interface CacheEntry {
  url: string
  timestamp: number
}

class StreamCache {
  private cache = new Map<string, CacheEntry>()
  private cacheDuration = 18000000 // 5 hours in milliseconds (YouTube URLs expire after ~6h)

  set(youtubeId: string, url: string) {
    this.cache.set(youtubeId, {
      url,
      timestamp: Date.now(),
    })
  }

  get(youtubeId: string): string | null {
    const entry = this.cache.get(youtubeId)
    if (!entry) return null

    // Check if cache is still valid
    if (Date.now() - entry.timestamp > this.cacheDuration) {
      this.cache.delete(youtubeId)
      return null
    }

    return entry.url
  }

  clear() {
    this.cache.clear()
  }
}

export const streamCache = new StreamCache()
