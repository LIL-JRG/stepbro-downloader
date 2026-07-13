import type { NextRequest } from 'next/server'
import { listReports, setReportStatus } from '@/lib/blocklist'

export const runtime = 'nodejs'

type AuthState = 'ok' | 'disabled' | 'unauthorized'

// Admin is gated by the ADMIN_TOKEN env var, sent as `Authorization: Bearer <token>`.
function auth(request: NextRequest): AuthState {
  const token = process.env.ADMIN_TOKEN
  if (!token) return 'disabled'
  return request.headers.get('authorization') === `Bearer ${token}` ? 'ok' : 'unauthorized'
}

function guard(request: NextRequest): Response | null {
  const state = auth(request)
  if (state === 'disabled') {
    return Response.json({ error: 'Admin is disabled. Set ADMIN_TOKEN to enable review.' }, { status: 503 })
  }
  if (state === 'unauthorized') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request: NextRequest) {
  const denied = guard(request)
  if (denied) return denied
  return Response.json({ reports: listReports() })
}

export async function POST(request: NextRequest) {
  const denied = guard(request)
  if (denied) return denied

  const { id, action } = (await request.json().catch(() => ({}))) as {
    id?: string
    action?: string
  }
  if (!id || (action !== 'approve' && action !== 'reject')) {
    return Response.json({ error: 'id and a valid action are required' }, { status: 400 })
  }
  const ok = setReportStatus(id, action === 'approve' ? 'approved' : 'rejected')
  return ok
    ? Response.json({ ok: true })
    : Response.json({ error: 'Report not found' }, { status: 404 })
}
