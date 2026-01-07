'use server'

import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { verifyToken } from '@/lib/auth'

const SESSION_COOKIE = 'hibiki_session_id'
const ADMIN_COOKIE = 'hibiki_admin_token'

// Types
interface Session {
  id: string
  displayName: string
  colorIndex: number
  isAdmin: boolean
  createdAt: number
  lastSeenAt: number
  isActive: boolean
  countsForVotes: boolean
}

interface SkipVoteStatus {
  current: number
  required: number
  hasVoted: boolean
  skipped?: boolean
}

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// Helper functions
async function getSessionFromCookie(): Promise<Session | null> {
  const cookieStore = await cookies()
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value
  if (!sessionId) return null
  return db.getSessionById(sessionId) || null
}

async function requireSession(): Promise<Session> {
  const session = await getSessionFromCookie()
  if (!session) {
    throw new Error('Session required')
  }
  return session
}

async function isAdminFromCookie(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(ADMIN_COOKIE)?.value
  if (!token) return false
  const payload = verifyToken(token)
  return payload?.isAdmin === true
}

async function requireAdmin(): Promise<Session> {
  const session = await requireSession()
  const isAdmin = await isAdminFromCookie()
  if (!isAdmin) {
    throw new Error('Admin access required')
  }
  return session
}

function calculateCurrentPosition(state: {
  isPlaying: boolean
  currentPosition: number
  startedAt: number | null
}): number {
  if (!state.isPlaying || !state.startedAt) {
    return state.currentPosition
  }
  const elapsed = (Date.now() - state.startedAt) / 1000
  return state.currentPosition + elapsed
}

// Session Actions
export async function createSession(
  displayName: string,
  colorIndex: number
): Promise<ActionResult<Session>> {
  try {
    if (!displayName || typeof displayName !== 'string') {
      return { success: false, error: 'Display name is required' }
    }

    const color = typeof colorIndex === 'number' ? colorIndex % 8 : 0
    const session = db.createSession(displayName.trim().slice(0, 20), color)

    // Set session cookie
    const cookieStore = await cookies()
    cookieStore.set(SESSION_COOKIE, session.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7 // 1 week
    })

    return { success: true, data: session }
  } catch (error) {
    console.error('Error creating session:', error)
    return { success: false, error: 'Failed to create session' }
  }
}

export async function endSession(): Promise<ActionResult> {
  try {
    const session = await getSessionFromCookie()
    if (session) {
      db.deactivateSession(session.id)
    }

    // Clear cookie
    const cookieStore = await cookies()
    cookieStore.delete(SESSION_COOKIE)

    return { success: true }
  } catch (error) {
    console.error('Error ending session:', error)
    return { success: false, error: 'Failed to end session' }
  }
}


// Queue Actions
export async function removeFromQueue(queueItemId: string): Promise<ActionResult> {
  try {
    const session = await requireSession()

    const queueItem = db.getRadioQueueItem(queueItemId)
    if (!queueItem) {
      return { success: false, error: 'Queue item not found' }
    }

    // Only admin or the person who added can remove
    if (!session.isAdmin && queueItem.addedBy !== session.id) {
      return { success: false, error: 'Not authorized to remove this item' }
    }

    db.removeFromRadioQueue(queueItemId)
    return { success: true }
  } catch (error) {
    console.error('Error removing from queue:', error)
    return { success: false, error: 'Failed to remove from queue' }
  }
}

// Voting Actions
export async function voteSkip(): Promise<ActionResult<SkipVoteStatus>> {
  try {
    const session = await requireSession()
    const radioState = db.getRadioState()

    if (!radioState?.currentSongId) {
      return { success: false, error: 'No song playing' }
    }

    // Check if already voted
    const existingVote = db.getSkipVote(session.id, radioState.currentSongId)
    if (existingVote) {
      return { success: false, error: 'Already voted to skip' }
    }

    // Create vote
    db.createSkipVote(session.id, radioState.currentSongId)

    // Check if threshold met (only count users who can vote)
    const activeVoters = db.getActiveVoters().length
    const votesNeeded = Math.max(1, Math.floor(activeVoters / 2) + 1)
    const currentVotes = db.getSkipVotesForSong(radioState.currentSongId).length

    let skipped = false

    if (currentVotes >= votesNeeded) {
      // Skip to next song
      db.clearSkipVotesForSong(radioState.currentSongId)

      const nextItem = db.getNextQueueItem()
      if (nextItem?.song) {
        db.markQueueItemPlayed(nextItem.id)
        db.updateRadioState({
          isPlaying: true,
          currentSongId: nextItem.song.id,
          currentPosition: 0,
          startedAt: Date.now()
        })
      } else {
        const playlistSong = db.getNextRadioPlaylistSong()
        if (playlistSong?.song) {
          db.updateRadioState({
            isPlaying: true,
            currentSongId: playlistSong.song.id,
            currentPosition: 0,
            startedAt: Date.now()
          })
        } else {
          db.updateRadioState({
            isPlaying: false,
            currentSongId: null,
            currentPosition: 0,
            startedAt: null
          })
        }
      }
      skipped = true
    }

    return {
      success: true,
      data: {
        current: skipped ? 0 : currentVotes,
        required: votesNeeded,
        hasVoted: true,
        skipped
      }
    }
  } catch (error) {
    console.error('Error voting to skip:', error)
    return { success: false, error: 'Failed to vote' }
  }
}

