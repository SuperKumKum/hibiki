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

    // Use atomic transaction to advance to next song
    const result = db.advanceToNextSong()

    if (result.currentSong) {
      return NextResponse.json({
        success: true,
        song: result.currentSong
      })
    }

    return NextResponse.json({ success: true, ended: true })
  } catch (error) {
    console.error('Error skipping to next:', error)
    return NextResponse.json(
      { error: 'Failed to skip to next' },
      { status: 500 }
    )
  }
}
