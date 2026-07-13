import type { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/admin-auth'
import { createKey, listKeys, setKeyRevoked } from '@/lib/supporter'

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
  }

  if (body.action === 'create') {
    const key = createKey(typeof body.note === 'string' ? body.note.trim() : '')
    return Response.json({ key })
  }
  if ((body.action === 'revoke' || body.action === 'restore') && typeof body.code === 'string') {
    const ok = setKeyRevoked(body.code, body.action === 'revoke')
    return ok ? Response.json({ ok: true }) : Response.json({ error: 'Key not found' }, { status: 404 })
  }
  return Response.json({ error: 'Invalid action' }, { status: 400 })
}
