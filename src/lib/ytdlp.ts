/** True for YouTube URLs (or when the target is unknown — be safe). */
export function isYouTubeUrl(url?: string): boolean {
  if (!url) return true
  return /(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i.test(url)
}

/**
 * Common yt-dlp arguments applied to every invocation.
 * Centralised here so info and download routes stay in sync.
 *
 * The proxy, PO-token provider, remote JS components and cookies all exist ONLY
 * to defeat YouTube's datacenter-IP block and SABR/GVS restriction. Applying
 * them to other sites (TikTok, X, Instagram…) is pure overhead: the proxy hop
 * (a slow WARP/residential IP) throttles a fast CDN to a crawl, and the remote
 * component fetch adds a GitHub round-trip. So we gate them on the target being
 * YouTube. Pass the target URL; omit it (or set YTDLP_PROXY_ALL=true) to force
 * the full YouTube treatment.
 */
export async function commonYtdlpArgs(targetUrl?: string): Promise<string[]> {
  const args: string[] = []

  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  const bgutilUrl   = process.env.BGUTIL_URL?.replace(/\/$/, '')
  const proxy       = process.env.YTDLP_PROXY
  const proxyAll    = process.env.YTDLP_PROXY_ALL === 'true'
  const youtube     = isYouTubeUrl(targetUrl)

  // Route outbound yt-dlp traffic through a forward proxy. On a heavily flagged
  // datacenter IP, YouTube returns "Sign in to confirm you're not a bot"; a
  // residential/mobile proxy (or Cloudflare WARP) gets past that. Only YouTube
  // needs it, so skip it elsewhere (WARP would just cap the download speed)
  // unless the operator opts into proxying everything. Accepts any yt-dlp
  // --proxy URL, e.g. http://user:pass@host:port or socks5://host:port.
  if (proxy && (proxyAll || youtube)) args.push('--proxy', proxy)

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

    // Cookies are optional and additive: a signed-in session gives yt-dlp the
    // account context (and binds tokens to the account session id).
    if (cookiesFile) {
      args.push('--cookies', cookiesFile)
    }
  }

  return args
}

export function ytdlpBin(): string {
  return process.env.YT_DLP_BIN || 'yt-dlp'
}
