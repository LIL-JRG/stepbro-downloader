import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createKey, listKeys, setKeyRevoked, PLANS, type Plan } from '@/lib/supporter'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied
  return Response.json({ keys: listKeys() })
}

export async function POST(request: NextRequest) {
  const denied = requireAdmin(request)
  if (denied) return denied

  const body = (await request.json().catch(() => ({}))) as {
    action?: string
    note?: string
    code?: string
    plan?: string
    count?: number
    startOnUse?: boolean
  }

  if (body.action === 'create') {
    const plan: Plan = PLANS.includes(body.plan as Plan) ? (body.plan as Plan) : 'lifetime'
    const note = typeof body.note === 'string' ? body.note.trim() : ''
    const count = Math.min(50, Math.max(1, Math.floor(Number(body.count ?? 1)) || 1))
    const startOnUse = body.startOnUse !== false
    const created = Array.from({ length: count }, () => createKey(note, plan, startOnUse))
    return Response.json({ keys: created, key: created[0] })
  }
  if ((body.action === 'revoke' || body.action === 'restore') && typeof body.code === 'string') {
    const ok = setKeyRevoked(body.code, body.action === 'revoke')
    return ok ? Response.json({ ok: true }) : Response.json({ error: 'Key not found' }, { status: 404 })
  }
  return Response.json({ error: 'Invalid action' }, { status: 400 })
}
