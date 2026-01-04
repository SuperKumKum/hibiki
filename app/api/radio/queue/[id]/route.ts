import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = request.headers.get('X-Session-ID')
    const { id } = await params

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

    const queueItem = db.getRadioQueueItem(id)
    if (!queueItem) {
      return NextResponse.json(
        { error: 'Queue item not found' },
        { status: 404 }
      )
    }

    // Only admin or the person who added can remove
    if (!session.isAdmin && queueItem.addedBy !== session.id) {
      return NextResponse.json(
        { error: 'Not authorized to remove this item' },
        { status: 403 }
      )
    }

    db.removeFromRadioQueue(id)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing from queue:', error)
    return NextResponse.json(
      { error: 'Failed to remove from queue' },
      { status: 500 }
    )
  }
}
