import { spawn } from 'child_process'
import { mkdtemp, readdir, stat } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { v4 as uuid } from 'uuid'
import type { NextRequest } from 'next/server'
import { registerTempFile } from '@/lib/temp-store'
import { commonYtdlpArgs, ytdlpBin } from '@/lib/ytdlp'

export const runtime = 'nodejs'

interface DownloadOptions {
  url: string
  quality: string
  container: string
  audioOnly?: boolean
  audioFormat?: string
  audioQuality?: string
}

async function buildArgs(opts: DownloadOptions, outDir: string): Promise<string[]> {
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

    const mergeFormat = container !== 'any' ? container : 'mp4'
    // Sort by quality first (res → fps → bitrate), then prefer compatible codecs
    // as a tiebreaker. ext: is intentionally omitted — --merge-output-format
    // handles the output container so we don't penalise VP9/AV1 streams.
    args.push('-S', 'res,fps,vbr,abr,vcodec:avc,acodec:m4a')
    args.push('--merge-output-format', mergeFormat)
  }

  const ffmpegBin = process.env.FFMPEG_BIN
  if (ffmpegBin) args.push('--ffmpeg-location', ffmpegBin)

  args.push(...await commonYtdlpArgs())
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

  const args = await buildArgs(opts, tempDir)

  const stream = new ReadableStream({
    start(controller) {
      const proc = spawn(ytdlpBin(), args)

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
