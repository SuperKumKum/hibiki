'use client'

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { playNotificationSound } from '@/lib/notification'
import { useAuth } from '@/components/AuthContext'
import { useToast } from '@/components/Toast'
import {
  createSession as createSessionAction,
  endSession as endSessionAction,
  removeFromQueue as removeFromQueueAction,
  voteSkip as voteSkipAction,
  voteForPlaylist as voteForPlaylistAction,
  play as playAction,
  pause as pauseAction,
  next as nextAction,
  seek as seekAction,
  toggleShuffle as toggleShuffleAction,
  activatePlaylist as activatePlaylistAction,
  clearQueue as clearQueueAction,
  playFromQueue as playFromQueueAction
} from '@/lib/actions/radio'

interface Song {
  id: string
  youtubeId: string
  title: string
  channelName: string
  thumbnail: string
  duration: number
}

interface Session {
  id: string
  displayName: string
  colorIndex: number
  isAdmin: boolean
  countsForVotes: boolean
  isMuted: boolean
}

interface RadioState {
  id: string
  isPlaying: boolean
  currentSongId: string | null
  currentPosition: number
  startedAt: number | null
  lastUpdatedAt: number
  calculatedPosition: number
  isShuffled: boolean
  activeRadioPlaylistId: string | null
}

interface RadioPlaylist {
  id: string
  name: string
  songCount?: number
}

interface PlaylistVoteStatus {
  [playlistId: string]: {
    count: number
    hasVoted: boolean
  }
}

interface QueueItem {
  id: string
  songId: string
  addedBy: string
  addedByName: string
  position: number
  song: Song
}

interface SkipVoteStatus {
  current: number
  required: number
  hasVoted: boolean
}

interface RadioContextType {
  session: Session | null
  radioState: RadioState | null
  currentSong: Song | null
  queue: QueueItem[]
  listeners: Session[]
  skipVotes: SkipVoteStatus
  playlistVotes: PlaylistVoteStatus
  isAdmin: boolean
  isConnected: boolean
  error: string | null
  activePlaylist: RadioPlaylist | null
  radioPlaylists: RadioPlaylist[]

  createSession: (displayName: string, colorIndex: number) => Promise<boolean>
  endSession: () => void
  addToQueue: (urlOrSongId: string, isUrl?: boolean) => Promise<boolean>
  removeFromQueue: (queueItemId: string) => Promise<boolean>
  voteSkip: () => Promise<boolean>
  voteForPlaylist: (playlistId: string) => Promise<boolean>
  play: () => Promise<void>
  pause: () => Promise<void>
  next: () => Promise<void>
  seek: (position: number) => Promise<void>
  toggleShuffle: () => Promise<void>
  fetchRadioPlaylists: () => Promise<void>
  activatePlaylist: (playlistId: string) => Promise<boolean>
  clearQueue: () => Promise<boolean>
  playFromQueue: (queueItemId: string) => Promise<boolean>
  // Optimistic update for listener properties (used by admin controls)
  updateListener: (listenerId: string, updates: Partial<Session>) => void
  // Clear pending update after API call completes
  clearPendingListenerUpdate: (listenerId: string) => void
}

const RadioContext = createContext<RadioContextType | undefined>(undefined)

const STORAGE_KEY = 'hibiki_radio_session'

