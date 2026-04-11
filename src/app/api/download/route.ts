import { spawn } from 'child_process'
import { mkdtemp, readdir, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import type { NextRequest } from 'next/server'
import { registerTempFile } from '@/lib/temp-store'

export const runtime = 'nodejs'

interface DownloadOptions {
  url: string
  quality: string
  container: string
  audioOnly?: boolean
  audioFormat?: string
  audioQuality?: string
}

function buildArgs(opts: DownloadOptions, outDir: string): string[] {
  const args: string[] = []
  args.push('-o', join(outDir, '%(title).100s [%(id)s].%(ext)s'), '--restrict-filenames')

  if (opts.audioOnly) {
    args.push('-x')
    if (opts.audioFormat) args.push('--audio-format', opts.audioFormat)
    args.push('--audio-quality', opts.audioQuality ?? '0')
  } else {
    const quality = opts.quality ?? 'best'
    const container = opts.container ?? 'any'

    if (quality === 'best') {
      args.push('-f', 'bv*+ba/b')
    } else {
      args.push('-f', `b[height<=${quality}]/bv*[height<=${quality}]+ba/bv*+ba/b`)
    }

    const extPref = container !== 'any' ? container : 'mp4'
    args.push('-S', `ext:${extPref},vcodec:avc,acodec:m4a`)
    args.push('--merge-output-format', container !== 'any' ? container : 'mp4')
  }

  const ffmpegBin = process.env.FFMPEG_BIN
  if (ffmpegBin) args.push('--ffmpeg-location', ffmpegBin)

  // Pass full path to node binary so yt-dlp can use it as JS runtime
  args.push('--js-runtimes', 'nodejs:/usr/local/bin/node')
  // Use TV embedded + iOS clients — less bot-detected on server IPs
  args.push('--extractor-args', 'youtube:player_client=tv_embedded,ios')
  // If a cookies file is provided, pass it for YouTube authentication
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE
  if (cookiesFile) args.push('--cookies', cookiesFile)

  args.push('--newline', '--no-playlist', '--force-overwrites', opts.url)
  return args
}

function sendEvent(
  controller: ReadableStreamDefaultController,
  encoder: TextEncoder,
  data: object
) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

export async function POST(request: NextRequest) {
  const opts: DownloadOptions = await request.json()

  if (!opts.url || typeof opts.url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 })
  }

  const token = uuid()
  const tempDir = await mkdtemp(join(tmpdir(), `ytdlp-${token}-`))

  const encoder = new TextEncoder()
  const progressRegex =
    /\[download\]\s+([\d.]+)%\s+of\s+~?([\d.]+\S*)\s+at\s+([\d.]+\S*)\s+ETA\s+(\S+)/

  const stream = new ReadableStream({
    start(controller) {
      const args = buildArgs(opts, tempDir)
      const bin = process.env.YT_DLP_BIN || 'yt-dlp'
      const proc = spawn(bin, args)

      proc.stdout.on('data', (data: Buffer) => {
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

      proc.stderr.on('data', (data: Buffer) => {
        const msg = data.toString().trim()
        if (msg) sendEvent(controller, encoder, { type: 'error', message: msg })
      })

      proc.on('close', async (code) => {
        if (code === 0) {
          try {
            // Find the downloaded file (largest non-temp file in the dir)
            const entries = await readdir(tempDir)
            const files = await Promise.all(
              entries
                .filter(f => !f.endsWith('.part') && !f.endsWith('.ytdl'))
                .map(async (f) => ({ f, size: (await stat(join(tempDir, f))).size }))
            )
            const largest = files.sort((a, b) => b.size - a.size)[0]

            if (!largest) throw new Error('No output file found')

            const filePath = join(tempDir, largest.f)
            registerTempFile(token, filePath, largest.f)
            sendEvent(controller, encoder, { type: 'ready', token, filename: largest.f })
          } catch (err) {
            sendEvent(controller, encoder, {
              type: 'failed',
              message: err instanceof Error ? err.message : 'Failed to locate output file',
            })
          }
        } else {
          sendEvent(controller, encoder, {
            type: 'failed',
            message: `Process exited with code ${code}`,
          })
        }
        controller.close()
      })

      proc.on('error', (err) => {
        sendEvent(controller, encoder, {
          type: 'error',
          message: err.message.includes('ENOENT')
            ? 'yt-dlp not found. Please install it and make sure it is in your PATH.'
            : err.message,
        })
        controller.close()
      })
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
