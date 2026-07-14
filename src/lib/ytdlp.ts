/** True for YouTube URLs (or when the target is unknown — be safe). */
export function isYouTubeUrl(url?: string): boolean {
  if (!url) return true
  return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url)
}

// Sites known to block or rate-limit datacenter IPs, so they need the outbound
// proxy. Everything else (TikTok, Vimeo, Reddit, Twitch…) stays direct so the
// proxy hop doesn't throttle a fast CDN. Operators can add more hostnames via
// YTDLP_PROXY_SITES (comma-separated), or set YTDLP_PROXY_ALL=true for all.
const DEFAULT_PROXY_SITES = [
  'youtube.com',
  'youtu.be',
  'youtube-nocookie.com',
  'instagram.com',
  'facebook.com',
  'fb.watch',
  'fb.com',
  'twitter.com',
  'x.com',
  't.co',
]

/** Whether this target should be routed through YTDLP_PROXY. */
export function needsProxy(url?: string): boolean {
  if (!url) return true // unknown target — be safe and proxy
  const extra = (process.env.YTDLP_PROXY_SITES || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  const sites = [...DEFAULT_PROXY_SITES, ...extra]
  const u = url.toLowerCase()
  return sites.some((s) => u.includes(s))
}

/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 *
 * The PO-token provider, remote JS components and cookies exist ONLY for
 * YouTube's SABR/GVS restriction, so they stay YouTube-only. The proxy is for
 * sites that block datacenter IPs — YouTube plus Instagram/Facebook/X — but NOT
 * fast CDNs like TikTok/Vimeo, where the proxy hop only caps download speed. So
 * the proxy is gated on a site allowlist (see needsProxy), the rest on YouTube.
 * Pass the target URL; omit it (or set YTDLP_PROXY_ALL=true) for the full treatment.
 */
export async function commonYtdlpArgs(targetUrl?: string): Promise<string[]> {
  const args: string[] = []

  const bgutilUrl   = process.env.BGUTIL_URL?.replace(/\/$/, '')
  const proxy       = process.env.YTDLP_PROXY
  const proxyAll    = process.env.YTDLP_PROXY_ALL === 'true'
  const youtube     = isYouTubeUrl(targetUrl)

  // Cookies for auth-gated sites (Instagram, X, Facebook, members-only videos…).
  // A single Netscape cookies.txt can hold sessions for many domains — yt-dlp
  // sends only the cookies matching each request's domain — so COOKIES_FILE
  // applies to every site. YOUTUBE_COOKIES_FILE stays as a YouTube-specific
  // override (takes precedence on YouTube URLs) for backward compatibility.
  const cookiesFile =
    (youtube && process.env.YOUTUBE_COOKIES_FILE) || process.env.COOKIES_FILE

  // Route outbound yt-dlp traffic through a forward proxy for sites that block a
  // flagged datacenter IP (YouTube's "Sign in to confirm you're not a bot",
  // Instagram/Facebook/X "login required" / rate limits). A residential/mobile
  // proxy (or Cloudflare WARP) gets past that. Fast CDNs stay direct so the proxy
  // doesn't cap their speed. Accepts any yt-dlp --proxy URL, e.g.
  // http://user:pass@host:port or socks5://host:port.
  if (proxy && (proxyAll || needsProxy(targetUrl))) args.push('--proxy', proxy)

  // Applied to every site (yt-dlp matches cookies to the domain itself).
  if (cookiesFile) args.push('--cookies', cookiesFile)

  if (youtube) {
    // Resolve the JS runtime to the Node binary actually running this process.
    // Hardcoding /usr/local/bin/node only works inside the Alpine container; on
    // a Windows/macOS dev machine that path does not exist and the n-challenge
    // solver (needed to avoid throttled downloads) would silently fail.
    // process.execPath is the absolute path to the current Node on every OS.
    args.push('--js-runtimes', `node:${process.execPath}`)
    args.push('--remote-components', 'ejs:github')

    // bgutil PO token provider — via the yt-dlp plugin, NOT manual token passing.
    // On a low-trust IP YouTube serves SABR-only streams whose media URLs are
    // withheld unless the request carries a GVS PO token; without it yt-dlp
    // reports "Only images are available" and quality collapses. The
    // bgutil-ytdlp-pot-provider plugin fetches both the player and gvs tokens
    // automatically with the correct content bindings — we just point it at the
    // provider's base_url.
    if (bgutilUrl) {
      args.push('--extractor-args', `youtubepot-bgutilhttp:base_url=${bgutilUrl}`)
    }
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
