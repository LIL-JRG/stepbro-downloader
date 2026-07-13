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

#### 2. (Recommended) YouTube on a VPS: PO tokens + proxy

YouTube blocks datacenter IPs in **two layers**, and a VPS usually hits both:

1. **The bot check** — unauthenticated requests from a flagged IP get *"Sign in to
   confirm you're not a bot"*.
2. **SABR-only streaming** — even once past the bot check, a low-trust IP is served
   SABR streams whose media URLs are withheld unless the request carries a **GVS PO
   token**. Without it yt-dlp reports *"Only images are available"* and quality
   collapses to storyboards or a single 360p stream.

You need to address both. In practice: **bgutil** (for the PO/GVS tokens) **+ a proxy**
(to get past the IP block).

**A — bgutil PO token provider (handles the tokens)**

1. Create a new **Docker Compose** service in Dokploy, point it to this repo, and set **Compose path** to `./docker-compose.bgutil.yml`
2. Deploy it
3. In your Application service, add the environment variable:
   ```
   BGUTIL_URL=http://bgutil-provider:4416
   ```
4. Redeploy the app

The app installs the `bgutil-ytdlp-pot-provider` **yt-dlp plugin** (see the Dockerfile),
which fetches both the `player` and `gvs` PO tokens from the container automatically.
The first request may take up to 2 minutes while bgutil initializes.

**B — Outbound proxy to bypass the IP block (`YTDLP_PROXY`)**

The bot check is IP-based, so it cannot be solved from the VPS itself — outbound
requests must leave through a less-flagged IP. Two ways:

- **Cloudflare WARP (free, runs on the VPS).** Deploy `./docker-compose.warp.yml` as a
  separate Docker Compose service in Dokploy, then set on the app:
  ```
  YTDLP_PROXY=socks5://warp:1080
  ```
  WARP's egress is usually trusted enough to clear the bot check. Reliability is
  best-effort — verify with the debug endpoint.
- **Residential/mobile proxy (paid, most robust).** Point `YTDLP_PROXY` at any
  `http://user:pass@host:port` or `socks5://host:port` residential proxy.

**C — (Optional) YouTube cookies**

Cookies are no longer required, but a valid signed-in session can still help. Export
them in Netscape format (e.g. with [Get cookies.txt](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)) — from a private/incognito window that you close immediately after exporting, or the session rotates and the cookies stop authenticating — then:

1. Upload the cookies file to your VPS (e.g. `/data/cookies/youtube-cookies.txt`)
2. In Dokploy, add a bind mount: host `/data/cookies` → container `/cookies`
3. Set `YOUTUBE_COOKIES_FILE=/cookies/youtube-cookies.txt` and redeploy

> **Recommended VPS setup:** bgutil (`BGUTIL_URL`) + WARP (`YTDLP_PROXY`). This clears
> both the bot check and the SABR/GVS restriction, returning the full format list up
> to 4K without any account cookies.

#### Debug endpoint

`GET /api/debug` returns the yt-dlp version, the active proxy, bgutil connectivity
status, and the tokens received. Add `?url=<youtube_url>` to compare the format lists
produced by each strategy — the quickest way to verify your setup after deploy (look
for real `mp4_dash`/`webm_dash` formats rather than only `sb0..sb3` storyboards).

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `YT_DLP_BIN` | `yt-dlp` | Path to the yt-dlp binary |
| `FFMPEG_BIN` | *(system PATH)* | Path to the ffmpeg binary |
| `BGUTIL_URL` | *(disabled)* | URL of the bgutil PO token provider (used via the yt-dlp plugin) |
| `YTDLP_PROXY` | *(disabled)* | Outbound proxy for yt-dlp (`http://…` or `socks5://…`); needed to bypass a blocked VPS IP |
| `DAILY_DOWNLOAD_LIMIT` | `5` | Max successful downloads per client IP per day |
| `MAX_VIDEO_DURATION` | `10800` | Max allowed video length in seconds (0 = unlimited) |
| `DATA_DIR` | `/data` (Docker) | Where per-IP rate-limit state is persisted; mount a volume here to keep it across redeploys |
| `INFO_RATE_PER_MIN` | `30` | Max `/api/info` (preview) requests per IP per minute |
| `YTDLP_AUTO_UPDATE` | `true` | Update yt-dlp + bgutil plugin on container start |
| `ADMIN_TOKEN` | *(disabled)* | Enables the `/admin` page (DMCA review + supporter keys); sent as `Authorization: Bearer <token>`. Reports only block a video once approved here |

| `KOFI_VERIFICATION_TOKEN` | *(disabled)* | Enables the Ko-fi payment webhook at `/api/kofi` (set it to the token shown at ko-fi.com/manage/webhooks) |
| `KOFI_PRICE_30D` / `KOFI_PRICE_90D` / `KOFI_PRICE_LIFETIME` | `5` / `10` / `25` | Payment thresholds (in your Ko-fi currency) mapping a payment to a license tier; anything below `KOFI_PRICE_30D` grants 7-Day |
| `EMAIL_LOOKUP_PER_HOUR` | `5` | Max license activations/recoveries by payment email per IP per hour (anti-guessing) |

> **Supporter keys:** from `/admin` you can generate keys (`SB-XXXX-XXXX-XXXX`) for
> supporters. Entering a key on the home page (navbar → Supporter, or "Have a
> supporter key?") unlocks unlimited downloads and lifts the duration cap. Keys are
> validated server-side on every request and can be revoked/restored anytime; they
> persist in `DATA_DIR/supporters.json`.
>
> **Automatic activation via Ko-fi:** set `KOFI_VERIFICATION_TOKEN` and point a
> webhook at `https://your-domain/api/kofi` from ko-fi.com/manage/webhooks. When
> someone pays, a key is granted to their payment email automatically — they then
> click Supporter → enter that email, and their license activates on the spot (it
> also works as key recovery). The payment amount picks the tier (7/30/90-day or
> Lifetime, thresholds via `KOFI_PRICE_*`); repeat payments extend or upgrade the
> existing license.
>
> ⚠️ Email-based activation proves only knowledge of the buyer's email. It's
> strictly rate-limited (`EMAIL_LOOKUP_PER_HOUR`), but for stronger verification
> you'd need an email-delivery service to send a confirmation code.
| `YOUTUBE_COOKIES_FILE` | *(disabled)* | Path to a Netscape-format YouTube cookies file (optional) |

> **Local development on a residential IP** needs none of these — yt-dlp's default web
> client returns the full format list. `BGUTIL_URL` + `YTDLP_PROXY` are only for
> datacenter/VPS deployments that YouTube blocks.

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
