import type { NextRequest } from 'next/server'
import { addReport } from '@/lib/blocklist'
import { getClientIp, allowInfoRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// DMCA / takedown report. Records the claim and blocks the video from further
// downloads. Throttled per IP to deter spam.
export async function POST(request: NextRequest) {
  if (!allowInfoRequest(getClientIp(request))) {
    return Response.json({ error: 'Too many requests. Please try again shortly.' }, { status: 429 })
  }

  let body: { url?: unknown; email?: unknown; reason?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 2000) : ''

  if (!/^https?:\/\/\S+\.\S+/i.test(url)) {
    return Response.json({ error: 'A valid video URL is required.' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return Response.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  addReport({ url, email, reason })
  return Response.json({ ok: true })
}
