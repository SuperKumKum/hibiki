![Hibiki](hibiki_v2.svg)

Self-hosted YouTube music streaming application built with Next.js 15.

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
- Docker & Docker Compose (for deployment)
- Python 3 & yt-dlp (installed automatically in Docker)

## Quick Start with Docker (Recommended)

1. **Download the docker-compose.yml file:**
   ```bash
   wget https://raw.githubusercontent.com/superkumkum/hibiki/main/docker-compose.yml
   ```

2. **Configure environment (optional for Radio admin):**
   ```bash
   echo "ADMIN_PASSWORD=your-secret-password" > .env
   ```

3. **Start the application:**
   ```bash
   docker-compose up -d
   ```

4. **Access the application:**
   Navigate to [http://localhost:3000](http://localhost:3000)

Your music library will be stored in `./data/db.json` and persists across container restarts.

## Local Development

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create Python virtual environment:**
   ```bash
   python -m venv .venv
   ```

3. **Activate the virtual environment:**
   - **Linux/macOS:**
     ```bash
     source .venv/bin/activate
     ```
   - **Windows:**
     ```bash
     .venv\Scripts\activate
     ```

4. **Install yt-dlp:**
   ```bash
   pip install yt-dlp
   ```

5. **Run the development server:**
   ```bash
   npm run dev
   ```

6. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

The database file (`data/db.json`) will be created automatically on first run.

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

All data is stored in a simple JSON file at `data/db.json`. To backup your library, simply copy the `data/` folder.

## Notes

- Audio files are **never downloaded** to the server
- Streaming URLs are dynamically generated using `yt-dlp`
- The application requires `yt-dlp` to be installed (included in Docker)

## License

MIT
