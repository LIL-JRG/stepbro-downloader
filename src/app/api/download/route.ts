import { spawn } from 'child_process'
import { createWriteStream } from 'fs'
import { mkdtemp, readdir, rm } from 'fs/promises'
import { createRequire } from 'module'
import { tmpdir } from 'os'
import { basename, join } from 'path'
import { v4 as uuid } from 'uuid'
import type { NextRequest } from 'next/server'

// archiver is CommonJS (`export =`), which fights ESM default/named imports and
// isn't seen as callable via `typeof import`. Require it directly for reliable
// interop; the surface we use (pipe/file/on/finalize) is tiny and local to zipFiles.
type ArchiverInstance = {
  pipe(dest: NodeJS.WritableStream): void
  file(path: string, opts: { name: string }): void
  on(event: 'error', cb: (err: Error) => void): void
  finalize(): Promise<void>
}
const archiver = createRequire(import.meta.url)('archiver') as (
  format: string,
  options?: { zlib?: { level?: number } }
) => ArchiverInstance
import { registerTempFile } from '@/lib/temp-store'
import { commonYtdlpArgs, ytdlpBin } from '@/lib/ytdlp'
import {
  getClientIp,
  peekLimit,
  consumeLimit,
  MAX_VIDEO_DURATION,
  PLAYLIST_MAX_ITEMS,
} from '@/lib/rate-limit'

export const runtime = 'nodejs'

interface DownloadOptions {
  url: string
  quality: string
  container: string
  audioOnly?: boolean
  audioFormat?: string
  audioQuality?: string
  playlist?: boolean
  embedThumbnail?: boolean
  embedSubs?: boolean
  srtSubs?: boolean
}

// Sidecar (subtitle / thumbnail) extensions — not counted as downloads.
const SIDECAR_RE = /\.(srt|vtt|ass|ssa|jpg|jpeg|png|webp)$/i

function buildArgs(opts: DownloadOptions, outDir: string, maxItems: number, shared: string[]): string[] {
  const args: string[] = []

  // Playlists get an index prefix so items sort and never collide.
  const template = opts.playlist
    ? '%(playlist_index)s - %(title).80s [%(id)s].%(ext)s'
    : '%(title).100s [%(id)s].%(ext)s'
  args.push('-o', join(outDir, template), '--restrict-filenames')

  if (opts.audioOnly) {
    args.push('-x')
    if (opts.audioFormat) args.push('--audio-format', opts.audioFormat)
    args.push('--audio-quality', opts.audioQuality ?? '0')
  } else {
    const quality = opts.quality ?? 'best'
    const container = opts.container ?? 'any'
    const mergeFormat = container !== 'any' ? container : 'mp4'

    // Audio MUST be compatible with the output container, or the merged file plays
    // with no sound in most players. Pin AAC (m4a) for mp4/mkv and Opus for webm.
    const audioExt = mergeFormat === 'webm' ? 'webm' : 'm4a'
    const heightFilter = quality === 'best' ? '' : `[height<=${quality}]`
    const combinedFallback = heightFilter ? `/b${heightFilter}/b` : '/b'
    args.push('-f', `bv*${heightFilter}+ba[ext=${audioExt}]/bv*${heightFilter}+ba${combinedFallback}`)
    args.push('-S', 'res,fps,vbr,abr,vcodec:avc,acodec:m4a')
    args.push('--merge-output-format', mergeFormat)
  }

  // Extras.
  if (opts.embedThumbnail) args.push('--embed-thumbnail')
  if (opts.embedSubs) args.push('--embed-subs')
  if (opts.srtSubs) args.push('--write-subs', '--convert-subs', 'srt')
  if (opts.embedSubs || opts.srtSubs) args.push('--sub-langs', 'all')

  const ffmpegBin = process.env.FFMPEG_BIN
  if (ffmpegBin) args.push('--ffmpeg-location', ffmpegBin)

  // Anti-abuse backstop: refuse videos longer than the cap (client gates too).
  if (MAX_VIDEO_DURATION > 0) args.push('--match-filters', `duration<=${MAX_VIDEO_DURATION}`)

  args.push(...shared)

  if (opts.playlist) {
    args.push('--yes-playlist', '--playlist-items', `1-${maxItems}`)
  } else {
    args.push('--no-playlist')
  }
  args.push('--newline', '--force-overwrites', opts.url)
  return args
}

function zipFiles(paths: string[], outPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outPath)
    const archive = archiver('zip', { zlib: { level: 5 } })
    output.on('close', () => resolve())
    output.on('error', reject)
    archive.on('error', reject)
    archive.pipe(output)
    for (const p of paths) archive.file(p, { name: basename(p) })
    archive.finalize()
  })
}

