'use client'

import { useState } from 'react'
import { Users, Crown, VolumeX, UserCheck, Volume2 } from 'lucide-react'
import { useRadio } from './RadioContext'
import { AVATAR_COLORS } from './NamePickerModal'

export default function ListenersList() {
  const { listeners, session, isAdmin, updateListener, clearPendingListenerUpdate } = useRadio()
  const [updating, setUpdating] = useState<string | null>(null)

  const toggleVoteStatus = async (listenerId: string, currentStatus: boolean) => {
    // Optimistic update - instant UI feedback
    updateListener(listenerId, { countsForVotes: !currentStatus })
    setUpdating(listenerId)
    try {
      const res = await fetch(`/api/radio/sessions/${listenerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countsForVotes: !currentStatus })
      })
      if (!res.ok) {
        // Revert on error
        updateListener(listenerId, { countsForVotes: currentStatus })
        const data = await res.json()
        console.error('Failed to toggle vote status:', data.error)
      }
    } catch (err) {
      // Revert on error
      updateListener(listenerId, { countsForVotes: currentStatus })
      console.error('Error toggling vote status:', err)
    } finally {
      setUpdating(null)
      clearPendingListenerUpdate(listenerId)
    }
  }

  const toggleMuteStatus = async (listenerId: string, currentStatus: boolean) => {
    // Optimistic update - instant UI feedback
    updateListener(listenerId, { isMuted: !currentStatus })
    setUpdating(`mute-${listenerId}`)
    try {
      const res = await fetch(`/api/radio/sessions/${listenerId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isMuted: !currentStatus })
      })
      if (!res.ok) {
        // Revert on error
        updateListener(listenerId, { isMuted: currentStatus })
        const data = await res.json()
        console.error('Failed to toggle mute status:', data.error)
      }
    } catch (err) {
      // Revert on error
      updateListener(listenerId, { isMuted: currentStatus })
      console.error('Error toggling mute status:', err)
    } finally {
      setUpdating(null)
      clearPendingListenerUpdate(listenerId)
    }
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <h3 className="text-white font-semibold flex items-center gap-2 mb-4">
        <Users size={18} />
        Listeners ({listeners.length})
      </h3>

      {listeners.length === 0 ? (
        <p className="text-gray-500 text-sm text-center py-4">
          No one is listening yet
        </p>
      ) : (
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {listeners.map((listener) => (
            <div
              key={listener.id}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                listener.id === session?.id ? 'bg-gray-700/50' : ''
              }`}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium text-sm flex-shrink-0"
                style={{ backgroundColor: AVATAR_COLORS[listener.colorIndex] || AVATAR_COLORS[0] }}
              >
                {listener.displayName[0].toUpperCase()}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm truncate">
                    {listener.displayName}
                  </span>
                  {listener.id === session?.id && (
                    <span className="text-xs text-gray-500">(you)</span>
                  )}
                  {listener.isAdmin && (
                    <Crown size={14} className="text-yellow-500" />
                  )}
                  {!listener.countsForVotes && (
                    <span title="Cannot vote">
                      <VolumeX size={14} className="text-gray-500" />
                    </span>
                  )}
                </div>
              </div>

              {/* Admin controls */}
              {isAdmin && listener.id !== session?.id && (
                <div className="flex items-center gap-1">
                  {/* Toggle vote status */}
                  <button
                    onClick={() => toggleVoteStatus(listener.id, listener.countsForVotes)}
                    disabled={updating === listener.id}
                    className={`p-1.5 rounded transition-colors ${
                      listener.countsForVotes
                        ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                        : 'bg-gray-600/20 text-gray-500 hover:bg-gray-600/30'
                    } ${updating === listener.id ? 'opacity-50' : ''}`}
                    title={listener.countsForVotes ? 'Can vote - click to disable' : 'Cannot vote - click to enable'}
                  >
                    <UserCheck size={14} />
                  </button>
                  {/* Toggle mute status */}
                  <button
                    onClick={() => toggleMuteStatus(listener.id, listener.isMuted)}
                    disabled={updating === `mute-${listener.id}`}
                    className={`p-1.5 rounded transition-colors ${
                      listener.isMuted
                        ? 'bg-red-600/20 text-red-400 hover:bg-red-600/30'
                        : 'bg-gray-600/20 text-gray-500 hover:bg-gray-600/30'
                    } ${updating === `mute-${listener.id}` ? 'opacity-50' : ''}`}
                    title={listener.isMuted ? 'Muted - click to unmute' : 'Not muted - click to mute'}
                  >
                    {listener.isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                  </button>
                </div>
              )}

              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
