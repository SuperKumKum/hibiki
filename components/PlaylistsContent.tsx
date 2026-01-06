'use client'

import { useState, useEffect, useTransition, useRef } from 'react'
import { Plus, Trash2, Music, Play, Menu, X, Download, Loader2, CheckCircle, HardDrive, Upload } from 'lucide-react'
import Image from 'next/image'
import { useToast } from '@/components/Toast'
import { usePlayer } from '@/components/PlayerContext'
import { createPlaylist, deletePlaylist, removeFromPlaylist, addToPlaylist } from '@/lib/actions/library'

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

interface PlaylistsContentProps {
  initialPlaylists: Playlist[]
}

interface DownloadStatus {
  playlistId: string
  isDownloading: boolean
  progress: { downloaded: number; total: number; failed: number } | null
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

// Upload Modal Component
function UploadModal({ playlistId, playlistName, onClose, onSuccess }: {
  playlistId: string
  playlistName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [channelName, setChannelName] = useState('')
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) {
      if (!selected.name.toLowerCase().endsWith('.mp3')) {
        setError('Only MP3 files are allowed')
        setFile(null)
        return
      }
      if (selected.size > 50 * 1024 * 1024) {
        setError('File size exceeds 50MB limit')
        setFile(null)
        return
      }
      setFile(selected)
      setError('')
      if (!title) {
        setTitle(selected.name.replace(/\.mp3$/i, ''))
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!file) return

    setIsUploading(true)
    setError('')

    const formData = new FormData()
    formData.append('file', file)
    if (title) formData.append('title', title)
    if (channelName) formData.append('channelName', channelName)

    try {
      const response = await fetch(`/api/playlists/${playlistId}/upload`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        onSuccess()
        onClose()
      } else {
        const data = await response.json()
        setError(data.error || 'Upload failed')
      }
    } catch {
      setError('Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-2">Upload MP3</h2>
        <p className="text-gray-400 text-sm mb-4">
          Upload to: <span className="text-white">{playlistName}</span>
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">MP3 File</label>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".mp3,audio/mpeg"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full bg-gray-800 border border-gray-600 border-dashed rounded-lg py-4 px-4 text-gray-400 hover:text-white hover:border-gray-500 transition-colors"
            >
              {file ? (
                <span className="text-white">{file.name}</span>
              ) : (
                <span>Click to select MP3 file (max 50MB)</span>
              )}
            </button>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Title (optional)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Song title..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">Artist (optional)</label>
            <input
              type="text"
              value={channelName}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="Artist name..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

          <button
            type="submit"
            disabled={!file || isUploading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {isUploading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload size={18} />
                Upload
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function PlaylistsContent({ initialPlaylists }: PlaylistsContentProps) {
  const [playlists, setPlaylists] = useState<Playlist[]>(initialPlaylists)
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null)
  const [newPlaylistName, setNewPlaylistName] = useState('')
  const [newPlaylistUrl, setNewPlaylistUrl] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([])
  const [showSidebar, setShowSidebar] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [downloadStatus, setDownloadStatus] = useState<DownloadStatus | null>(null)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const { showToast } = useToast()
  const { playSong } = usePlayer()

  useEffect(() => {
    if (selectedPlaylist) {
      const songs = selectedPlaylist.playlistSongs.map((ps) => ps.song)
      setPlaylistSongs(songs)
    }
  }, [selectedPlaylist])

  const getDownloadedCount = (playlist: Playlist) => {
    return playlist.playlistSongs.filter(ps => ps.song.isDownloaded).length
  }

  const handleDownloadPlaylist = async (playlist: Playlist) => {
    if (downloadStatus?.isDownloading) {
      showToast('A download is already in progress', 'error')
      return
    }

    setDownloadStatus({
      playlistId: playlist.id,
      isDownloading: true,
      progress: { downloaded: 0, total: playlist.playlistSongs.length, failed: 0 }
    })

    try {
      const response = await fetch(`/api/playlists/${playlist.id}/download`, { method: 'POST' })

      if (response.ok) {
        const result = await response.json()
        setDownloadStatus({
          playlistId: playlist.id,
          isDownloading: false,
          progress: {
            downloaded: result.results.downloaded + result.results.skipped,
            total: result.results.total,
            failed: result.results.failed
          }
        })

        await refreshPlaylist(playlist.id)

        if (result.results.failed > 0) {
          showToast(`Downloaded ${result.results.downloaded} songs, ${result.results.failed} failed`, 'error')
        } else {
          showToast(`Downloaded ${result.results.downloaded} songs (${result.results.skipped} already downloaded)`, 'success')
        }
      } else {
        const error = await response.json()
        showToast(error.error || 'Download failed', 'error')
        setDownloadStatus(null)
      }
    } catch {
      showToast('Download failed', 'error')
      setDownloadStatus(null)
    }
  }

  const refreshPlaylist = async (playlistId: string) => {
    const statusResponse = await fetch(`/api/playlists/${playlistId}`)
    if (statusResponse.ok) {
      const updatedPlaylist = await statusResponse.json()
      setPlaylists(prev => prev.map(p =>
        p.id === playlistId ? { ...p, playlistSongs: updatedPlaylist.playlistSongs } : p
      ))
      if (selectedPlaylist?.id === playlistId) {
        setSelectedPlaylist(prev => prev ? { ...prev, playlistSongs: updatedPlaylist.playlistSongs } : null)
      }
    }
  }

  const handleUploadSuccess = async () => {
    if (selectedPlaylist) {
      await refreshPlaylist(selectedPlaylist.id)
      showToast('File uploaded successfully', 'success')
    }
  }

  const handleCreatePlaylist = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim()) return

    if (newPlaylistUrl.trim()) {
      try {
        const response = await fetch('/api/playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newPlaylistName, youtubeUrl: newPlaylistUrl.trim() }),
        })

        if (response.ok) {
          const result = await response.json()
          setPlaylists((prev) => [result.playlist, ...prev])
          showToast(result.addedSongs > 0 ? `Playlist created with ${result.addedSongs} songs!` : 'Playlist created', 'success')
          setNewPlaylistName('')
          setNewPlaylistUrl('')
          setShowCreateForm(false)
        } else {
          const error = await response.json()
          showToast(error.error || 'Error creating playlist', 'error')
        }
      } catch {
        showToast('Error creating playlist', 'error')
      }
      return
    }

    startTransition(async () => {
      const result = await createPlaylist(newPlaylistName)
      if (result.success && result.data) {
        setPlaylists((prev) => [{ ...result.data!, playlistSongs: [] }, ...prev])
        showToast('Playlist created', 'success')
        setNewPlaylistName('')
        setNewPlaylistUrl('')
        setShowCreateForm(false)
      } else if (!result.success) {
        showToast(result.error, 'error')
      }
    })
  }

  const handleDeletePlaylist = async (playlistId: string) => {
    if (!confirm('Delete this playlist?')) return

    startTransition(async () => {
      const result = await deletePlaylist(playlistId)
      if (result.success) {
        setPlaylists((prev) => prev.filter((p) => p.id !== playlistId))
        if (selectedPlaylist?.id === playlistId) {
          setSelectedPlaylist(null)
        }
        showToast('Playlist deleted', 'success')
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  const handleRemoveSong = async (songId: string) => {
    if (!selectedPlaylist) return

    startTransition(async () => {
      const result = await removeFromPlaylist(selectedPlaylist.id, songId)
      if (result.success) {
        const updatedPlaylistSongs = selectedPlaylist.playlistSongs.filter((ps) => ps.song.id !== songId)
        const updatedPlaylist = { ...selectedPlaylist, playlistSongs: updatedPlaylistSongs }
        setSelectedPlaylist(updatedPlaylist)
        setPlaylists((prev) => prev.map((p) => p.id === selectedPlaylist.id ? updatedPlaylist : p))
        showToast('Song removed', 'success')
      } else {
        showToast(result.error, 'error')
      }
    })
  }

  const handlePlaySong = (song: Song, index: number) => {
    playSong(song, index, playlistSongs, true)
  }

  const handlePlayPlaylist = (playlist: Playlist) => {
    const songs = playlist.playlistSongs.map((ps) => ps.song)
    if (songs.length > 0) {
      setPlaylistSongs(songs)
      playSong(songs[0], 0, songs, true)
      setSelectedPlaylist(playlist)
    }
  }

  return (
    <>
      {/* Mobile header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-gray-800 z-50 relative">
        <h1 className="text-xl font-bold text-white">Playlists</h1>
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="p-2 cursor-pointer text-gray-400 hover:text-white transition-colors"
        >
          {showSidebar ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
        {/* Sidebar */}
        <div className={`${showSidebar ? 'block' : 'hidden'} lg:block absolute lg:relative inset-0 lg:inset-auto z-40 lg:z-auto w-full lg:w-80 bg-gray-900 lg:bg-transparent border-b lg:border-b-0 lg:border-r border-gray-800 overflow-y-auto p-3 sm:p-6`}>
          <div className="mb-4">
            {!showCreateForm ? (
              <button
                onClick={() => setShowCreateForm(true)}
                className="w-full cursor-pointer flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                <Plus size={20} />
                New Playlist
              </button>
            ) : (
              <form onSubmit={handleCreatePlaylist} className="space-y-2">
                <input
                  type="text"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  placeholder="Playlist name..."
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  autoFocus
                />
                <input
                  type="url"
                  value={newPlaylistUrl}
                  onChange={(e) => setNewPlaylistUrl(e.target.value)}
                  placeholder="YouTube playlist URL (optional)..."
                  className="w-full px-4 py-2 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <div className="flex gap-2">
                  <button type="submit" disabled={isPending} className="flex-1 cursor-pointer px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50">
                    {isPending ? 'Creating...' : 'Create'}
                  </button>
                  <button type="button" onClick={() => { setShowCreateForm(false); setNewPlaylistName(''); setNewPlaylistUrl('') }} className="flex-1 cursor-pointer px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>

          <div className="space-y-2">
            {playlists.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No playlists</p>
            ) : (
              playlists.map((playlist) => (
                <div
                  key={playlist.id}
                  className={`flex items-center justify-between p-3 rounded-lg transition-colors ${selectedPlaylist?.id === playlist.id ? 'bg-gray-700' : 'bg-gray-800 hover:bg-gray-700'}`}
                >
                  <div onClick={() => { setSelectedPlaylist(playlist); setShowSidebar(false) }} className="flex-1 min-w-0 cursor-pointer">
                    <h3 className="text-white font-semibold truncate">{playlist.name}</h3>
                    <p className="text-gray-400 text-sm">
                      {playlist.playlistSongs.length} song{playlist.playlistSongs.length !== 1 ? 's' : ''}
                      {getDownloadedCount(playlist) > 0 && (
                        <span className={getDownloadedCount(playlist) === playlist.playlistSongs.length ? 'text-green-400 ml-2' : 'text-yellow-400 ml-2'}>
                          ({getDownloadedCount(playlist)} local)
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    {playlist.playlistSongs.length > 0 && (
                      <>
                        <button onClick={(e) => { e.stopPropagation(); handleDownloadPlaylist(playlist) }} disabled={downloadStatus?.isDownloading} className="p-2 cursor-pointer text-gray-400 hover:text-blue-400 disabled:opacity-50" title="Download playlist">
                          {downloadStatus?.isDownloading && downloadStatus.playlistId === playlist.id ? <Loader2 size={18} className="animate-spin" /> : <Download size={18} />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handlePlayPlaylist(playlist); setShowSidebar(false) }} className="p-2 cursor-pointer bg-green-500 rounded-full hover:bg-green-600" title="Play">
                          <Play size={18} fill="white" className="text-white ml-0.5" />
                        </button>
                      </>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(playlist.id) }} className="p-2 cursor-pointer text-gray-400 hover:text-red-500" title="Delete">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {showSidebar && <div className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-30" onClick={() => setShowSidebar(false)} />}

        {/* Main content */}
        <main className="flex-1 overflow-y-auto pb-36 sm:pb-32 p-3 sm:p-6">
          {!selectedPlaylist ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Music size={64} className="mx-auto text-gray-600 mb-4" />
                <h2 className="text-2xl font-bold text-gray-400 mb-2">Select a playlist</h2>
                <p className="text-gray-500">Or create a new one to start</p>
              </div>
            </div>
          ) : (
            <div>
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h2 className="text-2xl font-bold text-white">{selectedPlaylist.name}</h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
                    {getDownloadedCount(selectedPlaylist) === selectedPlaylist.playlistSongs.length && selectedPlaylist.playlistSongs.length > 0 ? (
                      <span className="flex items-center gap-1 text-green-400"><CheckCircle size={16} />All local</span>
                    ) : (
                      <span className="text-gray-400">{getDownloadedCount(selectedPlaylist)}/{selectedPlaylist.playlistSongs.length} local</span>
                    )}
                  </div>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors"
                  >
                    <Upload size={18} />
                    Upload MP3
                  </button>
                  <button
                    onClick={() => handleDownloadPlaylist(selectedPlaylist)}
                    disabled={downloadStatus?.isDownloading || getDownloadedCount(selectedPlaylist) === selectedPlaylist.playlistSongs.length}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {downloadStatus?.isDownloading && downloadStatus.playlistId === selectedPlaylist.id ? (
                      <><Loader2 size={18} className="animate-spin" />Downloading...</>
                    ) : (
                      <><Download size={18} />Download All</>
                    )}
                  </button>
                </div>
              </div>

              {/* Song list (list view) */}
              {selectedPlaylist.playlistSongs.length === 0 ? (
                <div className="text-center py-12">
                  <Music size={48} className="mx-auto text-gray-600 mb-4" />
                  <p className="text-gray-400">No songs in this playlist</p>
                  <p className="text-gray-500 text-sm">Upload MP3 files or add from home page</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {selectedPlaylist.playlistSongs.map((ps, index) => (
                    <div
                      key={ps.id}
                      className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 hover:bg-gray-800 transition-colors group"
                    >
                      <span className="text-gray-500 text-sm w-6 text-right">{index + 1}</span>

                      <div className="relative w-12 h-12 rounded overflow-hidden bg-gray-900 flex-shrink-0">
                        <Image src={ps.song.thumbnail} alt={ps.song.title} fill className="object-cover" unoptimized />
                        <button
                          onClick={() => handlePlaySong(ps.song, index)}
                          className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                        >
                          <Play size={20} fill="white" className="text-white ml-0.5" />
                        </button>
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white font-medium truncate">{ps.song.title}</p>
                        <p className="text-gray-400 text-sm truncate">{ps.song.channelName}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        {ps.song.isDownloaded && (
                          <span title="Downloaded locally">
                            <HardDrive size={16} className="text-green-400" />
                          </span>
                        )}
                        <span className="text-gray-500 text-sm">{formatDuration(ps.song.duration)}</span>
                        <button
                          onClick={() => handleRemoveSong(ps.song.id)}
                          className="p-2 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Upload Modal */}
      {showUploadModal && selectedPlaylist && (
        <UploadModal
          playlistId={selectedPlaylist.id}
          playlistName={selectedPlaylist.name}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
        />
      )}
    </>
  )
}
