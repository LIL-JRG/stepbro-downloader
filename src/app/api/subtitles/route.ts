import { spawn } from 'child_process'
import { mkdtemp, readdir, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import type { NextRequest } from 'next/server'
import { commonYtdlpArgs, ytdlpBin } from '@/lib/ytdlp'
import { getClientIp, allowInfoRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'

function toMs(t: string): number {
  const m = t.match(/(\d+):(\d+):(\d+)[,.](\d+)/)
  if (!m) return 0
  return +m[1] * 3600000 + +m[2] * 60000 + +m[3] * 1000 + +m[4]
}

/**
 * YouTube auto-captions arrive "rolling": each cue repeats the previous line plus
 * a new one, interleaved with ~10ms transition cues, so a raw SRT conversion is
 * full of duplicates. Detect that pattern (lots of micro-cues) and collapse it —
 * drop the micro-cues and keep only each cue's newly-added lines. Clean manual
 * subtitles are left untouched.
 */
function cleanSrt(srt: string): string {
  const blocks = srt.replace(/\r/g, '').trim().split(/\n\n+/)
  const cues: { start: string; end: string; lines: string[]; dur: number }[] = []
  for (const b of blocks) {
    const lines = b.split('\n')
    const tIdx = lines.findIndex((l) => l.includes('-->'))
    if (tIdx === -1) continue
    const [start, end] = lines[tIdx].split('-->').map((s) => s.trim())
    const text = lines.slice(tIdx + 1).map((s) => s.trim()).filter(Boolean)
    if (!start || !end || text.length === 0) continue
    cues.push({ start, end, lines: text, dur: toMs(end) - toMs(start) })
  }
  if (cues.length === 0) return srt

  const micro = cues.filter((c) => c.dur < 100).length
  if (micro < cues.length * 0.2) return srt // not rolling ASR — leave as-is

  const out: { start: string; end: string; text: string }[] = []
  let prev: string[] = []
  for (const c of cues) {
    if (c.dur < 100) continue
    const fresh = c.lines.filter((l) => !prev.includes(l))
    prev = c.lines
    if (fresh.length === 0) continue
    out.push({ start: c.start, end: c.end, text: fresh.join('\n') })
  }
  if (out.length === 0) return srt
  return out.map((c, i) => `${i + 1}\n${c.start} --> ${c.end}\n${c.text}`).join('\n\n') + '\n'
}

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

    const srt = cleanSrt(await readFile(join(dir, srtFile), 'utf8'))

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
