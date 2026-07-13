import { spawn } from 'child_process'
import { mkdtemp, readdir, rm, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import type { NextRequest } from 'next/server'
import { registerTempFile } from '@/lib/temp-store'
import { commonYtdlpArgs, ytdlpBin } from '@/lib/ytdlp'
import { getClientIp, peekLimit, consumeLimit, MAX_VIDEO_DURATION } from '@/lib/rate-limit'
import { isBlocked } from '@/lib/blocklist'
import { isValidKey } from '@/lib/supporter'
import {
  findAudioOption,
  resolutionsFor,
  videoRequiresSupporter,
  audioRequiresSupporter,
  FREE_MAX_HEIGHT,
  DEFAULT_AUDIO,
  DEFAULT_CONTAINER,
  DEFAULT_RESOLUTION,
  VIDEO_CONTAINERS,
} from '@/lib/formats'

export const runtime = 'nodejs'

interface DownloadOptions {
  url: string
  audioOnly?: boolean
  container?: string
  quality?: string
  audioOption?: string
}

function buildArgs(
  opts: DownloadOptions,
  outDir: string,
  shared: string[],
  supporter: boolean
): string[] {
  const args: string[] = []
  args.push('-o', join(outDir, '%(title).100s [%(id)s].%(ext)s'), '--restrict-filenames')

  if (opts.audioOnly) {
    const opt = findAudioOption(opts.audioOption) ?? findAudioOption(DEFAULT_AUDIO)!
    args.push('-x', '--audio-format', opt.format)
    args.push('--audio-quality', opt.quality ?? '0')
  } else {
    const container = VIDEO_CONTAINERS.includes(opts.container as never)
      ? (opts.container as string)
      : DEFAULT_CONTAINER
    const quality = resolutionsFor(container).some((r) => r.value === opts.quality)
      ? (opts.quality as string)
      : DEFAULT_RESOLUTION
    const mergeFormat = container
    const premium = quality === '1080premium'

    // Effective height ceiling. "Auto" is the real best for supporters, but a
    // non-supporter is always clamped to the free cap (1080p) regardless of pick.
    let height: number
    if (premium) height = 1080
    else if (quality === 'best') height = supporter ? Infinity : FREE_MAX_HEIGHT
    else height = Number(quality)
    if (!supporter) height = Math.min(height, FREE_MAX_HEIGHT)
    const heightFilter = Number.isFinite(height) ? `[height<=${height}]` : ''
    // The 1080p "Premium" tier prefers YouTube's high-bitrate variant.
    const premiumFilter = premium ? '[format_note*=Premium]' : ''

    // Both the video codec AND the audio codec must suit the container, or the
    // merged file misbehaves in common players. VP9/AV1 inside MP4 plays as
    // audio-only on Windows/QuickTime/Safari/iOS, and Opus inside MP4 has no
    // sound. WebM pins its native VP9/AV1 + Opus; MKV takes anything (VLC plays
    // it) so it keeps the highest resolution; MP4/MOV/FLV/AVI are the "H.264
    // family" — pin H.264 (AVC) + AAC for universal compatibility (YouTube caps
    // AVC at 1080p, so above that keep the real codec).
    let videoPref: string
    let audioExt: string
    if (mergeFormat === 'webm') {
      videoPref = 'bv*[ext=webm]'
      audioExt = 'webm'
    } else if (mergeFormat === 'mkv') {
      videoPref = 'bv*'
      audioExt = 'm4a'
    } else {
      const qNum = Number.isFinite(height) ? height : Infinity
      videoPref = qNum <= 1080 ? 'bv*[vcodec^=avc1]' : 'bv*'
      audioExt = 'm4a'
    }

    const vsel = `${videoPref}${heightFilter}${premiumFilter}`
    const combinedFallback = heightFilter ? `/b${heightFilter}/b` : '/b'
    args.push(
      '-f',
      `${vsel}+ba[ext=${audioExt}]/bv*${heightFilter}+ba${combinedFallback}`
    )
    args.push('-S', 'res,fps,vbr,abr,vcodec:avc,acodec:m4a')
    args.push('--merge-output-format', mergeFormat)
  }

  const ffmpegBin = process.env.FFMPEG_BIN
  if (ffmpegBin) args.push('--ffmpeg-location', ffmpegBin)

  // Anti-abuse backstop: refuse videos longer than the cap (client gates too).
  // Supporters are exempt.
  if (!supporter && MAX_VIDEO_DURATION > 0) {
    args.push('--match-filters', `duration<=${MAX_VIDEO_DURATION}`)
  }

  args.push(...shared)
  args.push('--newline', '--no-playlist', '--force-overwrites', opts.url)
  return args
}

function sendEvent(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: object) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

export async function POST(request: NextRequest) {
  const opts: DownloadOptions = await request.json()

  if (!opts.url || typeof opts.url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 })
  }

  // Refuse content removed at a rights holder's request (DMCA).
  if (isBlocked(opts.url)) {
    return Response.json(
      { error: 'This video has been removed at the request of the rights holder.' },
      { status: 403 }
    )
  }

  // A valid supporter key (validated server-side on every request) bypasses the
  // daily limit and the duration cap. DMCA blocks still apply to everyone.
  const supporter = isValidKey(request.headers.get('x-supporter-key'))

  // Backstop for the quality gate: the UI hides supporter-only tiers from free
  // users, but reject them here too so the API itself can't be used to bypass it.
  if (!supporter) {
    const gated = opts.audioOnly
      ? audioRequiresSupporter(opts.audioOption)
      : videoRequiresSupporter(opts.container ?? DEFAULT_CONTAINER, opts.quality ?? DEFAULT_RESOLUTION)
    if (gated) {
      return Response.json(
        { error: 'This quality requires a supporter license.' },
        { status: 403 }
      )
    }
  }

  // Enforce the per-IP daily limit up front (a slot is only consumed on success).
  const clientIp = getClientIp(request)
  if (!supporter) {
    const status = peekLimit(clientIp)
    if (status.remaining <= 0) {
      return Response.json(
        { error: 'Daily download limit reached. Please try again tomorrow.', limit: status.limit, remaining: 0 },
        { status: 429 }
      )
    }
  }

  const token = uuid()
  const tempDir = await mkdtemp(join(tmpdir(), `ytdlp-${token}-`))

  const encoder = new TextEncoder()
  const progressRegex =
    /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\S*)\s+at\s+([\d.]+\S*)\s+ETA\s+(\S+)/

  const shared = await commonYtdlpArgs()
  const args = buildArgs(opts, tempDir, shared, supporter)

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
            // Largest non-temp file is the merged media output.
            const entries = await readdir(tempDir)
            const files = await Promise.all(
              entries
                .filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'))
                .map(async (f) => ({ f, size: (await stat(join(tempDir, f))).size }))
            )
            const largest = files.sort((a, b) => b.size - a.size)[0]

            if (!largest) {
              throw new Error(
                MAX_VIDEO_DURATION > 0
                  ? `No file produced — the video may exceed the maximum allowed length (${Math.floor(MAX_VIDEO_DURATION / 3600)}h).`
                  : 'No output file found'
              )
            }

            registerTempFile(token, join(tempDir, largest.f), largest.f)
            registered = true
            // Supporters don't consume (or report) daily-limit slots.
            const usage = supporter ? null : consumeLimit(clientIp)
            sendEvent(controller, encoder, {
              type: 'ready',
              token,
              filename: largest.f,
              ...(usage ? { remaining: usage.remaining, limit: usage.limit } : {}),
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
