import { NextRequest, NextResponse } from 'next/server'
import { getYtDlpStatus, getYtDlpQueueStats, updateYtDlp } from '@/lib/ytdlp'
import { isAdminRequest } from '@/lib/auth'

/**
 * yt-dlp status and update
 *
 * @description GET reports the running version so a stale install is visible instead of
 * only showing up as broken playback. POST installs the latest version onto the data
 * volume, which persists across container restarts.
 *
 * Both are admin only: POST spawns processes and performs a network install.
 */

export async function GET(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  const status = await getYtDlpStatus()

  return NextResponse.json({
    ...status,
    queue: getYtDlpQueueStats()
  })
}

export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
  }

  try {
    const { previousVersion, version } = await updateYtDlp()

    return NextResponse.json({
      success: true,
      previousVersion,
      version,
      updated: previousVersion !== version,
      message:
        previousVersion === version
          ? `Already up to date (${version ?? 'unknown'})`
          : `Updated from ${previousVersion ?? 'unknown'} to ${version ?? 'unknown'}`
    })
  } catch (error) {
    console.error('Error updating yt-dlp:', error)
    return NextResponse.json(
      { error: 'Failed to update yt-dlp', details: String(error) },
      { status: 500 }
    )
  }
}
