/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */

interface BgutilTokens {
  poToken: string
  visitorData: string
}

let _cachedTokens: BgutilTokens | null = null
let _cachedAt = 0
const TOKEN_CACHE_MS = 6 * 60 * 60 * 1000

async function fetchBgutilTokens(baseUrl: string): Promise<BgutilTokens | null> {
  const now = Date.now()
  if (_cachedTokens && now - _cachedAt < TOKEN_CACHE_MS) return _cachedTokens

  try {
    const res = await fetch(`${baseUrl}/get_pot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, string>
    const poToken = data.poToken ?? data.po_token
    const visitorData = data.contentBinding ?? data.visitorData ?? data.visitor_data ?? ''
    if (!poToken) return null
    _cachedTokens = { poToken, visitorData: decodeURIComponent(visitorData) }
    _cachedAt = now
    return _cachedTokens
  } catch {
    return null
  }
}

export async function commonYtdlpArgs(): Promise<string[]> {
  const args: string[] = []

  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')

  // Node.js runtime for n-challenge / signature solving on the web client.
  // Explicit path needed — Alpine's PATH lookup is not reliable in spawned processes.
  args.push('--js-runtimes', 'node:/usr/local/bin/node')

  // EJS challenge solver downloaded from GitHub at first use and cached locally.
  // Required since yt-dlp 2025.x — without it, n-challenge solving is skipped
  // and only low-quality storyboard images are returned.
  args.push('--remote-components', 'ejs:github')

  if (cookiesFile) {
    // Authenticated via cookies. Web client visits the YouTube page to get the
    // full player config and Data Sync ID. player.js is downloaded for
    // n-challenge + signature solving via node.js + the EJS solver above.
    args.push('--cookies', cookiesFile)

    const ytArgs = ['player_client=web']

    if (bgutilUrl) {
      // Fetch PO token from our bgutil instance (correct Docker network URL).
      // The bgutil yt-dlp plugin is NOT installed — it would try 127.0.0.1:4416
      // and fail. We pass the token directly here instead.
      const tokens = await fetchBgutilTokens(bgutilUrl)
      if (tokens?.poToken) {
        // Pass the PO token scoped to the web client.
        // visitor_data is intentionally omitted so yt-dlp uses the one obtained
        // from visiting the YouTube page (needed for valid Data Sync ID).
        ytArgs.push(`po_token=web+${tokens.poToken}`)
      }
    }

    args.push('--extractor-args', `youtube:${ytArgs.join(';')}`)
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else if (bgutilUrl) {
    // No cookies: bypass the YouTube watch page (bot-blocked on VPS IPs) and
    // supply bgutil's visitor_data + PO token directly via player_skip.
    const tokens = await fetchBgutilTokens(bgutilUrl)
    if (tokens?.visitorData) {
      args.push(
        '--extractor-args',
        `youtube:player_client=web;po_token=web+${tokens.poToken};visitor_data=${tokens.visitorData};player_skip=webpage,configs`,
      )
      args.push('--extractor-args', 'youtubetab:skip=webpage')
    } else {
      args.push('--extractor-args', 'youtube:player_client=android,ios')
    }
  } else {
    // No auth: android/ios use mobile API — no JS challenges, work from any IP.
    args.push('--extractor-args', 'youtube:player_client=android,ios')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
