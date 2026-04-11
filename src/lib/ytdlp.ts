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

  if (cookiesFile) {
    // Authenticated via cookies. Web client visits the YouTube page normally
    // (no player_skip) to get: full player config, Data Sync ID, and the player.js
    // needed for n-challenge + signature solving.
    // --js-runtimes is explicit because Alpine Linux may not find 'node' automatically.
    args.push('--js-runtimes', 'node:/usr/local/bin/node')
    args.push('--cookies', cookiesFile)
    args.push('--extractor-args', 'youtube:player_client=web')
    // youtubetab only affects playlist/channel pages, not individual video downloads
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else if (bgutilUrl) {
    // No cookies: bypass the YouTube watch page (bot-blocked on VPS IPs) using
    // bgutil PO tokens. player.js is still fetched for challenge solving.
    args.push('--js-runtimes', 'node:/usr/local/bin/node')
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
    // No auth: android/ios use YouTube's mobile API — no JS challenges, work from
    // datacenter IPs for public videos.
    args.push('--extractor-args', 'youtube:player_client=android,ios')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
