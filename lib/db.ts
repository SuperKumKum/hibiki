import Database from 'better-sqlite3'
import { existsSync, mkdirSync, readdirSync } from 'fs'
import { join } from 'path'
import { randomBytes } from 'crypto'

// Types
interface Song {
  id: string
  youtubeId: string
  title: string
  channelName: string
  thumbnail: string
  duration: number
  isInLibrary: boolean
  createdAt: number
  isDownloaded?: boolean
  localPath?: string | null
  downloadedAt?: number | null
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

// Database setup
function getDataDir() {
  return join(process.cwd(), 'data')
}

function getDbPath() {
  return join(getDataDir(), 'hibiki.db')
}

function getAudioDir() {
  return join(getDataDir(), 'audio')
}

function ensureDataDir() {
  const dataDir = getDataDir()
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
}

function ensureAudioDir() {
  const audioDir = getAudioDir()
  if (!existsSync(audioDir)) {
    mkdirSync(audioDir, { recursive: true })
  }
  return audioDir
}

// Initialize database connection
ensureDataDir()
const sqlite = new Database(getDbPath())

// Enable WAL mode for better concurrency
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

// Initialize schema
function initializeSchema() {
  sqlite.exec(`
    -- Songs
    CREATE TABLE IF NOT EXISTS songs (
      id TEXT PRIMARY KEY,
      youtube_id TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      channel_name TEXT NOT NULL,
      thumbnail TEXT,
      duration INTEGER NOT NULL,
      is_in_library INTEGER DEFAULT 1,
      is_downloaded INTEGER DEFAULT 0,
      local_path TEXT,
      downloaded_at INTEGER,
      created_at INTEGER NOT NULL
    );

    -- Playlists
    CREATE TABLE IF NOT EXISTS playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- PlaylistSongs
    CREATE TABLE IF NOT EXISTS playlist_songs (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      added_at INTEGER NOT NULL
    );

    -- Sessions
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      color_index INTEGER NOT NULL,
      is_admin INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at INTEGER NOT NULL,
      last_seen_at INTEGER NOT NULL
    );

    -- RadioState (singleton)
    CREATE TABLE IF NOT EXISTS radio_state (
      id TEXT PRIMARY KEY DEFAULT 'main',
      is_playing INTEGER DEFAULT 0,
      current_song_id TEXT REFERENCES songs(id) ON DELETE SET NULL,
      current_position REAL DEFAULT 0,
      started_at INTEGER,
      last_updated_at INTEGER NOT NULL,
      is_shuffled INTEGER DEFAULT 0,
      active_radio_playlist_id TEXT
    );

    -- RadioQueue
    CREATE TABLE IF NOT EXISTS radio_queue (
      id TEXT PRIMARY KEY,
      song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      added_by TEXT,
      added_by_name TEXT,
      position INTEGER NOT NULL,
      is_played INTEGER DEFAULT 0,
      added_at INTEGER NOT NULL
    );

    -- SkipVotes
    CREATE TABLE IF NOT EXISTS skip_votes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE(session_id, song_id)
    );

    -- PlaylistVotes
    CREATE TABLE IF NOT EXISTS playlist_votes (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
      playlist_id TEXT NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      UNIQUE(session_id, playlist_id)
    );

    -- RadioPlaylists
    CREATE TABLE IF NOT EXISTS radio_playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    -- RadioPlaylistSongs
    CREATE TABLE IF NOT EXISTS radio_playlist_songs (
      id TEXT PRIMARY KEY,
      radio_playlist_id TEXT NOT NULL REFERENCES radio_playlists(id) ON DELETE CASCADE,
      song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      added_at INTEGER NOT NULL
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_songs_youtube_id ON songs(youtube_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON playlist_songs(song_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);
    CREATE INDEX IF NOT EXISTS idx_radio_queue_is_played ON radio_queue(is_played);
    CREATE INDEX IF NOT EXISTS idx_skip_votes_song_id ON skip_votes(song_id);
    CREATE INDEX IF NOT EXISTS idx_playlist_votes_playlist_id ON playlist_votes(playlist_id);
  `)
}

initializeSchema()

// Helper to convert SQLite row to Song
function rowToSong(row: Record<string, unknown>): Song {
  return {
    id: row.id as string,
    youtubeId: row.youtube_id as string,
    title: row.title as string,
    channelName: row.channel_name as string,
    thumbnail: row.thumbnail as string,
    duration: row.duration as number,
    isInLibrary: Boolean(row.is_in_library),
    createdAt: row.created_at as number,
    isDownloaded: Boolean(row.is_downloaded),
    localPath: row.local_path as string | null,
    downloadedAt: row.downloaded_at as number | null
  }
}

// Helper to convert SQLite row to Playlist
function rowToPlaylist(row: Record<string, unknown>): Playlist {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as number
  }
}

