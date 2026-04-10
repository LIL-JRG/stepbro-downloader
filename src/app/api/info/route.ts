import { spawn } from 'child_process'
import type { NextRequest } from 'next/server'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const { url } = await request.json()

  if (!url || typeof url !== 'string') {
    return Response.json({ error: 'URL is required' }, { status: 400 })
  }

  return new Promise<Response>((resolve) => {
    const chunks: string[] = []
    const errors: string[] = []

    const bin = process.env.YT_DLP_BIN || 'yt-dlp'
    const proc = spawn(bin, ['--dump-json', '--no-playlist', url])

    proc.stdout.on('data', (data: Buffer) => {
      chunks.push(data.toString())
    })

    proc.stderr.on('data', (data: Buffer) => {
      errors.push(data.toString())
    })

    proc.on('close', (code) => {
      if (code !== 0) {
        const errMsg = errors.join('').trim()
        resolve(
          Response.json(
            { error: errMsg || 'Failed to fetch video info' },
            { status: 500 }
          )
        )
        return
      }

      try {
        const info = JSON.parse(chunks.join(''))
        resolve(
          Response.json({
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
            formats: (info.formats || []).map(
              (f: {
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
              }) => ({
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
              })
            ),
          })
        )
      } catch {
        resolve(
          Response.json({ error: 'Failed to parse video info' }, { status: 500 })
        )
      }
    })

    proc.on('error', (err) => {
      resolve(
        Response.json(
          {
            error:
              err.message.includes('ENOENT')
                ? 'yt-dlp not found. Please install it and make sure it is in your PATH.'
                : err.message,
          },
          { status: 500 }
        )
      )
    })
  })
}
