import { spawn } from 'child_process'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// YouTube thumbnail fallback chain: maxresdefault → hqdefault → mqdefault → default
const YT_FALLBACKS: Record<string, string> = {
  'maxresdefault.jpg': 'hqdefault.jpg',
  'hqdefault.jpg': 'mqdefault.jpg',
  'mqdefault.jpg': 'default.jpg',
}

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'

function isYouTubeThumb(url: string): boolean {
  return /(?:ytimg\.com|youtube\.com|youtu\.be)/i.test(url)
}

async function fetchThumbnail(url: string): Promise<Response | null> {
  try {
    // Only YouTube's image host wants (and accepts) a youtube.com referer; other
    // CDNs — e.g. TikTok's signed tiktokcdn.com URLs — reject it, so send a plain
    // browser UA with no referer instead.
    const headers: Record<string, string> = { 'User-Agent': BROWSER_UA }
    if (isYouTubeThumb(url)) headers.Referer = 'https://www.youtube.com/'
    const res = await fetch(url, { headers })
    if (res.ok) return res
  } catch { /* ignore */ }
  return null
}

// Fetch the JPG (with YouTube resolution fallbacks) as bytes.
async function fetchJpg(url: string): Promise<Buffer | null> {
  let res = await fetchThumbnail(url)
  // The maxres→hqdefault fallback chain only applies to YouTube's /vi/ URLs.
  if (!res && isYouTubeThumb(url)) {
    const match = url.match(/\/vi\/[^/]+\/([^/?#]+\.jpg)/)
    if (match) {
      let current = match[1]
      while (YT_FALLBACKS[current] && !res) {
        const fallback = YT_FALLBACKS[current]
        res = await fetchThumbnail(url.replace(current, fallback))
        current = fallback
      }
    }
  }
  return res ? Buffer.from(await res.arrayBuffer()) : null
}

// Convert an image via ffmpeg (png / webp). Rejects if ffmpeg can't produce it.
function convertImage(input: Buffer, fmt: 'png' | 'webp'): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const ff = process.env.FFMPEG_BIN || 'ffmpeg'
    const codec = fmt === 'png' ? 'png' : 'libwebp'
    const proc = spawn(ff, ['-y', '-i', 'pipe:0', '-c:v', codec, '-f', 'image2pipe', 'pipe:1'])
    const chunks: Buffer[] = []
    proc.stdout.on('data', (d: Buffer) => chunks.push(d))
    proc.on('error', reject)
    proc.on('close', (code) => {
      const out = Buffer.concat(chunks)
      if (code === 0 && out.length > 0) resolve(out)
      else reject(new Error('conversion failed'))
    })
    proc.stdin.on('error', () => {})
    proc.stdin.end(input)
  })
}

export async function GET(request: NextRequest) {
  // searchParams.get() already percent-decodes once. Do NOT decode again — a
  // second pass mangles URLs whose query carries encoded reserved chars, e.g.
  // TikTok's signed thumbnails (x-signature=…%2B…%2F…%3D), breaking the
  // signature so the CDN 403s. (YouTube URLs have no such encoding, which is why
  // this only ever showed up on TikTok/others.)
  const url = request.nextUrl.searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  try {
    new URL(url) // validate
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  const req = (request.nextUrl.searchParams.get('format') || 'jpg').toLowerCase()
  const download = request.nextUrl.searchParams.get('download')

  let bytes: Buffer | null = null
  let format: 'jpg' | 'webp' | 'png' = 'jpg'

  if (req === 'webp') {
    // Prefer YouTube's native WebP; otherwise convert the JPG.
    const webpUrl = url.replace('/vi/', '/vi_webp/').replace(/\.jpg(\?|$)/i, '.webp$1')
    bytes = webpUrl !== url ? await fetchJpg(webpUrl) : null
    if (bytes) {
      format = 'webp'
    } else {
      const jpg = await fetchJpg(url)
      if (jpg) {
        try { bytes = await convertImage(jpg, 'webp'); format = 'webp' } catch { bytes = jpg; format = 'jpg' }
      }
    }
  } else if (req === 'png') {
    const jpg = await fetchJpg(url)
    if (jpg) {
      try { bytes = await convertImage(jpg, 'png'); format = 'png' } catch { bytes = jpg; format = 'jpg' }
    }
  } else {
    bytes = await fetchJpg(url)
    format = 'jpg'
  }

  if (!bytes) return new Response('Thumbnail unavailable', { status: 502 })

  const contentType = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg'
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
  }
  if (download) headers['Content-Disposition'] = `attachment; filename="thumbnail.${format}"`
  return new Response(new Uint8Array(bytes), { headers })
}
