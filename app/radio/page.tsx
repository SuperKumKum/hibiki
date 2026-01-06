'use client'

import { useState } from 'react'
import { Radio, LogOut } from 'lucide-react'
import { RadioProvider, useRadio } from '@/components/radio/RadioContext'
import NamePickerModal from '@/components/radio/NamePickerModal'
import RadioPlayer from '@/components/radio/RadioPlayer'
import RadioQueue from '@/components/radio/RadioQueue'
import ListenersList from '@/components/radio/ListenersList'
import RadioPlaylistManager from '@/components/radio/RadioPlaylistManager'
import Navbar from '@/components/Navbar'
import { useToast } from '@/components/Toast'

function RadioContent() {
  const {
    session,
    isConnected,
    isAdmin,
    createSession,
    endSession,
    voteSkip
  } = useRadio()

  const [isJoining, setIsJoining] = useState(false)
  const { showToast } = useToast()

  const handleJoin = async (name: string, colorIndex: number) => {
    setIsJoining(true)
    const success = await createSession(name, colorIndex)
    setIsJoining(false)
    if (success) {
      showToast('Welcome to the radio!', 'success')
    } else {
      showToast('Failed to join', 'error')
    }
  }

  const handleVoteSkip = async () => {
    const success = await voteSkip()
    if (success) {
      showToast('Vote recorded', 'success')
    } else {
      showToast('Failed to vote', 'error')
    }
  }

  const handleLeave = () => {
    endSession()
    showToast('Left the radio', 'success')
  }

  // Show name picker if not connected
  if (!isConnected) {
    return (
      <>
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="bg-green-500/20 p-4 rounded-full inline-block mb-4">
              <Radio size={48} className="text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Hibiki Radio</h1>
            <p className="text-gray-400 mb-6">
              Join the collaborative listening experience
            </p>
          </div>
        </div>
        <NamePickerModal onJoin={handleJoin} isLoading={isJoining} />
      </>
    )
  }

  return (
    <>
      <Navbar />

      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-green-500/20 p-2 rounded-full">
              <Radio size={20} className="text-green-500" />
            </div>
            <div>
              <h1 className="text-white font-semibold">Hibiki Radio</h1>
              <p className="text-gray-400 text-sm">
                {session?.displayName}
                {isAdmin && <span className="text-yellow-500 ml-1">(Admin)</span>}
              </p>
            </div>
          </div>

          <button
            onClick={handleLeave}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
          >
            <LogOut size={16} />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto pb-8 p-4">
        <div className="max-w-6xl mx-auto">
          {/* Player */}
          <div className="mb-6">
            <RadioPlayer onVoteSkip={handleVoteSkip} />
          </div>

          {/* Queue, Playlists, and Listeners */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <RadioQueue />
            <RadioPlaylistManager />
            <ListenersList />
          </div>
        </div>
      </main>

    </>
  )
}

export default function RadioPage() {
  return (
    <RadioProvider>
      <div className="flex flex-col h-screen overflow-hidden">
        <RadioContent />
      </div>
    </RadioProvider>
  )
}
