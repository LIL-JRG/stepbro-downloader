/**
 * Per-IP daily download limiter + lightweight /api/info throttle.
 *
 * The hosted instance acts as a SaaS. Download counts are capped per client IP
 * per (UTC) day and PERSISTED to a JSON file under DATA_DIR so they survive a
 * container restart (mount a volume at DATA_DIR to keep it across redeploys).
 * State is a single-process Map; a multi-instance setup would need a shared
 * store (Redis). The info throttle is in-memory only (short-lived by nature).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

interface Entry {
  date: string // YYYY-MM-DD (UTC)
  count: number
}

export const DAILY_LIMIT = Math.max(1, Number(process.env.DAILY_DOWNLOAD_LIMIT ?? 5))

/** Max allowed video duration in seconds (0 = unlimited). Anti-abuse guard. */
export const MAX_VIDEO_DURATION = Math.max(0, Number(process.env.MAX_VIDEO_DURATION ?? 10800))

const DATA_DIR = process.env.DATA_DIR || join(tmpdir(), 'stepbro')
const STORE_FILE = join(DATA_DIR, 'rate-limit.json')

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

const store = new Map<string, Entry>()

// Load persisted counters (today's only) once at module init.
try {
  const obj = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as Record<string, Entry>
  const today = todayUTC()
  for (const [ip, e] of Object.entries(obj)) {
    if (e && e.date === today && typeof e.count === 'number') store.set(ip, e)
  }
} catch {
  /* no file yet / unreadable — start fresh */
}

let saveScheduled = false
function persist() {
  // Coalesce writes to the next tick so bursts don't hammer the disk.
  if (saveScheduled) return
  saveScheduled = true
  queueMicrotask(() => {
    saveScheduled = false
    try {
      mkdirSync(DATA_DIR, { recursive: true })
      writeFileSync(STORE_FILE, JSON.stringify(Object.fromEntries(store)))
    } catch {
      /* best effort */
    }
  })
}

/** Best-effort client IP behind Traefik / a reverse proxy. */
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return req.headers.get('x-real-ip')?.trim() || 'unknown'
}

/** Return today's entry, resetting the counter when the day rolls over. */
function current(ip: string): Entry {
  const today = todayUTC()
  const existing = store.get(ip)
  if (!existing || existing.date !== today) {
    const fresh: Entry = { date: today, count: 0 }
    store.set(ip, fresh)
    return fresh
  }
  return existing
}

export interface LimitStatus {
  limit: number
  count: number
  remaining: number
}

/** Read the current status without consuming a slot. */
export function peekLimit(ip: string): LimitStatus {
  const entry = current(ip)
  return { limit: DAILY_LIMIT, count: entry.count, remaining: Math.max(0, DAILY_LIMIT - entry.count) }
}

/** Consume `n` slots if enough remain. */
export function consumeLimit(ip: string, n = 1): LimitStatus & { allowed: boolean } {
  const entry = current(ip)
  if (entry.count + n > DAILY_LIMIT) {
    return { allowed: false, limit: DAILY_LIMIT, count: entry.count, remaining: Math.max(0, DAILY_LIMIT - entry.count) }
  }
  entry.count += n
  persist()
  return {
    allowed: true,
    limit: DAILY_LIMIT,
    count: entry.count,
    remaining: Math.max(0, DAILY_LIMIT - entry.count),
  }
}

// ── /api/info throttle (in-memory sliding window) ────────────────────────────
const INFO_WINDOW_MS = 60_000
const INFO_MAX = Math.max(1, Number(process.env.INFO_RATE_PER_MIN ?? 30))
const infoHits = new Map<string, { start: number; count: number }>()

/** Returns false when the IP has exceeded the per-minute /api/info budget. */
export function allowInfoRequest(ip: string): boolean {
  const now = Date.now()
  const hit = infoHits.get(ip)
  if (!hit || now - hit.start > INFO_WINDOW_MS) {
    infoHits.set(ip, { start: now, count: 1 })
    return true
  }
  hit.count += 1
  return hit.count <= INFO_MAX
}
