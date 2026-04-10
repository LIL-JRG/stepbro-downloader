import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

// YouTube thumbnail fallback chain: maxresdefault → hqdefault → mqdefault → default
const YT_FALLBACKS: Record<string, string> = {
  'maxresdefault.jpg': 'hqdefault.jpg',
  'hqdefault.jpg': 'mqdefault.jpg',
  'mqdefault.jpg': 'default.jpg',
}

async function fetchThumbnail(url: string): Promise<Response | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; bot)',
        Referer: 'https://www.youtube.com/',
      },
    })
    if (res.ok) return res
  } catch { /* ignore */ }
  return null
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('url')
  if (!raw) return new Response('Missing url', { status: 400 })

  let url: string
  try {
    url = decodeURIComponent(raw)
    new URL(url) // validate
  } catch {
    return new Response('Invalid url', { status: 400 })
  }

  // Try the original URL first, then YouTube fallbacks
  let res = await fetchThumbnail(url)

  if (!res) {
    // Check if it's a YouTube thumbnail and try fallbacks
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

  if (!res) return new Response('Thumbnail unavailable', { status: 502 })

  const contentType = res.headers.get('content-type') ?? 'image/jpeg'
  return new Response(res.body, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=3600',
    },
  })
}
