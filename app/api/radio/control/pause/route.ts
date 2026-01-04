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

    if (!session.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const radioState = db.getRadioState()

    if (!radioState) {
      return NextResponse.json(
        { error: 'No radio state' },
        { status: 400 }
      )
    }

    // Calculate current position before pausing
    const currentPosition = calculateCurrentPosition(radioState)

    db.updateRadioState({
      isPlaying: false,
      currentPosition,
      startedAt: null
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error pausing:', error)
    return NextResponse.json(
      { error: 'Failed to pause' },
      { status: 500 }
    )
  }
}
