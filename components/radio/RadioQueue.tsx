'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Plus, X, Music, Trash2, Play } from 'lucide-react'
import { useRadio } from './RadioContext'
import { AVATAR_COLORS } from './NamePickerModal'

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface AddSongModalProps {
  onClose: () => void
  onAdd: (url: string) => Promise<boolean>
}

function AddSongModal({ onClose, onAdd }: AddSongModalProps) {
  const [url, setUrl] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim()) return

    setIsLoading(true)
    setError('')

    const success = await onAdd(url.trim())

    if (success) {
      onClose()
    } else {
      setError('Failed to add song. Please check the URL.')
      setIsLoading(false)
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

        <h2 className="text-xl font-bold text-white mb-4">
          Add Song to Queue
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              YouTube URL
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://youtube.com/watch?v=..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!url.trim() || isLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {isLoading ? 'Adding...' : 'Add to Queue'}
          </button>
        </form>
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
