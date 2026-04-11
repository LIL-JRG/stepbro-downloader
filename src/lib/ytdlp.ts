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

// ── Data Sync ID cache (1 hour) ───────────────────────────────────────────────
// The Data Sync ID (DELEGATED_SESSION_ID) identifies the signed-in account
// context in the YouTube player API. Without it, YouTube returns only the
// legacy 360p format (id 18) even when a valid PO token + visitor_data pair
// are supplied. It is extracted from the YouTube homepage via the cookies.
let _cachedDataSyncId: string | null = null
let _dataSyncIdFetchedAt = 0
const DATA_SYNC_ID_CACHE_MS = 60 * 60 * 1000

async function fetchDataSyncId(cookiesFile: string): Promise<string | null> {
  const now = Date.now()
  if (_cachedDataSyncId && now - _dataSyncIdFetchedAt < DATA_SYNC_ID_CACHE_MS) {
    return _cachedDataSyncId
  }

  try {
    const content = await readFile(cookiesFile, 'utf8')

    // Parse Netscape cookies format (tab-separated: domain flag path secure expiry name value)
    const cookieHeader = content
      .split('\n')
      .filter(l => l.trim() && !l.startsWith('#'))
      .map(l => {
        const parts = l.split('\t')
        return parts.length >= 7 ? `${parts[5].trim()}=${parts[6].trim()}` : null
      })
      .filter(Boolean)
      .join('; ')

    if (!cookieHeader) return null

    const res = await fetch('https://www.youtube.com/', {
      headers: {
        'Cookie': cookieHeader,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(20_000),
    })

    const html = await res.text()
    const match = html.match(/"DELEGATED_SESSION_ID"\s*:\s*"([^"]+)"/)
    if (!match) return null

    _cachedDataSyncId = match[1]
    _dataSyncIdFetchedAt = now
    return _cachedDataSyncId
  } catch {
    return null
  }
}

// ── Main args builder ─────────────────────────────────────────────────────────
export async function commonYtdlpArgs(): Promise<string[]> {
  const args: string[] = []

  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')

  // JS runtime + EJS challenge solver — required for n-challenge and signature
  // solving on the web client. Without ejs:github, yt-dlp can find node but
  // skips the challenge, and all adaptive formats fail to download.
  args.push('--js-runtimes', 'node:/usr/local/bin/node')
  args.push('--remote-components', 'ejs:github')

  if (bgutilUrl) {
    // Fetch bgutil tokens and Data Sync ID in parallel.
    const [tokens, autoDataSyncId] = await Promise.all([
      fetchBgutilTokens(bgutilUrl),
      cookiesFile ? fetchDataSyncId(cookiesFile) : Promise.resolve(null),
    ])

    // Manual override wins; auto-fetch is the fallback.
    // YOUTUBE_DATA_SYNC_ID = value of ytcfg.get('DELEGATED_SESSION_ID')
    // obtained from the browser console on youtube.com while logged in.
    const dataSyncId = process.env.YOUTUBE_DATA_SYNC_ID || autoDataSyncId

    if (tokens?.visitorData) {
      if (cookiesFile) args.push('--cookies', cookiesFile)

      const ytArgs = [
        'player_client=web',
        `po_token=web+${tokens.poToken}`,
        `visitor_data=${tokens.visitorData}`,
      ]

      if (dataSyncId) {
        // We know the account's Data Sync ID: keep our visitor_data intact by
        // skipping the page visit (player_skip=webpage,configs) and supply the
        // Data Sync ID explicitly. player.js is still downloaded for challenges.
        ytArgs.push('player_skip=webpage,configs')
        ytArgs.push(`data_sync_id=${dataSyncId}`)
      } else {
        // No Data Sync ID available: allow yt-dlp to visit the YouTube page
        // so it can obtain the Data Sync ID itself. Only skip player configs
        // (not the webpage) so the extractor arg visitor_data still applies
        // to the player API call.
        ytArgs.push('player_skip=configs')
      }

      args.push('--extractor-args', `youtube:${ytArgs.join(';')}`)
      args.push('--extractor-args', 'youtubetab:skip=webpage')
    } else {
      // bgutil reachable but no tokens yet — fall back
      if (cookiesFile) {
        args.push('--cookies', cookiesFile)
        args.push('--extractor-args', 'youtube:player_client=web')
      } else {
        args.push('--extractor-args', 'youtube:player_client=android,ios')
      }
      args.push('--extractor-args', 'youtubetab:skip=webpage')
    }
  } else if (cookiesFile) {
    // No bgutil: visit the YouTube page normally with cookies so yt-dlp obtains
    // the player config and Data Sync ID itself.
    args.push('--cookies', cookiesFile)
    args.push('--extractor-args', 'youtube:player_client=web')
    args.push('--extractor-args', 'youtubetab:skip=webpage')
  } else {
    // No auth at all: android/ios use the mobile API with no JS challenges.
    args.push('--extractor-args', 'youtube:player_client=android,ios')
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
