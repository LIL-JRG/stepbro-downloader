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

  const bgutilUrl  = process.env.BGUTIL_URL?.replace(/\/$/, '')
  const cookiesFile = process.env.YOUTUBE_COOKIES_FILE ?? null

  // Test bgutil token endpoint
  let bgutilWebStatus = 'not configured'
  let bgutilWebTokens: unknown = null

  if (bgutilUrl) {
    try {
      const res = await fetch(`${bgutilUrl}/get_pot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(30_000),
      })
      bgutilWebStatus = `HTTP ${res.status}`
      const text = await res.text()
      try { bgutilWebTokens = JSON.parse(text) } catch { bgutilWebTokens = text }
    } catch (e) {
      bgutilWebStatus = `UNREACHABLE: ${(e as Error).message}`
    }
  }

  // Format listings when a test URL is provided.
  // Four approaches tested in parallel to pinpoint which combination works:
  //
  //  formatsCurrentConfig  — full production config (sharedArgs above)
  //  formatsWebCookiesOnly — cookies alone, no bgutil, no player_skip
  //                          (does a logged-in watch page bypass the IP block?)
  //  formatsAndroidNoPage  — android with player_skip=webpage
  //                          (avoids watch-page bot check, goes direct to android API)
  //  formatsIosNoPage      — ios with player_skip=webpage
  //                          (same, but ios for HLS streams)
  let formatsCurrentConfig: string | null = null
  let formatsWebCookiesOnly: string | null = null
  let formatsAndroidNoPage: string | null = null
  let formatsIosNoPage: string | null = null

  if (testUrl) {
    const cookiesArgs = cookiesFile ? ['--cookies', cookiesFile] : []

    const [a, b, c, d] = await Promise.all([
      runCommand(bin, [...sharedArgs, '--list-formats', '--no-playlist', testUrl]),
      cookiesFile
        ? runCommand(bin, [
            '--cookies', cookiesFile,
            '--extractor-args', 'youtube:player_client=web',
            '--list-formats', '--no-playlist', testUrl,
          ])
        : Promise.resolve('no cookies configured'),
      runCommand(bin, [
        ...cookiesArgs,
        '--extractor-args', 'youtube:player_client=android;player_skip=webpage',
        '--list-formats', '--no-playlist', testUrl,
      ]),
      runCommand(bin, [
        ...cookiesArgs,
        '--extractor-args', 'youtube:player_client=ios;player_skip=webpage',
        '--list-formats', '--no-playlist', testUrl,
      ]),
    ])

    formatsCurrentConfig  = a
    formatsWebCookiesOnly = b
    formatsAndroidNoPage  = c
    formatsIosNoPage      = d
  }

  return Response.json({
    ytdlpBin: bin,
    ytdlpVersion,
    cookiesFile,
    bgutilUrl: bgutilUrl ?? null,
    bgutilWebStatus,
    bgutilWebTokens,
    sharedArgs,
    // Format listing comparisons (add ?url=<youtube_url> to populate):
    formatsCurrentConfig:  formatsCurrentConfig  ?? 'Pass ?url=<youtube_url> to compare',
    formatsWebCookiesOnly: formatsWebCookiesOnly ?? 'Pass ?url=<youtube_url> to compare',
    formatsAndroidNoPage:  formatsAndroidNoPage  ?? 'Pass ?url=<youtube_url> to compare',
    formatsIosNoPage:      formatsIosNoPage       ?? 'Pass ?url=<youtube_url> to compare',
  })
}