export async function voteForPlaylist(playlistId: string): Promise<ActionResult<{ activated: boolean; current: number; required: number }>> {
  try {
    const session = await requireSession()

    if (!playlistId) {
      return { success: false, error: 'Playlist ID required' }
    }

    const playlist = db.getPlaylistById(playlistId)
    if (!playlist) {
      return { success: false, error: 'Playlist not found' }
    }

    // Create vote (removes any previous vote from this session)
    db.createPlaylistVote(session.id, playlistId)

    // Check if majority reached (only count users who can vote)
    const activeVoters = db.getActiveVoters()
    const votes = db.getPlaylistVotes(playlistId)
    const activeVotes = votes.filter(v =>
      activeVoters.some(s => s.id === v.sessionId)
    )

    const required = Math.floor(activeVoters.length / 2) + 1
    const current = activeVotes.length

    // If majority reached, activate the playlist
    if (current >= required) {
      const playlistSongs = db.getPlaylistSongs(playlistId)

      if (playlistSongs.length > 0) {
        db.clearRadioQueue()

        for (const ps of playlistSongs) {
          const song = db.getSongById(ps.songId)
          if (song) {
            db.addToRadioQueue(song.id, session.id, `${session.displayName} (vote)`)
          }
        }
      }

      db.setActiveRadioPlaylist(playlistId)
      db.clearPlaylistVotes()

      return {
        success: true,
        data: { activated: true, current, required }
      }
    }

    return {
      success: true,
      data: { activated: false, current, required }
    }
  } catch (error) {
    console.error('Error voting for playlist:', error)
    return { success: false, error: 'Failed to vote for playlist' }
  }
}

// Playback Control Actions
export async function play(): Promise<ActionResult> {
  try {
    const radioState = db.getRadioState()

    // Anyone can start playback if nothing is playing
    if (!radioState?.currentSongId) {
      await requireSession() // Just need a valid session to start
      const nextItem = db.getNextQueueItem()
      if (nextItem?.song) {
        db.updateRadioState({
          isPlaying: true,
          currentSongId: nextItem.song.id,
          currentPosition: 0,
          startedAt: Date.now()
        })
        db.markQueueItemPlayed(nextItem.id)
        db.clearSkipVotesForSong(nextItem.song.id)
        return { success: true }
      }

      const playlistSong = db.getNextRadioPlaylistSong()
      if (playlistSong?.song) {
        db.updateRadioState({
          isPlaying: true,
          currentSongId: playlistSong.song.id,
          currentPosition: 0,
          startedAt: Date.now()
        })
        return { success: true }
      }

      return { success: false, error: 'No song to play' }
    }

    // Only admin can resume when already has a song (use cookie check like pause)
    await requireAdmin()

    db.updateRadioState({
      isPlaying: true,
      startedAt: Date.now()
    })

    return { success: true }
  } catch (error) {
    console.error('Error playing:', error)
    return { success: false, error: 'Failed to play' }
  }
}

export async function pause(): Promise<ActionResult> {
  try {
    await requireAdmin()
    const radioState = db.getRadioState()

    if (!radioState) {
      return { success: false, error: 'No radio state' }
    }

    const currentPosition = calculateCurrentPosition(radioState)

    db.updateRadioState({
      isPlaying: false,
      currentPosition,
      startedAt: null
    })

    return { success: true }
  } catch (error) {
    console.error('Error pausing:', error)
    return { success: false, error: 'Failed to pause' }
  }
}

