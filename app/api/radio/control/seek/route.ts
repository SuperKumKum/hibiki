import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    const { position } = await request.json()

    if (typeof position !== 'number' || position < 0) {
      return NextResponse.json(
        { error: 'Valid position required' },
        { status: 400 }
      )
    }

    const radioState = db.getRadioState()

    if (!radioState?.currentSongId) {
      return NextResponse.json(
        { error: 'No song playing' },
        { status: 400 }
      )
    }

    db.updateRadioState({
      currentPosition: position,
      startedAt: radioState.isPlaying ? Date.now() : null
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error seeking:', error)
    return NextResponse.json(
      { error: 'Failed to seek' },
      { status: 500 }
    )
  }
}
