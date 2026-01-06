'use client'

import { useState, useTransition } from 'react'
import { Trash2, CheckSquare, Square, X } from 'lucide-react'
import Header from '@/components/Header'
import SongCard from '@/components/SongCard'
import { useToast } from '@/components/Toast'
import { usePlayer } from '@/components/PlayerContext'
import { addSong, deleteSong, deleteSongs, addToPlaylist } from '@/lib/actions/library'

interface Song {
  id: string
  youtubeId: string
  title: string
  channelName: string
  thumbnail: string
  duration: number
  playlists?: Playlist[]
}

interface Playlist {
  id: string
  name: string
}

interface HomeContentProps {
  initialSongs: Song[]
  initialPlaylists: Playlist[]
}

export default function HomeContent({ initialSongs, initialPlaylists }: HomeContentProps) {
  const [songs, setSongs] = useState<Song[]>(initialSongs)
  const [playlists] = useState<Playlist[]>(initialPlaylists)
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [selectedSongs, setSelectedSongs] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const [isAddingPending, startAddingTransition] = useTransition()
  const { showToast } = useToast()
  const { playSong } = usePlayer()

  const handleAddSong = async (url: string) => {
    startAddingTransition(async () => {
      const result = await addSong(url)
      if (result.success && result.data) {
        setSongs((prev) => [result.data!, ...prev])
        showToast('Song added successfully', 'success')
      } else if (!result.success) {
        showToast(result.error, 'error')
      }
    })
  }

  const handlePlaySong = (song: Song) => {
    const index = songs.findIndex((s) => s.id === song.id)
    playSong(song, index, songs, false)
  }

  const handleDeleteSong = async (songId: string) => {
    startTransition(async () => {
      const result = await deleteSong(songId)
      if (result.success) {
        setSongs((prev) => prev.filter((s) => s.id !== songId))
        showToast('Song deleted', 'success')
      } else if (!result.success) {
        showToast(result.error, 'error')
      }
    })
  }

  // Selection mode functions
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode)
    setSelectedSongs(new Set())
  }

  const toggleSongSelection = (songId: string) => {
    const newSelected = new Set(selectedSongs)
    if (newSelected.has(songId)) {
      newSelected.delete(songId)
    } else {
      newSelected.add(songId)
    }
    setSelectedSongs(newSelected)
  }

  const selectAllSongs = () => {
    if (selectedSongs.size === songs.length) {
      setSelectedSongs(new Set())
    } else {
      setSelectedSongs(new Set(songs.map(song => song.id)))
    }
  }

  const deleteSelectedSongs = async () => {
    if (selectedSongs.size === 0) return

    startTransition(async () => {
      const result = await deleteSongs(Array.from(selectedSongs))
      if (result.success && result.data) {
        setSongs(prev => prev.filter(song => !selectedSongs.has(song.id)))
        showToast(`${result.data.deleted} song${result.data.deleted !== 1 ? 's' : ''} deleted`, 'success')
        setSelectedSongs(new Set())
        setIsSelectionMode(false)
      } else if (!result.success) {
        showToast(result.error, 'error')
      }
    })
  }

  const handleAddToPlaylist = async (songId: string, playlistId: string) => {
    startTransition(async () => {
      const result = await addToPlaylist(songId, playlistId)
      if (result.success) {
        showToast('Song added to playlist', 'success')
      } else if (!result.success) {
        showToast(result.error, 'error')
      }
    })
  }

  return (
    <>
      <Header onAddSong={handleAddSong} isLoading={isAddingPending} />

      {/* Selection mode bar */}
      {isSelectionMode && (
        <div className="bg-tokyo-bg-hl border-b border-tokyo-border px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={toggleSelectionMode}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-tokyo-bg-menu hover:bg-tokyo-selection disabled:bg-tokyo-bg disabled:cursor-not-allowed text-tokyo-fg rounded-lg transition-colors"
            >
              <X size={16} />
              Cancel
            </button>
            <span className="text-tokyo-fg text-sm">
              {selectedSongs.size} of {songs.length} selected
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={selectAllSongs}
              disabled={isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-tokyo-bg-menu hover:bg-tokyo-selection disabled:bg-tokyo-bg disabled:cursor-not-allowed text-tokyo-fg rounded-lg transition-colors"
            >
              {selectedSongs.size === songs.length ? <CheckSquare size={16} /> : <Square size={16} />}
              {selectedSongs.size === songs.length ? 'Deselect All' : 'Select All'}
            </button>
            {selectedSongs.size > 0 && (
              <button
                onClick={deleteSelectedSongs}
                disabled={isPending}
                className="flex items-center gap-2 px-3 py-1.5 text-sm bg-tokyo-red hover:bg-tokyo-magenta disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
              >
                <Trash2 size={16} />
                {isPending ? 'Deleting...' : `Delete (${selectedSongs.size})`}
              </button>
            )}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto pb-36 sm:pb-32 p-3 sm:p-6">
        {songs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-tokyo-comment mb-2">
                No songs yet
              </h2>
              <p className="text-tokyo-fg-gutter">
                Search YouTube or paste a URL to add your first song
              </p>
            </div>
          </div>
        ) : (
          <div>
            {!isSelectionMode && (
              <div className="mb-4">
                <button
                  onClick={toggleSelectionMode}
                  className="flex items-center gap-2 bg-tokyo-red hover:bg-tokyo-magenta text-white px-4 py-2 rounded-lg transition-colors"
                  title="Select multiple songs"
                >
                  <CheckSquare size={18} />
                  <span className="text-sm font-medium">Select songs</span>
                </button>
              </div>
            )}
            <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4 sm:gap-6">
              {songs.map((song) => (
                <SongCard
                  key={song.id}
                  song={song}
                  onPlay={handlePlaySong}
                  onDelete={handleDeleteSong}
                  playlists={playlists}
                  onAddToPlaylist={handleAddToPlaylist}
                  isSelectionMode={isSelectionMode}
                  isSelected={selectedSongs.has(song.id)}
                  onToggleSelection={toggleSongSelection}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </>
  )
}

// Export the add song handler for Header component
export { addSong }
