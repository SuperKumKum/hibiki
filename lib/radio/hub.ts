import { db, type Session, type Song, type RadioState } from '@/lib/db'

/**
 * Authoritative radio ticker and broadcast hub
 *
 * @description Single source of truth for radio progression. Replaces the previous
 * design where every connected SSE client ran its own interval, duplicated all state
 * queries and independently triggered auto-advance (which consumed one queue item per
 * connected listener at each end of song). Exactly one timer runs per process: it
 * advances the radio, builds the state snapshot once, then fans it out to every
 * subscriber. Database work is now O(1) per tick instead of O(listeners).
 *
 * @example
 * // In an SSE route handler
 * const unsubscribe = radioHub.subscribe(sessionId, payload => send(payload))
 * request.signal.addEventListener('abort', unsubscribe)
 *
 * @example
 * // In a server action, after mutating radio state
 * notifyRadioChanged()
 */

/** Broadcast cadence. Keeps client drift correction (3s threshold) responsive. */
const TICK_INTERVAL_MS = 2000

/** How often subscriber sessions are refreshed in the database. */
const HEARTBEAT_INTERVAL_MS = 15000

/** How often stale sessions are marked inactive and purged. */
const CLEANUP_INTERVAL_MS = 60000

/** Grace period after a song's expected end before auto-advancing. */
const AUTO_ADVANCE_GRACE_MS = 2000

/** Coalescing window for explicit change notifications. */
const NOTIFY_DEBOUNCE_MS = 50

/** Per-session vote state, resolved from the shared snapshot. */
interface SkipVoteStatus {
  current: number
  required: number
  hasVoted: boolean
}

/** Vote tallies for a single playlist. */
interface PlaylistVoteTally {
  count: number
  voterIds: Set<string>
}

/** Shared state computed once per tick, before per-session personalization. */
interface RadioSnapshot {
  radioState: RadioState & { calculatedPosition: number }
  currentSong: Song | null
  listeners: Session[]
  queue: ReturnType<typeof db.getRadioQueue>
  activePlaylist: ReturnType<typeof db.getPlaylistById> | null
  votesRequired: number
  skipVoteCount: number
  /** Every session that voted, including non-voters, so each client sees its own vote. */
  skipVoterIds: Set<string>
  playlistVotes: Record<string, PlaylistVoteTally>
  serverTime: number
}

/** Payload delivered to a single subscriber. Shape matches the previous SSE contract. */
export interface RadioSessionPayload {
  radioState: RadioState & { calculatedPosition: number }
  currentSong: Song | null
  listeners: Session[]
  queue: RadioSnapshot['queue']
  activePlaylist: RadioSnapshot['activePlaylist']
  skipVotes: SkipVoteStatus
  playlistVotes: Record<string, { count: number; hasVoted: boolean }>
  serverTime: number
}

interface Subscriber {
  sessionId: string
  send: (payload: RadioSessionPayload) => void
}

/**
 * Computes the elapsed playback position from the authoritative start timestamp
 *
 * @param state Radio state carrying playback flags and start time
 * @returns Position in seconds
 */
function calculateCurrentPosition(state: {
  isPlaying: boolean
  currentPosition: number
  startedAt: number | null
}): number {
  if (!state.isPlaying || !state.startedAt) {
    return state.currentPosition
  }
  return state.currentPosition + (Date.now() - state.startedAt) / 1000
}

class RadioHub {
  private subscribers = new Set<Subscriber>()
  private timer: NodeJS.Timeout | null = null
  private pendingNotify: NodeJS.Timeout | null = null
  private lastSnapshot: RadioSnapshot | null = null
  private lastSnapshotAt = 0
  private lastHeartbeatAt = 0
  private lastCleanupAt = 0

  /**
   * Registers a subscriber and delivers an immediate snapshot
   *
   * @param sessionId Session the payload is personalized for
   * @param send Callback invoked with each new payload
   * @returns Unsubscribe function, safe to call more than once
   */
  subscribe(sessionId: string, send: (payload: RadioSessionPayload) => void): () => void {
    const subscriber: Subscriber = { sessionId, send }
    this.subscribers.add(subscriber)
    this.start()

    // Reuse the current snapshot when it is still fresh, so a burst of joining
    // clients does not trigger a burst of identical database reads.
    const snapshot =
      this.lastSnapshot && Date.now() - this.lastSnapshotAt < TICK_INTERVAL_MS
        ? this.lastSnapshot
        : this.buildSnapshot()

    this.deliver(subscriber, snapshot)

    return () => {
      this.subscribers.delete(subscriber)
      if (this.subscribers.size === 0) {
        this.stop()
      }
    }
  }

  /**
   * Requests an out-of-band broadcast after an external state mutation
   *
   * @description Debounced so that a server action performing several writes
   * results in a single broadcast, and so the broadcast reads the database only
   * once the calling action has committed.
   */
  notifyChanged(): void {
    if (this.subscribers.size === 0 || this.pendingNotify) return

    this.pendingNotify = setTimeout(() => {
      this.pendingNotify = null
      this.tick()
    }, NOTIFY_DEBOUNCE_MS)
    this.pendingNotify.unref?.()
  }

  /** Number of live subscribers, exposed for diagnostics. */
  getSubscriberCount(): number {
    return this.subscribers.size
  }

