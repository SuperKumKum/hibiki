![Hibiki](hibiki_v2.svg)

Self-hosted YouTube music streaming and collaborative radio application built with Next.js.

## Features

### Library Management
- Stream music from YouTube without downloading files
- **YouTube Search** - Search videos directly from the app or paste URLs
- Create and manage playlists
- Bulk playlist creation from YouTube playlist URLs
- Song tags showing playlist memberships
- Cross-playlist song movement
- Bulk song selection and deletion

### Collaborative Radio Mode
- Multiple users listen to the same music in sync
- Temporary user sessions with display names and avatar colors
- Admin controls for playback (play, pause, skip, seek, shuffle)
- Vote-to-skip system (majority vote)
- Vote-to-load-playlist system (majority vote)
- Real-time listener list

### Player & UI
- Tokyo Night color theme
- Fully responsive design (mobile & desktop)
- Full playback controls (play, pause, next, previous, shuffle)
- Volume control with visual feedback
- Progress bar with seeking and time display
- Global player - music continues playing across page navigation
- Toast notifications for user feedback

### Technical
- sqlite3 SQL database to manage songs, playlists, mapping of storage and states of plays
- Easy Docker deployment
- TypeScript + Tailwind CSS

## Prerequisites

- Node.js 20+ (for local development)
- Sqlite3 (for local development)
- Docker & Docker Compose (for deployment)
- Python 3 & yt-dlp (installed automatically in Docker)

## Notes
There are sometimes rate-limiting from Youtube with yt-dlp (even more if you're hosting on a static IP). 
There is `yt-dlp` cache to prevent to requests Youtube, but when streaming it still send requests and it might not works on some songs. (Rick roll works fine) 
To prevent this problem, there are 2 solutions: 
- Download locally a playlist (Will take disk space on your system)
- Add a `./data/cookies.txt` file to use active cookie from a Youtube session using your account.

### Retrieve active cookie from Youtube session 
- Get cookies.txt (for Chrome) https://chrome.google.com/webstore/detail/get-cookiestxt/bgaddhkoddajcdgocldbbfleckgcbcid/
- Get cookies.txt (for Firefox ) https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/
- Add it to `./data/cookies.txt`

You can check if is working from NodeJS logs (using `docker logs -f hibiki`) 
Here is a example output (without the file): 
```
[yt-dlp] Current working directory: /app
[yt-dlp] Checking cookie paths: [ '/app/data/cookies.txt', '/app/cookies.txt', '/data/cookies.txt' ]
[yt-dlp] Checking /app/data/cookies.txt: NOT FOUND
[yt-dlp] Checking /app/cookies.txt: NOT FOUND
[yt-dlp] Checking /data/cookies.txt: NOT FOUND
[yt-dlp] No cookies file found, some videos may not work
```
## Quick Start with Docker (Recommended)

The container will run with an unprevilegied user by default using UID and GID *1001* 

0. **Add Unix system user**
   ```bash
   addgroup -g 1001 hibiki
   adduser -u 1001 -g 1001 -s /usr/sbin/nologin
   ```
   
2. **Download the docker-compose.yml file:**
   ```bash
   wget https://raw.githubusercontent.com/superkumkum/hibiki/main/docker-compose.yml
   ```

3. **Configure environment (optional for Radio admin):**
   ```bash
   echo "ADMIN_PASSWORD=your-secret-password" > .env
   ```

4. **Start the application:**
   ```bash
   docker-compose up -d
   ```

5. **Access the application:**
   Navigate to [http://localhost:3000](http://localhost:3000)

The SQLlite3 database will be created on first container launch. The file is stored under ./data/hibiki.db (for backup purpose).

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```


2. **Install yt-dlp:**
   ```bash
   pip install yt-dlp
   ```

3. **Run the development server:**
   ```bash
   npm run dev
   ```

4. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

The database file (`data/hibiki.db`) will be created automatically on first run.

## Usage

### Library
1. **Search or add a song**: Type to search YouTube or paste a URL directly
2. **Play a song**: Click the play button on any song card
3. **Control playback**: Use the player controls at the bottom of the page
4. **Create playlists**: Navigate to Playlists and create your custom collections
5. **Shuffle mode**: Toggle shuffle to randomize playback order

### Radio Mode
1. **Join the radio**: Navigate to Radio and enter a display name
2. **Add songs**: Use the queue to add songs from your library or YouTube
3. **Vote to skip**: Click skip to vote - majority triggers skip
4. **Admin controls**: Enter admin password for full playback control

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `ADMIN_PASSWORD` | Password for Radio admin authentication | - |

## Updating

```bash
docker-compose down
docker-compose pull
docker-compose up -d
```

## Build from Source

```bash
git clone https://github.com/superkumkum/hibiki.git
cd hibiki
docker build -t hibiki .
docker-compose up -d
```

## Data Storage

- The database SQLite3 is stored under `data/hibiki.db`
- Locally audio files are stored under `data/audio` and must be mounted as a volume from docker

## Notes

- Audio files are **never downloaded** to the server in default behavior, you will need to **manually download** songs / playlists from /playlists
- Streaming URLs are dynamically generated using `yt-dlp`
- The application requires `yt-dlp` to be installed (included in Docker)
