/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */

export function commonYtdlpArgs(): string[] {
  // Android and iOS clients use YouTube's mobile API:
  //   - No JS challenge solving needed (n-challenge / sig) — URLs work directly from any IP
  //   - No datacenter bot detection (different endpoint than the web player)
  //   - High quality: android supports up to 4K, ios up to 1080p
  //
  // Web is listed last as a last-resort fallback. It is intentionally deprioritised
  // because the web player requires JS challenge solving which fails unreliably on
  // VPS/datacenter IPs and causes silent fallback to low-quality combined streams.
  //
  // NOTE: --cookies must NOT be passed globally — yt-dlp skips android/ios if it is set.
  return [
    '--extractor-args', 'youtube:player_client=android,ios,web',
    '--extractor-args', 'youtubetab:skip=webpage',
  ]
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
