import { Suspense } from 'react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import Navbar from '@/components/Navbar'
import HomeContent from '@/components/HomeContent'

export const metadata: Metadata = {
  title: 'Library',
  description: 'Your music library - browse and play your YouTube songs',
}

// Types
interface Song {
  id: string
  youtubeId: string
  title: string
  channelName: string
  thumbnail: string
  duration: number
  isDownloaded?: boolean
}

interface Playlist {
  id: string
  name: string
}

// Server-side data fetching
// Returns only songs that are NOT in any playlist (orphan songs)
async function getOrphanSongs(): Promise<{ songs: Song[]; playlists: Playlist[] }> {
  const songs = db.getSongs()
  const playlists = db.getPlaylists()

  // Get all song IDs that are in at least one playlist
  const songsInPlaylists = new Set<string>()
  for (const playlist of playlists) {
    const playlistSongs = db.getPlaylistSongs(playlist.id)
    for (const ps of playlistSongs) {
      songsInPlaylists.add(ps.songId)
    }
  }

  // Filter to only songs NOT in any playlist
  const orphanSongs = songs
    .filter(song => !songsInPlaylists.has(song.id))
    .map(song => ({
      id: song.id,
      youtubeId: song.youtubeId,
      title: song.title,
      channelName: song.channelName,
      thumbnail: song.thumbnail,
      duration: song.duration,
      isDownloaded: song.isDownloaded ?? false
    }))

  return {
    songs: orphanSongs,
    playlists: playlists.map(p => ({ id: p.id, name: p.name }))
  }
}

// Loading skeleton
function HomeLoading() {
  return (
    <div className="flex-1 overflow-y-auto pb-36 sm:pb-32 p-3 sm:p-6">
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-tokyo-bg-hl rounded-lg aspect-video mb-2" />
            <div className="h-4 bg-tokyo-bg-hl rounded w-3/4 mb-1" />
            <div className="h-3 bg-tokyo-bg-hl rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  )
}

// Main page (Server Component)
export default async function Home() {
  const { songs, playlists } = await getOrphanSongs()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <Suspense fallback={<HomeLoading />}>
        <HomeContent initialSongs={songs} initialPlaylists={playlists} />
      </Suspense>
    </div>
  )
}
