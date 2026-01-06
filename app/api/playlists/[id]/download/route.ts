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

    const playlist = db.getPlaylistById(id)
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      )
    }

    const playlistSongs = db.getPlaylistSongs(id)
    if (playlistSongs.length === 0) {
      return NextResponse.json(
        { error: 'Playlist is empty' },
        { status: 400 }
      )
    }

    console.log(`[API] Downloading playlist: ${playlist.name} (${playlistSongs.length} songs)`)

    const results = {
      total: playlistSongs.length,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      errors: [] as string[]
    }

    for (const ps of playlistSongs) {
      const song = ps.song
      if (!song) {
        results.failed++
        results.errors.push(`Song not found for playlist entry`)
        continue
      }

      // Check if already downloaded
      if (song.isDownloaded && song.localPath && existsSync(song.localPath)) {
        console.log(`[API] Song already downloaded: ${song.title}`)
        results.skipped++
        continue
      }

      try {
        const outputPath = db.getAudioPath(song.id)
        console.log(`[API] Downloading: ${song.title}`)

        await downloadAudio(song.youtubeId, outputPath)

        if (existsSync(outputPath)) {
          db.markSongDownloaded(song.id, outputPath)
          results.downloaded++
          console.log(`[API] Downloaded successfully: ${song.title}`)
        } else {
          throw new Error('File not found after download')
        }
      } catch (error) {
        console.error(`[API] Failed to download: ${song.title}`, error)
        results.failed++
        results.errors.push(`${song.title}: ${String(error)}`)
      }
    }

    console.log(`[API] Playlist download complete:`, results)

    return NextResponse.json({
      success: true,
      message: `Downloaded ${results.downloaded} songs, skipped ${results.skipped}, failed ${results.failed}`,
      results
    })
  } catch (error) {
    console.error('[API] Error downloading playlist:', error)
    return NextResponse.json(
      { error: 'Failed to download playlist', details: String(error) },
      { status: 500 }
    )
  }
}

// Get download status for all songs in playlist
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const playlist = db.getPlaylistById(id)
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      )
    }

    const playlistSongs = db.getPlaylistSongs(id)

    const songs = playlistSongs.map(ps => {
      const song = ps.song
      if (!song) return null

      const isDownloaded = song.isDownloaded && song.localPath && existsSync(song.localPath)
      return {
        id: song.id,
        title: song.title,
        isDownloaded,
        downloadedAt: isDownloaded ? song.downloadedAt : null
      }
    }).filter(Boolean)

    const downloadedCount = songs.filter(s => s?.isDownloaded).length

    return NextResponse.json({
      total: songs.length,
      downloaded: downloadedCount,
      songs
    })
  } catch (error) {
    console.error('[API] Error checking playlist download status:', error)
    return NextResponse.json(
      { error: 'Failed to check download status' },
      { status: 500 }
    )
  }
}
