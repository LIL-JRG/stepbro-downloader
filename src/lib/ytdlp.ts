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

  if (bgutilUrl) {
    // bgutil supplies a matched (po_token, visitor_data) pair. Both must be passed
    // together — YouTube validates coherence between them. If visitor_data is
    // omitted yt-dlp replaces it with the value from the watch page, breaking
    // the pair and causing YouTube to return only the legacy 360p format (18).
    //
    // player_skip=webpage,configs prevents the page visit from overwriting our
    // visitor_data. player.js is still downloaded (no 'js' in player_skip) so
    // n-challenge + sig solving via node + EJS work normally.
    //
    // Cookies are still sent on every subsequent request (player API, streams)
    // even though the watch page is skipped, so authentication is preserved.
    const tokens = await fetchBgutilTokens(bgutilUrl)
    if (tokens?.visitorData) {
      if (cookiesFile) args.push('--cookies', cookiesFile)
      args.push(
        '--extractor-args',
        `youtube:player_client=web;po_token=web+${tokens.poToken};visitor_data=${tokens.visitorData};player_skip=webpage,configs`,
      )
      args.push('--extractor-args', 'youtubetab:skip=webpage')
    } else {
      // bgutil reachable but returned no tokens yet — fall back.
      if (cookiesFile) {
        args.push('--cookies', cookiesFile)
        args.push('--extractor-args', 'youtube:player_client=web')
      } else {
        args.push('--extractor-args', 'youtube:player_client=android,ios')
      }
      args.push('--extractor-args', 'youtubetab:skip=webpage')
    }
  } else if (cookiesFile) {
    // No bgutil: cookies alone, visit the page normally for player config.
    args.push('--cookies', cookiesFile)
    args.push('--extractor-args', 'youtube:player_client=web')
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else {
    // No auth: android/ios use mobile API — no JS challenges, work from any IP.
    args.push('--extractor-args', 'youtube:player_client=android,ios')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
