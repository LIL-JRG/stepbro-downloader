import type { NextRequest } from 'next/server'
import { grantKeyForEmail, type Plan } from '@/lib/supporter'

export const runtime = 'nodejs'

// Shop item → plan. Shop Orders carry each item's direct_link_code (the code in
// its ko-fi.com/s/<code> link), which maps a purchase to its tier exactly.
// Defaults are this instance's shop items; override via KOFI_ITEM_*.
function itemPlans(): Record<string, Plan> {
  return {
    [process.env.KOFI_ITEM_7D ?? '6256f77fd5']: '7d',
    [process.env.KOFI_ITEM_30D ?? '1b20036466']: '30d',
    [process.env.KOFI_ITEM_90D ?? 'b1c568c4bb']: '90d',
    [process.env.KOFI_ITEM_LIFETIME ?? 'f30c359628']: 'lifetime',
  }
}

const PLAN_RANK: Record<Plan, number> = { '7d': 1, '30d': 2, '90d': 3, lifetime: 4 }

// Amount → plan fallback for plain donations (thresholds mirror the shop prices;
// configurable via KOFI_PRICE_*). Below the 30-day price grants 7-Day.
function planForAmount(amount: number): Plan {
  const lifetime = Number(process.env.KOFI_PRICE_LIFETIME ?? 39.99)
  const d90 = Number(process.env.KOFI_PRICE_90D ?? 24.99)
  const d30 = Number(process.env.KOFI_PRICE_30D ?? 14.99)
  if (amount >= lifetime) return 'lifetime'
  if (amount >= d90) return '90d'
  if (amount >= d30) return '30d'
  return '7d'
}

function planForPayment(payload: Record<string, unknown>): Plan {
  // Prefer the exact shop item(s); the highest tier in the cart wins.
  const items = Array.isArray(payload.shop_items) ? payload.shop_items : []
  const map = itemPlans()
  let best: Plan | null = null
  for (const item of items) {
    const code = (item as Record<string, unknown>)?.direct_link_code
    const plan = typeof code === 'string' ? map[code] : undefined
    if (plan && (!best || PLAN_RANK[plan] > PLAN_RANK[best])) best = plan
  }
  if (best) return best
  return planForAmount(Number(payload.amount ?? 0) || 0)
}

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
    const amount = Number(payload.amount ?? 0) || 0
    const plan = planForPayment(payload)
    grantKeyForEmail(email, `Ko-fi ${type}${from ? ` — ${from}` : ''} ($${amount})`, plan)
  }

  // Always 200 so Ko-fi doesn't retry forever on odd payloads.
  return Response.json({ ok: true })
}
