import type { NextRequest } from 'next/server'
import { getClientIp, peekLimit, MAX_VIDEO_DURATION } from '@/lib/rate-limit'

export const runtime = 'nodejs'

// Current daily download allowance for this client (no slot is consumed).
export async function GET(request: NextRequest) {
  return Response.json({ ...peekLimit(getClientIp(request)), maxDuration: MAX_VIDEO_DURATION })
}
