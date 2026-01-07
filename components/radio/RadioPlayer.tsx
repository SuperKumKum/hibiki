'use client'

import { useRef, useEffect, useState } from 'react'
import Image from 'next/image'
import { Play, Pause, SkipForward, Volume2, VolumeX, Users, Shuffle } from 'lucide-react'
import { useRadio } from './RadioContext'

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return '0:00'
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

interface RadioPlayerProps {
  onVoteSkip: () => void
}

export default function RadioPlayer({ onVoteSkip }: RadioPlayerProps) {
  const {
    radioState,
    currentSong,
    skipVotes,
    listeners,
    isAdmin,
    queue,
    activePlaylist,
    play,
    pause,
    next,
    seek,
    toggleShuffle
  } = useRadio()

  const audioRef = useRef<HTMLAudioElement>(null)
  const [volume, setVolume] = useState(0.25) // Start at 25% volume
  const [isMuted, setIsMuted] = useState(false)
  const [localTime, setLocalTime] = useState(0)
  const [isBuffering, setIsBuffering] = useState(false)
  const lastSongIdRef = useRef<string | null>(null)

  // Load audio when song changes
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    // Clear audio source when no song is playing
    if (!currentSong) {
      if (audio.src) {
        audio.pause()
        audio.src = ''
        audio.load()
        lastSongIdRef.current = null
        setLocalTime(0)
      }
      return
    }

    if (lastSongIdRef.current !== currentSong.id) {
      lastSongIdRef.current = currentSong.id
      audio.src = `/api/stream/${currentSong.id}`
      audio.load()
    }
  }, [currentSong])

  // Sync playback state with server
  useEffect(() => {
    const audio = audioRef.current
    if (!audio || !radioState) return

    // Sync play/pause state
    if (radioState.isPlaying && audio.paused && audio.src) {
      audio.play().catch(() => {})
    } else if (!radioState.isPlaying && !audio.paused) {
      audio.pause()
    }

    // Sync position (if drift > 3 seconds)
    if (radioState.isPlaying && radioState.calculatedPosition !== undefined) {
      const drift = Math.abs(audio.currentTime - radioState.calculatedPosition)
      if (drift > 3 && !isBuffering) {
        audio.currentTime = radioState.calculatedPosition
      }
    }
  }, [radioState, isBuffering])

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // Track local time for display and handle song end
  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const handleTimeUpdate = () => {
      setLocalTime(audio.currentTime)
    }

    const handleWaiting = () => setIsBuffering(true)
    const handlePlaying = () => setIsBuffering(false)
    const handleCanPlay = () => setIsBuffering(false)

    // When audio ends, pause it to prevent any glitches while waiting for server auto-advance
    const handleEnded = () => {
      audio.pause()
      // Set local time to duration to show song completed
      if (currentSong) {
        setLocalTime(currentSong.duration)
      }
    }

    // Handle errors gracefully (e.g., network issues, format problems)
    const handleError = () => {
      console.error('Audio playback error')
      setIsBuffering(false)
    }

    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('waiting', handleWaiting)
    audio.addEventListener('playing', handlePlaying)
    audio.addEventListener('canplay', handleCanPlay)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('waiting', handleWaiting)
      audio.removeEventListener('playing', handlePlaying)
      audio.removeEventListener('canplay', handleCanPlay)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
    }
  }, [currentSong])

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isAdmin || !currentSong) return

    const rect = e.currentTarget.getBoundingClientRect()
    const percent = (e.clientX - rect.left) / rect.width
    const newPosition = percent * currentSong.duration
    seek(newPosition)
  }

  const progress = currentSong?.duration ? (localTime / currentSong.duration) * 100 : 0

  if (!currentSong) {
    const canStart = queue.length > 0 || activePlaylist
    return (
      <div className="bg-tokyo-bg-hl rounded-xl p-6 text-center">
        <audio ref={audioRef} preload="none" />
        <div className="text-tokyo-fg text-xl font-semibold mb-2">
          {canStart ? 'Ready to play' : 'No music available'}
        </div>
        <p className="text-tokyo-comment text-sm mb-4">
          {queue.length > 0
            ? `${queue.length} song${queue.length > 1 ? 's' : ''} in queue - click to start`
            : activePlaylist
              ? `Playlist: ${activePlaylist.name}`
              : 'Add songs to the queue or select a playlist to start'
          }
        </p>
        {canStart ? (
          <button
            onClick={play}
            className="bg-tokyo-blue hover:bg-tokyo-cyan text-tokyo-bg px-6 py-3 rounded-full transition-colors inline-flex items-center gap-2"
          >
            <Play size={24} className="ml-0.5" />
            Start Playing
          </button>
        ) : (
          <div className="text-tokyo-fg-gutter text-sm">
            Waiting for songs...
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-tokyo-bg-hl rounded-xl p-4 sm:p-6">
      <audio ref={audioRef} preload="auto" />

      <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
        <div className="relative w-24 h-24 sm:w-32 sm:h-32 rounded-lg overflow-hidden bg-tokyo-bg flex-shrink-0">
          <Image
            src={currentSong.thumbnail}
            alt={currentSong.title}
            fill
            className="object-cover"
            unoptimized
          />
          {isBuffering && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-tokyo-fg border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>

        <div className="flex-1 text-center sm:text-left min-w-0">
          <h3 className="text-tokyo-fg font-semibold text-lg truncate">
            {currentSong.title}
          </h3>
          <p className="text-tokyo-comment truncate">{currentSong.channelName}</p>

          <div className="flex items-center justify-center sm:justify-start gap-4 mt-2 text-sm text-tokyo-fg-gutter">
            <div className="flex items-center gap-1">
              <Users size={14} />
              <span>{listeners.length} listening</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-4">
        <div
          className={`h-2 bg-tokyo-fg-gutter rounded-full overflow-hidden ${isAdmin ? 'cursor-pointer' : ''}`}
          onClick={handleSeek}
        >
          <div
            className="h-full bg-tokyo-blue transition-all duration-200"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-tokyo-comment mt-1">
          <span>{formatTime(localTime)}</span>
          <span>{formatTime(currentSong.duration)}</span>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        {/* Admin controls or skip vote */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <>
              <button
                onClick={() => radioState?.isPlaying ? pause() : play()}
                className="bg-tokyo-blue hover:bg-tokyo-cyan text-tokyo-bg p-3 rounded-full transition-colors"
              >
                {radioState?.isPlaying ? <Pause size={24} /> : <Play size={24} className="ml-0.5" />}
              </button>
              <button
                onClick={next}
                className="bg-tokyo-bg-menu hover:bg-tokyo-selection text-tokyo-fg p-2 rounded-full transition-colors"
                title="Next song"
              >
                <SkipForward size={20} />
              </button>
              <button
                onClick={toggleShuffle}
                className={`p-2 rounded-full transition-colors ${
                  radioState?.isShuffled
                    ? 'bg-tokyo-blue text-tokyo-bg'
                    : 'bg-tokyo-bg-menu hover:bg-tokyo-selection text-tokyo-comment'
                }`}
                title={radioState?.isShuffled ? 'Shuffle on' : 'Shuffle off'}
              >
                <Shuffle size={20} />
              </button>
              {/* Admin can also vote to skip */}
              <button
                onClick={onVoteSkip}
                disabled={skipVotes.hasVoted}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  skipVotes.hasVoted
                    ? 'bg-tokyo-bg-menu text-tokyo-comment cursor-not-allowed'
                    : 'bg-tokyo-orange hover:bg-tokyo-yellow text-tokyo-bg'
                }`}
                title="Vote to skip (in addition to manual skip)"
              >
                {skipVotes.hasVoted ? 'Voted' : 'Vote'} ({skipVotes.current}/{skipVotes.required})
              </button>
            </>
          ) : (
            <button
              onClick={onVoteSkip}
              disabled={skipVotes.hasVoted}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                skipVotes.hasVoted
                  ? 'bg-tokyo-bg-menu text-tokyo-comment cursor-not-allowed'
                  : 'bg-tokyo-orange hover:bg-tokyo-yellow text-tokyo-bg'
              }`}
            >
              {skipVotes.hasVoted ? 'Voted' : 'Vote Skip'} ({skipVotes.current}/{skipVotes.required})
            </button>
          )}
        </div>

        {/* Center info */}
        <div className="flex items-center gap-3 text-sm">
          {/* Active playlist indicator */}
          {activePlaylist && (
            <div className="text-tokyo-cyan hidden sm:block">
              Playlist: {activePlaylist.name}
            </div>
          )}
          {/* Shuffle indicator for non-admin */}
          {!isAdmin && radioState?.isShuffled && (
            <div className="text-tokyo-cyan flex items-center gap-1">
              <Shuffle size={14} />
              <span>Shuffle</span>
            </div>
          )}
          {/* Skip vote indicator for admin */}
          {isAdmin && skipVotes.current > 0 && (
            <div className="text-tokyo-orange">
              Skip votes: {skipVotes.current}/{skipVotes.required}
            </div>
          )}
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMuted(!isMuted)}
            className="text-tokyo-comment hover:text-tokyo-fg"
          >
            {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <div className="w-20 sm:w-24 relative h-5 flex items-center group">
            <div className="absolute w-full h-1 bg-tokyo-fg-gutter rounded-full" />
            <div
              className="absolute h-1 bg-tokyo-fg rounded-full pointer-events-none"
              style={{ width: `${(isMuted ? 0 : volume) * 100}%` }}
            />
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={isMuted ? 0 : volume}
              onChange={(e) => {
                setVolume(parseFloat(e.target.value))
                setIsMuted(false)
              }}
              className="absolute w-full h-5 appearance-none bg-transparent cursor-pointer z-10"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
