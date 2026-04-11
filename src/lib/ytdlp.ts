/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */

import { readFile } from 'fs/promises'

interface BgutilTokens {
  poToken: string
  visitorData: string
}

// ── bgutil token cache (6 hours) ─────────────────────────────────────────────
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

// ── Cookie header builder ─────────────────────────────────────────────────────
// Converts a Netscape cookies file into a Cookie: header string.
// This is used with --add-headers instead of --cookies so that yt-dlp does NOT
// skip the android/ios clients (it skips them when --cookies is set, but not
// when cookies arrive as a generic custom header).
let _cachedCookieHeader: string | null = null
let _cookieHeaderBuiltAt = 0
const COOKIE_HEADER_CACHE_MS = 30 * 60 * 1000

async function buildCookieHeader(cookiesFile: string): Promise<string | null> {
  const now = Date.now()
  if (_cachedCookieHeader !== null && now - _cookieHeaderBuiltAt < COOKIE_HEADER_CACHE_MS) {
    return _cachedCookieHeader
  }

  try {
    const content = await readFile(cookiesFile, 'utf8')
    const pairs = content
      .split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .flatMap(l => {
        const parts = l.split('\t')
        if (parts.length < 7) return []
        const domain = parts[0].trim().replace(/^\./, '')
        const name  = parts[5].trim()
        const value = parts[6].trim()
        // Only include cookies relevant to YouTube/Google auth
        if (!domain.includes('youtube.com') && !domain.includes('google.com')) return []
        return [`${name}=${value}`]
      })

    _cachedCookieHeader = pairs.length > 0 ? pairs.join('; ') : null
    _cookieHeaderBuiltAt = now
    return _cachedCookieHeader
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

  if (cookiesFile) {
    // Strategy: android client + cookies injected via --add-headers.
    //
    // Why not --cookies?
    //   yt-dlp automatically skips android/ios when --cookies is set because
    //   those clients don't support yt-dlp's cookie-jar auth. But the android
    //   client DOES visit the YouTube watch page first — if that request carries
    //   cookies (via --add-headers), it passes the "sign in to confirm" bot check
    //   and the android player API then returns the full adaptive format list
    //   without needing JS challenge solving.
    //
    // Why android over web?
    //   The web client from this VPS IP (even with a valid PO token + cookies)
    //   returns only the 360p combined stream (format 18). The android client
    //   uses a different API endpoint (youtubei.googleapis.com) that is less
    //   aggressively restricted.
    const cookieHeader = await buildCookieHeader(cookiesFile)
    if (cookieHeader) {
      args.push('--add-headers', `Cookie:${cookieHeader}`)
    }
    args.push('--extractor-args', 'youtube:player_client=android,ios')
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else if (bgutilUrl) {
    // No cookies: web client with bgutil PO tokens to bypass bot detection.
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
    args.push('--extractor-args', 'youtube:player_client=android,ios')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
