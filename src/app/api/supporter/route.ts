import type { NextRequest } from 'next/server'
import { isValidKey, findKeyByEmail } from '@/lib/supporter'
import { getClientIp, allowInfoRequest, allowEmailLookup } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * Supporter validation & activation. Throttled per IP.
 * - { key }   → { valid } — validate a license key.
 * - { email } → { key }   — activate/recover: return the key granted to that
 *                            payment email (via the Ko-fi webhook), if any.
 *                            Strictly throttled (5/hour/IP) since knowing a
 *                            buyer's email is the only proof we can check
 *                            without an email-delivery service.
 */
export async function POST(request: NextRequest) {
  const ip = getClientIp(request)
  const body = (await request.json().catch(() => ({}))) as { key?: string; email?: string }

  if (typeof body.key === 'string' && body.key.trim()) {
    if (!allowInfoRequest(ip)) {
      return Response.json({ error: 'Too many requests. Slow down a moment.' }, { status: 429 })
    }
    return Response.json({ valid: isValidKey(body.key) })
  }
  if (typeof body.email === 'string' && body.email.trim()) {
    if (!allowEmailLookup(ip)) {
      return Response.json(
        { error: 'Too many attempts. Please try again in an hour.' },
        { status: 429 }
      )
    }
    const found = findKeyByEmail(body.email)
    if (found) return Response.json({ key: found.code })
    return Response.json({ error: 'No license found for that email yet.' }, { status: 404 })
  }
  return Response.json({ error: 'key or email is required' }, { status: 400 })
}
