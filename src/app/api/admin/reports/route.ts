import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { listReports, setReportStatus } from '@/lib/blocklist'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  return Response.json({ reports: listReports() })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
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
