/**
 * Supporter keys, persisted to DATA_DIR/supporters.json.
 *
 * A valid (non-revoked, non-expired) key unlocks supporter perks — no daily
 * download limit and no duration cap. Plans: 7-day, 30-day, 90-day, or lifetime.
 * Keys are generated/revoked by the operator from /admin, or granted
 * automatically by the Ko-fi payment webhook. File-backed and single-process,
 * like the rate-limiter and DMCA store.
 */
import { randomBytes } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export type Plan = '7d' | '30d' | '90d' | 'lifetime'

export const PLANS: Plan[] = ['7d', '30d', '90d', 'lifetime']

const PLAN_DAYS: Record<Exclude<Plan, 'lifetime'>, number> = { '7d': 7, '30d': 30, '90d': 90 }

export interface SupporterKey {
  code: string
  note: string
  ts: number
  revoked: boolean
  /** Payment email (set for keys granted via the Ko-fi webhook). */
  email?: string
  /** Missing on keys created before plans existed — treated as lifetime. */
  plan?: Plan
  /** Epoch ms; null/undefined = never expires (lifetime, or not yet activated). */
  expiresAt?: number | null
  /** Timed key whose countdown starts on first use instead of at creation. */
  pendingActivation?: boolean
  /** When the countdown actually started (first use). */
  activatedAt?: number | null
}

const DATA_DIR = process.env.DATA_DIR || join(tmpdir(), 'stepbro')
const FILE = join(DATA_DIR, 'supporters.json')

let keys: SupporterKey[] = []
try {
  const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as { keys?: SupporterKey[] }
  if (Array.isArray(parsed.keys)) keys = parsed.keys
} catch {
  /* no file yet */
}

function persist(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify({ keys }))
  } catch {
    /* best effort */
  }
}

// Unambiguous alphabet (no O/0, I/1/L) so keys survive being read aloud.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

function generateCode(): string {
  const bytes = randomBytes(12)
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length])
  return `SB-${chars.slice(0, 4).join('')}-${chars.slice(4, 8).join('')}-${chars.slice(8, 12).join('')}`
}

function normalize(code: string): string {
  return code.trim().toUpperCase()
}

function isActive(key: SupporterKey): boolean {
  if (key.revoked) return false
  return key.expiresAt == null || key.expiresAt > Date.now()
}

function expiryFor(plan: Plan, from = Date.now()): number | null {
  return plan === 'lifetime' ? null : from + PLAN_DAYS[plan] * 86_400_000
}

export function createKey(note: string, plan: Plan = 'lifetime', startOnUse = false): SupporterKey {
  let code = generateCode()
  while (keys.some((k) => k.code === code)) code = generateCode()
  const pending = startOnUse && plan !== 'lifetime'
  const key: SupporterKey = {
    code,
    note: note.slice(0, 200),
    ts: Date.now(),
    revoked: false,
    plan,
    // Pending keys hold their countdown until first use.
    expiresAt: pending ? null : expiryFor(plan),
    pendingActivation: pending,
    activatedAt: pending ? null : Date.now(),
  }
  keys.push(key)
  persist()
  return key
}

export function listKeys(): SupporterKey[] {
  return [...keys].sort((a, b) => b.ts - a.ts)
}

export function setKeyRevoked(code: string, revoked: boolean): boolean {
  const key = keys.find((k) => k.code === normalize(code))
  if (!key) return false
  key.revoked = revoked
  persist()
  return true
}

export function isValidKey(code: string | null | undefined): boolean {
  return !!getKeyInfo(code)
}

/**
 * The key record when the code is valid (active + not expired), else null.
 * First use of a pending key activates it — the plan countdown starts here.
 */
export function getKeyInfo(code: string | null | undefined): SupporterKey | null {
  if (!code) return null
  const key = keys.find((k) => k.code === normalize(code))
  if (!key || key.revoked) return null
  if (key.pendingActivation) {
    key.pendingActivation = false
    key.activatedAt = Date.now()
    key.expiresAt = expiryFor(key.plan ?? 'lifetime')
    persist()
    return key
  }
  return isActive(key) ? key : null
}

/** Active key for a payment email (used for activation and key recovery). */
export function findKeyByEmail(email: string): SupporterKey | null {
  const needle = email.trim().toLowerCase()
  if (!needle) return null
  return keys.find((k) => isActive(k) && k.email?.toLowerCase() === needle) ?? null
}

const PLAN_RANK: Record<Plan, number> = { '7d': 1, '30d': 2, '90d': 3, lifetime: 4 }

/**
 * Grant a plan to a payment email (Ko-fi webhook). New timed licenses are
 * granted pending — the countdown starts when the buyer first activates, not at
 * payment. Idempotent and renewal-friendly: an existing key is upgraded
 * (lifetime wins; a pending key keeps the highest-ranked plan) or extended
 * (running timed plans stack on top of the current expiry).
 */
export function grantKeyForEmail(email: string, note: string, plan: Plan = 'lifetime'): SupporterKey {
  const existing = findKeyByEmail(email)
  if (existing) {
    if (plan === 'lifetime') {
      existing.plan = 'lifetime'
      existing.expiresAt = null
      existing.pendingActivation = false
    } else if (existing.pendingActivation) {
      if (PLAN_RANK[plan] > PLAN_RANK[existing.plan ?? '7d']) existing.plan = plan
    } else if (existing.expiresAt != null) {
      existing.plan = plan
      existing.expiresAt = expiryFor(plan, Math.max(Date.now(), existing.expiresAt))
    }
    // lifetime existing + timed payment → keep lifetime.
    persist()
    return existing
  }
  const key = createKey(note, plan, true)
  key.email = email.trim().toLowerCase()
  persist()
  return key
}