// Helper to convert SQLite row to PlaylistSong
function rowToPlaylistSong(row: Record<string, unknown>): PlaylistSong {
  return {
    id: row.id as string,
    playlistId: row.playlist_id as string,
    songId: row.song_id as string,
    position: row.position as number,
    addedAt: row.added_at as number
  }
}

// Helper to convert SQLite row to Session
function rowToSession(row: Record<string, unknown>): Session {
  return {
    id: row.id as string,
    displayName: row.display_name as string,
    colorIndex: row.color_index as number,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at as number,
    lastSeenAt: row.last_seen_at as number,
    isActive: Boolean(row.is_active)
  }
}

// Helper to convert SQLite row to RadioState
function rowToRadioState(row: Record<string, unknown>): RadioState {
  return {
    id: row.id as string,
    isPlaying: Boolean(row.is_playing),
    currentSongId: row.current_song_id as string | null,
    currentPosition: row.current_position as number,
    startedAt: row.started_at as number | null,
    lastUpdatedAt: row.last_updated_at as number,
    isShuffled: Boolean(row.is_shuffled),
    activeRadioPlaylistId: row.active_radio_playlist_id as string | null
  }
}

// Helper to convert SQLite row to RadioQueueItem
function rowToRadioQueueItem(row: Record<string, unknown>): RadioQueueItem {
  return {
    id: row.id as string,
    songId: row.song_id as string,
    addedBy: row.added_by as string,
    addedByName: row.added_by_name as string,
    position: row.position as number,
    addedAt: row.added_at as number,
    isPlayed: Boolean(row.is_played)
  }
}

// Helper to convert SQLite row to SkipVote
function rowToSkipVote(row: Record<string, unknown>): SkipVote {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    songId: row.song_id as string,
    createdAt: row.created_at as number
  }
}

// Helper to convert SQLite row to PlaylistVote
function rowToPlaylistVote(row: Record<string, unknown>): PlaylistVote {
  return {
    id: row.id as string,
    sessionId: row.session_id as string,
    playlistId: row.playlist_id as string,
    createdAt: row.created_at as number
  }
}

// Helper to convert SQLite row to RadioPlaylist
function rowToRadioPlaylist(row: Record<string, unknown>): RadioPlaylist {
  return {
    id: row.id as string,
    name: row.name as string,
    createdAt: row.created_at as number
  }
}

// Helper to convert SQLite row to RadioPlaylistSong
function rowToRadioPlaylistSong(row: Record<string, unknown>): RadioPlaylistSong {
  return {
    id: row.id as string,
    radioPlaylistId: row.radio_playlist_id as string,
    songId: row.song_id as string,
    position: row.position as number,
    addedAt: row.added_at as number
  }
}

// Generate random ID
function generateId(): string {
  return randomBytes(16).toString('hex')
}

