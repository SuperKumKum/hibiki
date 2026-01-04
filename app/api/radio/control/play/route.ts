import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function POST(request: NextRequest) {
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

    const radioState = db.getRadioState()

    // Anyone can start playback if nothing is playing
    if (!radioState?.currentSongId) {
      // Try to start playing from queue first
      const nextItem = db.getNextQueueItem()
      if (nextItem && nextItem.song) {
        db.updateRadioState({
          isPlaying: true,
          currentSongId: nextItem.song.id,
          currentPosition: 0,
          startedAt: Date.now()
        })
        db.markQueueItemPlayed(nextItem.id)
        db.clearSkipVotesForSong(nextItem.song.id)
        return NextResponse.json({ success: true, started: true })
      }

      // Try to get song from radio playlist if queue is empty
      const playlistSong = db.getNextRadioPlaylistSong()
      if (playlistSong && playlistSong.song) {
        db.updateRadioState({
          isPlaying: true,
          currentSongId: playlistSong.song.id,
          currentPosition: 0,
          startedAt: Date.now()
        })
        return NextResponse.json({ success: true, started: true, fromPlaylist: true })
      }

      return NextResponse.json(
        { error: 'No song to play' },
        { status: 400 }
      )
    }

    // Only admin can resume/control when already playing
    if (!session.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Resume playing
    db.updateRadioState({
      isPlaying: true,
      startedAt: Date.now()
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error playing:', error)
    return NextResponse.json(
      { error: 'Failed to play' },
      { status: 500 }
    )
  }
}
