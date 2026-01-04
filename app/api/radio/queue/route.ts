import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getYoutubeMetadata } from '@/lib/ytdlp'

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

    const queue = db.getRadioQueue()

    return NextResponse.json(queue)
  } catch (error) {
    console.error('Error getting queue:', error)
    return NextResponse.json(
      { error: 'Failed to get queue' },
      { status: 500 }
    )
  }
}

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

    const { songId, url } = await request.json()

    let song

    if (songId) {
      // Add existing song from library
      song = db.getSongById(songId)
      if (!song) {
        return NextResponse.json(
          { error: 'Song not found' },
          { status: 404 }
        )
      }
    } else if (url) {
      // Add new song from YouTube URL
      const metadata = await getYoutubeMetadata(url)

      // Check if already exists
      const existingSong = db.getSongByYoutubeId(metadata.id)
      if (existingSong) {
        song = existingSong
        // Restore to library if needed
        if (!existingSong.isInLibrary) {
          db.updateSong(existingSong.id, { isInLibrary: true })
        }
      } else {
        // Create new song
        song = db.createSong({
          youtubeId: metadata.id,
          title: metadata.title,
          channelName: metadata.channel,
          thumbnail: metadata.thumbnail,
          duration: metadata.duration
        })
      }
    } else {
      return NextResponse.json(
        { error: 'Song ID or URL required' },
        { status: 400 }
      )
    }

    // Add to queue
    const queueItem = db.addToRadioQueue(song.id, session.id, session.displayName)

    return NextResponse.json({
      ...queueItem,
      song
    })
  } catch (error) {
    console.error('Error adding to queue:', error)
    return NextResponse.json(
      { error: 'Failed to add to queue' },
      { status: 500 }
    )
  }
}
