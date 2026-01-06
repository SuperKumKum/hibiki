'use client'

import { useEffect } from 'react'
import { ListMusic, Vote, Check } from 'lucide-react'
import { useRadio } from './RadioContext'

interface PlaylistWithVotes {
  id: string
  name: string
  songCount?: number
  localCount?: number
  votes: number
  hasVoted: boolean
}

export default function RadioPlaylistManager() {
  const {
    isAdmin,
    radioPlaylists,
    activePlaylist,
    playlistVotes,
    fetchRadioPlaylists,
    activatePlaylist,
    voteForPlaylist,
    listeners
  } = useRadio()

  useEffect(() => {
    fetchRadioPlaylists()
  }, [fetchRadioPlaylists])

  const handleActivate = async (playlistId: string) => {
    await activatePlaylist(playlistId)
  }

  const handleVote = async (playlistId: string) => {
    await voteForPlaylist(playlistId)
  }

  // Calculate votes needed (majority)
  const votesRequired = Math.floor(listeners.length / 2) + 1

  // Merge playlists with vote data
  const playlistsWithVotes: PlaylistWithVotes[] = radioPlaylists.map(p => ({
    ...p,
    votes: playlistVotes[p.id]?.count || 0,
    hasVoted: playlistVotes[p.id]?.hasVoted || false
  }))

  if (radioPlaylists.length === 0) {
    return (
      <div className="bg-gray-800 rounded-xl p-4">
        <h3 className="text-white font-semibold flex items-center gap-2 mb-2">
          <ListMusic size={18} />
          Radio Source
        </h3>
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm mb-2">No playlists available</p>
          <p className="text-gray-600 text-xs">
            Create playlists in the Library to use as radio source
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold flex items-center gap-2">
          <ListMusic size={18} />
          Radio Source
        </h3>
      </div>

      <div className="space-y-2">
        {playlistsWithVotes.map((playlist) => {
          const isActive = activePlaylist?.id === playlist.id

          return (
            <div
              key={playlist.id}
              className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-green-600/20 border border-green-600'
                  : 'bg-gray-900/50 hover:bg-gray-900'
              }`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{playlist.name}</p>
                <p className="text-gray-500 text-xs">
                  {playlist.songCount || 0} songs
                  {playlist.localCount !== undefined && playlist.localCount > 0 && (
                    <span className="text-green-400 ml-2">
                      ({playlist.localCount} local)
                    </span>
                  )}
                  {playlist.votes > 0 && !isActive && (
                    <span className="text-orange-400 ml-2">
                      {playlist.votes}/{votesRequired} votes
                    </span>
                  )}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {isAdmin ? (
                  <button
                    onClick={() => handleActivate(playlist.id)}
                    className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                  >
                    {isActive ? 'Active' : 'Use'}
                  </button>
                ) : (
                  <>
                    {isActive ? (
                      <span className="px-3 py-1 rounded text-xs font-medium bg-green-600 text-white flex items-center gap-1">
                        <Check size={12} />
                        Active
                      </span>
                    ) : (
                      <button
                        onClick={() => handleVote(playlist.id)}
                        disabled={playlist.hasVoted}
                        className={`px-3 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
                          playlist.hasVoted
                            ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                            : 'bg-orange-600 hover:bg-orange-700 text-white'
                        }`}
                      >
                        <Vote size={12} />
                        {playlist.hasVoted ? 'Voted' : 'Vote'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <p className="text-gray-500 text-xs mt-4">
        {isAdmin
          ? 'Select a playlist to play when queue is empty.'
          : 'Vote for a playlist to request it as the radio source.'}
      </p>
    </div>
  )
}