function sendEvent(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: object) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

export async function POST(request: NextRequest) {
  const opts: DownloadOptions = await request.json()

  if (!opts.url || typeof opts.url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 })
  }

  // Enforce the per-IP daily limit up front (slots are only consumed on success).
  const clientIp = getClientIp(request)
  const status = peekLimit(clientIp)
  if (status.remaining <= 0) {
    return Response.json(
      { error: 'Daily download limit reached. Please try again tomorrow.', limit: status.limit, remaining: 0 },
      { status: 429 }
    )
  }

  // Never let a playlist pull more than the remaining daily allowance.
  const maxItems = opts.playlist ? Math.min(PLAYLIST_MAX_ITEMS, status.remaining) : 1

  const token = uuid()
  const tempDir = await mkdtemp(join(tmpdir(), `ytdlp-${token}-`))

  const encoder = new TextEncoder()
  const progressRegex =
    /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\S*)\s+at\s+([\d.]+\S*)\s+ETA\s+(\S+)/

  const shared = await commonYtdlpArgs()
  const args = buildArgs(opts, tempDir, maxItems, shared)

  let proc: ReturnType<typeof spawn> | null = null
  let registered = false

  const stream = new ReadableStream({
    start(controller) {
      const p = spawn(ytdlpBin(), args)
      proc = p

      p.stdout.on('data', (data: Buffer) => {
        const lines = data.toString().split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed) continue
          const match = progressRegex.exec(trimmed)
          if (match) {
            sendEvent(controller, encoder, {
              type: 'progress',
              percent: parseFloat(match[1]),
              size: match[2],
              speed: match[3],
              eta: match[4],
            })
          } else if (trimmed.includes('[download] 100%')) {
            sendEvent(controller, encoder, { type: 'progress', percent: 100 })
          } else if (trimmed.startsWith('[') && !trimmed.startsWith('[download]')) {
            sendEvent(controller, encoder, { type: 'status', message: trimmed })
          }
        }
      })

      p.stderr.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) sendEvent(controller, encoder, { type: 'error', message: msg })
      })

      p.on('close', async (code) => {
        if (code === 0) {
          try {
            const entries = await readdir(tempDir)
            const kept = entries.filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'))
            if (kept.length === 0) {
              throw new Error(
                MAX_VIDEO_DURATION > 0
                  ? `No file produced — the video may exceed the maximum allowed length (${Math.floor(MAX_VIDEO_DURATION / 3600)}h).`
                  : 'No output file found'
              )
            }

            // Media outputs (exclude subtitle/thumbnail sidecars) drive the count.
            const media = kept.filter((f) => !SIDECAR_RE.test(f))
            const mediaCount = Math.max(1, media.length)

            let outName: string
            let outPath: string
            if (kept.length === 1) {
              outName = kept[0]!
              outPath = join(tempDir, outName)
            } else {
              // Multiple files (playlist items and/or .srt sidecars) → one ZIP.
              const base = opts.playlist ? 'playlist' : (media[0]?.replace(/\.[^.]+$/, '') || 'download')
              outName = `${base}.zip`
              outPath = join(tempDir, outName)
              await zipFiles(kept.map((f) => join(tempDir, f)), outPath)
            }

            registerTempFile(token, outPath, outName)
            registered = true
            const usage = consumeLimit(clientIp, mediaCount)
            sendEvent(controller, encoder, {
              type: 'ready',
              token,
              filename: outName,
              remaining: usage.remaining,
              limit: usage.limit,
            })
          } catch (err) {
            sendEvent(controller, encoder, {
              type: 'failed',
              message: err instanceof Error ? err.message : 'Failed to locate output file',
            })
          }
        } else {
          sendEvent(controller, encoder, { type: 'failed', message: `Process exited with code ${code}` })
        }
        controller.close()
      })

      p.on('error', (err) => {
        sendEvent(controller, encoder, {
          type: 'error',
          message: err.message.includes('ENOENT')
            ? 'yt-dlp not found. Please install it and make sure it is in your PATH.'
            : err.message,
        })
        controller.close()
      })
    },
    // Fired when the client aborts (cancel button / navigation). Kill the yt-dlp
    // process and drop the temp dir unless the file was already handed off.
    cancel() {
      if (proc && proc.exitCode === null) {
        try { proc.kill('SIGKILL') } catch { /* already gone */ }
      }
      if (!registered) rm(tempDir, { recursive: true, force: true }).catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
