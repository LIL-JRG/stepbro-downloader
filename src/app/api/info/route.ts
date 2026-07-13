import { spawn } from 'child_process'
import type { NextRequest } from 'next/server'
import { commonYtdlpArgs, ytdlpBin } from '@/lib/ytdlp'
import { getClientIp, allowInfoRequest } from '@/lib/rate-limit'
import { isBlocked } from '@/lib/blocklist'

export const runtime = 'nodejs'

// Short-lived metadata cache. /api/info spawns yt-dlp per call and is hit on every
// debounced keystroke, so caching by URL cuts CPU and speeds up the preview.
const CACHE_TTL_MS = 5 * 60 * 1000
const cache = new Map<string, { body: unknown; expires: number }>()

interface RawFormat {
  format_id: string
  format_note?: string
  ext: string
  height?: number
  width?: number
  fps?: number
  tbr?: number
  vcodec?: string
  acodec?: string
  filesize?: number
  filesize_approx?: number
}

export async function POST(request: NextRequest) {
  const { url } = await request.json()

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 })
  }

  if (isBlocked(url)) {
    return Response.json(
      { error: 'This video has been removed at the request of the rights holder.' },
      { status: 403 }
    )
  }

  // Per-IP throttle so the (yt-dlp-spawning) endpoint can't be hammered.
  if (!allowInfoRequest(getClientIp(request))) {
    return Response.json({ error: 'Too many requests. Slow down a moment.' }, { status: 429 })
  }

  const cached = cache.get(url)
  if (cached && cached.expires > Date.now()) {
    return Response.json(cached.body)
  }

  const args = [...(await commonYtdlpArgs()), '--dump-json', '--no-playlist', url]

  return new Promise<Response>((resolve) => {
    const chunks: string[] = []
    const errors: string[] = []

    const proc = spawn(ytdlpBin(), args)

    proc.stdout.on('data', (data: Buffer) => chunks.push(data.toString()))
    proc.stderr.on('data', (data: Buffer) => errors.push(data.toString()))

    proc.on('close', (code) => {
      if (code !== 0) {
        const errMsg = errors.join('').trim()
        resolve(Response.json({ error: errMsg || 'Failed to fetch video info' }, { status: 500 }))
        return
      }

      try {
        const info = JSON.parse(chunks.join(''))

        // Manual subs are few; auto-captions can be ~140 (mostly auto-translations),
        // so surface a curated set: the video's own language + common languages.
        const manualLangs = Object.keys(info.subtitles ?? {}).filter((l: string) => l !== 'live_chat')
        const autoAll = Object.keys(info.automatic_captions ?? {})
        const COMMON = ['en', 'es', 'pt', 'fr', 'de', 'it', 'ru', 'ja', 'ko', 'ar', 'hi', 'id']
        const source = typeof info.language === 'string' ? info.language : null
        const autoLangs = autoAll.length
          ? [...new Set([source, 'en', ...COMMON].filter(Boolean) as string[])].filter((l) =>
              autoAll.includes(l)
            )
          : []

        const body = {
          id: info.id,
          title: info.title,
          thumbnail: info.thumbnail,
          duration: info.duration,
          duration_string: info.duration_string,
          uploader: info.uploader,
          channel: info.channel,
          upload_date: info.upload_date,
          view_count: info.view_count,
          description: info.description,
          webpage_url: info.webpage_url,
          extractor: info.extractor,
          subtitleLangs: manualLangs,
          autoSubLangs: autoLangs,
          formats: (info.formats || []).map((f: RawFormat) => ({
            format_id: f.format_id,
            format_note: f.format_note,
            ext: f.ext,
            height: f.height,
            width: f.width,
            fps: f.fps,
            tbr: f.tbr,
            vcodec: f.vcodec,
            acodec: f.acodec,
            filesize: f.filesize ?? f.filesize_approx,
          })),
        }
        cache.set(url, { body, expires: Date.now() + CACHE_TTL_MS })
        resolve(Response.json(body))
      } catch {
        resolve(Response.json({ error: 'Failed to parse video info' }, { status: 500 }))
      }
    })

    proc.on('error', (err) => {
      resolve(
        Response.json(
          {
            error: err.message.includes('ENOENT')
              ? 'yt-dlp not found. Please install it and make sure it is in your PATH.'
              : err.message,
          },
          { status: 500 }
        )
      )
    })
  })
}
