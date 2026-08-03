import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { isAdminRequest } from '@/lib/auth'
import { getPlaylistDownloadJob, startPlaylistDownload } from '@/lib/jobs/playlistDownload'

/**
 * Playlist download control
 *
 * @description POST starts a background job and returns immediately; GET reports its
 * progress. Downloading inline used to hold the request open for up to five minutes per
 * song, so the proxy cut the connection long before a real playlist finished.
 */

/**
 * Starts downloading every song of a playlist
 *
 * @returns 202 with the initial job state, or 409 when one is already running
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    if (!(await isAdminRequest(request))) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { id } = await params

    const playlist = db.getPlaylistById(id)
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    const existing = getPlaylistDownloadJob(id)
    if (existing?.status === 'running') {
      return NextResponse.json(
        { error: 'A download is already running for this playlist', job: existing },
        { status: 409 }
      )
    }

    const job = startPlaylistDownload(id)
    if (!job) {
      return NextResponse.json({ error: 'Playlist is empty' }, { status: 400 })
    }

    return NextResponse.json({ started: true, job }, { status: 202 })
  } catch (error) {
    console.error('[API] Error starting playlist download:', error)
    return NextResponse.json(
      { error: 'Failed to start playlist download', details: String(error) },
      { status: 500 }
    )
  }
}

/**
 * Reports download progress for a playlist
 *
 * @description When no job exists (never started, or finished long ago) the current
 * on-disk state is reported instead, so the client can always render something useful.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const playlist = db.getPlaylistById(id)
    if (!playlist) {
      return NextResponse.json({ error: 'Playlist not found' }, { status: 404 })
    }

    const job = getPlaylistDownloadJob(id)
    if (job) {
      return NextResponse.json({ job })
    }

    const counts = db.getPlaylistLocalCount(id)
    return NextResponse.json({
      job: null,
      total: counts.total,
      downloaded: counts.local
    })
  } catch (error) {
    console.error('[API] Error reading playlist download status:', error)
    return NextResponse.json({ error: 'Failed to read download status' }, { status: 500 })
  }
}
