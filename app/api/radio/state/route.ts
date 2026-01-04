import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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
