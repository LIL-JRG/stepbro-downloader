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

  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')

  // Test bgutil web token (standard) AND android GVS token in parallel
  let bgutilWebStatus = 'not configured'
  let bgutilWebTokens: unknown = null
  let bgutilAndroidStatus = 'not configured'
  let bgutilAndroidTokens: unknown = null

  if (bgutilUrl) {
    const [webResult, androidResult] = await Promise.allSettled([
      fetch(`${bgutilUrl}/get_pot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30_000),
      }),
      fetch(`${bgutilUrl}/get_pot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client: 'ANDROID' }),
        signal: AbortSignal.timeout(10_000),
      }),
    ])

    if (webResult.status === 'fulfilled') {
      bgutilWebStatus = `HTTP ${webResult.value.status}`
      const text = await webResult.value.text()
      try { bgutilWebTokens = JSON.parse(text) } catch { bgutilWebTokens = text }
    } else {
      bgutilWebStatus = `UNREACHABLE: ${(webResult.reason as Error)?.message}`
    }

    if (androidResult.status === 'fulfilled') {
      bgutilAndroidStatus = `HTTP ${androidResult.value.status}`
      const text = await androidResult.value.text()
      try { bgutilAndroidTokens = JSON.parse(text) } catch { bgutilAndroidTokens = text }
    } else {
      bgutilAndroidStatus = `ERROR: ${(androidResult.reason as Error)?.message}`
    }
  }

  // Format listings: run current config, android-only, and ios-only in parallel
  let formatsCurrentConfig: string | null = null
  let formatsAndroid: string | null = null
  let formatsIos: string | null = null

  if (testUrl) {
    const [a, b, c] = await Promise.all([
      runCommand(bin, [...sharedArgs, '--list-formats', '--no-playlist', testUrl]),
      runCommand(bin, [
        '--extractor-args', 'youtube:player_client=android',
        '--list-formats', '--no-playlist', testUrl,
      ]),
      runCommand(bin, [
        '--extractor-args', 'youtube:player_client=ios',
        '--list-formats', '--no-playlist', testUrl,
      ]),
    ])
    formatsCurrentConfig = a
    formatsAndroid = b
    formatsIos = c
  }

  return Response.json({
    ytdlpBin: bin,
    ytdlpVersion,
    cookiesFile: process.env.YOUTUBE_COOKIES_FILE ?? null,
    bgutilUrl: bgutilUrl ?? null,
    // bgutil web (standard) token
    bgutilWebStatus,
    bgutilWebTokens,
    // bgutil android GVS token (unlocks android https adaptive streams)
    bgutilAndroidStatus,
    bgutilAndroidTokens,
    sharedArgs,
    // Three-way format comparison:
    // formatsCurrentConfig = production config (bgutil android GVS / web / ios fallback)
    // formatsAndroid       = bare android client, no auth (baseline)
    // formatsIos           = ios client, no auth (HLS streams, no GVS PO token needed)
    formatsCurrentConfig: formatsCurrentConfig ?? 'Pass ?url=<youtube_url> to compare',
    formatsAndroid: formatsAndroid ?? 'Pass ?url=<youtube_url> to compare',
    formatsIos: formatsIos ?? 'Pass ?url=<youtube_url> to compare',
  })
}
