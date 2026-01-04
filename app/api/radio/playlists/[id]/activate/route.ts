import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
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

    if (!session.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Check library playlists
    const playlist = db.getPlaylistById(id)
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      )
    }

    // Get songs from the playlist
    const playlistSongs = db.getPlaylistSongs(id)

    if (playlistSongs.length === 0) {
      return NextResponse.json(
        { error: 'Playlist is empty' },
        { status: 400 }
      )
    }

    // Clear the current queue
    db.clearRadioQueue()

    // Add all songs from the playlist to the queue
    for (const ps of playlistSongs) {
      const song = db.getSongById(ps.songId)
      if (song) {
        db.addToRadioQueue(song.id, session.id, session.displayName)
      }
    }

    // Set the active playlist
    const radioState = db.setActiveRadioPlaylist(id)

    return NextResponse.json({
      success: true,
      radioState,
      songsAdded: playlistSongs.length
    })
  } catch (error) {
    console.error('Error activating playlist:', error)
    return NextResponse.json(
      { error: 'Failed to activate playlist' },
      { status: 500 }
    )
  }
}
