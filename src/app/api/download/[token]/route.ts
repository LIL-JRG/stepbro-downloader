import { createReadStream } from 'fs'
import { rm } from 'fs/promises'
import { statSync } from 'fs'
import { dirname } from 'path'
import type { NextRequest } from 'next/server'
import { claimTempFile } from '@/lib/temp-store'

export const runtime = 'nodejs'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const entry = claimTempFile(token)

  if (!entry) {
    return new Response('File not found or already downloaded', { status: 404 })
  }

  const { filePath, filename } = entry

  let fileSize: number
  try {
    fileSize = statSync(filePath).size
  } catch {
    return new Response('File not found', { status: 404 })
  }

  const cleanup = () =>
    rm(dirname(filePath), { recursive: true, force: true }).catch(() => {})

  const nodeStream = createReadStream(filePath)
  const webStream = new ReadableStream({
    start(controller) {
      nodeStream.on('data', (chunk) => controller.enqueue(chunk))
      nodeStream.on('end', () => {
        controller.close()
        // Small delay to ensure data is flushed before deleting
        setTimeout(cleanup, 5000)
      })
      nodeStream.on('error', (err) => {
        controller.error(err)
        cleanup()
      })
    },
    cancel() {
      nodeStream.destroy()
      cleanup()
    },
  })

  return new Response(webStream, {
    headers: {
      'Content-Length': String(fileSize),
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
