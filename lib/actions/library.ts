'use server'

import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { getYoutubeMetadata } from '@/lib/ytdlp'

// Types
interface Song {
  id: string
  youtubeId: string
  title: string
  channelName: string
  thumbnail: string
  duration: number
}

type ActionResult<T = void> =
  | { success: true; data?: T }
  | { success: false; error: string }

// Add song from YouTube URL
export async function addSong(url: string): Promise<ActionResult<Song>> {
  try {
    if (!url || typeof url !== 'string') {
      return { success: false, error: 'URL is required' }
    }

    // Extract YouTube ID from URL
    const youtubeIdMatch = url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/
    )

    if (!youtubeIdMatch) {
      return { success: false, error: 'Invalid YouTube URL' }
    }

    const youtubeId = youtubeIdMatch[1]

    // Check if song already exists
    const existingSong = db.getSongByYoutubeId(youtubeId)
    if (existingSong) {
      // If it exists but not in library, add it
      if (!existingSong.isInLibrary) {
        const updated = db.updateSong(existingSong.id, { isInLibrary: true })
        revalidatePath('/')
        return { success: true, data: updated as Song }
      }
      return { success: false, error: 'Song already in library' }
    }

    // Fetch metadata from YouTube
    const metadata = await getYoutubeMetadata(url)

    // Create song in database
    const song = db.createSong({
      youtubeId: metadata.id,
      title: metadata.title,
      channelName: metadata.channel,
      thumbnail: metadata.thumbnail,
      duration: metadata.duration
    })

    revalidatePath('/')
    return { success: true, data: song as Song }
  } catch (error) {
    console.error('Error adding song:', error)
    return { success: false, error: 'Failed to add song' }
  }
}

// Delete song from library (soft delete - marks as not in library)
export async function deleteSong(songId: string): Promise<ActionResult> {
  try {
    if (!songId) {
      return { success: false, error: 'Song ID is required' }
    }

    const song = db.getSongById(songId)
    if (!song) {
      return { success: false, error: 'Song not found' }
    }

    // Soft delete - mark as not in library
    db.updateSong(songId, { isInLibrary: false })
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Error deleting song:', error)
    return { success: false, error: 'Failed to delete song' }
  }
}

// Delete multiple songs (soft delete)
export async function deleteSongs(songIds: string[]): Promise<ActionResult<{ deleted: number }>> {
  try {
    if (!songIds || songIds.length === 0) {
      return { success: false, error: 'Song IDs are required' }
    }

    let deleted = 0
    for (const songId of songIds) {
      const song = db.getSongById(songId)
      if (song) {
        db.updateSong(songId, { isInLibrary: false })
        deleted++
      }
    }

    revalidatePath('/')
    return { success: true, data: { deleted } }
  } catch (error) {
    console.error('Error deleting songs:', error)
    return { success: false, error: 'Failed to delete songs' }
  }
}

// Add song to playlist
export async function addToPlaylist(songId: string, playlistId: string): Promise<ActionResult> {
  try {
    if (!songId || !playlistId) {
      return { success: false, error: 'Song ID and Playlist ID are required' }
    }

    const song = db.getSongById(songId)
    if (!song) {
      return { success: false, error: 'Song not found' }
    }

    const playlist = db.getPlaylistById(playlistId)
    if (!playlist) {
      return { success: false, error: 'Playlist not found' }
    }

    // Check if already in playlist
    const playlistSongs = db.getPlaylistSongs(playlistId)
    if (playlistSongs.some(ps => ps.songId === songId)) {
      return { success: false, error: 'Song already in playlist' }
    }

    db.addSongToPlaylist(playlistId, songId)
    revalidatePath('/')
    revalidatePath('/playlists')
    return { success: true }
  } catch (error) {
    console.error('Error adding to playlist:', error)
    return { success: false, error: 'Failed to add to playlist' }
  }
}

// Create playlist
export async function createPlaylist(name: string): Promise<ActionResult<{ id: string; name: string }>> {
  try {
    if (!name || typeof name !== 'string') {
      return { success: false, error: 'Playlist name is required' }
    }

    const playlist = db.createPlaylist(name.trim())
    revalidatePath('/')
    revalidatePath('/playlists')
    return { success: true, data: { id: playlist.id, name: playlist.name } }
  } catch (error) {
    console.error('Error creating playlist:', error)
    return { success: false, error: 'Failed to create playlist' }
  }
}

// Delete playlist
export async function deletePlaylist(playlistId: string): Promise<ActionResult> {
  try {
    if (!playlistId) {
      return { success: false, error: 'Playlist ID is required' }
    }

    const playlist = db.getPlaylistById(playlistId)
    if (!playlist) {
      return { success: false, error: 'Playlist not found' }
    }

    db.deletePlaylist(playlistId)
    revalidatePath('/')
    revalidatePath('/playlists')
    return { success: true }
  } catch (error) {
    console.error('Error deleting playlist:', error)
    return { success: false, error: 'Failed to delete playlist' }
  }
}

// Remove song from playlist
export async function removeFromPlaylist(playlistId: string, songId: string): Promise<ActionResult> {
  try {
    if (!playlistId || !songId) {
      return { success: false, error: 'Playlist ID and Song ID are required' }
    }

    db.removeSongFromPlaylist(playlistId, songId)
    revalidatePath('/')
    revalidatePath('/playlists')
    return { success: true }
  } catch (error) {
    console.error('Error removing from playlist:', error)
    return { success: false, error: 'Failed to remove from playlist' }
  }
}

// Remove multiple songs from playlist
export async function removeMultipleFromPlaylist(playlistId: string, songIds: string[]): Promise<ActionResult<{ removed: number }>> {
  try {
    if (!playlistId || !songIds || songIds.length === 0) {
      return { success: false, error: 'Playlist ID and Song IDs are required' }
    }

    let removed = 0
    for (const songId of songIds) {
      db.removeSongFromPlaylist(playlistId, songId)
      removed++
    }

    revalidatePath('/')
    revalidatePath('/playlists')
    return { success: true, data: { removed } }
  } catch (error) {
    console.error('Error removing songs from playlist:', error)
    return { success: false, error: 'Failed to remove songs from playlist' }
  }
}
