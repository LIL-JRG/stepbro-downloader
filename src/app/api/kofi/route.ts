import type { NextRequest } from 'next/server'
import { grantKeyForEmail } from '@/lib/supporter'

export const runtime = 'nodejs'

/**
 * Ko-fi payment webhook (configure at ko-fi.com/manage/webhooks pointing here).
 * Ko-fi POSTs form data with a `data` field holding JSON that includes a
 * verification_token (must match KOFI_VERIFICATION_TOKEN) and the buyer's email.
 * On a verified payment we grant that email a supporter key; the buyer then
 * activates it on the site by entering their payment email.
 */
export async function POST(request: NextRequest) {
  const token = process.env.KOFI_VERIFICATION_TOKEN
  if (!token) {
    return Response.json({ error: 'Webhook disabled. Set KOFI_VERIFICATION_TOKEN.' }, { status: 503 })
  }

  let payload: Record<string, unknown>
  try {
    const form = await request.formData()
    payload = JSON.parse(String(form.get('data') ?? '{}'))
  } catch {
    return Response.json({ error: 'Invalid payload' }, { status: 400 })
  }

  if (payload.verification_token !== token) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const email = typeof payload.email === 'string' ? payload.email.trim() : ''
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    const type = typeof payload.type === 'string' ? payload.type : 'Payment'
    const from = typeof payload.from_name === 'string' ? payload.from_name : ''
    grantKeyForEmail(email, `Ko-fi ${type}${from ? ` — ${from}` : ''}`)
  }

  // Always 200 so Ko-fi doesn't retry forever on odd payloads.
  return Response.json({ ok: true })
}
