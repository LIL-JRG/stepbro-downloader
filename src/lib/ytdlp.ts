/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */

interface BgutilWebTokens {
  poToken: string
  visitorData: string
}

// ── bgutil web token cache (6 hours) ─────────────────────────────────────────
let _cachedWebTokens: BgutilWebTokens | null = null
let _cachedWebAt = 0
const TOKEN_CACHE_MS = 6 * 60 * 60 * 1000

async function fetchBgutilWebTokens(baseUrl: string): Promise<BgutilWebTokens | null> {
  const now = Date.now()
  if (_cachedWebTokens && now - _cachedWebAt < TOKEN_CACHE_MS) return _cachedWebTokens

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
    _cachedWebTokens = { poToken, visitorData: decodeURIComponent(visitorData) }
    _cachedWebAt = now
    return _cachedWebTokens
  } catch {
    return null
  }
}

// ── Main args builder ─────────────────────────────────────────────────────────
export async function commonYtdlpArgs(): Promise<string[]> {
  const args: string[] = []

  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  const bgutilUrl   = process.env.BGUTIL_URL?.replace(/\/$/, '')

  args.push('--js-runtimes', 'node:/usr/local/bin/node')
  args.push('--remote-components', 'ejs:github')

  if (bgutilUrl) {
    // Combine cookies (account authentication) with bgutil PO tokens (anti-bot proof).
    //
    // Why both?
    //   From a datacenter IP, YouTube's player API returns "Sign in to confirm you're
    //   not a bot" even with a valid PO token + visitor_data pair when the request
    //   is unauthenticated. Adding real account cookies to the API call signals that
    //   this is a genuine user session, bypassing the IP-based bot check.
    //
    // Why player_skip=webpage,configs?
    //   The YouTube watch page HTML (youtube.com/watch?v=...) is the front-line
    //   where bot checks happen for unauthenticated requests. Skipping it avoids
    //   that check entirely. player.js is still fetched so n-challenge solving works
    //   via --remote-components. Skipping configs prevents yt-dlp from overwriting
    //   bgutil's visitor_data with the page's own value (they must stay a matched pair).
    if (cookiesFile) {
      args.push('--cookies', cookiesFile)
    }
    const tokens = await fetchBgutilWebTokens(bgutilUrl)
    if (tokens?.visitorData) {
      args.push(
        '--extractor-args',
        `youtube:player_client=web;po_token=web+${tokens.poToken};visitor_data=${tokens.visitorData};player_skip=webpage,configs`,
      )
    } else {
      // bgutil unreachable — use ios HLS (does not require GVS PO token)
      args.push('--extractor-args', 'youtube:player_client=ios,android')
    }
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else if (cookiesFile) {
    // Cookies only, no bgutil.
    //
    // Use web client with player_skip=webpage: the watch page HTML is skipped to
    // avoid the IP bot check, but the player API call carries the authentication
    // cookies so YouTube serves the full format list.
    args.push('--cookies', cookiesFile)
    args.push('--extractor-args', 'youtube:player_client=web;player_skip=webpage,configs')
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else {
    // No auth available. ios uses HLS streams (no GVS PO token required).
    args.push('--extractor-args', 'youtube:player_client=ios,android')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
