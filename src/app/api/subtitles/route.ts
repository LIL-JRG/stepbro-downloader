import { spawn } from 'child_process'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import { commonYtdlpArgs, ytdlpBin } from '@/lib/ytdlp'
import { getClientIp, allowInfoRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Fetch a single subtitle track and return it as SRT text (or an attachment).
// GET /api/subtitles?url=<video>&lang=<code>[&download=1]
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')
  const lang = request.nextUrl.searchParams.get('lang')
  const download = request.nextUrl.searchParams.get('download')

  if (!url || !lang) {
    return Response.json({ error: 'url and lang are required' }, { status: 400 })
  }
  // Keep lang a plain token so it can't smuggle extra yt-dlp flags.
  if (!/^[a-zA-Z0-9_-]+$/.test(lang)) {
    return Response.json({ error: 'Invalid language code' }, { status: 400 })
  }
  if (!allowInfoRequest(getClientIp(request))) {
    return Response.json({ error: 'Too many requests. Slow down a moment.' }, { status: 429 })
  }

  const dir = await mkdtemp(join(tmpdir(), 'ytdlp-sub-'))
  try {
    const args = [
      ...(await commonYtdlpArgs()),
      '--skip-download',
      '--write-subs',
      '--write-auto-subs', // fall back to auto-generated captions when there's no manual track
      '--sub-langs',
      lang,
      '--convert-subs',
      'srt',
      '--no-playlist',
      '-o',
      join(dir, 'sub.%(ext)s'),
      url,
    ]

    const code = await new Promise<number>((resolve) => {
      const proc = spawn(ytdlpBin(), args)
      proc.on('close', (c) => resolve(c ?? 1))
      proc.on('error', () => resolve(1))
    })

    if (code !== 0) {
      return Response.json({ error: 'Could not fetch subtitles' }, { status: 502 })
    }

    const srtFile = (await readdir(dir)).find((f) => f.endsWith('.srt'))
    if (!srtFile) {
      return Response.json({ error: 'No subtitles available for that language' }, { status: 404 })
    }

    const srt = await readFile(join(dir, srtFile), 'utf8')

    if (download) {
      return new Response(srt, {
        headers: {
          'Content-Type': 'application/x-subrip; charset=utf-8',
          'Content-Disposition': `attachment; filename="subtitles.${lang}.srt"`,
        },
      })
    }
    return Response.json({ srt })
  } finally {
    rm(dir, { recursive: true, force: true }).catch(() => {})
  }
}
