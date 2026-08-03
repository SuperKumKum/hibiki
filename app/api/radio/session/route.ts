import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'hibiki_session_id'

/**
 * Resolves the caller's radio session
 *
 * @description Used by the client on load to validate a session restored from
 * localStorage. Creating and ending sessions goes through the server actions in
 * lib/actions/radio.ts, which own the session cookie; duplicating that here also exposed
 * an unauthenticated session-creation endpoint.
 */
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

    // Lightweight liveness refresh, no read-modify-write
    db.heartbeatSession(sessionId)

    return NextResponse.json(session)
  } catch (error) {
    console.error('Error getting session:', error)
    return NextResponse.json(
      { error: 'Failed to get session' },
      { status: 500 }
    )
  }
}
