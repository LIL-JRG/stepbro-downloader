/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 */

export async function commonYtdlpArgs(): Promise<string[]> {
  const args: string[] = []

  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  const bgutilUrl   = process.env.BGUTIL_URL?.replace(/\/$/, '')
  const proxy       = process.env.YTDLP_PROXY

  // Route ALL outbound yt-dlp traffic through a forward proxy when configured.
  // On a heavily flagged datacenter IP, YouTube returns "Sign in to confirm you're
  // not a bot" for every client. Sending requests through a residential/mobile
  // proxy (or Cloudflare WARP) gets past that block. Accepts any yt-dlp --proxy URL,
  // e.g. http://user:pass@host:port or socks5://host:port. Applied first so it
  // covers every request.
  if (proxy) args.push('--proxy', proxy)

  // Resolve the JS runtime to the Node binary actually running this process.
  // Hardcoding /usr/local/bin/node only works inside the Alpine container; on a
  // Windows/macOS dev machine that path does not exist and the n-challenge solver
  // (needed to avoid throttled downloads) would silently fail. process.execPath is
  // the absolute path to the current Node executable on every platform.
  args.push('--js-runtimes', `node:${process.execPath}`)
  args.push('--remote-components', 'ejs:github')

  // bgutil PO token provider — via the yt-dlp plugin, NOT manual token passing.
  //
  // On a low-trust IP (e.g. a datacenter, or Cloudflare WARP) YouTube serves
  // SABR-only streams whose media URLs are withheld unless the request carries a
  // GVS (Google Video Server) PO token. Without it yt-dlp reports "Only images are
  // available" / "formats ... missing a URL" and quality collapses to storyboards
  // or format 18.
  //
  // The bgutil-ytdlp-pot-provider PLUGIN (installed in the same venv as yt-dlp,
  // see Dockerfile) hooks into yt-dlp's PO Token Provider Framework and fetches
  // BOTH the player and gvs tokens from the provider server automatically, with the
  // correct content bindings. We only need to point it at the provider's base_url.
  // Manual po_token / visitor_data / player_skip args are intentionally gone — they
  // only ever supplied the player token, which is why GVS/SABR formats were dropped.
  if (bgutilUrl) {
    args.push('--extractor-args', `youtubepot-bgutilhttp:base_url=${bgutilUrl}`)
  }

  // Cookies are optional and additive: with a valid signed-in session yt-dlp gets
  // the account context (and the plugin binds tokens to the account session id).
  // Safe to run alongside the plugin; leave unset to rely on bgutil + proxy alone.
  if (cookiesFile) {
    args.push('--cookies', cookiesFile)
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
