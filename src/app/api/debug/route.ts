import { spawn } from 'child_process'
import type { NextRequest } from 'next/server'
import { commonYtdlpArgs, ytdlpBin } from '@/lib/ytdlp'

export const runtime = 'nodejs'

function runCommand(bin: string, args: string[]): Promise<string> {
  return new Promise((resolve) => {
    const chunks: string[] = []
    const proc = spawn(bin, args)
    proc.stdout.on('data', (d: Buffer) => chunks.push(d.toString()))
    proc.stderr.on('data', (d: Buffer) => chunks.push(d.toString()))
    proc.on('close', () => resolve(chunks.join('').trim()))
    proc.on('error', (e) => resolve(`ERROR: ${e.message}`))
  })
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const testUrl = searchParams.get('url') ?? ''

  const bin = ytdlpBin()
  const sharedArgs = await commonYtdlpArgs()

  const [ytdlpVersion] = await Promise.all([
    runCommand(bin, ['--version']),
  ])

  // Test bgutil
  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')
  let bgutilStatus = 'not configured'
  let bgutilTokens = null
  if (bgutilUrl) {
    try {
      const res = await fetch(`${bgutilUrl}/get_pot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30_000),
      })
      bgutilStatus = `HTTP ${res.status}`
      const text = await res.text()
      try { bgutilTokens = JSON.parse(text) } catch { bgutilTokens = text }
    } catch (e) {
      bgutilStatus = `UNREACHABLE: ${(e as Error).message}`
    }
  }

  // Optional: list formats for a user-supplied URL to diagnose quality issues
  let formats: string | null = null
  if (testUrl) {
    formats = await runCommand(bin, [
      ...sharedArgs,
      '--list-formats',
      '--no-playlist',
      testUrl,
    ])
  }

  return Response.json({
    ytdlpBin: bin,
    ytdlpVersion,
    cookiesFile: process.env.YOUTUBE_COOKIES_FILE ?? null,
    bgutilUrl: bgutilUrl ?? null,
    bgutilStatus,
    bgutilTokens,
    // Show the exact args being passed to every yt-dlp call
    sharedArgs,
    // Format list (only when ?url= is provided)
    formats: formats ?? 'Pass ?url=<youtube_url> to see available formats',
  })
}
