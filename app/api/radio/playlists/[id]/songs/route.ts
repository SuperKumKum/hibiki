import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = request.headers.get('X-Session-ID')
    const { id: playlistId } = await params

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

    const playlist = db.getRadioPlaylistById(playlistId)
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      )
    }

    const { songId } = await request.json()

    if (!songId) {
      return NextResponse.json(
        { error: 'Song ID required' },
        { status: 400 }
      )
    }

    const song = db.getSongById(songId)
    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      )
    }

    const result = db.addSongToRadioPlaylist(playlistId, songId)

    if (!result) {
      return NextResponse.json(
        { error: 'Song already in playlist' },
        { status: 400 }
      )
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error adding song to radio playlist:', error)
    return NextResponse.json(
      { error: 'Failed to add song' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionId = request.headers.get('X-Session-ID')
    const { id: playlistId } = await params

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

    const { songId } = await request.json()

    if (!songId) {
      return NextResponse.json(
        { error: 'Song ID required' },
        { status: 400 }
      )
    }

    db.removeSongFromRadioPlaylist(playlistId, songId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing song from radio playlist:', error)
    return NextResponse.json(
      { error: 'Failed to remove song' },
      { status: 500 }
    )
  }
}
