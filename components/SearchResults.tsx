'use client'

import Image from 'next/image'
import { Plus, Loader2 } from 'lucide-react'

interface SearchResult {
  id: string
  title: string
  channel: string
  thumbnail: string
  duration: number
}

interface SearchResultsProps {
  results: SearchResult[]
  isLoading: boolean
  onSelect: (result: SearchResult) => void
  onClose: () => void
}

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

export default function SearchResults({ results, isLoading, onSelect, onClose }: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className="absolute top-full left-0 right-0 mt-2 bg-tokyo-bg-hl border border-tokyo-border rounded-lg shadow-xl z-50 p-8">
        <div className="flex items-center justify-center gap-3 text-tokyo-comment">
          <Loader2 className="animate-spin" size={24} />
          <span>Searching YouTube...</span>
        </div>
      </div>
    )
  }

  if (results.length === 0) {
    return null
  }

  return (
    <>
      {/* Backdrop to close on click outside */}
      <div
        className="fixed inset-0 z-40"
        onClick={onClose}
      />

      <div className="absolute top-full left-0 right-0 mt-2 bg-tokyo-bg-hl border border-tokyo-border rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
        <div className="p-2">
          <p className="text-tokyo-comment text-sm px-2 py-1 mb-1">
            {results.length} results found
          </p>
          {results.map((result) => (
            <button
              key={result.id}
              onClick={() => onSelect(result)}
              className="w-full flex items-center gap-3 p-2 hover:bg-tokyo-bg-menu rounded-lg transition-colors text-left group"
            >
              <div className="relative w-24 h-14 flex-shrink-0 rounded overflow-hidden bg-tokyo-bg-menu">
                <Image
                  src={result.thumbnail}
                  alt={result.title}
                  fill
                  className="object-cover"
                  unoptimized
                />
                <span className="absolute bottom-0.5 right-0.5 bg-tokyo-bg/80 text-tokyo-fg text-xs px-1 rounded">
                  {formatDuration(result.duration)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-tokyo-fg text-sm font-medium truncate" title={result.title}>
                  {result.title}
                </h4>
                <p className="text-tokyo-comment text-xs truncate" title={result.channel}>
                  {result.channel}
                </p>
              </div>

              <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                <div className="bg-tokyo-blue rounded-full p-1.5">
                  <Plus size={16} className="text-tokyo-bg" />
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
