import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET() {
  try {
    // Cleanup stale sessions first
    db.cleanupStaleSessions()

    // Get active sessions
    const sessions = db.getActiveSessions()

    // Return sessions without sensitive data
    const safeSessions = sessions.map(s => ({
      id: s.id,
      displayName: s.displayName,
      colorIndex: s.colorIndex,
      isAdmin: s.isAdmin
    }))

    return NextResponse.json(safeSessions)
  } catch (error) {
    console.error('Error fetching sessions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 }
    )
  }
}
