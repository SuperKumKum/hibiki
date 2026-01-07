import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// Use atomic transaction from db module
function skipToNextSong() {
  const result = db.advanceToNextSong()
  return result.currentSong
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

    const radioState = db.getRadioState()
    if (!radioState?.currentSongId) {
      return NextResponse.json({
        current: 0,
        required: 1,
        hasVoted: false
      })
    }

    const activeVoters = db.getActiveVoters().length
    const votesNeeded = Math.max(1, Math.floor(activeVoters / 2) + 1)
    const votes = db.getSkipVotesForSong(radioState.currentSongId)
    const hasVoted = votes.some(v => v.sessionId === sessionId)

    return NextResponse.json({
      current: votes.length,
      required: votesNeeded,
      hasVoted
    })
  } catch (error) {
    console.error('Error getting skip votes:', error)
    return NextResponse.json(
      { error: 'Failed to get skip votes' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
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

    const radioState = db.getRadioState()
    if (!radioState?.currentSongId) {
      return NextResponse.json(
        { error: 'No song playing' },
        { status: 400 }
      )
    }

    // Check if already voted
    const existingVote = db.getSkipVote(sessionId, radioState.currentSongId)
    if (existingVote) {
      return NextResponse.json(
        { error: 'Already voted to skip' },
        { status: 400 }
      )
    }

    // Create vote
    db.createSkipVote(sessionId, radioState.currentSongId)

    // Check if threshold met (only count users who can vote)
    const activeVoters = db.getActiveVoters().length
    const votesNeeded = Math.max(1, Math.floor(activeVoters / 2) + 1)
    const currentVotes = db.getSkipVotesForSong(radioState.currentSongId).length

    let skipped = false
    let nextSong = null

    if (currentVotes >= votesNeeded) {
      nextSong = skipToNextSong()
      skipped = true
    }

    return NextResponse.json({
      success: true,
      current: skipped ? 0 : currentVotes,
      required: votesNeeded,
      skipped,
      nextSong
    })
  } catch (error) {
    console.error('Error voting to skip:', error)
    return NextResponse.json(
      { error: 'Failed to vote' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
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

    const radioState = db.getRadioState()
    if (!radioState?.currentSongId) {
      return NextResponse.json({ success: true })
    }

    db.removeSkipVote(sessionId, radioState.currentSongId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing skip vote:', error)
    return NextResponse.json(
      { error: 'Failed to remove vote' },
      { status: 500 }
    )
  }
}