export async function next(): Promise<ActionResult> {
  try {
    await requireAdmin()

    // Clear votes for current song
    const radioState = db.getRadioState()
    if (radioState?.currentSongId) {
      db.clearSkipVotesForSong(radioState.currentSongId)
    }

    // Try to get next song from queue first
    const nextItem = db.getNextQueueItem()

    if (nextItem?.song) {
      db.markQueueItemPlayed(nextItem.id)
      db.updateRadioState({
        isPlaying: true,
        currentSongId: nextItem.song.id,
        currentPosition: 0,
        startedAt: Date.now()
      })
      return { success: true }
    }

    // Queue is empty, try radio playlist
    const playlistSong = db.getNextRadioPlaylistSong()

    if (playlistSong?.song) {
      db.updateRadioState({
        isPlaying: true,
        currentSongId: playlistSong.song.id,
        currentPosition: 0,
        startedAt: Date.now()
      })
      return { success: true }
    }

    // No songs available, stop playing
    db.updateRadioState({
      isPlaying: false,
      currentSongId: null,
      currentPosition: 0,
      startedAt: null
    })

    return { success: true }
  } catch (error) {
    console.error('Error skipping to next:', error)
    return { success: false, error: 'Failed to skip to next' }
  }
}

export async function seek(position: number): Promise<ActionResult> {
  try {
    await requireAdmin()

    if (typeof position !== 'number' || position < 0) {
      return { success: false, error: 'Valid position required' }
    }

    const radioState = db.getRadioState()

    if (!radioState?.currentSongId) {
      return { success: false, error: 'No song playing' }
    }

    db.updateRadioState({
      currentPosition: position,
      startedAt: radioState.isPlaying ? Date.now() : null
    })

    return { success: true }
  } catch (error) {
    console.error('Error seeking:', error)
    return { success: false, error: 'Failed to seek' }
  }
}

export async function toggleShuffle(): Promise<ActionResult<boolean>> {
  try {
    await requireAdmin()
    const radioState = db.toggleShuffle()

    return { success: true, data: radioState.isShuffled }
  } catch (error) {
    console.error('Error toggling shuffle:', error)
    return { success: false, error: 'Failed to toggle shuffle' }
  }
}

export async function clearQueue(): Promise<ActionResult> {
  try {
    await requireAdmin()
    db.clearRadioQueue()
    return { success: true }
  } catch (error) {
    console.error('Error clearing queue:', error)
    return { success: false, error: 'Failed to clear queue' }
  }
}

export async function activatePlaylist(playlistId: string): Promise<ActionResult<{ songsAdded: number }>> {
  try {
    const session = await requireAdmin()

    const playlist = db.getPlaylistById(playlistId)
    if (!playlist) {
      return { success: false, error: 'Playlist not found' }
    }

    const playlistSongs = db.getPlaylistSongs(playlistId)

    if (playlistSongs.length === 0) {
      return { success: false, error: 'Playlist is empty' }
    }

    // Clear the current queue
    db.clearRadioQueue()

    // Add all songs from the playlist to the queue
    for (const ps of playlistSongs) {
      const song = db.getSongById(ps.songId)
      if (song) {
        db.addToRadioQueue(song.id, session.id, session.displayName)
      }
    }

    // Set the active playlist
    db.setActiveRadioPlaylist(playlistId)

    return { success: true, data: { songsAdded: playlistSongs.length } }
  } catch (error) {
    console.error('Error activating playlist:', error)
    return { success: false, error: 'Failed to activate playlist' }
  }
}

export async function playFromQueue(queueItemId: string): Promise<ActionResult> {
  try {
    await requireAdmin()

    const queueItem = db.getRadioQueueItem(queueItemId)
    if (!queueItem) {
      return { success: false, error: 'Queue item not found' }
    }

    const song = db.getSongById(queueItem.songId)
    if (!song) {
      return { success: false, error: 'Song not found' }
    }

    // Clear skip votes for current song
    const radioState = db.getRadioState()
    if (radioState?.currentSongId) {
      db.clearSkipVotesForSong(radioState.currentSongId)
    }

    // Mark items before this one as played (skip them)
    const queue = db.getRadioQueue()
    for (const item of queue) {
      if (item.position < queueItem.position) {
        db.markQueueItemPlayed(item.id)
      }
    }

    // Mark this item as played and set it as current song
    db.markQueueItemPlayed(queueItemId)
    db.updateRadioState({
      isPlaying: true,
      currentSongId: song.id,
      currentPosition: 0,
      startedAt: Date.now()
    })

    return { success: true }
  } catch (error) {
    console.error('Error playing from queue:', error)
    return { success: false, error: 'Failed to play from queue' }
  }
}
