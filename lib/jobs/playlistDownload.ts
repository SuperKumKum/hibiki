import { existsSync } from 'fs'
import { db } from '@/lib/db'
import { downloadAudio } from '@/lib/ytdlp'

/**
 * Background playlist download jobs
 *
 * @description Playlist downloads used to run inside the HTTP request that started them,
 * looping over every song with a five minute timeout each. Any playlist longer than a few
 * tracks outlived the reverse proxy's timeout: the client saw a failure while the download
 * kept going, orphaned. Jobs now run detached from the request, and progress is polled.
 *
 * @example
 * const job = startPlaylistDownload(playlistId)
 * // later
 * const progress = getPlaylistDownloadJob(playlistId)
 */

/** How long a finished job stays queryable so the client can read its final state. */
const COMPLETED_JOB_TTL_MS = 5 * 60 * 1000

export interface PlaylistDownloadJob {
  playlistId: string
  playlistName: string
  status: 'running' | 'completed' | 'failed'
  total: number
  downloaded: number
  skipped: number
  failed: number
  currentTitle: string | null
  errors: string[]
  startedAt: number
  finishedAt: number | null
}

class PlaylistDownloadRegistry {
  private jobs = new Map<string, PlaylistDownloadJob>()

  get(playlistId: string): PlaylistDownloadJob | null {
    return this.jobs.get(playlistId) ?? null
  }

  isRunning(playlistId: string): boolean {
    return this.jobs.get(playlistId)?.status === 'running'
  }

  /**
   * Starts a download job unless one is already running for this playlist
   *
   * @param playlistId Playlist whose songs should be downloaded
   * @returns The job, or null when the playlist does not exist or has no songs
   */
  start(playlistId: string): PlaylistDownloadJob | null {
    if (this.isRunning(playlistId)) {
      return this.jobs.get(playlistId)!
    }

    const playlist = db.getPlaylistById(playlistId)
    if (!playlist) return null

    const playlistSongs = db.getPlaylistSongs(playlistId)
    if (playlistSongs.length === 0) return null

    const job: PlaylistDownloadJob = {
      playlistId,
      playlistName: playlist.name,
      status: 'running',
      total: playlistSongs.length,
      downloaded: 0,
      skipped: 0,
      failed: 0,
      currentTitle: null,
      errors: [],
      startedAt: Date.now(),
      finishedAt: null
    }
    this.jobs.set(playlistId, job)

    // Detached on purpose: the HTTP response returns immediately
    void this.run(job, playlistSongs.map(ps => ps.song))

    return job
  }

  private async run(
    job: PlaylistDownloadJob,
    songs: { id: string; title: string; youtubeId: string; isDownloaded?: boolean; localPath?: string | null }[]
  ): Promise<void> {
    console.log(`[Download] Starting playlist "${job.playlistName}" (${job.total} songs)`)

    for (const song of songs) {
      if (!song) {
        job.failed++
        continue
      }

      if (song.isDownloaded && song.localPath && existsSync(song.localPath)) {
        job.skipped++
        continue
      }

      job.currentTitle = song.title

      try {
        const outputPath = db.getAudioPath(song.id)
        // Concurrency is bounded inside the yt-dlp wrapper
        await downloadAudio(song.youtubeId, outputPath)

        if (!existsSync(outputPath)) {
          throw new Error('File not found after download')
        }

        db.markSongDownloaded(song.id, outputPath)
        job.downloaded++
      } catch (error) {
        job.failed++
        job.errors.push(`${song.title}: ${String(error)}`)
        console.error(`[Download] Failed: ${song.title}`, error)
      }
    }

    job.currentTitle = null
    job.status = 'completed'
    job.finishedAt = Date.now()

    console.log(
      `[Download] Finished "${job.playlistName}": ${job.downloaded} downloaded, ` +
        `${job.skipped} skipped, ${job.failed} failed`
    )

    this.scheduleCleanup(job.playlistId)
  }

  /** Drops a finished job once the client has had time to read its result. */
  private scheduleCleanup(playlistId: string): void {
    const timer = setTimeout(() => {
      const job = this.jobs.get(playlistId)
      if (job && job.status !== 'running') {
        this.jobs.delete(playlistId)
      }
    }, COMPLETED_JOB_TTL_MS)
    timer.unref?.()
  }
}

/**
 * Process-wide registry
 *
 * @description Pinned to globalThis so route bundles and dev-mode reloads share one
 * instance; a second registry would let the same playlist download twice at once.
 */
const globalForJobs = globalThis as typeof globalThis & {
  __hibikiDownloadJobs?: PlaylistDownloadRegistry
}

const registry: PlaylistDownloadRegistry = (globalForJobs.__hibikiDownloadJobs ??=
  new PlaylistDownloadRegistry())

export function startPlaylistDownload(playlistId: string): PlaylistDownloadJob | null {
  return registry.start(playlistId)
}

export function getPlaylistDownloadJob(playlistId: string): PlaylistDownloadJob | null {
  return registry.get(playlistId)
}

export function isPlaylistDownloadRunning(playlistId: string): boolean {
  return registry.isRunning(playlistId)
}
