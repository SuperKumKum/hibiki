import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    // sendBeacon sends data as text/plain by default
    const text = await request.text()
    const { sessionId } = JSON.parse(text)

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      )
    }

    // Mark session as inactive
    db.deactivateSession(sessionId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error handling session leave:', error)
    return NextResponse.json(
      { error: 'Failed to process leave' },
      { status: 500 }
    )
  }
}
