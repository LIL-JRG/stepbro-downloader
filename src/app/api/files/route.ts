import { readdir, stat } from 'fs/promises'
import { join, extname } from 'path'
import { getUserDir } from '@/lib/user-dir'

export const runtime = 'nodejs'

const VIDEO_EXTS = new Set(['.mp4', '.mkv', '.webm', '.avi', '.mov', '.flv', '.m4v'])
const AUDIO_EXTS = new Set(['.mp3', '.m4a', '.aac', '.flac', '.opus', '.wav', '.ogg'])

function mimeForExt(ext: string): string {
  const map: Record<string, string> = {
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.webm': 'video/webm',
    '.avi': 'video/x-msvideo', '.mov': 'video/quicktime', '.flv': 'video/x-flv',
    '.m4v': 'video/x-m4v', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4',
    '.aac': 'audio/aac', '.flac': 'audio/flac', '.opus': 'audio/opus',
    '.wav': 'audio/wav', '.ogg': 'audio/ogg',
  }
  return map[ext] ?? 'application/octet-stream'
}

export async function GET() {
  const dir = await getUserDir()
  try {
    const entries = await readdir(dir)
    const files = await Promise.all(
      entries
        .filter((name) => {
          const ext = extname(name).toLowerCase()
          return VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext)
        })
        .map(async (name) => {
          const ext = extname(name).toLowerCase()
          const info = await stat(join(dir, name))
          return {
            name,
            size: info.size,
            mtime: info.mtime.toISOString(),
            type: VIDEO_EXTS.has(ext) ? 'video' : 'audio',
            mime: mimeForExt(ext),
          }
        })
    )
    files.sort((a, b) => b.mtime.localeCompare(a.mtime))
    return Response.json({ files })
  } catch {
    return Response.json({ files: [] })
  }
}
