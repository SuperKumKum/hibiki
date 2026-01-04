'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Play, Trash2, ListPlus, ArrowRight, CheckSquare } from 'lucide-react'

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

interface SongCardProps {
  song: Song
  onPlay: (song: Song) => void
  onDelete: (songId: string) => void
  playlists?: Playlist[]
  onAddToPlaylist?: (songId: string, playlistId: string) => void
  currentPlaylistId?: string
  onMoveToPlaylist?: (songId: string, fromPlaylistId: string, toPlaylistId: string) => void
  isSelectionMode?: boolean
  isSelected?: boolean
  onToggleSelection?: (songId: string) => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function SongCard({
  song,
  onPlay,
  onDelete,
  playlists,
  onAddToPlaylist,
  currentPlaylistId,
  onMoveToPlaylist,
  isSelectionMode = false,
  isSelected = false,
  onToggleSelection
}: SongCardProps) {
  const [showPlaylistMenu, setShowPlaylistMenu] = useState(false)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(song.id)
  }

  const handleAddToPlaylist = (e: React.MouseEvent, playlistId: string) => {
    e.stopPropagation()
    if (onAddToPlaylist) {
      onAddToPlaylist(song.id, playlistId)
    }
    setShowPlaylistMenu(false)
  }

  const handleMoveToPlaylist = (e: React.MouseEvent, toPlaylistId: string) => {
    e.stopPropagation()
    if (onMoveToPlaylist && currentPlaylistId) {
      onMoveToPlaylist(song.id, currentPlaylistId, toPlaylistId)
    }
    setShowMoveMenu(false)
  }

  const toggleMoveMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowMoveMenu(!showMoveMenu)
  }

  const togglePlaylistMenu = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowPlaylistMenu(!showPlaylistMenu)
  }

  return (
    <div className={`bg-tokyo-bg-hl rounded-lg p-4 transition-colors group relative ${
      isSelectionMode
        ? 'cursor-default hover:bg-tokyo-bg-menu'
        : 'cursor-pointer hover:bg-tokyo-bg-menu'
    } ${isSelected ? 'ring-2 ring-tokyo-cyan bg-tokyo-bg-menu' : ''}`}
    onClick={isSelectionMode ? () => onToggleSelection?.(song.id) : () => onPlay(song)}>

      {/* Selection checkbox */}
      {isSelectionMode && (
        <div className="absolute top-2 left-2 z-20">
          <button
            onClick={(e) => {
              e.stopPropagation()
              onToggleSelection?.(song.id)
            }}
            className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
              isSelected
                ? 'bg-tokyo-cyan border-tokyo-cyan text-tokyo-bg'
                : 'border-tokyo-comment hover:border-tokyo-fg-dark'
            }`}
          >
            {isSelected && <CheckSquare size={14} fill="currentColor" />}
          </button>
        </div>
      )}

      <div className="absolute top-2 right-2 z-10 flex gap-2">
        {!isSelectionMode && playlists && playlists.length > 0 && onAddToPlaylist && (
          <div className="relative">
            <button
              onClick={togglePlaylistMenu}
              className="bg-tokyo-blue cursor-pointer rounded-full p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-tokyo-cyan"
              title="Add to playlist"
            >
              <ListPlus size={16} className="text-tokyo-bg" />
            </button>

            {showPlaylistMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-tokyo-bg-hl border border-tokyo-border rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto z-20">
                {playlists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={(e) => handleAddToPlaylist(e, playlist.id)}
                    className="w-full cursor-pointer text-left px-4 py-2 text-sm text-tokyo-fg hover:bg-tokyo-bg-menu transition-colors"
                  >
                    {playlist.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {!isSelectionMode && currentPlaylistId && playlists && playlists.length > 1 && onMoveToPlaylist && (
          <div className="relative">
            <button
              onClick={toggleMoveMenu}
              className="bg-tokyo-blue cursor-pointer rounded-full p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-tokyo-cyan"
              title="Move to another playlist"
            >
              <ArrowRight size={16} className="text-tokyo-bg" />
            </button>

            {showMoveMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-tokyo-bg-hl border border-tokyo-border rounded-lg shadow-lg py-1 max-h-60 overflow-y-auto z-20">
                {playlists
                  .filter(playlist => playlist.id !== currentPlaylistId)
                  .map((playlist) => (
                    <button
                      key={playlist.id}
                      onClick={(e) => handleMoveToPlaylist(e, playlist.id)}
                      className="w-full cursor-pointer text-left px-4 py-2 text-sm text-tokyo-fg hover:bg-tokyo-bg-menu transition-colors"
                    >
                      {playlist.name}
                    </button>
                  ))}
              </div>
            )}
          </div>
        )}

        {!isSelectionMode && (
        <button
          onClick={handleDelete}
          className="bg-tokyo-red cursor-pointer rounded-full p-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity hover:bg-tokyo-magenta"
          title="Delete song"
        >
          <Trash2 size={16} className="text-white" />
        </button>
        )}
      </div>

      <div className="relative mb-4 w-full aspect-video rounded-md overflow-hidden bg-tokyo-bg">
        <Image
          src={song.thumbnail}
          alt={song.title}
          fill
          className="object-cover"
          unoptimized
        />
        <div className="absolute inset-0 bg-transparent bg-opacity-0 group-hover:bg-opacity-40 transition-all flex items-center justify-center">
          <button
            onClick={() => onPlay(song)}
            className="opacity-0 cursor-pointer group-hover:opacity-100 transition-opacity bg-tokyo-blue rounded-full p-3 hover:bg-tokyo-cyan hover:scale-110 transform"
          >
            <Play size={24} fill="#1a1b26" className="text-tokyo-bg ml-0.5" />
          </button>
        </div>
      </div>

      <h3 className="text-tokyo-fg font-semibold mb-1 truncate" title={song.title}>
        {song.title}
      </h3>

      {song.playlists && song.playlists.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {song.playlists.slice(0, 2).map((playlist) => (
            <span
              key={playlist.id}
              className="inline-block bg-tokyo-purple text-tokyo-bg text-xs px-2 py-0.5 rounded-full truncate max-w-20"
              title={playlist.name}
            >
              {playlist.name}
            </span>
          ))}
          {song.playlists.length > 2 && (
            <span className="inline-block bg-tokyo-fg-gutter text-tokyo-fg text-xs px-2 py-0.5 rounded-full">
              +{song.playlists.length - 2}
            </span>
          )}
        </div>
      )}

      <div className="flex justify-between items-center">
        <p className="text-tokyo-comment text-sm truncate flex-1" title={song.channelName}>
          {song.channelName}
        </p>
        <span className="text-tokyo-fg-gutter text-xs ml-2">
          {formatDuration(song.duration)}
        </span>
      </div>
    </div>
  )
}
