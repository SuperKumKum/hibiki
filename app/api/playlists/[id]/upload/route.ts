import { NextRequest, NextResponse } from 'next/server'
import { writeFile } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'

const SESSION_COOKIE = 'hibiki_session_id'

async function requireAdmin(request: NextRequest) {
  // Check cookie first
  const cookieStore = await cookies()
  let sessionId = cookieStore.get(SESSION_COOKIE)?.value

  // Fallback to header
  if (!sessionId) {
    sessionId = request.headers.get('X-Session-ID') || undefined
  }

  if (!sessionId) {
    return null
  }

  const session = db.getSessionById(sessionId)
  if (!session || !session.isAdmin) {
    return null
  }

  return session
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify admin access
    const admin = await requireAdmin(request)
    if (!admin) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    const playlist = db.getPlaylistById(id)
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string | null
    const channelName = formData.get('channelName') as string | null

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.mp3') && file.type !== 'audio/mpeg') {
      return NextResponse.json(
        { error: 'Only MP3 files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 50MB limit' },
        { status: 400 }
      )
    }

    console.log('[API] Uploading MP3:', file.name)
    console.log('[API] File size:', file.size)
    console.log('[API] Playlist:', playlist.name)

    // Create song entry
    const songTitle = title || file.name.replace(/\.mp3$/i, '')
    const song = db.createSong({
      youtubeId: `upload_${Date.now()}`, // Unique ID for uploaded files
      title: songTitle,
      channelName: channelName || 'Uploaded',
      thumbnail: '/icon.svg', // Default thumbnail for uploads
      duration: 0 // Will need to be extracted from file
    })

    // Ensure audio directory exists
    const audioDir = db.getAudioDir()

    // Save file
    const outputPath = db.getAudioPath(song.id)
    const buffer = Buffer.from(await file.arrayBuffer())
    await writeFile(outputPath, buffer)

    console.log('[API] File saved to:', outputPath)

    // Mark as downloaded
    db.markSongDownloaded(song.id, outputPath)

    // Add to playlist
    db.addSongToPlaylist(id, song.id)

    console.log('[API] Song added to playlist:', song.id)

    return NextResponse.json({
      success: true,
      message: 'File uploaded successfully',
      song: {
        ...song,
        isDownloaded: true,
        localPath: outputPath
      }
    })
  } catch (error) {
    console.error('[API] Error uploading file:', error)
    return NextResponse.json(
      { error: 'Failed to upload file', details: String(error) },
      { status: 500 }
    )
  }
}
