'use client'

import { useState } from 'react'
import { Lock, X } from 'lucide-react'

interface AdminLoginModalProps {
  onSubmit: (password: string) => Promise<boolean>
  onClose: () => void
}

export default function AdminLoginModal({ onSubmit, onClose }: AdminLoginModalProps) {
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return

    setIsLoading(true)
    setError('')

    const success = await onSubmit(password)

    if (success) {
      onClose()
    } else {
      setError('Invalid password')
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-xl p-6 w-full max-w-sm border border-gray-700 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <div className="flex items-center justify-center mb-4">
          <div className="bg-yellow-500/20 p-3 rounded-full">
            <Lock size={24} className="text-yellow-500" />
          </div>
        </div>

        <h2 className="text-xl font-bold text-white mb-2 text-center">
          Admin Login
        </h2>
        <p className="text-gray-400 text-center mb-6 text-sm">
          Enter the admin password to control playback
        </p>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password..."
              className="w-full bg-gray-800 border border-gray-600 rounded-lg py-3 px-4 text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-sm mt-2">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!password.trim() || isLoading}
            className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-lg transition-colors"
          >
            {isLoading ? 'Authenticating...' : 'Login as Admin'}
          </button>
        </form>
      </div>
    </div>
  )
}