export function RadioProvider({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  const { showToast } = useToast()
  const [session, setSession] = useState<Session | null>(null)
  const [radioState, setRadioState] = useState<RadioState | null>(null)
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [listeners, setListeners] = useState<Session[]>([])
  const [skipVotes, setSkipVotes] = useState<SkipVoteStatus>({ current: 0, required: 1, hasVoted: false })
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activePlaylist, setActivePlaylist] = useState<RadioPlaylist | null>(null)
  const [radioPlaylists, setRadioPlaylists] = useState<RadioPlaylist[]>([])
  const [playlistVotes, setPlaylistVotes] = useState<PlaylistVoteStatus>({})
  const prevSkipVotesRef = useRef<number>(-1)
  const prevPlaylistVotesRef = useRef<{ [key: string]: number }>({})
  // Track pending optimistic updates for listeners (to preserve during SSE updates)
  const pendingListenerUpdatesRef = useRef<Map<string, Partial<Session>>>(new Map())

  const getHeaders = useCallback((): Record<string, string> => {
    if (!session) return {}
    return { 'X-Session-ID': session.id }
  }, [session])

  // Restore session from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        // Validate session with server
        fetch('/api/radio/session', {
          headers: { 'X-Session-ID': parsed.id }
        }).then(res => {
          if (res.ok) {
            return res.json()
          }
          throw new Error('Session invalid')
        }).then(data => {
          setSession(data)
          setIsConnected(true)
        }).catch(() => {
          localStorage.removeItem(STORAGE_KEY)
        })
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
  }, [])

  // Session persistence: Don't disconnect on refresh, only on explicit leave or tab close
  // The heartbeat system (30s) and server cleanup (5min) handle stale sessions
  useEffect(() => {
    if (!session) return

    // We don't use beforeunload anymore because:
    // 1. Can't distinguish refresh from close
    // 2. Heartbeat + server cleanup handles stale sessions
    // 3. Better UX to keep session on refresh

    return () => {
      // Cleanup on unmount (but not on page unload)
    }
  }, [session])

  // SSE connection for real-time updates (replaces polling)
  useEffect(() => {
    if (!session) return

    let eventSource: EventSource | null = null
    let reconnectTimeout: NodeJS.Timeout | null = null

    const connect = () => {
      // Create EventSource with session header via URL (EventSource doesn't support custom headers)
      // We'll use a workaround: pass session ID as query param
      eventSource = new EventSource(`/api/radio/events?sessionId=${session.id}`)

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          setRadioState(data.radioState)
          setCurrentSong(data.currentSong)
          setSkipVotes(data.skipVotes)
          setQueue(data.queue || [])
          setActivePlaylist(data.activePlaylist || null)
          // Merge server listeners with pending optimistic updates
          const serverListeners = data.listeners || []
          const mergedListeners = serverListeners.map((listener: Session) => {
            const pendingUpdate = pendingListenerUpdatesRef.current.get(listener.id)
            if (pendingUpdate) {
              return { ...listener, ...pendingUpdate }
            }
            return listener
          })
          setListeners(mergedListeners)
          setPlaylistVotes(data.playlistVotes || {})
          setError(null)
        } catch (err) {
          console.error('[SSE] Error parsing message:', err)
        }
      }

      eventSource.onerror = () => {
        console.warn('[SSE] Connection error, reconnecting...')
        eventSource?.close()
        // Reconnect after 3 seconds
        reconnectTimeout = setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      eventSource?.close()
      if (reconnectTimeout) clearTimeout(reconnectTimeout)
    }
  }, [session])

  // Play notification sound and show toast when skip votes increase
  useEffect(() => {
    // Check for new skip votes (notify from first vote, but not on initial load)
    if (skipVotes.current > prevSkipVotesRef.current && prevSkipVotesRef.current !== -1) {
      // Don't notify if we just voted ourselves
      if (!skipVotes.hasVoted || skipVotes.current > 1) {
        playNotificationSound()
        showToast(`Vote to skip: ${skipVotes.current}/${skipVotes.required}`, 'info')
      }
    }
    // Initialize ref on first render (use -1 to distinguish from 0 votes)
    if (prevSkipVotesRef.current === -1 && skipVotes.current >= 0) {
      prevSkipVotesRef.current = skipVotes.current
    } else {
      prevSkipVotesRef.current = skipVotes.current
    }
  }, [skipVotes.current, skipVotes.required, skipVotes.hasVoted, showToast])

  // Play notification sound and show toast when playlist votes increase
  useEffect(() => {
    let notified = false
    for (const [playlistId, vote] of Object.entries(playlistVotes)) {
      const prevCount = prevPlaylistVotesRef.current[playlistId] ?? -1
      // Notify from first vote, but not on initial load
      if (vote.count > prevCount && prevCount !== -1 && !notified) {
        // Don't notify if we just voted ourselves
        if (!vote.hasVoted || vote.count > 1) {
          const playlist = radioPlaylists.find(p => p.id === playlistId)
          const playlistName = playlist?.name || 'playlist'
          playNotificationSound()
          showToast(`Vote for "${playlistName}": ${vote.count} vote(s)`, 'info')
          notified = true
        }
      }
    }
    // Update ref with current counts
    const newCounts: { [key: string]: number } = {}
    for (const [playlistId, vote] of Object.entries(playlistVotes)) {
      newCounts[playlistId] = vote.count
    }
    prevPlaylistVotesRef.current = newCounts
  }, [playlistVotes, radioPlaylists, showToast])

  const createSession = async (displayName: string, colorIndex: number): Promise<boolean> => {
    try {
      const result = await createSessionAction(displayName, colorIndex)

      if (result.success && result.data) {
        setSession(result.data)
        setIsConnected(true)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.data))
        return true
      }
      return false
    } catch (err) {
      console.error('Error creating session:', err)
      setError('Failed to join radio')
      return false
    }
  }

  const endSession = () => {
    if (session) {
      endSessionAction().catch(() => {})
    }
    setSession(null)
    setIsConnected(false)
    localStorage.removeItem(STORAGE_KEY)
  }


  const addToQueue = async (urlOrSongId: string, isUrl = true): Promise<boolean> => {
    try {
      const body = isUrl ? { url: urlOrSongId } : { songId: urlOrSongId }
      const res = await fetch('/api/radio/queue', {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        // Queue will update on next poll
        return true
      }
      return false
    } catch (err) {
      console.error('Error adding to queue:', err)
      return false
    }
  }

  const removeFromQueue = async (queueItemId: string): Promise<boolean> => {
    try {
      const result = await removeFromQueueAction(queueItemId)
      return result.success
    } catch (err) {
      console.error('Error removing from queue:', err)
      return false
    }
  }

  const voteSkip = async (): Promise<boolean> => {
    try {
      const result = await voteSkipAction()

      if (result.success && result.data) {
        setSkipVotes({
          current: result.data.current,
          required: result.data.required,
          hasVoted: true
        })
        return true
      }
      return false
    } catch (err) {
      console.error('Error voting to skip:', err)
      return false
    }
  }

  const voteForPlaylist = async (playlistId: string): Promise<boolean> => {
    try {
      const result = await voteForPlaylistAction(playlistId)

      if (result.success && result.data) {
        // Update local vote status
        setPlaylistVotes(prev => ({
          ...prev,
          [playlistId]: {
            count: result.data!.current,
            hasVoted: true
          }
        }))
        return true
      }
      return false
    } catch (err) {
      console.error('Error voting for playlist:', err)
      return false
    }
  }

  const play = async () => {
    // Optimistic update
    setRadioState(prev => prev ? { ...prev, isPlaying: true, startedAt: Date.now() } : prev)
    try {
      const result = await playAction()
      if (!result.success) {
        // Revert on error
        setRadioState(prev => prev ? { ...prev, isPlaying: false, startedAt: null } : prev)
        console.error('Error playing:', result.error)
      }
    } catch (err) {
      setRadioState(prev => prev ? { ...prev, isPlaying: false, startedAt: null } : prev)
      console.error('Error playing:', err)
    }
  }

  const pause = async () => {
    // Optimistic update
    const previousState = radioState
    setRadioState(prev => prev ? { ...prev, isPlaying: false, startedAt: null } : prev)
    try {
      const result = await pauseAction()
      if (!result.success) {
        // Revert on error
        setRadioState(previousState)
        console.error('Error pausing:', result.error)
      }
    } catch (err) {
      setRadioState(previousState)
      console.error('Error pausing:', err)
    }
  }

  const next = async () => {
    try {
      const result = await nextAction()
      if (!result.success) {
        console.error('Error skipping:', result.error)
      }
    } catch (err) {
      console.error('Error skipping:', err)
    }
  }

  const seek = async (position: number) => {
    // Optimistic update
    setRadioState(prev => prev ? { ...prev, currentPosition: position, startedAt: prev.isPlaying ? Date.now() : null } : prev)
    try {
      const result = await seekAction(position)
      if (!result.success) {
        console.error('Error seeking:', result.error)
      }
    } catch (err) {
      console.error('Error seeking:', err)
    }
  }

  const toggleShuffle = async () => {
    try {
      const result = await toggleShuffleAction()
      if (!result.success) {
        console.error('Error toggling shuffle:', result.error)
      }
    } catch (err) {
      console.error('Error toggling shuffle:', err)
    }
  }

  const fetchRadioPlaylists = useCallback(async () => {
    try {
      const res = await fetch('/api/radio/playlists', {
        headers: getHeaders()
      })
      if (res.ok) {
        const data = await res.json()
        setRadioPlaylists(data)
      }
    } catch (err) {
      console.error('Error fetching radio playlists:', err)
    }
  }, [getHeaders])

  const activatePlaylist = async (playlistId: string): Promise<boolean> => {
    try {
      const result = await activatePlaylistAction(playlistId)
      return result.success
    } catch (err) {
      console.error('Error activating playlist:', err)
      return false
    }
  }

  const clearQueue = async (): Promise<boolean> => {
    try {
      const result = await clearQueueAction()
      return result.success
    } catch (err) {
      console.error('Error clearing queue:', err)
      return false
    }
  }

  const playFromQueue = async (queueItemId: string): Promise<boolean> => {
    try {
      const result = await playFromQueueAction(queueItemId)
      return result.success
    } catch (err) {
      console.error('Error playing from queue:', err)
      return false
    }
  }

  // Optimistic update for listener properties (mute, vote status, etc.)
  // Also tracks the update so SSE won't overwrite it until cleared
  const updateListener = (listenerId: string, updates: Partial<Session>) => {
    // Track pending update to preserve during SSE updates
    const existing = pendingListenerUpdatesRef.current.get(listenerId) || {}
    pendingListenerUpdatesRef.current.set(listenerId, { ...existing, ...updates })

    setListeners(prev => prev.map(listener =>
      listener.id === listenerId
        ? { ...listener, ...updates }
        : listener
    ))
  }

  // Clear pending update after API call completes (success or failure)
  const clearPendingListenerUpdate = (listenerId: string) => {
    pendingListenerUpdatesRef.current.delete(listenerId)
  }

  return (
    <RadioContext.Provider
      value={{
        session,
        radioState,
        currentSong,
        queue,
        listeners,
        skipVotes,
        playlistVotes,
        isAdmin,
        isConnected,
        error,
        activePlaylist,
        radioPlaylists,
        createSession,
        endSession,
        addToQueue,
        removeFromQueue,
        voteSkip,
        voteForPlaylist,
        play,
        pause,
        next,
        seek,
        toggleShuffle,
        fetchRadioPlaylists,
        activatePlaylist,
        clearQueue,
        playFromQueue,
        updateListener,
        clearPendingListenerUpdate
      }}
    >
      {children}
    </RadioContext.Provider>
  )
}

export function useRadio() {
  const context = useContext(RadioContext)
  if (context === undefined) {
    throw new Error('useRadio must be used within a RadioProvider')
  }
  return context
}
