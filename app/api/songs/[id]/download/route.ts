import { NextRequest, NextResponse } from 'next/server'
import { existsSync } from 'fs'
import { db } from '@/lib/db'
import { downloadAudio } from '@/lib/ytdlp'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const song = db.getSongById(id)
    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      )
    }

    // Check if already downloaded
    if (song.isDownloaded && song.localPath && existsSync(song.localPath)) {
      return NextResponse.json({
        success: true,
        message: 'Song already downloaded',
        song
      })
    }

    // Get output path
    const outputPath = db.getAudioPath(id)

    console.log('[API] Downloading song:', song.title)
    console.log('[API] YouTube ID:', song.youtubeId)
    console.log('[API] Output path:', outputPath)

    // Download the audio
    await downloadAudio(song.youtubeId, outputPath)

    // Verify file exists
    if (!existsSync(outputPath)) {
      throw new Error('Download completed but file not found')
    }

    // Update database
    const updatedSong = db.markSongDownloaded(id, outputPath)

    console.log('[API] Song downloaded successfully:', id)
    return NextResponse.json({
      success: true,
      message: 'Song downloaded successfully',
      song: updatedSong
    })
  } catch (error) {
    console.error('[API] Error downloading song:', error)
    return NextResponse.json(
      { error: 'Failed to download song', details: String(error) },
      { status: 500 }
    )
  }
}

// Check download status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const song = db.getSongById(id)
    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      )
    }

    const isDownloaded = song.isDownloaded && song.localPath && existsSync(song.localPath)

    return NextResponse.json({
      isDownloaded,
      localPath: isDownloaded ? song.localPath : null,
      downloadedAt: isDownloaded ? song.downloadedAt : null
    })
  } catch (error) {
    console.error('[API] Error checking download status:', error)
    return NextResponse.json(
      { error: 'Failed to check download status' },
      { status: 500 }
    )
  }
}
