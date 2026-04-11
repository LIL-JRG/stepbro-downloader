import { spawn } from 'child_process'
import { ytdlpBin } from '@/lib/ytdlp'

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

export async function GET() {
  const bgutilUrl = process.env.BGUTIL_URL?.replace(/\/$/, '')
  const bin = ytdlpBin()

  const [ytdlpVersion, ytdlpPlugins] = await Promise.all([
    runCommand(bin, ['--version']),
    runCommand(bin, ['--list-extractors']),
  ])

  let bgutilStatus = 'not configured'
  let bgutilTokens = null
  if (bgutilUrl) {
    try {
      const res = await fetch(`${bgutilUrl}/get_pot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(10000),
      })
      bgutilStatus = `HTTP ${res.status}`
      const text = await res.text()
      try { bgutilTokens = JSON.parse(text) } catch { bgutilTokens = text }
    } catch (e) {
      bgutilStatus = `UNREACHABLE: ${(e as Error).message}`
    }
  }

  return Response.json({
    ytdlpBin: bin,
    ytdlpVersion,
    bgutilUrl,
    bgutilStatus,
    bgutilTokens,
  })
}
