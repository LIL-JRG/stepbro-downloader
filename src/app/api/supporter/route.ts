import type { NextRequest } from 'next/server'
import { isValidKey } from '@/lib/supporter'
import { getClientIp, allowInfoRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Validate a supporter key. Throttled per IP (shared budget with /api/info) to
// deter guessing — though the key space makes brute force infeasible anyway.
export async function POST(request: NextRequest) {
  if (!allowInfoRequest(getClientIp(request))) {
    return Response.json({ error: 'Too many requests. Slow down a moment.' }, { status: 429 })
  }
  const { key } = (await request.json().catch(() => ({}))) as { key?: string }
  return Response.json({ valid: typeof key === 'string' && isValidKey(key) })
}