// Prepared statements for better performance
const statements = {
  // Songs
  getSongs: sqlite.prepare(`
    SELECT * FROM songs WHERE is_in_library = 1 ORDER BY created_at DESC
  `),
  getSongById: sqlite.prepare(`SELECT * FROM songs WHERE id = ?`),
  getSongByYoutubeId: sqlite.prepare(`SELECT * FROM songs WHERE youtube_id = ?`),
  insertSong: sqlite.prepare(`
    INSERT INTO songs (id, youtube_id, title, channel_name, thumbnail, duration, is_in_library, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 1, ?)
  `),
  updateSong: sqlite.prepare(`
    UPDATE songs SET
      youtube_id = COALESCE(?, youtube_id),
      title = COALESCE(?, title),
      channel_name = COALESCE(?, channel_name),
      thumbnail = COALESCE(?, thumbnail),
      duration = COALESCE(?, duration),
      is_in_library = COALESCE(?, is_in_library),
      is_downloaded = COALESCE(?, is_downloaded),
      local_path = ?,
      downloaded_at = ?
    WHERE id = ?
  `),

  // Playlists
  getPlaylists: sqlite.prepare(`SELECT * FROM playlists ORDER BY created_at DESC`),
  getPlaylistById: sqlite.prepare(`SELECT * FROM playlists WHERE id = ?`),
  insertPlaylist: sqlite.prepare(`
    INSERT INTO playlists (id, name, created_at) VALUES (?, ?, ?)
  `),
  deletePlaylist: sqlite.prepare(`DELETE FROM playlists WHERE id = ?`),

  // PlaylistSongs
  getPlaylistSongs: sqlite.prepare(`
    SELECT ps.*, s.id as s_id, s.youtube_id, s.title, s.channel_name, s.thumbnail,
           s.duration, s.is_in_library, s.is_downloaded, s.local_path, s.downloaded_at, s.created_at as s_created_at
    FROM playlist_songs ps
    JOIN songs s ON ps.song_id = s.id
    WHERE ps.playlist_id = ?
    ORDER BY ps.position
  `),
  getPlaylistSongExists: sqlite.prepare(`
    SELECT id FROM playlist_songs WHERE playlist_id = ? AND song_id = ?
  `),
  getPlaylistMaxPosition: sqlite.prepare(`
    SELECT MAX(position) as max_pos FROM playlist_songs WHERE playlist_id = ?
  `),
  insertPlaylistSong: sqlite.prepare(`
    INSERT INTO playlist_songs (id, playlist_id, song_id, position, added_at) VALUES (?, ?, ?, ?, ?)
  `),
  deletePlaylistSong: sqlite.prepare(`
    DELETE FROM playlist_songs WHERE playlist_id = ? AND song_id = ?
  `),

  // Sessions
  getSessions: sqlite.prepare(`SELECT * FROM sessions`),
  getActiveSessions: sqlite.prepare(`
    SELECT * FROM sessions WHERE is_active = 1 AND last_seen_at > ?
  `),
  getSessionById: sqlite.prepare(`SELECT * FROM sessions WHERE id = ?`),
  insertSession: sqlite.prepare(`
    INSERT INTO sessions (id, display_name, color_index, is_admin, is_active, created_at, last_seen_at)
    VALUES (?, ?, ?, 0, 1, ?, ?)
  `),
  updateSession: sqlite.prepare(`
    UPDATE sessions SET
      display_name = COALESCE(?, display_name),
      color_index = COALESCE(?, color_index),
      is_admin = COALESCE(?, is_admin),
      is_active = COALESCE(?, is_active),
      last_seen_at = COALESCE(?, last_seen_at)
    WHERE id = ?
  `),
  deleteSession: sqlite.prepare(`DELETE FROM sessions WHERE id = ?`),
  deactivateSession: sqlite.prepare(`UPDATE sessions SET is_active = 0 WHERE id = ?`),
  markStaleSessionsInactive: sqlite.prepare(`
    UPDATE sessions SET is_active = 0 WHERE last_seen_at < ? AND is_active = 1
  `),
  deleteOldInactiveSessions: sqlite.prepare(`
    DELETE FROM sessions WHERE is_active = 0 AND last_seen_at < ?
  `),
  deleteInactiveSessions: sqlite.prepare(`DELETE FROM sessions WHERE is_active = 0`),
  countInactiveSessions: sqlite.prepare(`SELECT COUNT(*) as count FROM sessions WHERE is_active = 0`),

  // RadioState
  getRadioState: sqlite.prepare(`SELECT * FROM radio_state WHERE id = 'main'`),
  upsertRadioState: sqlite.prepare(`
    INSERT INTO radio_state (id, is_playing, current_song_id, current_position, started_at, last_updated_at, is_shuffled, active_radio_playlist_id)
    VALUES ('main', ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      is_playing = excluded.is_playing,
      current_song_id = excluded.current_song_id,
      current_position = excluded.current_position,
      started_at = excluded.started_at,
      last_updated_at = excluded.last_updated_at,
      is_shuffled = excluded.is_shuffled,
      active_radio_playlist_id = excluded.active_radio_playlist_id
  `),

  // SkipVotes
  getSkipVotes: sqlite.prepare(`SELECT * FROM skip_votes`),
  getSkipVotesForSong: sqlite.prepare(`SELECT * FROM skip_votes WHERE song_id = ?`),
  getSkipVote: sqlite.prepare(`SELECT * FROM skip_votes WHERE session_id = ? AND song_id = ?`),
  insertSkipVote: sqlite.prepare(`
    INSERT INTO skip_votes (id, session_id, song_id, created_at) VALUES (?, ?, ?, ?)
  `),
  deleteSkipVote: sqlite.prepare(`DELETE FROM skip_votes WHERE session_id = ? AND song_id = ?`),
  deleteSkipVotesForSong: sqlite.prepare(`DELETE FROM skip_votes WHERE song_id = ?`),
  deleteSkipVotesForSession: sqlite.prepare(`DELETE FROM skip_votes WHERE session_id = ?`),

  // PlaylistVotes
  getPlaylistVotes: sqlite.prepare(`SELECT * FROM playlist_votes WHERE playlist_id = ?`),
  getAllPlaylistVotes: sqlite.prepare(`SELECT * FROM playlist_votes`),
  getPlaylistVote: sqlite.prepare(`SELECT * FROM playlist_votes WHERE session_id = ? AND playlist_id = ?`),
  insertPlaylistVote: sqlite.prepare(`
    INSERT INTO playlist_votes (id, session_id, playlist_id, created_at) VALUES (?, ?, ?, ?)
  `),
  deletePlaylistVoteBySession: sqlite.prepare(`DELETE FROM playlist_votes WHERE session_id = ?`),
  deleteAllPlaylistVotes: sqlite.prepare(`DELETE FROM playlist_votes`),

  // RadioQueue
  getRadioQueue: sqlite.prepare(`
    SELECT rq.*, s.id as s_id, s.youtube_id, s.title, s.channel_name, s.thumbnail,
           s.duration, s.is_in_library, s.is_downloaded, s.local_path, s.downloaded_at, s.created_at as s_created_at
    FROM radio_queue rq
    JOIN songs s ON rq.song_id = s.id
    WHERE rq.is_played = 0
    ORDER BY rq.position
  `),
  getRadioQueueItem: sqlite.prepare(`SELECT * FROM radio_queue WHERE id = ?`),
  getRadioQueueMaxPosition: sqlite.prepare(`
    SELECT MAX(position) as max_pos FROM radio_queue WHERE is_played = 0
  `),
  insertRadioQueueItem: sqlite.prepare(`
    INSERT INTO radio_queue (id, song_id, added_by, added_by_name, position, added_at, is_played)
    VALUES (?, ?, ?, ?, ?, ?, 0)
  `),
  deleteRadioQueueItem: sqlite.prepare(`DELETE FROM radio_queue WHERE id = ?`),
  markQueueItemPlayed: sqlite.prepare(`UPDATE radio_queue SET is_played = 1 WHERE id = ?`),
  getNextQueueItem: sqlite.prepare(`
    SELECT rq.*, s.id as s_id, s.youtube_id, s.title, s.channel_name, s.thumbnail,
           s.duration, s.is_in_library, s.is_downloaded, s.local_path, s.downloaded_at, s.created_at as s_created_at
    FROM radio_queue rq
    JOIN songs s ON rq.song_id = s.id
    WHERE rq.is_played = 0
    ORDER BY rq.position
    LIMIT 1
  `),
  clearRadioQueue: sqlite.prepare(`DELETE FROM radio_queue`),

  // RadioPlaylists
  getRadioPlaylists: sqlite.prepare(`SELECT * FROM radio_playlists ORDER BY created_at DESC`),
  getRadioPlaylistById: sqlite.prepare(`SELECT * FROM radio_playlists WHERE id = ?`),
  insertRadioPlaylist: sqlite.prepare(`
    INSERT INTO radio_playlists (id, name, created_at) VALUES (?, ?, ?)
  `),
  deleteRadioPlaylist: sqlite.prepare(`DELETE FROM radio_playlists WHERE id = ?`),

  // RadioPlaylistSongs
  getRadioPlaylistSongs: sqlite.prepare(`
    SELECT rps.*, s.id as s_id, s.youtube_id, s.title, s.channel_name, s.thumbnail,
           s.duration, s.is_in_library, s.is_downloaded, s.local_path, s.downloaded_at, s.created_at as s_created_at
    FROM radio_playlist_songs rps
    JOIN songs s ON rps.song_id = s.id
    WHERE rps.radio_playlist_id = ?
    ORDER BY rps.position
  `),
  getRadioPlaylistSongExists: sqlite.prepare(`
    SELECT id FROM radio_playlist_songs WHERE radio_playlist_id = ? AND song_id = ?
  `),
  getRadioPlaylistMaxPosition: sqlite.prepare(`
    SELECT MAX(position) as max_pos FROM radio_playlist_songs WHERE radio_playlist_id = ?
  `),
  insertRadioPlaylistSong: sqlite.prepare(`
    INSERT INTO radio_playlist_songs (id, radio_playlist_id, song_id, position, added_at) VALUES (?, ?, ?, ?, ?)
  `),
  deleteRadioPlaylistSong: sqlite.prepare(`
    DELETE FROM radio_playlist_songs WHERE radio_playlist_id = ? AND song_id = ?
  `),

  // For getNextRadioPlaylistSong - using library playlists
  getPlaylistSongEntries: sqlite.prepare(`
    SELECT song_id, position FROM playlist_songs WHERE playlist_id = ? ORDER BY position
  `)
}

