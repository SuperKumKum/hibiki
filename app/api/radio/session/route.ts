import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'hibiki_session_id'

export async function POST(request: NextRequest) {
  try {
    const { displayName, colorIndex } = await request.json()

    if (!displayName || typeof displayName !== 'string') {
      return NextResponse.json(
        { error: 'Display name is required' },
        { status: 400 }
      )
    }

    const color = typeof colorIndex === 'number' ? colorIndex % 8 : 0
    const session = db.createSession(displayName.trim().slice(0, 20), color)

    // Set session cookie for server actions
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error creating session:', error)
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check header first, then fallback to cookie
    let sessionId = request.headers.get('X-Session-ID')

    if (!sessionId) {
      const cookieStore = await cookies()
      sessionId = cookieStore.get(SESSION_COOKIE)?.value || null
    }

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

    // Update last seen
    db.updateSession(sessionId, { lastSeenAt: Date.now(), isActive: true })

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error getting session:', error)
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check header first, then fallback to cookie
    let sessionId = request.headers.get('X-Session-ID')

    if (!sessionId) {
      const cookieStore = await cookies()
      sessionId = cookieStore.get(SESSION_COOKIE)?.value || null
    }

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 401 }
      )
    }

    db.deleteSession(sessionId)

    // Clear session cookie
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting session:', error)
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    )
  }
}
