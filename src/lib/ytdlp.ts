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

// ── bgutil android GVS token cache (6 hours) ─────────────────────────────────
// android GVS PO tokens unlock the https adaptive streams on the android client
// without triggering YouTube's bot check (android API is less restricted than web).
let _cachedAndroidToken: string | null = null
let _cachedAndroidAt = 0

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

/**
 * Try to fetch an android GVS PO token from bgutil.
 * Some bgutil versions support { client: 'ANDROID' } to generate android-specific tokens.
 * Uses a short timeout (5 s) so it fails fast when not supported.
 * Failures are NOT cached — we retry every request so a bgutil upgrade is picked up
 * immediately. Successful tokens are cached for 6 hours.
 */
async function fetchBgutilAndroidToken(baseUrl: string): Promise<string | null> {
  const now = Date.now()
  if (_cachedAndroidToken && now - _cachedAndroidAt < TOKEN_CACHE_MS) return _cachedAndroidToken

  try {
    const res = await fetch(`${baseUrl}/get_pot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client: 'ANDROID' }),
      signal: AbortSignal.timeout(5_000),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, string>
    const poToken = data.poToken ?? data.po_token ?? null
    if (poToken) {
      _cachedAndroidToken = poToken
      _cachedAndroidAt = now
    }
    return poToken
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
    // Strategy A: android client + android GVS PO token.
    //
    // The android YouTube API is reachable from datacenter IPs and returns adaptive
    // streams at full quality — but only when a GVS (Google Video Server) PO token
    // is supplied. Some bgutil versions can generate these via { client: 'ANDROID' }.
    const androidToken = await fetchBgutilAndroidToken(bgutilUrl)
    if (androidToken) {
      args.push(
        '--extractor-args',
        `youtube:player_client=android;po_token=android.gvs+${androidToken}`,
      )
    } else {
      // Strategy B: web client + web PO token + visitor_data.
      //
      // player_skip=webpage,configs prevents yt-dlp from overwriting bgutil's
      // visitor_data with the page's own data (they must be a matched pair).
      // player.js is still fetched so n-challenge solving works via --remote-components.
      const tokens = await fetchBgutilWebTokens(bgutilUrl)
      if (tokens?.visitorData) {
        args.push(
          '--extractor-args',
          `youtube:player_client=web;po_token=web+${tokens.poToken};visitor_data=${tokens.visitorData};player_skip=webpage,configs`,
        )
      } else {
        // bgutil unreachable — fall back to ios HLS (no GVS PO token needed)
        args.push('--extractor-args', 'youtube:player_client=ios,android')
      }
    }
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else if (cookiesFile) {
    // Cookies only, no bgutil.
    // yt-dlp skips android/ios when --cookies is set, so web is the only option.
    args.push('--cookies', cookiesFile)
    args.push('--extractor-args', 'youtube:player_client=web;player_skip=webpage')
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else {
    // No auth at all. Use ios (HLS streams — no GVS PO token required) first,
    // then android as fallback.
    args.push('--extractor-args', 'youtube:player_client=ios,android')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
