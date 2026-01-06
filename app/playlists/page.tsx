import { Suspense } from 'react'
import type { Metadata } from 'next'
import { db } from '@/lib/db'
import { isAdminFromCookies } from '@/lib/auth'
import Navbar from '@/components/Navbar'
import PlaylistsContent from '@/components/PlaylistsContent'
import AdminLoginRequired from '@/components/AdminLoginRequired'

export const metadata: Metadata = {
  title: 'Playlists',
  description: 'Manage your music playlists - create, edit and play your collections',
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

interface PlaylistSong {
  id: string
  song: Song
}

interface Playlist {
  id: string
  name: string
  playlistSongs: PlaylistSong[]
}

// Server-side data fetching
async function getPlaylistsWithSongs(): Promise<Playlist[]> {
  // Sync local audio files with database
  db.syncLocalAudioFiles()

  const playlists = db.getPlaylists()

  return playlists.map(playlist => {
    const playlistSongs = db.getPlaylistSongs(playlist.id)

    return {
      id: playlist.id,
      name: playlist.name,
      playlistSongs: playlistSongs
        .filter(ps => ps.song)
        .map(ps => ({
          id: ps.id,
          song: {
            id: ps.song!.id,
            youtubeId: ps.song!.youtubeId,
            title: ps.song!.title,
            channelName: ps.song!.channelName,
            thumbnail: ps.song!.thumbnail,
            duration: ps.song!.duration,
            isDownloaded: ps.song!.isDownloaded
          }
        }))
    }
  })
}

// Loading skeleton
function PlaylistsLoading() {
  return (
    <div className="flex-1 flex">
      <div className="w-80 border-r border-gray-800 p-6">
        <div className="h-12 bg-tokyo-bg-hl rounded-lg mb-4 animate-pulse" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-16 bg-tokyo-bg-hl rounded-lg mb-2 animate-pulse" />
        ))}
      </div>
      <div className="flex-1 p-6">
        <div className="h-8 bg-tokyo-bg-hl rounded w-48 mb-6 animate-pulse" />
        <div className="grid grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-tokyo-bg-hl rounded-lg aspect-video mb-2" />
              <div className="h-4 bg-tokyo-bg-hl rounded w-3/4 mb-1" />
              <div className="h-3 bg-tokyo-bg-hl rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Main page (Server Component)
export default async function PlaylistsPage() {
  const isAdmin = await isAdminFromCookies()

  if (!isAdmin) {
    return (
      <div className="flex flex-col h-screen overflow-hidden">
        <Navbar />
        <AdminLoginRequired />
      </div>
    )
  }

  const playlists = await getPlaylistsWithSongs()

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Navbar />
      <Suspense fallback={<PlaylistsLoading />}>
        <PlaylistsContent initialPlaylists={playlists} />
      </Suspense>
    </div>
  )
}
