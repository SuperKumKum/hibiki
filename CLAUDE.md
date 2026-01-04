# Hibiki - Project Context

## Overview

Hibiki is a self-hosted YouTube music streaming application built with Next.js 15. It allows users to stream music from YouTube, manage playlists, and includes a collaborative radio mode where multiple users can listen together in sync.

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: JSON file storage (`data/db.json`)
- **Audio**: yt-dlp for YouTube metadata and streaming
- **Real-time**: Polling-based synchronization

## Key Features

### 1. Library Management (`/playlists`)
- Create and manage playlists
- Add songs from YouTube URLs
- Songs are stored with metadata (title, channel, thumbnail, duration)

### 2. Collaborative Radio Mode (`/radio`)
- Multiple users listen to the same music in sync
- Temporary user sessions with display names and avatar colors
- Admin controls for playback (play, pause, skip, seek, shuffle)
- Vote-to-skip system (majority vote)
- Vote-to-load-playlist system (majority vote)
- Real-time listener list

## Architecture

### Database Schema (`lib/db.ts`)

```typescript
// Core entities
Song { id, youtubeId, title, channelName, thumbnail, duration, isInLibrary, createdAt }
Playlist { id, name, createdAt }
PlaylistSong { id, playlistId, songId, position, addedAt }

// Radio mode entities
Session { id, displayName, colorIndex, isAdmin, createdAt, lastSeenAt, isActive }
RadioState { id, isPlaying, currentSongId, currentPosition, startedAt, lastUpdatedAt, isShuffled, activeRadioPlaylistId }
RadioQueueItem { id, songId, addedBy, addedByName, position, addedAt, isPlayed }
SkipVote { id, sessionId, songId, createdAt }
PlaylistVote { id, sessionId, playlistId, createdAt }
```

### API Endpoints

#### Library
- `GET/POST /api/playlists` - List/create playlists
- `GET/PUT/DELETE /api/playlists/[id]` - Manage playlist
- `GET/POST /api/playlists/[id]/songs` - Playlist songs
- `GET/POST /api/songs` - Library songs
- `GET /api/stream/[id]` - Stream audio

#### Radio Session
- `GET/POST/DELETE /api/radio/session` - Create/get/end session
- `POST /api/radio/session/heartbeat` - Keep session alive
- `POST /api/radio/session/leave` - End session on page close (beacon)
- `GET /api/radio/sessions` - List active listeners
- `POST /api/radio/admin/auth` - Admin authentication

#### Radio Playback
- `GET /api/radio/state` - Get current state (polled every 2s)
- `POST /api/radio/control/play` - Start playback
- `POST /api/radio/control/pause` - Pause (admin only)
- `POST /api/radio/control/next` - Skip to next
- `POST /api/radio/control/seek` - Seek position (admin only)
- `POST /api/radio/shuffle` - Toggle shuffle (admin only)

#### Radio Queue & Playlists
- `GET/POST /api/radio/queue` - Get/add to queue
- `DELETE /api/radio/queue/[id]` - Remove from queue
- `GET /api/radio/playlists` - List library playlists for radio
- `POST /api/radio/playlists/[id]/activate` - Load playlist to queue (admin)
- `GET/POST /api/radio/playlist-vote` - Vote for playlist
- `POST /api/radio/skip` - Vote to skip current song

### Key Components

#### Radio Context (`components/radio/RadioContext.tsx`)
- Manages all radio state via React Context
- Polling intervals: state (2s), listeners/votes (5s), heartbeat (30s)
- Handles session persistence via localStorage
- Auto-disconnects on page close via `beforeunload` + `sendBeacon`

#### Radio Components
- `RadioPlayer.tsx` - Synced audio player with controls
- `RadioQueue.tsx` - Queue display and add song UI
- `RadioPlaylistManager.tsx` - Playlist selection with voting
- `ListenersList.tsx` - Active listeners display
- `NamePickerModal.tsx` - Join flow with name/color selection
- `AdminLoginModal.tsx` - Admin password authentication

## Radio Mode Behavior

### Session Management
- Users join with a display name and color
- Sessions auto-expire after 5 minutes without heartbeat
- Page close triggers immediate session deactivation
- Sessions stored in localStorage for reconnection

### Playback Sync
- Server is authoritative for playback position
- Position calculated as: `currentPosition + (now - startedAt)`
- Clients sync if drift > 3 seconds
- Admin controls propagate to all listeners

### Voting Systems
1. **Vote to Skip**: Majority (50%+) triggers auto-skip
2. **Vote for Playlist**: Majority triggers playlist load (clears queue, adds all songs)

### Playlist Loading
- Admin can directly activate any library playlist
- When activated: queue is cleared, all playlist songs added
- Shuffle mode randomizes next song selection

## Environment Variables

```bash
ADMIN_PASSWORD=your-secret-password  # Radio admin authentication
```

## Development

```bash
npm install
npm run dev     # Development server
npm run build   # Production build
```

## Docker

```bash
# Build and push to GitLab registry
docker buildx build --platform linux/amd64 -t registry.gitlab.com/USERNAME/hibiki:latest --push .
```

## Dependencies

- `yt-dlp` must be installed on the system for YouTube streaming
- Install via: `pip install yt-dlp` or system package manager
