import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

interface Song {
  id: string
  youtubeId: string
  title: string
  channelName: string
  thumbnail: string
  duration: number
  isInLibrary: boolean
  createdAt: number
}

interface Playlist {
  id: string
  name: string
  createdAt: number
}

interface PlaylistSong {
  id: string
  playlistId: string
  songId: string
  position: number
  addedAt: number
}

// Radio mode entities
interface Session {
  id: string
  displayName: string
  colorIndex: number
  isAdmin: boolean
  createdAt: number
  lastSeenAt: number
  isActive: boolean
}

interface RadioState {
  id: string
  isPlaying: boolean
  currentSongId: string | null
  currentPosition: number
  startedAt: number | null
  lastUpdatedAt: number
  isShuffled: boolean
  activeRadioPlaylistId: string | null
}

interface RadioPlaylist {
  id: string
  name: string
  createdAt: number
}

interface RadioPlaylistSong {
  id: string
  radioPlaylistId: string
  songId: string
  position: number
  addedAt: number
}

interface SkipVote {
  id: string
  sessionId: string
  songId: string
  createdAt: number
}

interface PlaylistVote {
  id: string
  sessionId: string
  playlistId: string
  createdAt: number
}

interface RadioQueueItem {
  id: string
  songId: string
  addedBy: string
  addedByName: string
  position: number
  addedAt: number
  isPlayed: boolean
}

interface Database {
  songs: Song[]
  playlists: Playlist[]
  playlistSongs: PlaylistSong[]
  sessions: Session[]
  radioState: RadioState | null
  skipVotes: SkipVote[]
  playlistVotes: PlaylistVote[]
  radioQueue: RadioQueueItem[]
  radioPlaylists: RadioPlaylist[]
  radioPlaylistSongs: RadioPlaylistSong[]
}

function getDataDir() {
  return join(process.cwd(), 'data')
}

function getDbPath() {
  return join(getDataDir(), 'db.json')
}

function ensureDataDir() {
  const dataDir = getDataDir()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
}

function readDb(): Database {
  ensureDataDir()
  const dbPath = getDbPath()

  if (!existsSync(dbPath)) {
    const initialDb: Database = {
      songs: [],
      playlists: [],
      playlistSongs: [],
      sessions: [],
      radioState: null,
      skipVotes: [],
      playlistVotes: [],
      radioQueue: [],
      radioPlaylists: [],
      radioPlaylistSongs: []
    }
    writeFileSync(dbPath, JSON.stringify(initialDb, null, 2))
    return initialDb
  }

  const data = JSON.parse(readFileSync(dbPath, 'utf-8'))
  // Ensure new fields exist for backwards compatibility
  if (!data.sessions) data.sessions = []
  if (!data.radioState) data.radioState = null
  if (!data.skipVotes) data.skipVotes = []
  if (!data.playlistVotes) data.playlistVotes = []
  if (!data.radioQueue) data.radioQueue = []
  if (!data.radioPlaylists) data.radioPlaylists = []
  if (!data.radioPlaylistSongs) data.radioPlaylistSongs = []

  // Add new fields to radioState if missing
  if (data.radioState) {
    if (data.radioState.isShuffled === undefined) data.radioState.isShuffled = false
    if (data.radioState.activeRadioPlaylistId === undefined) data.radioState.activeRadioPlaylistId = null
  }

  return data
}

function writeDb(db: Database) {
  ensureDataDir()
  const dbPath = getDbPath()
  writeFileSync(dbPath, JSON.stringify(db, null, 2))
}

