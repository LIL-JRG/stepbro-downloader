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
  const proxy       = process.env.YTDLP_PROXY

  // Route ALL outbound yt-dlp traffic through a forward proxy when configured.
  // On a heavily flagged datacenter IP, YouTube returns "Sign in to confirm you're
  // not a bot" for every client — even with valid cookies or a bgutil PO token —
  // because the block is IP-based. Sending requests through a residential/mobile
  // proxy (or a self-hosted proxy on a residential connection) is the only reliable
  // fix. Accepts any yt-dlp --proxy URL, e.g. http://user:pass@host:port or
  // socks5://host:port. Applied first so it covers the cookies, bgutil and default
  // branches alike.
  if (proxy) args.push('--proxy', proxy)

  // Resolve the JS runtime to the Node binary actually running this process.
  // Hardcoding /usr/local/bin/node only works inside the Alpine container; on a
  // Windows/macOS dev machine that path does not exist and the n-challenge solver
  // (needed to avoid throttled downloads) would silently fail. process.execPath is
  // the absolute path to the current Node executable on every platform.
  args.push('--js-runtimes', `node:${process.execPath}`)
  args.push('--remote-components', 'ejs:github')

  if (cookiesFile) {
    // Cookies strategy: let yt-dlp work normally with a logged-in session.
    //
    // With valid account cookies the YouTube watch page loads without any bot
    // check (signed-in users are never shown "Sign in to confirm"). This means:
    //   1. yt-dlp fetches the watch page and extracts data_sync_id + visitor_data
    //      from the page config — this is what links the request to the account.
    //   2. player.js is fetched and the n-challenge is solved via --remote-components.
    //   3. The player API receives a fully authenticated request and returns the
    //      complete adaptive format list.
    //
    // Why NOT player_skip=webpage,configs here:
    //   player_skip skips the watch page, so yt-dlp never gets data_sync_id.
    //   Without data_sync_id YouTube ignores the account context and serves only
    //   format 18 — the same degraded response as unauthenticated requests.
    //
    // Why NOT bgutil tokens alongside cookies:
    //   bgutil provides its own visitor_data which must form a matched pair with
    //   its po_token. If bgutil visitor_data is passed while the page's own
    //   visitor_data is also fetched, yt-dlp warns about the missing data_sync_id
    //   and the result is again format 18 only.
    args.push('--cookies', cookiesFile)
    args.push('--extractor-args', 'youtube:player_client=web')
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else if (bgutilUrl) {
    // No cookies: unauthenticated requests from this VPS IP are blocked at the
    // watch page. Use bgutil PO tokens with player_skip=webpage,configs to skip
    // the page (avoiding the IP block) while still providing anti-bot proof.
    const tokens = await fetchBgutilWebTokens(bgutilUrl)
    if (tokens?.visitorData) {
      args.push(
        '--extractor-args',
        `youtube:player_client=web;po_token=web+${tokens.poToken};visitor_data=${tokens.visitorData};player_skip=webpage,configs`,
      )
    } else {
      args.push('--extractor-args', 'youtube:player_client=ios,android')
    }
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else {
    // No cookies, no bgutil: let yt-dlp use its default (web) client.
    //
    // On a residential IP (local dev, or a home-server deploy) the default web
    // client is NOT bot-blocked and returns the full adaptive format list (up to
    // 4K). Forcing player_client=ios,android here is actively harmful — YouTube
    // now caps those clients (without a PO token) to format 18 only, i.e. 360p.
    //
    // On a datacenter IP the web client would be blocked, so this branch is only a
    // last resort: production is expected to configure bgutil (or cookies) above.
    // We push no player_client and rely on yt-dlp's default.
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
