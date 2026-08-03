import { NextRequest, NextResponse } from 'next/server'
import { createReadStream, statSync } from 'fs'
import { Readable } from 'stream'
import { db } from '@/lib/db'
import { getStreamUrl } from '@/lib/ytdlp'
import { streamCache } from '@/lib/cache'

/**
 * Audio streaming endpoint
 *
 * @description Serves a locally downloaded file when available, otherwise redirects to a
 * resolved YouTube stream URL. Local files are piped straight from disk: buffering an
 * entire track into memory for every Range request (browsers issue several per track, per
 * listener) was a major source of allocation churn and event-loop stalls.
 */

export const dynamic = 'force-dynamic'

/** A resolved byte range, or a marker for a syntactically unsatisfiable one. */
type ParsedRange = { start: number; end: number } | 'unsatisfiable' | null

/**
 * Parses an HTTP Range header against a known file size
 *
 * @description Supports `bytes=start-end`, `bytes=start-` and the `bytes=-suffix` form.
 * Multi-range requests are intentionally unsupported and reported as unsatisfiable.
 *
 * @param header Raw Range header value, or null when absent
 * @param fileSize Total size of the target file in bytes
 * @returns Inclusive range, 'unsatisfiable' for a bad range, or null when no range asked
 *
 * @example
 * parseRange('bytes=0-1023', 5000)  // { start: 0, end: 1023 }
 * parseRange('bytes=-500', 5000)    // { start: 4500, end: 4999 }
 */
function parseRange(header: string | null, fileSize: number): ParsedRange {
  if (!header) return null

  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match) return 'unsatisfiable'

  const [, rawStart, rawEnd] = match
  if (!rawStart && !rawEnd) return 'unsatisfiable'

  let start: number
  let end: number

  if (!rawStart) {
    // Suffix form: the last N bytes
    const suffixLength = parseInt(rawEnd, 10)
    if (suffixLength === 0) return 'unsatisfiable'
    start = Math.max(0, fileSize - suffixLength)
    end = fileSize - 1
  } else {
    start = parseInt(rawStart, 10)
    end = rawEnd ? Math.min(parseInt(rawEnd, 10), fileSize - 1) : fileSize - 1
  }

  if (!Number.isFinite(start) || !Number.isFinite(end)) return 'unsatisfiable'
  if (start > end || start >= fileSize) return 'unsatisfiable'

  return { start, end }
}

/**
 * Opens a file slice as a web stream suitable for a Response body
 *
 * @param path Absolute path of the file to read
 * @param start First byte to send, inclusive
 * @param end Last byte to send, inclusive
 * @returns Web ReadableStream backed by a lazy file descriptor
 */
function createFileStream(path: string, start: number, end: number): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(path, { start, end })
  return Readable.toWeb(nodeStream) as unknown as ReadableStream<Uint8Array>
}

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

    // Serve the local file when the download is present on disk
    if (song.isDownloaded && song.localPath) {
      const localPath = song.localPath
      let fileSize: number | null = null

      try {
        const stat = statSync(localPath)
        // A zero-byte file means the download failed; treat it as absent
        if (stat.isFile() && stat.size > 0) fileSize = stat.size
      } catch {
        fileSize = null
      }

      if (fileSize === null) {
        // Database says downloaded but the file is gone or empty. Repair the flag so we
        // stop paying for a failing stat on every request, then fall through to YouTube.
        console.warn('[Stream] Missing or empty local file, clearing download flag:', localPath)
        db.markSongNotDownloaded(song.id)
      } else {
        const range = parseRange(request.headers.get('range'), fileSize)

        if (range === 'unsatisfiable') {
          return new NextResponse(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${fileSize}`,
              'Accept-Ranges': 'bytes'
            }
          })
        }

        const start = range ? range.start : 0
        const end = range ? range.end : fileSize - 1

        const headers: Record<string, string> = {
          'Content-Type': 'audio/mpeg',
          'Content-Length': String(end - start + 1),
          'Accept-Ranges': 'bytes',
          // Content for a given song id never changes once downloaded
          'Cache-Control': 'public, max-age=31536000, immutable'
        }

        if (range) {
          headers['Content-Range'] = `bytes ${start}-${end}/${fileSize}`
        }

        return new NextResponse(createFileStream(localPath, start, end), {
          status: range ? 206 : 200,
          headers
        })
      }
    }

    // Fallback to YouTube streaming
    console.log('[Stream] No local file, streaming from YouTube:', song.youtubeId)

    let streamUrl = streamCache.get(song.youtubeId)

    if (!streamUrl) {
      streamUrl = await getStreamUrl(song.youtubeId)
      streamCache.set(song.youtubeId, streamUrl)
    }

    // Redirects must not be cached: the resolved URL is short-lived and the song may be
    // downloaded locally in the meantime.
    return NextResponse.redirect(streamUrl, {
      headers: { 'Cache-Control': 'no-store' }
    })
  } catch (error) {
    console.error('Error streaming song:', error)
    return NextResponse.json(
      { error: 'Failed to get stream URL' },
      { status: 500 }
    )
  }
}
