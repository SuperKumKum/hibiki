'use client'

import { useState } from 'react'
import { User, Shuffle } from 'lucide-react'

const RANDOM_NAMES = [
  'DJ Llama', 'Beat Beaver', 'Rhythm Raccoon', 'Melody Moose',
  'Funky Fox', 'Groove Giraffe', 'Sonic Sloth', 'Bass Bear',
  'Tempo Tiger', 'Vibe Vulture', 'Wave Wolf', 'Disco Duck',
  'Jammin Jaguar', 'Synth Snake', 'Echo Eagle', 'Pulse Panda'
]

const AVATAR_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
  '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
]

interface NamePickerModalProps {
  onJoin: (name: string, colorIndex: number) => void
  isLoading?: boolean
}

export default function NamePickerModal({ onJoin, isLoading }: NamePickerModalProps) {
  const [name, setName] = useState('')
  const [colorIndex, setColorIndex] = useState(0)

  const getRandomName = () => {
    const randomIndex = Math.floor(Math.random() * RANDOM_NAMES.length)
    setName(RANDOM_NAMES[randomIndex])
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (name.trim()) {
      onJoin(name.trim(), colorIndex)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Join the Radio
        </h2>
        <p className="text-gray-400 text-center mb-6">
          Pick a name and color to join the listening party
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Your Name
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name..."
                  maxLength={20}
                  className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:outline-none focus:border-green-500"
                />
              </div>
              <button
                type="button"
                onClick={getRandomName}
                className="bg-gray-700 hover:bg-gray-600 text-white px-4 rounded-lg transition-colors"
                title="Random name"
              >
                <Shuffle size={18} />
              </button>
            </div>
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Avatar Color
            </label>
            <div className="flex gap-3 justify-center">
              {AVATAR_COLORS.map((color, index) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setColorIndex(index)}
                  className={`w-10 h-10 rounded-full transition-transform ${
                    colorIndex === index ? 'ring-2 ring-white ring-offset-2 ring-offset-gray-900 scale-110' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: AVATAR_COLORS[colorIndex] }}
            >
              {name.trim() ? name.trim()[0].toUpperCase() : '?'}
            </div>
            <div>
              <p className="text-white font-medium">
                {name.trim() || 'Your Name'}
              </p>
              <p className="text-gray-400 text-sm">Preview</p>
            </div>
          </div>

          <button
            type="submit"
            disabled={!name.trim() || isLoading}
            className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {isLoading ? 'Joining...' : 'Join Radio'}
          </button>
        </form>
      </div>
    </div>
  )
}

export { AVATAR_COLORS }
