'use client'

import { useEffect } from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import Link from 'next/link'

export default function PlaylistsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Playlists error:', error)
  }, [error])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Simple navbar placeholder */}
      <div className="h-14 bg-tokyo-bg-hl border-b border-tokyo-border flex items-center px-6">
        <Link href="/" className="text-tokyo-fg hover:text-tokyo-blue">
          &larr; Home
        </Link>
      </div>

      {/* Error content */}
      <main className="flex-1 flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertCircle size={64} className="mx-auto text-tokyo-red mb-4" />
          <h2 className="text-2xl font-bold text-tokyo-fg mb-2">
            Failed to load playlists
          </h2>
          <p className="text-tokyo-comment mb-6">
            {error.message || 'An unexpected error occurred while loading your playlists'}
          </p>
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-6 py-3 bg-tokyo-blue hover:bg-tokyo-cyan text-tokyo-bg rounded-lg transition-colors font-medium"
          >
            <RefreshCw size={18} />
            Try again
          </button>
        </div>
      </main>
    </div>
  )
}
