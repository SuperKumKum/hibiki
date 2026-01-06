import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
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

    // Sync local audio files with database
    db.syncLocalAudioFiles()

    // Get library playlists (from /playlists page) with local counts
    const playlists = db.getPlaylists().map(p => {
      const localInfo = db.getPlaylistLocalCount(p.id)
      return {
        ...p,
        songCount: localInfo.total,
        localCount: localInfo.local
      }
    })

    return NextResponse.json(playlists)
  } catch (error) {
    console.error('Error getting playlists:', error)
    return NextResponse.json(
      { error: 'Failed to get playlists' },
      { status: 500 }
    )
  }
}
