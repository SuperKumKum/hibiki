import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Update session settings (admin only)
// Supports: countsForVotes, isMuted
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check admin auth
    const adminToken = request.cookies.get('hibiki_admin_token')?.value
    if (!adminToken || !verifyToken(adminToken)?.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { countsForVotes, isMuted } = body

    // Validate at least one field is provided
    if (countsForVotes === undefined && isMuted === undefined) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    // Validate field types
    if (countsForVotes !== undefined && typeof countsForVotes !== 'boolean') {
      return NextResponse.json(
        { error: 'countsForVotes must be a boolean' },
        { status: 400 }
      )
    }
    if (isMuted !== undefined && typeof isMuted !== 'boolean') {
      return NextResponse.json(
        { error: 'isMuted must be a boolean' },
        { status: 400 }
      )
    }

    const session = db.getSessionById(id)
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      )
    }

    // Build updates object
    const updates: { countsForVotes?: boolean; isMuted?: boolean } = {}
    if (countsForVotes !== undefined) updates.countsForVotes = countsForVotes
    if (isMuted !== undefined) updates.isMuted = isMuted

    const updatedSession = db.updateSession(id, updates)

    return NextResponse.json({
      success: true,
      session: updatedSession
    })
  } catch (error) {
    console.error('Error updating session:', error)
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    )
  }
}
