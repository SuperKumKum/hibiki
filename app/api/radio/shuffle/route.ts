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

    const radioState = db.toggleShuffle()

    return NextResponse.json({
      success: true,
      isShuffled: radioState.isShuffled
    })
  } catch (error) {
    console.error('Error toggling shuffle:', error)
    return NextResponse.json(
      { error: 'Failed to toggle shuffle' },
      { status: 500 }
    )
  }
}
