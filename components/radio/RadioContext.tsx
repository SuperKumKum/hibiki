'use client'

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react'

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
  authenticate: (password: string) => Promise<boolean>
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
}

const RadioContext = createContext<RadioContextType | undefined>(undefined)

const STORAGE_KEY = 'hibiki_radio_session'

const POLL_INTERVALS = {
  RADIO_STATE: 2000,
  HEARTBEAT: 30000
}

export function RadioProvider({ children }: { children: ReactNode }) {
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

  // End session when user closes/leaves the page
  useEffect(() => {
    if (!session) return

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery when page is closing
      navigator.sendBeacon(
        '/api/radio/session/leave',
        JSON.stringify({ sessionId: session.id })
      )
      localStorage.removeItem(STORAGE_KEY)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Page is being hidden (tab switch, minimize, or close)
        // Send beacon to mark session as potentially leaving
        navigator.sendBeacon(
          '/api/radio/session/leave',
          JSON.stringify({ sessionId: session.id })
        )
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    // Note: visibilitychange is commented out as it would disconnect on tab switch
    // Uncomment if you want more aggressive disconnection
    // document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      // document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [session])

  // Poll for radio state
  useEffect(() => {
    if (!session) return

    const pollState = async () => {
      try {
        const res = await fetch('/api/radio/state', {
          headers: getHeaders()
        })
        if (res.ok) {
          const data = await res.json()
          setRadioState(data.radioState)
          setCurrentSong(data.currentSong)
          setSkipVotes(data.skipVotes)
          setQueue(data.queue || [])
          setActivePlaylist(data.activePlaylist || null)
          setError(null)
        }
      } catch (err) {
        console.error('Error polling state:', err)
      }
    }

    pollState()
    const interval = setInterval(pollState, POLL_INTERVALS.RADIO_STATE)

    return () => clearInterval(interval)
  }, [session, getHeaders])

  // Poll for listeners and playlist votes (less frequent)
  useEffect(() => {
    if (!session) return

    const pollListenersAndVotes = async () => {
      try {
        const [listenersRes, votesRes] = await Promise.all([
          fetch('/api/radio/sessions'),
          fetch('/api/radio/playlist-vote', { headers: getHeaders() })
        ])

        if (listenersRes.ok) {
          const data = await listenersRes.json()
          setListeners(data)
        }

        if (votesRes.ok) {
          const data = await votesRes.json()
          setPlaylistVotes(data.votes || {})
        }
      } catch (err) {
        console.error('Error polling listeners/votes:', err)
      }
    }

    pollListenersAndVotes()
    const interval = setInterval(pollListenersAndVotes, 5000)

    return () => clearInterval(interval)
  }, [session, getHeaders])

  // Heartbeat
  useEffect(() => {
    if (!session) return

    const heartbeat = async () => {
      try {
        await fetch('/api/radio/session/heartbeat', {
          method: 'POST',
          headers: getHeaders()
        })
      } catch (err) {
        console.error('Heartbeat failed:', err)
      }
    }

    const interval = setInterval(heartbeat, POLL_INTERVALS.HEARTBEAT)

    return () => clearInterval(interval)
  }, [session, getHeaders])

  const createSession = async (displayName: string, colorIndex: number): Promise<boolean> => {
    try {
      const res = await fetch('/api/radio/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, colorIndex })
      })

      if (res.ok) {
        const data = await res.json()
        setSession(data)
        setIsConnected(true)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
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
      fetch('/api/radio/session', {
        method: 'DELETE',
        headers: getHeaders()
      }).catch(() => {})
    }
    setSession(null)
    setIsConnected(false)
    localStorage.removeItem(STORAGE_KEY)
  }

  const authenticate = async (password: string): Promise<boolean> => {
    try {
      const res = await fetch('/api/radio/admin/auth', {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ password })
      })

      if (res.ok) {
        const data = await res.json()
        setSession(data.session)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data.session))
        return true
      }
      return false
    } catch (err) {
      console.error('Error authenticating:', err)
      return false
    }
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
      const res = await fetch(`/api/radio/queue/${queueItemId}`, {
        method: 'DELETE',
        headers: getHeaders()
      })
      return res.ok
    } catch (err) {
      console.error('Error removing from queue:', err)
      return false
    }
  }

  const voteSkip = async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/radio/skip', {
        method: 'POST',
        headers: getHeaders()
      })

      if (res.ok) {
        const data = await res.json()
        setSkipVotes({
          current: data.current,
          required: data.required,
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
      const res = await fetch('/api/radio/playlist-vote', {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ playlistId })
      })

      if (res.ok) {
        const data = await res.json()
        // Update local vote status
        setPlaylistVotes(prev => ({
          ...prev,
          [playlistId]: {
            count: data.current,
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
    try {
      await fetch('/api/radio/control/play', {
        method: 'POST',
        headers: getHeaders()
      })
    } catch (err) {
      console.error('Error playing:', err)
    }
  }

  const pause = async () => {
    try {
      await fetch('/api/radio/control/pause', {
        method: 'POST',
        headers: getHeaders()
      })
    } catch (err) {
      console.error('Error pausing:', err)
    }
  }

  const next = async () => {
    try {
      await fetch('/api/radio/control/next', {
        method: 'POST',
        headers: getHeaders()
      })
    } catch (err) {
      console.error('Error skipping:', err)
    }
  }

  const seek = async (position: number) => {
    try {
      await fetch('/api/radio/control/seek', {
        method: 'POST',
        headers: {
          ...getHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ position })
      })
    } catch (err) {
      console.error('Error seeking:', err)
    }
  }

  const toggleShuffle = async () => {
    try {
      await fetch('/api/radio/shuffle', {
        method: 'POST',
        headers: getHeaders()
      })
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
      const res = await fetch(`/api/radio/playlists/${playlistId}/activate`, {
        method: 'POST',
        headers: getHeaders()
      })
      return res.ok
    } catch (err) {
      console.error('Error activating playlist:', err)
      return false
    }
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
        isAdmin: session?.isAdmin ?? false,
        isConnected,
        error,
        activePlaylist,
        radioPlaylists,
        createSession,
        endSession,
        authenticate,
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
        activatePlaylist
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
