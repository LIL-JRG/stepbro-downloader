import { createReadStream, statSync } from 'fs'
import { unlink } from 'fs/promises'
import { resolve, join, basename } from 'path'
import type { NextRequest } from 'next/server'
import { getUserDir } from '@/lib/user-dir'

export const runtime = 'nodejs'

async function resolveSafePath(filename: string): Promise<{ filePath: string; safeName: string; userDir: string } | null> {
  const safeName = basename(filename)
  const userDir = await getUserDir()
  const filePath = resolve(join(userDir, safeName))
  if (!filePath.startsWith(resolve(userDir))) return null
  return { filePath, safeName, userDir }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const safe = await resolveSafePath(filename)
  if (!safe) return new Response('Forbidden', { status: 403 })
  const { filePath, safeName } = safe

  let fileSize: number
  try {
    fileSize = statSync(filePath).size
  } catch {
    return new Response('Not found', { status: 404 })
  }

  const rangeHeader = request.headers.get('range')

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace('bytes=', '').split('-')
    const start = parseInt(startStr, 10)
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1
    const chunkSize = end - start + 1

    const nodeStream = createReadStream(filePath, { start, end })
    const webStream = new ReadableStream({
      start(controller) {
        nodeStream.on('data', (chunk) => controller.enqueue(chunk))
        nodeStream.on('end', () => controller.close())
        nodeStream.on('error', (err) => controller.error(err))
      },
      cancel() { nodeStream.destroy() },
    })

    return new Response(webStream, {
      status: 206,
      headers: {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': String(chunkSize),
        'Content-Disposition': `attachment; filename="${safeName}"`,
      },
    })
  }

  const nodeStream = createReadStream(filePath)
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk))
      nodeStream.on('end', () => controller.close())
      nodeStream.on('error', (err) => controller.error(err))
    },
    cancel() { nodeStream.destroy() },
  })

  return new Response(webStream, {
    headers: {
      'Content-Length': String(fileSize),
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `attachment; filename="${safeName}"`,
    },
  })
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  const { filename } = await params
  const safe = await resolveSafePath(filename)
  if (!safe) return new Response('Forbidden', { status: 403 })

  try {
    await unlink(safe.filePath)
    return Response.json({ ok: true })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
