import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

// Toggle vote status for a session (admin only)
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
    const { countsForVotes } = await request.json()

    if (typeof countsForVotes !== 'boolean') {
      return NextResponse.json(
        { error: 'countsForVotes must be a boolean' },
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

    const updatedSession = db.updateSession(id, { countsForVotes })

    return NextResponse.json({
      success: true,
      session: updatedSession
    })
  } catch (error) {
    console.error('Error updating session vote status:', error)
    return NextResponse.json(
      { error: 'Failed to update vote status' },
      { status: 500 }
    )
  }
}