export const db = {
  // Songs
  getSongs: () => {
    const data = readDb()
    return data.songs.filter(s => s.isInLibrary).sort((a, b) => b.createdAt - a.createdAt)
  },
  
  getSongById: (id: string) => {
    const data = readDb()
    return data.songs.find(s => s.id === id)
  },
  
  getSongByYoutubeId: (youtubeId: string) => {
    const data = readDb()
    return data.songs.find(s => s.youtubeId === youtubeId)
  },
  
  createSong: (song: Omit<Song, 'id' | 'createdAt' | 'isInLibrary'>) => {
    const data = readDb()
    const newSong: Song = {
      ...song,
      id: randomBytes(16).toString('hex'),
      isInLibrary: true,
      createdAt: Date.now()
    }
    data.songs.push(newSong)
    writeDb(data)
    return newSong
  },
  
  updateSong: (id: string, updates: Partial<Song>) => {
    const data = readDb()
    const index = data.songs.findIndex(s => s.id === id)
    if (index !== -1) {
      data.songs[index] = { ...data.songs[index], ...updates }
      writeDb(data)
      return data.songs[index]
    }
    return null
  },
  
  // Playlists
  getPlaylists: () => {
    const data = readDb()
    return data.playlists.sort((a, b) => b.createdAt - a.createdAt)
  },
  
  getPlaylistById: (id: string) => {
    const data = readDb()
    return data.playlists.find(p => p.id === id)
  },
  
  createPlaylist: (name: string) => {
    const data = readDb()
    const newPlaylist: Playlist = {
      id: randomBytes(16).toString('hex'),
      name,
      createdAt: Date.now()
    }
    data.playlists.push(newPlaylist)
    writeDb(data)
    return newPlaylist
  },
  
  deletePlaylist: (id: string) => {
    const data = readDb()
    data.playlists = data.playlists.filter(p => p.id !== id)
    data.playlistSongs = data.playlistSongs.filter(ps => ps.playlistId !== id)
    writeDb(data)
  },
  
  // Playlist Songs
  getPlaylistSongs: (playlistId: string) => {
    const data = readDb()
    const playlistSongs = data.playlistSongs
      .filter(ps => ps.playlistId === playlistId)
      .sort((a, b) => a.position - b.position)
    
    return playlistSongs.map(ps => {
      const song = data.songs.find(s => s.id === ps.songId)
      return { ...ps, song }
    }).filter(ps => ps.song)
  },
  
  addSongToPlaylist: (playlistId: string, songId: string) => {
    const data = readDb()
    
    // Check if already exists
    if (data.playlistSongs.find(ps => ps.playlistId === playlistId && ps.songId === songId)) {
      return null
    }
    
    // Get next position
    const playlistSongs = data.playlistSongs.filter(ps => ps.playlistId === playlistId)
    const maxPosition = playlistSongs.length > 0 ? Math.max(...playlistSongs.map(ps => ps.position)) : -1
    
    const newPlaylistSong: PlaylistSong = {
      id: randomBytes(16).toString('hex'),
      playlistId,
      songId,
      position: maxPosition + 1,
      addedAt: Date.now()
    }
    
    data.playlistSongs.push(newPlaylistSong)
    writeDb(data)
    return newPlaylistSong
  },
  
  removeSongFromPlaylist: (playlistId: string, songId: string) => {
    const data = readDb()
    data.playlistSongs = data.playlistSongs.filter(
      ps => !(ps.playlistId === playlistId && ps.songId === songId)
    )
    writeDb(data)
  },

  // Sessions
  getSessions: () => {
    const data = readDb()
    return data.sessions
  },

  getActiveSessions: () => {
    const data = readDb()
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    return data.sessions.filter(s => s.isActive && s.lastSeenAt > fiveMinutesAgo)
  },

  getSessionById: (id: string) => {
    const data = readDb()
    return data.sessions.find(s => s.id === id)
  },

  createSession: (displayName: string, colorIndex: number) => {
    const data = readDb()
    const newSession: Session = {
      id: randomBytes(16).toString('hex'),
      displayName,
      colorIndex,
      isAdmin: false,
      createdAt: Date.now(),
      lastSeenAt: Date.now(),
      isActive: true
    }
    data.sessions.push(newSession)
    writeDb(data)
    return newSession
  },

  updateSession: (id: string, updates: Partial<Session>) => {
    const data = readDb()
    const index = data.sessions.findIndex(s => s.id === id)
    if (index !== -1) {
      data.sessions[index] = { ...data.sessions[index], ...updates }
      writeDb(data)
      return data.sessions[index]
    }
    return null
  },

  deleteSession: (id: string) => {
    const data = readDb()
    data.sessions = data.sessions.filter(s => s.id !== id)
    // Also remove any skip votes from this session
    data.skipVotes = data.skipVotes.filter(v => v.sessionId !== id)
    // Also remove any playlist votes from this session
    data.playlistVotes = data.playlistVotes.filter(v => v.sessionId !== id)
    writeDb(data)
  },

  deactivateSession: (id: string) => {
    const data = readDb()
    const index = data.sessions.findIndex(s => s.id === id)
    if (index !== -1) {
      data.sessions[index].isActive = false
      // Also remove any votes from this session
      data.skipVotes = data.skipVotes.filter(v => v.sessionId !== id)
      data.playlistVotes = data.playlistVotes.filter(v => v.sessionId !== id)
      writeDb(data)
    }
  },

  cleanupStaleSessions: () => {
    const data = readDb()
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    data.sessions = data.sessions.map(s => {
      if (s.lastSeenAt < fiveMinutesAgo && s.isActive) {
        return { ...s, isActive: false }
      }
      return s
    })
    writeDb(data)
  },

  // Radio State
  getRadioState: () => {
    const data = readDb()
    return data.radioState
  },

  setRadioState: (state: RadioState) => {
    const data = readDb()
    data.radioState = state
    writeDb(data)
    return state
  },

  updateRadioState: (updates: Partial<RadioState>) => {
    const data = readDb()
    if (!data.radioState) {
      data.radioState = {
        id: 'main',
        isPlaying: false,
        currentSongId: null,
        currentPosition: 0,
        startedAt: null,
        lastUpdatedAt: Date.now(),
        isShuffled: false,
        activeRadioPlaylistId: null
      }
    }
    data.radioState = { ...data.radioState, ...updates, lastUpdatedAt: Date.now() }
    writeDb(data)
    return data.radioState
  },

  // Skip Votes
  getSkipVotes: () => {
    const data = readDb()
    return data.skipVotes
  },

  getSkipVotesForSong: (songId: string) => {
    const data = readDb()
    return data.skipVotes.filter(v => v.songId === songId)
  },

  getSkipVote: (sessionId: string, songId: string) => {
    const data = readDb()
    return data.skipVotes.find(v => v.sessionId === sessionId && v.songId === songId)
  },

  createSkipVote: (sessionId: string, songId: string) => {
    const data = readDb()
    // Check if already voted
    if (data.skipVotes.find(v => v.sessionId === sessionId && v.songId === songId)) {
      return null
    }
    const newVote: SkipVote = {
      id: randomBytes(16).toString('hex'),
      sessionId,
      songId,
      createdAt: Date.now()
    }
    data.skipVotes.push(newVote)
    writeDb(data)
    return newVote
  },

  removeSkipVote: (sessionId: string, songId: string) => {
    const data = readDb()
    data.skipVotes = data.skipVotes.filter(
      v => !(v.sessionId === sessionId && v.songId === songId)
    )
    writeDb(data)
  },

  clearSkipVotesForSong: (songId: string) => {
    const data = readDb()
    data.skipVotes = data.skipVotes.filter(v => v.songId !== songId)
    writeDb(data)
  },

  // Playlist Votes
  getPlaylistVotes: (playlistId: string) => {
    const data = readDb()
    return data.playlistVotes.filter(v => v.playlistId === playlistId)
  },

  getAllPlaylistVotes: () => {
    const data = readDb()
    return data.playlistVotes
  },

  getPlaylistVote: (sessionId: string, playlistId: string) => {
    const data = readDb()
    return data.playlistVotes.find(v => v.sessionId === sessionId && v.playlistId === playlistId)
  },

  hasVotedForPlaylist: (sessionId: string, playlistId: string) => {
    const data = readDb()
    return data.playlistVotes.some(v => v.sessionId === sessionId && v.playlistId === playlistId)
  },

  createPlaylistVote: (sessionId: string, playlistId: string) => {
    const data = readDb()
    // Remove any existing vote from this session (can only vote for one playlist)
    data.playlistVotes = data.playlistVotes.filter(v => v.sessionId !== sessionId)

    const newVote: PlaylistVote = {
      id: randomBytes(16).toString('hex'),
      sessionId,
      playlistId,
      createdAt: Date.now()
    }
    data.playlistVotes.push(newVote)
    writeDb(data)
    return newVote
  },

  removePlaylistVote: (sessionId: string) => {
    const data = readDb()
    data.playlistVotes = data.playlistVotes.filter(v => v.sessionId !== sessionId)
    writeDb(data)
  },

  clearPlaylistVotes: () => {
    const data = readDb()
    data.playlistVotes = []
    writeDb(data)
  },

  // Radio Queue
  getRadioQueue: () => {
    const data = readDb()
    return data.radioQueue
      .filter(q => !q.isPlayed)
      .sort((a, b) => a.position - b.position)
      .map(q => {
        const song = data.songs.find(s => s.id === q.songId)
        return { ...q, song }
      })
      .filter(q => q.song)
  },

  getRadioQueueItem: (id: string) => {
    const data = readDb()
    return data.radioQueue.find(q => q.id === id)
  },

  addToRadioQueue: (songId: string, addedBy: string, addedByName: string) => {
    const data = readDb()
    const unplayedQueue = data.radioQueue.filter(q => !q.isPlayed)
    const maxPosition = unplayedQueue.length > 0
      ? Math.max(...unplayedQueue.map(q => q.position))
      : -1

    const newItem: RadioQueueItem = {
      id: randomBytes(16).toString('hex'),
      songId,
      addedBy,
      addedByName,
      position: maxPosition + 1,
      addedAt: Date.now(),
      isPlayed: false
    }
    data.radioQueue.push(newItem)
    writeDb(data)
    return newItem
  },

  removeFromRadioQueue: (id: string) => {
    const data = readDb()
    data.radioQueue = data.radioQueue.filter(q => q.id !== id)
    writeDb(data)
  },

  markQueueItemPlayed: (id: string) => {
    const data = readDb()
    const index = data.radioQueue.findIndex(q => q.id === id)
    if (index !== -1) {
      data.radioQueue[index].isPlayed = true
      writeDb(data)
      return data.radioQueue[index]
    }
    return null
  },

  getNextQueueItem: () => {
    const data = readDb()
    const unplayed = data.radioQueue
      .filter(q => !q.isPlayed)
      .sort((a, b) => a.position - b.position)
    if (unplayed.length === 0) return null
    const song = data.songs.find(s => s.id === unplayed[0].songId)
    return { ...unplayed[0], song }
  },

  clearRadioQueue: () => {
    const data = readDb()
    data.radioQueue = []
    writeDb(data)
  },

  // Radio Playlists
  getRadioPlaylists: () => {
    const data = readDb()
    return data.radioPlaylists.sort((a, b) => b.createdAt - a.createdAt)
  },

  getRadioPlaylistById: (id: string) => {
    const data = readDb()
    return data.radioPlaylists.find(p => p.id === id)
  },

  createRadioPlaylist: (name: string) => {
    const data = readDb()
    const newPlaylist: RadioPlaylist = {
      id: randomBytes(16).toString('hex'),
      name,
      createdAt: Date.now()
    }
    data.radioPlaylists.push(newPlaylist)
    writeDb(data)
    return newPlaylist
  },

  deleteRadioPlaylist: (id: string) => {
    const data = readDb()
    data.radioPlaylists = data.radioPlaylists.filter(p => p.id !== id)
    data.radioPlaylistSongs = data.radioPlaylistSongs.filter(ps => ps.radioPlaylistId !== id)
    // Clear active playlist if it was deleted
    if (data.radioState?.activeRadioPlaylistId === id) {
      data.radioState.activeRadioPlaylistId = null
    }
    writeDb(data)
  },

  // Radio Playlist Songs
  getRadioPlaylistSongs: (radioPlaylistId: string) => {
    const data = readDb()
    const playlistSongs = data.radioPlaylistSongs
      .filter(ps => ps.radioPlaylistId === radioPlaylistId)
      .sort((a, b) => a.position - b.position)

    return playlistSongs.map(ps => {
      const song = data.songs.find(s => s.id === ps.songId)
      return { ...ps, song }
    }).filter(ps => ps.song)
  },

  addSongToRadioPlaylist: (radioPlaylistId: string, songId: string) => {
    const data = readDb()

    // Check if already exists
    if (data.radioPlaylistSongs.find(ps => ps.radioPlaylistId === radioPlaylistId && ps.songId === songId)) {
      return null
    }

    // Get next position
    const playlistSongs = data.radioPlaylistSongs.filter(ps => ps.radioPlaylistId === radioPlaylistId)
    const maxPosition = playlistSongs.length > 0 ? Math.max(...playlistSongs.map(ps => ps.position)) : -1

    const newPlaylistSong: RadioPlaylistSong = {
      id: randomBytes(16).toString('hex'),
      radioPlaylistId,
      songId,
      position: maxPosition + 1,
      addedAt: Date.now()
    }

    data.radioPlaylistSongs.push(newPlaylistSong)
    writeDb(data)
    return newPlaylistSong
  },

  removeSongFromRadioPlaylist: (radioPlaylistId: string, songId: string) => {
    const data = readDb()
    data.radioPlaylistSongs = data.radioPlaylistSongs.filter(
      ps => !(ps.radioPlaylistId === radioPlaylistId && ps.songId === songId)
    )
    writeDb(data)
  },

  // Get next song from active playlist (for fallback when queue is empty)
  getNextRadioPlaylistSong: () => {
    const data = readDb()
    const radioState = data.radioState

    if (!radioState?.activeRadioPlaylistId) return null

    // Get songs from library playlist
    const songEntries = data.playlistSongs
      .filter(ps => ps.playlistId === radioState.activeRadioPlaylistId)
      .map(ps => ({ songId: ps.songId, position: ps.position }))
      .sort((a, b) => a.position - b.position)

    if (songEntries.length === 0) return null

    // If shuffle is on, get random song
    let selectedEntry
    if (radioState.isShuffled) {
      const randomIndex = Math.floor(Math.random() * songEntries.length)
      selectedEntry = songEntries[randomIndex]
    } else {
      // Get next song after current one, or first if current not in playlist
      const currentIndex = songEntries.findIndex(ps => ps.songId === radioState.currentSongId)
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % songEntries.length : 0
      selectedEntry = songEntries[nextIndex]
    }

    const song = data.songs.find(s => s.id === selectedEntry.songId)
    return { ...selectedEntry, song }
  },

  // Set active radio playlist
  setActiveRadioPlaylist: (playlistId: string | null) => {
    const data = readDb()
    if (!data.radioState) {
      data.radioState = {
        id: 'main',
        isPlaying: false,
        currentSongId: null,
        currentPosition: 0,
        startedAt: null,
        lastUpdatedAt: Date.now(),
        isShuffled: false,
        activeRadioPlaylistId: playlistId
      }
    } else {
      data.radioState.activeRadioPlaylistId = playlistId
      data.radioState.lastUpdatedAt = Date.now()
    }
    writeDb(data)
    return data.radioState
  },

  // Toggle shuffle
  toggleShuffle: () => {
    const data = readDb()
    if (!data.radioState) {
      data.radioState = {
        id: 'main',
        isPlaying: false,
        currentSongId: null,
        currentPosition: 0,
        startedAt: null,
        lastUpdatedAt: Date.now(),
        isShuffled: true,
        activeRadioPlaylistId: null
      }
    } else {
      data.radioState.isShuffled = !data.radioState.isShuffled
      data.radioState.lastUpdatedAt = Date.now()
    }
    writeDb(data)
    return data.radioState
  }
}