// Extract song from joined row
function extractSongFromJoinedRow(row: Record<string, unknown>): Song {
  return {
    id: row.s_id as string,
    youtubeId: row.youtube_id as string,
    title: row.title as string,
    channelName: row.channel_name as string,
    thumbnail: row.thumbnail as string,
    duration: row.duration as number,
    isInLibrary: Boolean(row.is_in_library),
    createdAt: row.s_created_at as number,
    isDownloaded: Boolean(row.is_downloaded),
    localPath: row.local_path as string | null,
    downloadedAt: row.downloaded_at as number | null
  }
}

export const db = {
  // Backup (no-op for SQLite, WAL handles this)
  createBackup: () => {
    // SQLite with WAL mode handles integrity automatically
    // For explicit backups, use sqlite.backup() if needed
  },

  // Songs
  getSongs: (): Song[] => {
    const rows = statements.getSongs.all() as Record<string, unknown>[]
    return rows.map(rowToSong)
  },

  getSongById: (id: string): Song | undefined => {
    const row = statements.getSongById.get(id) as Record<string, unknown> | undefined
    return row ? rowToSong(row) : undefined
  },

  getSongByYoutubeId: (youtubeId: string): Song | undefined => {
    const row = statements.getSongByYoutubeId.get(youtubeId) as Record<string, unknown> | undefined
    return row ? rowToSong(row) : undefined
  },

  createSong: (song: Omit<Song, 'id' | 'createdAt' | 'isInLibrary'>): Song => {
    const id = generateId()
    const createdAt = Date.now()
    statements.insertSong.run(id, song.youtubeId, song.title, song.channelName, song.thumbnail, song.duration, createdAt)
    return {
      ...song,
      id,
      isInLibrary: true,
      createdAt
    }
  },

  updateSong: (id: string, updates: Partial<Song>): Song | null => {
    const existing = db.getSongById(id)
    if (!existing) return null

    statements.updateSong.run(
      updates.youtubeId ?? null,
      updates.title ?? null,
      updates.channelName ?? null,
      updates.thumbnail ?? null,
      updates.duration ?? null,
      updates.isInLibrary !== undefined ? (updates.isInLibrary ? 1 : 0) : null,
      updates.isDownloaded !== undefined ? (updates.isDownloaded ? 1 : 0) : null,
      updates.localPath !== undefined ? updates.localPath : existing.localPath,
      updates.downloadedAt !== undefined ? updates.downloadedAt : existing.downloadedAt,
      id
    )

    return db.getSongById(id) || null
  },

  // Playlists
  getPlaylists: (): Playlist[] => {
    const rows = statements.getPlaylists.all() as Record<string, unknown>[]
    return rows.map(rowToPlaylist)
  },

  getPlaylistById: (id: string): Playlist | undefined => {
    const row = statements.getPlaylistById.get(id) as Record<string, unknown> | undefined
    return row ? rowToPlaylist(row) : undefined
  },

  createPlaylist: (name: string): Playlist => {
    const id = generateId()
    const createdAt = Date.now()
    statements.insertPlaylist.run(id, name, createdAt)
    return { id, name, createdAt }
  },

  deletePlaylist: (id: string): void => {
    statements.deletePlaylist.run(id)
  },

  // Playlist Songs
  getPlaylistSongs: (playlistId: string): (PlaylistSong & { song: Song })[] => {
    const rows = statements.getPlaylistSongs.all(playlistId) as Record<string, unknown>[]
    return rows.map(row => ({
      ...rowToPlaylistSong(row),
      song: extractSongFromJoinedRow(row)
    }))
  },

  addSongToPlaylist: (playlistId: string, songId: string): PlaylistSong | null => {
    const exists = statements.getPlaylistSongExists.get(playlistId, songId)
    if (exists) return null

    const maxPosRow = statements.getPlaylistMaxPosition.get(playlistId) as { max_pos: number | null }
    const position = (maxPosRow?.max_pos ?? -1) + 1

    const id = generateId()
    const addedAt = Date.now()
    statements.insertPlaylistSong.run(id, playlistId, songId, position, addedAt)

    return { id, playlistId, songId, position, addedAt }
  },

  removeSongFromPlaylist: (playlistId: string, songId: string): void => {
    statements.deletePlaylistSong.run(playlistId, songId)
  },

  // Sessions
  getSessions: (): Session[] => {
    const rows = statements.getSessions.all() as Record<string, unknown>[]
    return rows.map(rowToSession)
  },

  getActiveSessions: (): Session[] => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const rows = statements.getActiveSessions.all(fiveMinutesAgo) as Record<string, unknown>[]
    return rows.map(rowToSession)
  },

  getSessionById: (id: string): Session | undefined => {
    const row = statements.getSessionById.get(id) as Record<string, unknown> | undefined
    return row ? rowToSession(row) : undefined
  },

  createSession: (displayName: string, colorIndex: number): Session => {
    const id = generateId()
    const now = Date.now()
    statements.insertSession.run(id, displayName, colorIndex, now, now)
    return {
      id,
      displayName,
      colorIndex,
      isAdmin: false,
      createdAt: now,
      lastSeenAt: now,
      isActive: true
    }
  },

  updateSession: (id: string, updates: Partial<Session>): Session | null => {
    const existing = db.getSessionById(id)
    if (!existing) return null

    statements.updateSession.run(
      updates.displayName ?? null,
      updates.colorIndex ?? null,
      updates.isAdmin !== undefined ? (updates.isAdmin ? 1 : 0) : null,
      updates.isActive !== undefined ? (updates.isActive ? 1 : 0) : null,
      updates.lastSeenAt ?? null,
      id
    )

    return db.getSessionById(id) || null
  },

  deleteSession: (id: string): void => {
    statements.deleteSkipVotesForSession.run(id)
    statements.deletePlaylistVoteBySession.run(id)
    statements.deleteSession.run(id)
  },

  deactivateSession: (id: string): void => {
    statements.deleteSkipVotesForSession.run(id)
    statements.deletePlaylistVoteBySession.run(id)
    statements.deactivateSession.run(id)
  },

  cleanupStaleSessions: (): void => {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000

    statements.markStaleSessionsInactive.run(fiveMinutesAgo)

    const oldCount = statements.deleteOldInactiveSessions.run(oneDayAgo)
    if (oldCount.changes > 0) {
      console.log(`[DB] Purged ${oldCount.changes} old sessions`)
    }
  },

  purgeInactiveSessions: (): number => {
    const countRow = statements.countInactiveSessions.get() as { count: number }
    const count = countRow.count
    if (count > 0) {
      statements.deleteInactiveSessions.run()
      console.log(`[DB] Purged ${count} inactive sessions`)
    }
    return count
  },

  // Radio State
  getRadioState: (): RadioState | null => {
    const row = statements.getRadioState.get() as Record<string, unknown> | undefined
    return row ? rowToRadioState(row) : null
  },

  setRadioState: (state: RadioState): RadioState => {
    statements.upsertRadioState.run(
      state.isPlaying ? 1 : 0,
      state.currentSongId,
      state.currentPosition,
      state.startedAt,
      state.lastUpdatedAt,
      state.isShuffled ? 1 : 0,
      state.activeRadioPlaylistId
    )
    return state
  },

  updateRadioState: (updates: Partial<RadioState>): RadioState => {
    let current = db.getRadioState()
    if (!current) {
      current = {
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

    const newState: RadioState = {
      ...current,
      ...updates,
      lastUpdatedAt: Date.now()
    }

    return db.setRadioState(newState)
  },

  // Skip Votes
  getSkipVotes: (): SkipVote[] => {
    const rows = statements.getSkipVotes.all() as Record<string, unknown>[]
    return rows.map(rowToSkipVote)
  },

  getSkipVotesForSong: (songId: string): SkipVote[] => {
    const rows = statements.getSkipVotesForSong.all(songId) as Record<string, unknown>[]
    return rows.map(rowToSkipVote)
  },

  getSkipVote: (sessionId: string, songId: string): SkipVote | undefined => {
    const row = statements.getSkipVote.get(sessionId, songId) as Record<string, unknown> | undefined
    return row ? rowToSkipVote(row) : undefined
  },

  createSkipVote: (sessionId: string, songId: string): SkipVote | null => {
    const existing = db.getSkipVote(sessionId, songId)
    if (existing) return null

    const id = generateId()
    const createdAt = Date.now()
    try {
      statements.insertSkipVote.run(id, sessionId, songId, createdAt)
      return { id, sessionId, songId, createdAt }
    } catch {
      return null
    }
  },

  removeSkipVote: (sessionId: string, songId: string): void => {
    statements.deleteSkipVote.run(sessionId, songId)
  },

  clearSkipVotesForSong: (songId: string): void => {
    statements.deleteSkipVotesForSong.run(songId)
  },

  // Playlist Votes
  getPlaylistVotes: (playlistId: string): PlaylistVote[] => {
    const rows = statements.getPlaylistVotes.all(playlistId) as Record<string, unknown>[]
    return rows.map(rowToPlaylistVote)
  },

  getAllPlaylistVotes: (): PlaylistVote[] => {
    const rows = statements.getAllPlaylistVotes.all() as Record<string, unknown>[]
    return rows.map(rowToPlaylistVote)
  },

  getPlaylistVote: (sessionId: string, playlistId: string): PlaylistVote | undefined => {
    const row = statements.getPlaylistVote.get(sessionId, playlistId) as Record<string, unknown> | undefined
    return row ? rowToPlaylistVote(row) : undefined
  },

  hasVotedForPlaylist: (sessionId: string, playlistId: string): boolean => {
    return !!db.getPlaylistVote(sessionId, playlistId)
  },

  createPlaylistVote: (sessionId: string, playlistId: string): PlaylistVote => {
    // Remove existing vote from this session
    statements.deletePlaylistVoteBySession.run(sessionId)

    const id = generateId()
    const createdAt = Date.now()
    statements.insertPlaylistVote.run(id, sessionId, playlistId, createdAt)
    return { id, sessionId, playlistId, createdAt }
  },

  removePlaylistVote: (sessionId: string): void => {
    statements.deletePlaylistVoteBySession.run(sessionId)
  },

  clearPlaylistVotes: (): void => {
    statements.deleteAllPlaylistVotes.run()
  },

  // Radio Queue
  getRadioQueue: (): (RadioQueueItem & { song: Song })[] => {
    const rows = statements.getRadioQueue.all() as Record<string, unknown>[]
    return rows.map(row => ({
      ...rowToRadioQueueItem(row),
      song: extractSongFromJoinedRow(row)
    }))
  },

  getRadioQueueItem: (id: string): RadioQueueItem | undefined => {
    const row = statements.getRadioQueueItem.get(id) as Record<string, unknown> | undefined
    return row ? rowToRadioQueueItem(row) : undefined
  },

  addToRadioQueue: (songId: string, addedBy: string, addedByName: string): RadioQueueItem => {
    const maxPosRow = statements.getRadioQueueMaxPosition.get() as { max_pos: number | null }
    const position = (maxPosRow?.max_pos ?? -1) + 1

    const id = generateId()
    const addedAt = Date.now()
    statements.insertRadioQueueItem.run(id, songId, addedBy, addedByName, position, addedAt)

    return {
      id,
      songId,
      addedBy,
      addedByName,
      position,
      addedAt,
      isPlayed: false
    }
  },

  removeFromRadioQueue: (id: string): void => {
    statements.deleteRadioQueueItem.run(id)
  },

  markQueueItemPlayed: (id: string): RadioQueueItem | null => {
    statements.markQueueItemPlayed.run(id)
    return db.getRadioQueueItem(id) || null
  },

  getNextQueueItem: (): (RadioQueueItem & { song: Song }) | null => {
    const row = statements.getNextQueueItem.get() as Record<string, unknown> | undefined
    if (!row) return null
    return {
      ...rowToRadioQueueItem(row),
      song: extractSongFromJoinedRow(row)
    }
  },

  clearRadioQueue: (): void => {
    statements.clearRadioQueue.run()
  },

  // Radio Playlists
  getRadioPlaylists: (): RadioPlaylist[] => {
    const rows = statements.getRadioPlaylists.all() as Record<string, unknown>[]
    return rows.map(rowToRadioPlaylist)
  },

  getRadioPlaylistById: (id: string): RadioPlaylist | undefined => {
    const row = statements.getRadioPlaylistById.get(id) as Record<string, unknown> | undefined
    return row ? rowToRadioPlaylist(row) : undefined
  },

  createRadioPlaylist: (name: string): RadioPlaylist => {
    const id = generateId()
    const createdAt = Date.now()
    statements.insertRadioPlaylist.run(id, name, createdAt)
    return { id, name, createdAt }
  },

  deleteRadioPlaylist: (id: string): void => {
    // Clear active playlist if it was deleted
    const radioState = db.getRadioState()
    if (radioState?.activeRadioPlaylistId === id) {
      db.updateRadioState({ activeRadioPlaylistId: null })
    }
    statements.deleteRadioPlaylist.run(id)
  },

  // Radio Playlist Songs
  getRadioPlaylistSongs: (radioPlaylistId: string): (RadioPlaylistSong & { song: Song })[] => {
    const rows = statements.getRadioPlaylistSongs.all(radioPlaylistId) as Record<string, unknown>[]
    return rows.map(row => ({
      ...rowToRadioPlaylistSong(row),
      song: extractSongFromJoinedRow(row)
    }))
  },

  addSongToRadioPlaylist: (radioPlaylistId: string, songId: string): RadioPlaylistSong | null => {
    const exists = statements.getRadioPlaylistSongExists.get(radioPlaylistId, songId)
    if (exists) return null

    const maxPosRow = statements.getRadioPlaylistMaxPosition.get(radioPlaylistId) as { max_pos: number | null }
    const position = (maxPosRow?.max_pos ?? -1) + 1

    const id = generateId()
    const addedAt = Date.now()
    statements.insertRadioPlaylistSong.run(id, radioPlaylistId, songId, position, addedAt)

    return { id, radioPlaylistId, songId, position, addedAt }
  },

  removeSongFromRadioPlaylist: (radioPlaylistId: string, songId: string): void => {
    statements.deleteRadioPlaylistSong.run(radioPlaylistId, songId)
  },

  // Get next song from active playlist (for fallback when queue is empty)
  getNextRadioPlaylistSong: (): { songId: string; position: number; song: Song } | null => {
    const radioState = db.getRadioState()
    if (!radioState?.activeRadioPlaylistId) return null

    // Get songs from library playlist
    const songEntries = statements.getPlaylistSongEntries.all(radioState.activeRadioPlaylistId) as { song_id: string; position: number }[]
    if (songEntries.length === 0) return null

    let selectedEntry: { song_id: string; position: number }
    if (radioState.isShuffled) {
      const randomIndex = Math.floor(Math.random() * songEntries.length)
      selectedEntry = songEntries[randomIndex]
    } else {
      const currentIndex = songEntries.findIndex(ps => ps.song_id === radioState.currentSongId)
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % songEntries.length : 0
      selectedEntry = songEntries[nextIndex]
    }

    const song = db.getSongById(selectedEntry.song_id)
    if (!song) return null

    return {
      songId: selectedEntry.song_id,
      position: selectedEntry.position,
      song
    }
  },

  // Set active radio playlist
  setActiveRadioPlaylist: (playlistId: string | null): RadioState => {
    return db.updateRadioState({ activeRadioPlaylistId: playlistId })
  },

  // Toggle shuffle
  toggleShuffle: (): RadioState => {
    const current = db.getRadioState()
    return db.updateRadioState({ isShuffled: !current?.isShuffled })
  },

  // Audio storage helpers
  getAudioDir: (): string => ensureAudioDir(),

  getAudioPath: (songId: string): string => {
    return join(ensureAudioDir(), `${songId}.mp3`)
  },

  markSongDownloaded: (songId: string, localPath: string): Song | null => {
    return db.updateSong(songId, {
      isDownloaded: true,
      localPath,
      downloadedAt: Date.now()
    })
  },

  markSongNotDownloaded: (songId: string): Song | null => {
    return db.updateSong(songId, {
      isDownloaded: false,
      localPath: null,
      downloadedAt: null
    })
  },

  getDownloadedSongs: (): Song[] => {
    const rows = sqlite.prepare(`
      SELECT * FROM songs WHERE is_downloaded = 1 AND local_path IS NOT NULL
    `).all() as Record<string, unknown>[]
    return rows.map(rowToSong)
  },

  // Sync local audio files with database
  syncLocalAudioFiles: (): { synced: number; removed: number } => {
    const audioDir = ensureAudioDir()
    let audioFiles: string[] = []
    try {
      audioFiles = readdirSync(audioDir)
        .filter(f => f.endsWith('.mp3'))
        .map(f => f.replace('.mp3', ''))
    } catch (error) {
      console.error('[DB] Error reading audio directory:', error)
      return { synced: 0, removed: 0 }
    }

    let synced = 0
    let removed = 0

    const allSongs = sqlite.prepare(`SELECT * FROM songs`).all() as Record<string, unknown>[]

    for (const row of allSongs) {
      const song = rowToSong(row)
      const expectedPath = join(audioDir, `${song.id}.mp3`)
      const fileExists = audioFiles.includes(song.id)

      if (fileExists && !song.isDownloaded) {
        db.markSongDownloaded(song.id, expectedPath)
        synced++
        console.log(`[DB] Synced local file for song: ${song.title}`)
      } else if (!fileExists && song.isDownloaded) {
        db.markSongNotDownloaded(song.id)
        removed++
        console.log(`[DB] Removed download status for missing file: ${song.title}`)
      }
    }

    return { synced, removed }
  },

  // Get count of locally available songs for a playlist
  getPlaylistLocalCount: (playlistId: string): { total: number; local: number } => {
    const audioDir = ensureAudioDir()
    let audioFiles: string[] = []
    try {
      audioFiles = readdirSync(audioDir)
        .filter(f => f.endsWith('.mp3'))
        .map(f => f.replace('.mp3', ''))
    } catch {
      return { total: 0, local: 0 }
    }

    const playlistSongs = sqlite.prepare(`
      SELECT song_id FROM playlist_songs WHERE playlist_id = ?
    `).all(playlistId) as { song_id: string }[]

    let localCount = 0
    for (const ps of playlistSongs) {
      if (audioFiles.includes(ps.song_id)) {
        localCount++
      }
    }

    return { total: playlistSongs.length, local: localCount }
  }
}
