import type { NextRequest } from 'next/server'

/**
 * Admin endpoints are gated by the ADMIN_TOKEN env var, sent as
 * `Authorization: Bearer <token>`. Returns a Response to short-circuit with
 * (503 when admin is disabled, 401 when the token is wrong), or null when OK.
 */
export function requireAdmin(request: NextRequest): Response | null {
  const token = process.env.ADMIN_TOKEN
  if (!token) {
    // Deliberately vague — don't tell strangers how to enable it (see README).
    return Response.json({ error: 'Admin is disabled.' }, { status: 503 })
  }
  if (request.headers.get('authorization') !== `Bearer ${token}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}
