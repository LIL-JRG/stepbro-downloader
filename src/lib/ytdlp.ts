/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */

interface BgutilTokens {
  poToken: string
  visitorData: string
}

async function fetchBgutilTokens(baseUrl: string): Promise<BgutilTokens | null> {
  try {
    const res = await fetch(`${baseUrl}/get_pot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const data = await res.json() as Record<string, string>
    // Handle both camelCase and snake_case response keys
    const poToken = data.poToken ?? data.po_token
    const visitorData = data.visitorData ?? data.visitor_data ?? ''
    if (!poToken) return null
    return { poToken, visitorData }
  } catch {
    return null
  }
}

export async function commonYtdlpArgs(): Promise<string[]> {
  const args: string[] = []

  // Use the node binary already present in the container as JS runtime
  args.push('--js-runtimes', 'node:/usr/local/bin/node')

  // Use web+ios clients
  args.push('--extractor-args', 'youtube:player_client=web,ios')

  // Call bgutil HTTP API directly from Node.js to get PO tokens.
  // This bypasses the yt-dlp plugin system entirely — more reliable.
  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')
  if (bgutilUrl) {
    const tokens = await fetchBgutilTokens(bgutilUrl)
    if (tokens) {
      const visitorPart = tokens.visitorData ? `;visitor_data=${tokens.visitorData}` : ''
      args.push('--extractor-args', `youtube:po_token=web+${tokens.poToken}${visitorPart}`)
    }
  }

  // Optional: cookies file for age-restricted or private content
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  if (cookiesFile) args.push('--cookies', cookiesFile)

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
