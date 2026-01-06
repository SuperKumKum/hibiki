import { NextRequest, NextResponse } from 'next/server'
import { existsSync, statSync, createReadStream } from 'fs'
import { readFile } from 'fs/promises'
import { db } from '@/lib/db'
import { getStreamUrl } from '@/lib/ytdlp'
import { streamCache } from '@/lib/cache'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Get song from database
    const song = db.getSongById(id)

    if (!song) {
      return NextResponse.json(
        { error: 'Song not found' },
        { status: 404 }
      )
    }

    // Check if song is downloaded locally
    if (song.isDownloaded && song.localPath && existsSync(song.localPath)) {
      console.log('[Stream] Serving local file:', song.localPath)

      const stat = statSync(song.localPath)
      const fileSize = stat.size

      // Handle range requests for seeking
      const range = request.headers.get('range')

      if (range) {
        const parts = range.replace(/bytes=/, '').split('-')
        const start = parseInt(parts[0], 10)
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1
        const chunkSize = end - start + 1

        // Read the specific chunk
        const buffer = await readFile(song.localPath)
        const chunk = buffer.slice(start, end + 1)

        return new NextResponse(chunk, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${fileSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': String(chunkSize),
            'Content-Type': 'audio/mpeg',
            'Cache-Control': 'public, max-age=31536000',
          },
        })
      }

      // Full file response
      const buffer = await readFile(song.localPath)
      return new NextResponse(buffer, {
        headers: {
          'Content-Length': String(fileSize),
          'Content-Type': 'audio/mpeg',
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000',
        },
      })
    }

    // Fallback to YouTube streaming
    console.log('[Stream] No local file, streaming from YouTube:', song.youtubeId)

    // Check cache first
    let streamUrl = streamCache.get(song.youtubeId)

    if (!streamUrl) {
      console.log('[Stream] Cache miss for:', song.youtubeId)
      // Get dynamic stream URL using yt-dlp
      streamUrl = await getStreamUrl(song.youtubeId)
      // Cache the URL
      streamCache.set(song.youtubeId, streamUrl)
    } else {
      console.log('[Stream] Cache hit for:', song.youtubeId)
    }

    // Redirect to the stream URL
    return NextResponse.redirect(streamUrl)
  } catch (error) {
    console.error('Error streaming song:', error)
    return NextResponse.json(
      { error: 'Failed to get stream URL' },
      { status: 500 }
    )
  }
}
