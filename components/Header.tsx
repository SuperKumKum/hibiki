'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { Search, Plus, Loader2 } from 'lucide-react'
import SearchResults from './SearchResults'

interface SearchResult {
  id: string
  title: string
  channel: string
  thumbnail: string
  duration: number
}

interface HeaderProps {
  onAddSong: (url: string) => void
  isLoading?: boolean
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

export default function Header({ onAddSong, isLoading }: HeaderProps) {
  const [input, setInput] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim() || isYouTubeUrl(query)) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    setShowResults(true)

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

    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search for URLs
    if (isYouTubeUrl(value)) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    // Debounce search
    if (value.trim().length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        handleSearch(value)
      }, 500)
    } else {
      setSearchResults([])
      setShowResults(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (input.trim() && isYouTubeUrl(input)) {
      onAddSong(input)
      setInput('')
      setShowResults(false)
    }
  }

  const handleSelectResult = (result: SearchResult) => {
    const url = `https://www.youtube.com/watch?v=${result.id}`
    onAddSong(url)
    setInput('')
    setSearchResults([])
    setShowResults(false)
  }

  const handleCloseResults = () => {
    setShowResults(false)
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [])

  const isUrl = isYouTubeUrl(input)
  const canSubmit = input.trim() && isUrl

  return (
    <header className="bg-gradient-to-b from-tokyo-bg-hl to-tokyo-bg border-b border-tokyo-border p-3 sm:p-6 flex-shrink-0">
      <div className="max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <div className="relative flex-1" ref={containerRef}>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-tokyo-comment">
              <Search size={20} />
            </div>
            <input
              type="text"
              value={input}
              onChange={handleInputChange}
              placeholder="Search YouTube or paste URL..."
              className="w-full bg-tokyo-bg-menu text-tokyo-fg pl-10 pr-4 py-2 sm:py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-tokyo-blue placeholder-tokyo-comment text-sm sm:text-base"
              disabled={isLoading}
            />

            {showResults && (
              <SearchResults
                results={searchResults}
                isLoading={isSearching}
                onSelect={handleSelectResult}
                onClose={handleCloseResults}
              />
            )}
          </div>

          {isUrl && (
            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="flex items-center justify-center gap-2 px-4 py-2 sm:px-6 sm:py-3 bg-tokyo-blue text-tokyo-bg rounded-lg hover:bg-tokyo-cyan disabled:bg-tokyo-bg-menu disabled:text-tokyo-comment transition-colors font-medium whitespace-nowrap text-sm sm:text-base"
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Adding...</span>
                </>
              ) : (
                <>
                  <Plus size={18} />
                  <span>Add Song</span>
                </>
              )}
            </button>
          )}
        </form>
      </div>
    </header>
  )
}
