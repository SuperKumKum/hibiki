import { NextRequest } from 'next/server'
import { db } from '@/lib/db'

// SSE endpoint for real-time radio updates
// Replaces multiple polling endpoints with a single persistent connection

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
  // EventSource doesn't support custom headers, so we use query param
  const sessionId = request.nextUrl.searchParams.get('sessionId')

  if (!sessionId) {
    return new Response('Session ID required', { status: 401 })
  }

  const session = db.getSessionById(sessionId)
  if (!session) {
    return new Response('Session not found', { status: 404 })
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      // Send initial data immediately
      const sendUpdate = () => {
        try {
          // Update heartbeat (using lightweight method to reduce DB lock time)
          db.heartbeatSession(sessionId)

          // Get radio state
          let radioState = db.getRadioState()
          if (!radioState) {
            radioState = db.updateRadioState({
              id: 'main',
              isPlaying: false,
              currentSongId: null,
              currentPosition: 0,
              startedAt: null
            })
          }

          // Get current song
          let currentSong = null
          if (radioState.currentSongId) {
            currentSong = db.getSongById(radioState.currentSongId)
          }

          // Auto-advance check - uses atomic transaction to prevent lock contention
          if (radioState.isPlaying && radioState.startedAt && currentSong) {
            const expectedEndTime = radioState.startedAt + (currentSong.duration * 1000)
            if (Date.now() > expectedEndTime + 2000) {
              const result = db.advanceToNextSong()
              radioState = result.radioState
              currentSong = result.currentSong
            }
          }

          // Get skip votes
          const activeListeners = db.getActiveSessions()
          const votesNeeded = Math.max(1, Math.floor(activeListeners.length / 2) + 1)
          let currentVotes = 0
          let hasVotedSkip = false
          if (radioState.currentSongId) {
            const votes = db.getSkipVotesForSong(radioState.currentSongId)
            currentVotes = votes.length
            hasVotedSkip = votes.some(v => v.sessionId === sessionId)
          }

          // Get queue
          const queue = db.getRadioQueue()

          // Get active playlist
          let activePlaylist = null
          if (radioState.activeRadioPlaylistId) {
            activePlaylist = db.getPlaylistById(radioState.activeRadioPlaylistId)
          }

          // Get playlist votes
          const allPlaylistVotes = db.getAllPlaylistVotes()
          const playlistVotes: { [key: string]: { count: number; hasVoted: boolean } } = {}
          const playlists = db.getPlaylists()
          for (const playlist of playlists) {
            const votes = allPlaylistVotes.filter(v => v.playlistId === playlist.id)
            const activeVotes = votes.filter(v =>
              activeListeners.some(s => s.id === v.sessionId)
            )
            playlistVotes[playlist.id] = {
              count: activeVotes.length,
              hasVoted: votes.some(v => v.sessionId === sessionId)
            }
          }

          const data = {
            radioState: {
              ...radioState,
              calculatedPosition: calculateCurrentPosition(radioState)
            },
            currentSong,
            skipVotes: {
              current: currentVotes,
              required: votesNeeded,
              hasVoted: hasVotedSkip
            },
            listeners: activeListeners,
            queue,
            activePlaylist,
            playlistVotes,
            serverTime: Date.now()
          }

          // Send SSE formatted data
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        } catch (error) {
          console.error('[SSE] Error sending update:', error)
        }
      }

      // Send initial update
      sendUpdate()

      // Send updates every 5 seconds (reduced from 2s to prevent database lock contention)
      const interval = setInterval(sendUpdate, 5000)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        clearInterval(interval)
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no' // Disable buffering for nginx
    }
  })
}
