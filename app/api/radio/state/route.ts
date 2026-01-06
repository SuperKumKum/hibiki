import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Track last cleanup time
let lastCleanupTime = 0
const CLEANUP_INTERVAL = 60 * 1000 // 1 minute

function calculateCurrentPosition(state: {
  isPlaying: boolean
  currentPosition: number
  startedAt: number | null
}): number {
  if (!state.isPlaying || !state.startedAt) {
    return state.currentPosition
  }
  const elapsed = (Date.now() - state.startedAt) / 1000
  return state.currentPosition + elapsed
}

export async function GET(request: NextRequest) {
  try {
    // Periodic maintenance (backup + cleanup)
    const now = Date.now()
    if (now - lastCleanupTime > CLEANUP_INTERVAL) {
      lastCleanupTime = now
      try {
        db.createBackup()
        db.cleanupStaleSessions()
      } catch (error) {
        console.error('[Radio State] Maintenance error:', error)
      }
    }

    const sessionId = request.headers.get('X-Session-ID')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 401 }
      )
    }

    const session = db.getSessionById(sessionId)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Update heartbeat
    db.updateSession(sessionId, { lastSeenAt: Date.now(), isActive: true })

    // Get radio state
    let radioState = db.getRadioState()

    // Initialize if null
    if (!radioState) {
      radioState = db.updateRadioState({
        id: 'main',
        isPlaying: false,
        currentSongId: null,
        currentPosition: 0,
        startedAt: null
      })
    }

    // Get current song details
    let currentSong = null
    if (radioState.currentSongId) {
      currentSong = db.getSongById(radioState.currentSongId)
    }

    // AUTO-ADVANCE: Check if current song should have ended
    if (radioState.isPlaying && radioState.startedAt && currentSong) {
      const expectedEndTime = radioState.startedAt + (currentSong.duration * 1000)
      const now = Date.now()

      // Add 2-second buffer to account for timing variations
      if (now > expectedEndTime + 2000) {
        // Song should have ended - auto-advance to next
        db.clearSkipVotesForSong(radioState.currentSongId!)

        // Try queue first
        const nextItem = db.getNextQueueItem()
        if (nextItem?.song) {
          db.markQueueItemPlayed(nextItem.id)
          db.updateRadioState({
            isPlaying: true,
            currentSongId: nextItem.song.id,
            currentPosition: 0,
            startedAt: Date.now()
          })
          currentSong = nextItem.song
        } else {
          // Fall back to playlist
          const playlistSong = db.getNextRadioPlaylistSong()
          if (playlistSong?.song) {
            db.updateRadioState({
              isPlaying: true,
              currentSongId: playlistSong.song.id,
              currentPosition: 0,
              startedAt: Date.now()
            })
            currentSong = playlistSong.song
          } else {
            // No more songs - stop playback
            db.updateRadioState({
              isPlaying: false,
              currentSongId: null,
              currentPosition: 0,
              startedAt: null
            })
            currentSong = null
          }
        }
        // Refresh radio state after update
        radioState = db.getRadioState()!
      }
    }

    // Get skip vote status
    const activeListeners = db.getActiveSessions().length
    const votesNeeded = Math.max(1, Math.floor(activeListeners / 2) + 1)
    let currentVotes = 0
    let hasVoted = false

    if (radioState.currentSongId) {
      const votes = db.getSkipVotesForSong(radioState.currentSongId)
      currentVotes = votes.length
      hasVoted = votes.some(v => v.sessionId === sessionId)
    }

    // Get queue
    const queue = db.getRadioQueue()

    // Get active radio playlist info
    let activePlaylist = null
    if (radioState.activeRadioPlaylistId) {
      activePlaylist = db.getRadioPlaylistById(radioState.activeRadioPlaylistId)
    }

    return NextResponse.json({
      radioState: {
        ...radioState,
        calculatedPosition: calculateCurrentPosition(radioState)
      },
      currentSong,
      skipVotes: {
        current: currentVotes,
        required: votesNeeded,
        hasVoted
      },
      listeners: activeListeners,
      queue,
      activePlaylist,
      serverTime: Date.now()
    })
  } catch (error) {
    console.error('Error getting radio state:', error)
    return NextResponse.json(
      { error: 'Failed to get radio state' },
      { status: 500 }
    )
  }
}
