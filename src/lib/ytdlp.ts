/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */
export function commonYtdlpArgs(): string[] {
  const args: string[] = []

  // Use the node binary already present in the container as JS runtime.
  // The correct runtime name is "node" (not "nodejs").
  args.push('--js-runtimes', 'node:/usr/local/bin/node')

  // Use web+ios clients. bgutil provides PO tokens for the web client.
  // tv_embedded was removed in recent yt-dlp versions.
  args.push('--extractor-args', 'youtube:player_client=web,ios')

  // bgutil PO token provider — bypasses YouTube bot detection on server IPs
  // without any account. Set BGUTIL_URL to the bgutil service address.
  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '') // strip trailing slash
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
