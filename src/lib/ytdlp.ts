/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */

interface BgutilTokens {
  poToken: string
  visitorData: string
}

// Cache tokens for 6 hours (matches bgutil's TOKEN_TTL default)
let _cachedTokens: BgutilTokens | null = null
let _cachedAt = 0
const TOKEN_CACHE_MS = 6 * 60 * 60 * 1000

async function fetchBgutilTokens(baseUrl: string): Promise<BgutilTokens | null> {
  const now = Date.now()
  if (_cachedTokens && now - _cachedAt < TOKEN_CACHE_MS) return _cachedTokens

  try {
    // bgutil needs to call YouTube internally on the first request to get an
    // IntegrityToken — this can take up to 2 minutes on cold start.
    const res = await fetch(`${baseUrl}/get_pot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(120_000),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, string>
    const poToken = data.poToken ?? data.po_token
    // bgutil v1.3.1 returns "contentBinding" as the visitor data
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

  // Use the node binary already present in the container as JS runtime
  args.push('--js-runtimes', 'node:/usr/local/bin/node')

  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')
  if (bgutilUrl) {
    const tokens = await fetchBgutilTokens(bgutilUrl)
    if (tokens && tokens.visitorData) {
      // player_skip=webpage,configs tells yt-dlp to NOT visit YouTube's page
      // (which would overwrite our visitor_data) and use ours directly.
      // This matches the documented approach for supplying external visitor_data + po_token.
      args.push(
        '--extractor-args',
        `youtube:player_client=web;po_token=web+${tokens.poToken};visitor_data=${tokens.visitorData};player_skip=webpage,configs`,
      )
      args.push('--extractor-args', 'youtubetab:skip=webpage')
    } else {
      // bgutil didn't return tokens — fall back to ios client (no PO token needed)
      args.push('--extractor-args', 'youtube:player_client=ios')
    }
  } else {
    args.push('--extractor-args', 'youtube:player_client=ios')
  }

  // Optional: cookies file for age-restricted or private content
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  if (cookiesFile) args.push('--cookies', cookiesFile)

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
