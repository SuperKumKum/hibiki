'use client'

import { Users, Crown } from 'lucide-react'
import { useRadio } from './RadioContext'
import { AVATAR_COLORS } from './NamePickerModal'

export default function ListenersList() {
  const { listeners, session } = useRadio()

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
                </div>
              </div>

              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
