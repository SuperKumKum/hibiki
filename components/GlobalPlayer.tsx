'use client'

import { usePathname } from 'next/navigation'
import { usePlayer } from './PlayerContext'
import PlayerBar from './PlayerBar'

export default function GlobalPlayer() {
  const pathname = usePathname()
  const { currentSong, currentIndex, playlist, isPlaylist, isShuffled, playNext, playPrevious, toggleShuffle } = usePlayer()

  // Hide player on /radio page (radio has its own player)
  if (pathname === '/radio') {
    return null
  }

  const nextSong = currentIndex < playlist.length - 1 ? playlist[currentIndex + 1] : null

  return (
    <PlayerBar
      currentSong={currentSong}
      onNext={currentIndex < playlist.length - 1 ? playNext : undefined}
      onPrevious={currentIndex > 0 ? playPrevious : undefined}
      isPlaylist={isPlaylist}
      isShuffled={isShuffled}
      onToggleShuffle={isPlaylist ? toggleShuffle : undefined}
      nextSong={nextSong}
    />
  )
}
