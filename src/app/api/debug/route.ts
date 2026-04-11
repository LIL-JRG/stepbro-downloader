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

  const ytdlpVersion = await runCommand(bin, ['--version'])

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

  const dataSyncId = sharedArgs.find(a => a.includes('data_sync_id='))
    ?.match(/data_sync_id=([^;]+)/)?.[1] ?? null
  const dataSyncIdSource = process.env.YOUTUBE_DATA_SYNC_ID
    ? 'env var YOUTUBE_DATA_SYNC_ID'
    : dataSyncId ? 'auto-fetched from youtube.com' : 'not found (account has no YouTube channel)'

  // Format listings: run current config AND android-only in parallel for comparison
  let formatsCurrentConfig: string | null = null
  let formatsAndroid: string | null = null
  if (testUrl) {
    const [a, b] = await Promise.all([
      runCommand(bin, [...sharedArgs, '--list-formats', '--no-playlist', testUrl]),
      runCommand(bin, [
        '--extractor-args', 'youtube:player_client=android',
        '--list-formats', '--no-playlist', testUrl,
      ]),
    ])
    formatsCurrentConfig = a
    formatsAndroid = b
  }

  return Response.json({
    ytdlpBin: bin,
    ytdlpVersion,
    cookiesFile: process.env.YOUTUBE_COOKIES_FILE ?? null,
    bgutilUrl: bgutilUrl ?? null,
    bgutilStatus,
    bgutilTokens,
    dataSyncId,
    dataSyncIdSource,
    sharedArgs,
    // Compare format availability across two different approaches:
    // formatsCurrentConfig = web + bgutil + cookies (current production config)
    // formatsAndroid = android client with no auth (mobile API, no cookies needed)
    formatsCurrentConfig: formatsCurrentConfig ?? 'Pass ?url=<youtube_url> to compare',
    formatsAndroid: formatsAndroid ?? 'Pass ?url=<youtube_url> to compare',
  })
}
