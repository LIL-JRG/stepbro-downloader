/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */
export function commonYtdlpArgs(): string[] {
  const args: string[] = []

  // Use the node binary already present in the container as JS runtime.
  // yt-dlp needs a JS runtime to extract YouTube metadata.
  args.push('--js-runtimes', 'nodejs:/usr/local/bin/node')

  // tv_embedded + ios are first-party YouTube clients that bypass bot
  // detection on datacenter IPs without requiring cookies.
  args.push('--extractor-args', 'youtube:player_client=tv_embedded,ios')

  // If the user has supplied a cookies file (e.g. exported from Chrome),
  // pass it for authenticated requests.
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  if (cookiesFile) args.push('--cookies', cookiesFile)

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
