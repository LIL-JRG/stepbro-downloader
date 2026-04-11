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

  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')

  if (cookiesFile) {
    // Android/iOS clients don't use JS challenge solving (n-challenge / signature),
    // so their stream URLs work directly from datacenter IPs. The web client does
    // require JS challenges, which fail unreliably on VPS IPs and silently fall back
    // to low-quality streams. Cookies still authenticate the session on both clients.
    args.push('--cookies', cookiesFile)
    args.push('--extractor-args', 'youtube:player_client=android,ios')
  } else if (bgutilUrl) {
    // No cookies: use web client with bgutil PO tokens + JS runtime for challenge solving.
    args.push('--js-runtimes', 'node:/usr/local/bin/node')
    args.push('--remote-components', 'ejs:github')
    const tokens = await fetchBgutilTokens(bgutilUrl)
    if (tokens && tokens.visitorData) {
      args.push(
        '--extractor-args',
        `youtube:player_client=web;po_token=web+${tokens.poToken};visitor_data=${tokens.visitorData};player_skip=webpage,configs`,
      )
      args.push('--extractor-args', 'youtubetab:skip=webpage')
    } else {
      args.push('--extractor-args', 'youtube:player_client=ios')
    }
  } else {
    args.push('--extractor-args', 'youtube:player_client=ios')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
