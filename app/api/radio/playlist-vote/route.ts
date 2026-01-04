import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

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

    // Get all playlist votes grouped by playlist
    const allVotes = db.getAllPlaylistVotes()
    const activeSessions = db.getActiveSessions()
    const activeSessionIds = new Set(activeSessions.map(s => s.id))

    // Only count votes from active sessions
    const activeVotes = allVotes.filter(v => activeSessionIds.has(v.sessionId))

    // Group by playlist
    const votesByPlaylist: Record<string, { count: number; hasVoted: boolean }> = {}

    for (const vote of activeVotes) {
      if (!votesByPlaylist[vote.playlistId]) {
        votesByPlaylist[vote.playlistId] = { count: 0, hasVoted: false }
      }
      votesByPlaylist[vote.playlistId].count++
      if (vote.sessionId === sessionId) {
        votesByPlaylist[vote.playlistId].hasVoted = true
      }
    }

    // Calculate required votes (majority)
    const required = Math.floor(activeSessions.length / 2) + 1

    return NextResponse.json({
      votes: votesByPlaylist,
      required,
      totalListeners: activeSessions.length
    })
  } catch (error) {
    console.error('Error getting playlist votes:', error)
    return NextResponse.json(
      { error: 'Failed to get playlist votes' },
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

    const { playlistId } = await request.json()

    if (!playlistId) {
      return NextResponse.json(
        { error: 'Playlist ID required' },
        { status: 400 }
      )
    }

    // Verify playlist exists
    const playlist = db.getPlaylistById(playlistId)
    if (!playlist) {
      return NextResponse.json(
        { error: 'Playlist not found' },
        { status: 404 }
      )
    }

    // Create vote (removes any previous vote from this session)
    db.createPlaylistVote(sessionId, playlistId)

    // Check if majority reached
    const activeSessions = db.getActiveSessions()
    const votes = db.getPlaylistVotes(playlistId)
    const activeVotes = votes.filter(v =>
      activeSessions.some(s => s.id === v.sessionId)
    )

    const required = Math.floor(activeSessions.length / 2) + 1
    const current = activeVotes.length

    // If majority reached, activate the playlist
    if (current >= required) {
      // Get songs from the playlist
      const playlistSongs = db.getPlaylistSongs(playlistId)

      if (playlistSongs.length > 0) {
        // Clear the current queue
        db.clearRadioQueue()

        // Add all songs from the playlist to the queue
        for (const ps of playlistSongs) {
          const song = db.getSongById(ps.songId)
          if (song) {
            db.addToRadioQueue(song.id, session.id, `${session.displayName} (vote)`)
          }
        }
      }

      // Set the active playlist
      db.setActiveRadioPlaylist(playlistId)
      db.clearPlaylistVotes() // Clear all votes after successful change

      return NextResponse.json({
        success: true,
        activated: true,
        playlistId,
        current,
        required,
        songsAdded: playlistSongs.length
      })
    }

    return NextResponse.json({
      success: true,
      activated: false,
      current,
      required
    })
  } catch (error) {
    console.error('Error voting for playlist:', error)
    return NextResponse.json(
      { error: 'Failed to vote for playlist' },
      { status: 500 }
    )
  }
}
