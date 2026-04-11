# stepbro downloader

Download videos and audio from thousands of sites. A clean web UI for yt-dlp, built to self-host on your VPS.

## Features

- **Thousands of supported sites:** YouTube, Twitter/X, Instagram, TikTok, and [many more](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)
- **Video + audio options:** Choose quality (4K → 360p), container (MP4, WebM, MKV) and audio-only with format and quality selection
- **No storage:** Files are downloaded to a temp directory, served directly to the browser, and deleted automatically — nothing is kept on the server
- **Real-time progress:** Live progress bar with speed and ETA during download
- **Dark/Light theme:** System preference detection with manual toggle
- **Self-hostable:** Docker image with ffmpeg and yt-dlp bundled, ready for Dokploy or any VPS
- **YouTube bot detection bypass:** Optional bgutil PO token provider and/or cookies support for VPS deployments blocked by YouTube

## How it works

1. Paste a URL → fetch video info
2. Choose quality and format → click Download
3. yt-dlp downloads the file to a temporary directory on the server
4. The browser save dialog opens automatically
5. The file is deleted from the server shortly after it's sent (or after 15 minutes if unclaimed)

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
git clone https://github.com/LIL-JRG/stepbro-downloader
cd stepbro-downloader
npm install
```

Create a `.env.local` file:

```env
# Full path to yt-dlp binary (only needed if not in PATH)
YT_DLP_BIN=

# Full path to ffmpeg binary (only needed if not in PATH)
FFMPEG_BIN=

# (Optional) URL of a bgutil PO token provider — see YouTube section below
BGUTIL_URL=

# (Optional) Path to a Netscape-format cookies file for YouTube
YOUTUBE_COOKIES_FILE=
```

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

### Docker (local)

ffmpeg and yt-dlp are bundled in the image. Includes bgutil for YouTube support:

```bash
docker compose -f docker-compose.local.yml up --build
```

This starts both the app on port 3000 and the bgutil PO token provider. `BGUTIL_URL` is pre-configured between services.

---

### Deploy to Dokploy

#### 1. Deploy the app

1. Create a new **Application** in Dokploy and point it to this repository
2. Set **Build type** to **Dockerfile**
3. In **Domains**, add your domain and enable HTTPS — Dokploy configures Traefik automatically
4. Deploy

The app listens on port 3000 internally. No volumes required for basic usage.

#### 2. (Optional) YouTube bot detection bypass

VPS IPs are often flagged by YouTube. Two complementary options:

**Option A — bgutil PO token provider**

1. Create a new **Docker Compose** service in Dokploy, point it to this repo, and set **Compose path** to `./docker-compose.bgutil.yml`
2. Deploy it
3. In your Application service, add the environment variable:
   ```
   BGUTIL_URL=http://bgutil-provider:4416
   ```
4. Redeploy the app

The bgutil container generates YouTube PO tokens. The app fetches them automatically and caches them for 6 hours. The first request may take up to 2 minutes while bgutil initializes.

**Option B — YouTube cookies**

Export your YouTube cookies in Netscape format (e.g. with a browser extension like [Get cookies.txt](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)), then:

1. Upload the cookies file to your VPS (e.g. `/data/cookies/youtube-cookies.txt`)
2. In Dokploy, add a bind mount: host `/data/cookies` → container `/cookies`
3. Add the environment variable:
   ```
   YOUTUBE_COOKIES_FILE=/cookies/youtube-cookies.txt
   ```
4. Redeploy the app

> Both options can be used together. When a cookies file is configured, the app uses the web player client with the full signed-in session (recommended). When only bgutil is configured, the app supplies its PO tokens directly bypassing the YouTube page.

#### Debug endpoint

`GET /api/debug` returns the yt-dlp version, bgutil connectivity status, and the tokens received — useful for verifying your setup after deploy.

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `YT_DLP_BIN` | `yt-dlp` | Path to the yt-dlp binary |
| `FFMPEG_BIN` | *(system PATH)* | Path to the ffmpeg binary |
| `BGUTIL_URL` | *(disabled)* | URL of the bgutil PO token provider |
| `YOUTUBE_COOKIES_FILE` | *(disabled)* | Path to a Netscape-format YouTube cookies file |

## Built With

- [yt-dlp](https://github.com/yt-dlp/yt-dlp) — The download engine
- [Next.js](https://nextjs.org) — React framework (App Router)
- [shadcn/ui](https://ui.shadcn.com) — UI components
- [Tailwind CSS](https://tailwindcss.com) — Styling
- [Motion](https://motion.dev/) — Animations
- [Docker](https://www.docker.com) — Containerization
- [brainicism/bgutil-ytdlp-pot-provider](https://github.com/brainicism/bgutil-ytdlp-pot-provider) — YouTube PO token generation

## License

MIT
