'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import Image from 'next/image'
import { Plus, X, Music, Trash2, Play, Search, Loader2 } from 'lucide-react'
import { useRadio } from './RadioContext'
import { AVATAR_COLORS } from './NamePickerModal'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface SearchResult {
  id: string
  title: string
  channel: string
  thumbnail: string
  duration: number
}

function isYouTubeUrl(input: string): boolean {
  const trimmed = input.trim().toLowerCase()
  return (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be')
  )
}

interface AddSongModalProps {
  onClose: () => void
  onAdd: (url: string) => Promise<boolean>
}

function AddSongModal({ onClose, onAdd }: AddSongModalProps) {
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || isYouTubeUrl(query)) {
      setSearchResults([])
      return
    }

    setIsSearching(true)

    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`)
      if (res.ok) {
        const results = await res.json()
        setSearchResults(results)
      }
    } catch (error) {
      console.error('Search error:', error)
      setSearchResults([])
    } finally {
      setIsSearching(false)
    }
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
    setInput(value)
    setError('')

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    if (isYouTubeUrl(value)) {
      setSearchResults([])
      return
    }

    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value)
      }, 500)
    } else {
      setSearchResults([])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || !isYouTubeUrl(input)) return

    setIsLoading(true)
    setError('')

    const success = await onAdd(input.trim())

    if (success) {
      onClose()
    } else {
      setError('Failed to add song. Please check the URL.')
      setIsLoading(false)
    }
  }

  const handleSelectResult = async (result: SearchResult) => {
    const url = `https://www.youtube.com/watch?v=${result.id}`
    setIsLoading(true)
    setError('')

    const success = await onAdd(url)

    if (success) {
      onClose()
    } else {
      setError('Failed to add song.')
      setIsLoading(false)
    }
  }

  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const isUrl = isYouTubeUrl(input)

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-lg border border-gray-700 relative max-h-[90vh] flex flex-col">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="text-xl font-bold text-white mb-4">
          Add Song to Queue
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Search YouTube or paste URL
            </label>
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                <Search size={18} />
              </div>
              <input
                type="text"
                value={input}
                onChange={handleInputChange}
                placeholder="Search or paste YouTube URL..."
                className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                autoFocus
                disabled={isLoading}
              />
            </div>
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          {isUrl && (
            <button
              type="submit"
              disabled={!input.trim() || isLoading}
              className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus size={18} />
                  Add to Queue
                </>
              )}
            </button>
          )}
        </form>

        {/* Search Results */}
        {!isUrl && (isSearching || searchResults.length > 0) && (
          <div className="mt-4 flex-1 overflow-hidden flex flex-col">
            {isSearching ? (
              <div className="flex items-center justify-center gap-3 py-8 text-gray-400">
                <Loader2 className="animate-spin" size={24} />
                <span>Searching YouTube...</span>
              </div>
            ) : (
              <>
                <p className="text-gray-500 text-sm mb-2">
                  {searchResults.length} results found
                </p>
                <div className="overflow-y-auto flex-1 space-y-1 max-h-72">
                  {searchResults.map((result) => (
                    <button
                      key={result.id}
                      onClick={() => handleSelectResult(result)}
                      disabled={isLoading}
                      className="w-full flex items-center gap-3 p-2 hover:bg-gray-800 rounded-lg transition-colors text-left group disabled:opacity-50"
                    >
                      <div className="relative w-20 h-12 flex-shrink-0 rounded overflow-hidden bg-gray-800">
                        <Image
                          src={result.thumbnail}
                          alt={result.title}
                          fill
                          className="object-cover"
                          unoptimized
                        />
                        <span className="absolute bottom-0.5 right-0.5 bg-black/80 text-white text-xs px-1 rounded">
                          {formatDuration(result.duration)}
                        </span>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="text-white text-sm font-medium truncate" title={result.title}>
                          {result.title}
                        </h4>
                        <p className="text-gray-500 text-xs truncate" title={result.channel}>
                          {result.channel}
                        </p>
                      </div>

                      <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="bg-green-600 rounded-full p-1.5">
                          <Plus size={14} className="text-white" />
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function RadioQueue() {
  const { queue, session, isAdmin, addToQueue, removeFromQueue, clearQueue, playFromQueue } = useRadio()
  const [showAddModal, setShowAddModal] = useState(false)

  const handleClearQueue = async () => {
    if (confirm('Are you sure you want to clear the entire queue?')) {
      await clearQueue()
    }
  }

  const handleAdd = async (url: string) => {
    return await addToQueue(url, true)
  }

  const handleRemove = async (queueItemId: string) => {
    await removeFromQueue(queueItemId)
  }

  const handlePlay = async (queueItemId: string) => {
    await playFromQueue(queueItemId)
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <Music size={18} />
          Queue
        </h3>
        <div className="flex items-center gap-2">
          {isAdmin && queue.length > 0 && (
            <button
              onClick={handleClearQueue}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
            >
              <Trash2 size={16} />
              Clear
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1 transition-colors"
          >
            <Plus size={16} />
            Add Song
          </button>
        </div>
      </div>

      {queue.length === 0 ? (
        <div className="text-center py-8">
          <Music size={32} className="mx-auto text-gray-600 mb-2" />
          <p className="text-gray-500">Queue is empty</p>
          <p className="text-gray-600 text-sm">Add songs to get the party started!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {queue.map((item, index) => (
            <div
              key={item.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-gray-900/50 hover:bg-gray-900"
            >
              <span className="text-gray-500 text-sm w-5 text-center">
                {index + 1}
              </span>

              <div className="relative w-10 h-10 rounded overflow-hidden bg-gray-900 flex-shrink-0">
                <Image
                  src={item.song.thumbnail}
                  alt={item.song.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-white text-sm truncate">{item.song.title}</p>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{formatDuration(item.song.duration)}</span>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: AVATAR_COLORS[0] }}
                    />
                    <span>{item.addedByName}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isAdmin && (
                  <button
                    onClick={() => handlePlay(item.id)}
                    className="text-gray-500 hover:text-green-500 p-1"
                    title="Play this song now"
                  >
                    <Play size={16} />
                  </button>
                )}
                {(isAdmin || item.addedBy === session?.id) && (
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="text-gray-500 hover:text-red-500 p-1"
                    title="Remove from queue"
                  >
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <AddSongModal
          onClose={() => setShowAddModal(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
