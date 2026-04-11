/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */
export function commonYtdlpArgs(): string[] {
  const args: string[] = []

  // Use the node binary already present in the container as JS runtime.
  args.push('--js-runtimes', 'nodejs:/usr/local/bin/node')

  // tv_embedded + ios are first-party YouTube clients that bypass bot
  // detection on datacenter IPs without requiring cookies.
  args.push('--extractor-args', 'youtube:player_client=tv_embedded,ios')

  // bgutil PO token provider — bypasses YouTube bot detection on server IPs
  // without any account. Set BGUTIL_URL to the bgutil service address.
  const bgutilUrl = process.env.BGUTIL_URL
  if (bgutilUrl) {
    args.push('--extractor-args', `youtubepot-bgutilhttp:base_url=${bgutilUrl}`)
  }

  // Optional: cookies file for age-restricted or private content.
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  if (cookiesFile) args.push('--cookies', cookiesFile)

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