  private start(): void {
    if (this.timer) return
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS)
    this.timer.unref?.()
  }

  private stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    if (this.pendingNotify) {
      clearTimeout(this.pendingNotify)
      this.pendingNotify = null
    }
    this.lastSnapshot = null
  }

  /**
   * Runs one cycle: maintenance, auto-advance, snapshot, broadcast
   *
   * @description Never rethrows. An unhandled failure here would surface as an
   * uncaught exception on the event loop and could take the process down.
   */
  private tick(): void {
    if (this.subscribers.size === 0) {
      this.stop()
      return
    }

    try {
      this.runMaintenance()
      const snapshot = this.buildSnapshot()
      for (const subscriber of [...this.subscribers]) {
        this.deliver(subscriber, snapshot)
      }
    } catch (error) {
      console.error('[RadioHub] Tick failed:', error)
    }
  }

  /** Refreshes subscriber liveness and purges stale sessions on their own cadences. */
  private runMaintenance(): void {
    const now = Date.now()

    if (now - this.lastHeartbeatAt >= HEARTBEAT_INTERVAL_MS) {
      this.lastHeartbeatAt = now
      const sessionIds = [...new Set([...this.subscribers].map(s => s.sessionId))]
      db.heartbeatSessions(sessionIds)
    }

    if (now - this.lastCleanupAt >= CLEANUP_INTERVAL_MS) {
      this.lastCleanupAt = now
      db.cleanupStaleSessions()
    }
  }

  /** Reads all shared radio state in a single pass and advances the song if it ended. */
  private buildSnapshot(): RadioSnapshot {
    let radioState = db.getRadioState() ?? db.updateRadioState({})
    let currentSong = radioState.currentSongId
      ? db.getSongById(radioState.currentSongId) ?? null
      : null

    // Auto-advance. The observed song id is passed as a compare-and-swap token so a
    // concurrent skip vote and this tick can never consume two queue items.
    if (radioState.isPlaying && radioState.startedAt && currentSong) {
      const expectedEndAt = radioState.startedAt + currentSong.duration * 1000
      if (Date.now() > expectedEndAt + AUTO_ADVANCE_GRACE_MS) {
        const result = db.advanceToNextSong({ expectedSongId: currentSong.id })
        radioState = result.radioState
        currentSong = result.currentSong
      }
    }

    const listeners = db.getActiveSessions()
    const eligibleVoterIds = new Set(listeners.filter(s => s.countsForVotes).map(s => s.id))
    const votesRequired = Math.max(1, Math.floor(eligibleVoterIds.size / 2) + 1)

    // Tally skip votes. Only eligible voters count toward the threshold, but every
    // voter is tracked so each client can still see that it already voted.
    const skipVoterIds = new Set<string>()
    let skipVoteCount = 0
    if (radioState.currentSongId) {
      for (const vote of db.getSkipVotesForSong(radioState.currentSongId)) {
        skipVoterIds.add(vote.sessionId)
        if (eligibleVoterIds.has(vote.sessionId)) skipVoteCount++
      }
    }

    const playlistVotes: Record<string, PlaylistVoteTally> = {}
    for (const vote of db.getAllPlaylistVotes()) {
      const tally = (playlistVotes[vote.playlistId] ??= { count: 0, voterIds: new Set() })
      tally.voterIds.add(vote.sessionId)
      if (eligibleVoterIds.has(vote.sessionId)) tally.count++
    }

    const snapshot: RadioSnapshot = {
      radioState: { ...radioState, calculatedPosition: calculateCurrentPosition(radioState) },
      currentSong,
      listeners,
      queue: db.getRadioQueue(),
      activePlaylist: radioState.activeRadioPlaylistId
        ? db.getPlaylistById(radioState.activeRadioPlaylistId) ?? null
        : null,
      votesRequired,
      skipVoteCount,
      skipVoterIds,
      playlistVotes,
      serverTime: Date.now()
    }

    this.lastSnapshot = snapshot
    this.lastSnapshotAt = snapshot.serverTime
    return snapshot
  }

  /** Sends a snapshot to one subscriber, dropping it if its stream is gone. */
  private deliver(subscriber: Subscriber, snapshot: RadioSnapshot): void {
    try {
      subscriber.send(this.personalize(snapshot, subscriber.sessionId))
    } catch {
      this.subscribers.delete(subscriber)
      if (this.subscribers.size === 0) this.stop()
    }
  }

  /** Resolves the shared snapshot into one session's view of the vote state. */
  private personalize(snapshot: RadioSnapshot, sessionId: string): RadioSessionPayload {
    const playlistVotes: Record<string, { count: number; hasVoted: boolean }> = {}
    for (const [playlistId, tally] of Object.entries(snapshot.playlistVotes)) {
      playlistVotes[playlistId] = {
        count: tally.count,
        hasVoted: tally.voterIds.has(sessionId)
      }
    }

    return {
      radioState: snapshot.radioState,
      currentSong: snapshot.currentSong,
      listeners: snapshot.listeners,
      queue: snapshot.queue,
      activePlaylist: snapshot.activePlaylist,
      skipVotes: {
        current: snapshot.skipVoteCount,
        required: snapshot.votesRequired,
        hasVoted: snapshot.skipVoterIds.has(sessionId)
      },
      playlistVotes,
      serverTime: snapshot.serverTime
    }
  }
}

/**
 * Process-wide hub instance
 *
 * @description Pinned to globalThis so route bundles and dev-mode hot reloads share
 * one instance. A duplicated hub would mean duplicated tickers, which is precisely
 * the double-advance bug this module exists to remove.
 */
const globalForRadioHub = globalThis as typeof globalThis & { __hibikiRadioHub?: RadioHub }

export const radioHub: RadioHub = (globalForRadioHub.__hibikiRadioHub ??= new RadioHub())

/**
 * Broadcasts radio state to all listeners after a mutation
 *
 * @description Call at the end of any action that changes playback, queue, votes or
 * sessions. No-op when nobody is connected.
 */
export function notifyRadioChanged(): void {
  radioHub.notifyChanged()
}
