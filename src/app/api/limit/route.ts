import type { NextRequest } from 'next/server'
import { getClientIp, peekLimit, MAX_VIDEO_DURATION } from '@/lib/rate-limit'
import { getKeyInfo } from '@/lib/supporter'

export const runtime = 'nodejs'

// Current daily download allowance for this client (no slot is consumed).
// With a valid supporter key: unlimited downloads and no duration cap.
export async function GET(request: NextRequest) {
  const key = getKeyInfo(request.headers.get('x-supporter-key'))
  if (key) {
    return Response.json({
      supporter: true,
      maxDuration: 0,
      plan: key.plan ?? 'lifetime',
      expiresAt: key.expiresAt ?? null,
    })
  }
  return Response.json({
    supporter: false,
    ...peekLimit(getClientIp(request)),
    maxDuration: MAX_VIDEO_DURATION,
  })
}
