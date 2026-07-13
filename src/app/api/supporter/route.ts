import type { NextRequest } from 'next/server'
import { isValidKey, findKeyByEmail } from '@/lib/supporter'
import { getClientIp, allowInfoRequest } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Supporter validation & activation. Throttled per IP.
 * - { key }   → { valid } — validate a license key.
 * - { email } → { key }   — activate/recover: return the key granted to that
 *                            payment email (via the Ko-fi webhook), if any.
 */
export async function POST(request: NextRequest) {
  if (!allowInfoRequest(getClientIp(request))) {
    return Response.json({ error: 'Too many requests. Slow down a moment.' }, { status: 429 })
  }
  const body = (await request.json().catch(() => ({}))) as { key?: string; email?: string }

  if (typeof body.key === 'string' && body.key.trim()) {
    return Response.json({ valid: isValidKey(body.key) })
  }
  if (typeof body.email === 'string' && body.email.trim()) {
    const found = findKeyByEmail(body.email)
    if (found) return Response.json({ key: found.code })
    return Response.json({ error: 'No license found for that email yet.' }, { status: 404 })
  }
  return Response.json({ error: 'key or email is required' }, { status: 400 })
}
