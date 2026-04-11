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

  let bgutilReachable = 'not configured'
  let bgutilResponse = null
  if (bgutilUrl) {
    try {
      const res = await fetch(`${bgutilUrl}/`, { signal: AbortSignal.timeout(5000) })
      bgutilReachable = `HTTP ${res.status}`
      bgutilResponse = await res.text()
    } catch (e) {
      bgutilReachable = `UNREACHABLE: ${(e as Error).message}`
    }
  }

  const bgutilPluginLoaded = ytdlpPlugins.toLowerCase().includes('bgutil') ||
    ytdlpPlugins.toLowerCase().includes('youtubepot')

  return Response.json({
    ytdlpBin: bin,
    ytdlpVersion,
    bgutilUrl,
    bgutilReachable,
    bgutilResponse,
    bgutilPluginLoaded,
  })
}
