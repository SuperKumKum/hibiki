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

    if (!session.isAdmin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Clear votes for current song
    const radioState = db.getRadioState()
    if (radioState?.currentSongId) {
      db.clearSkipVotesForSong(radioState.currentSongId)
    }

    // Try to get next song from queue first
    const nextItem = db.getNextQueueItem()

    if (nextItem && nextItem.song) {
      // Play from queue
      db.markQueueItemPlayed(nextItem.id)
      db.updateRadioState({
        isPlaying: true,
        currentSongId: nextItem.song.id,
        currentPosition: 0,
        startedAt: Date.now()
      })

      return NextResponse.json({
        success: true,
        song: nextItem.song,
        source: 'queue'
      })
    }

    // Queue is empty, try radio playlist
    const playlistSong = db.getNextRadioPlaylistSong()

    if (playlistSong && playlistSong.song) {
      db.updateRadioState({
        isPlaying: true,
        currentSongId: playlistSong.song.id,
        currentPosition: 0,
        startedAt: Date.now()
      })

      return NextResponse.json({
        success: true,
        song: playlistSong.song,
        source: 'playlist'
      })
    }

    // No songs available, stop playing
    db.updateRadioState({
      isPlaying: false,
      currentSongId: null,
      currentPosition: 0,
      startedAt: null
    })

    return NextResponse.json({ success: true, ended: true })
  } catch (error) {
    console.error('Error skipping to next:', error)
    return NextResponse.json(
      { error: 'Failed to skip to next' },
      { status: 500 }
    )
  }
}
