# Stepbro Downloader

Download videos and audio from thousands of sites. A clean web UI for yt-dlp, built to self-host on your VPS.

## Features

- **Thousands of supported sites:** YouTube, Twitter/X, Instagram, TikTok, and [many more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- **Video + audio options:** Choose quality (4K → 360p), container (MP4, WebM, MKV) and audio bitrate independently
- **No storage:** Files are downloaded to a temp directory, served directly to the browser, and deleted automatically — nothing is kept on the server
- **Real-time feedback:** Spinner and toast notifications — no noisy progress logs
- **Dark/Light theme:** System preference detection with manual toggle
- **Self-hostable:** Docker image with ffmpeg and yt-dlp bundled, ready for Dokploy or any VPS

## How it works

1. Paste a URL → fetch video info
2. Choose quality and format → click Download
3. yt-dlp downloads the file to a temporary directory on the server
4. The browser save dialog opens automatically
5. The file is deleted from the server 5 seconds after it's sent (or after 15 minutes if unclaimed)

## Quick Start

### Local development

**Prerequisites**

- Node.js 22+
- [yt-dlp](https://github.com/yt-dlp/yt-dlp)
- [ffmpeg](https://ffmpeg.org) (required for merging video + audio at 1080p+)

<details>
<summary><b>Windows</b></summary>

```powershell
winget install yt-dlp.yt-dlp
winget install yt-dlp.FFmpeg
```

</details>

<details>
<summary><b>macOS</b></summary>

```bash
brew install yt-dlp ffmpeg
```

</details>

<details>
<summary><b>Linux</b></summary>

```bash
sudo apt install ffmpeg
pip install yt-dlp
```

</details>

**Install and run**

```bash
git clone https://github.com/your-username/stepbro-downloader.git
cd stepbro-downloader
npm install
```

Create a `.env.local` file:

```env
# Full path to yt-dlp binary (only needed if not in PATH, e.g. Windows + winget)
YT_DLP_BIN=

# Full path to ffmpeg binary (only needed if not in PATH, e.g. Windows + winget)
FFMPEG_BIN=
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Docker

ffmpeg and yt-dlp are bundled in the image — no extra setup needed.

```bash
docker compose -f docker-compose.local.yml up
```

---

### Deploy to Dokploy

1. Create a **Docker Compose** application in Dokploy and point it to this repository
2. In **Domains**, add your domain — Dokploy configures Traefik automatically
3. Deploy

The container listens on port 3000 internally. Traefik routes HTTPS traffic with no port conflicts. No volumes needed — the app uses the system temp directory.

## Built With

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — The download engine powering everything
- [Next.js](https://nextjs.org) — React framework (App Router)
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Motion](https://motion.dev/) — Animations
- [Docker](https://www.docker.com) — Containerization

## License

MIT
