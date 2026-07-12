/**
 * In-memory per-IP daily download limiter.
 *
 * The hosted instance acts as a SaaS, so downloads are capped per client IP per
 * (UTC) day. This is the server-side source of truth; the client only mirrors the
 * remaining count for display. Counters live in a module-level Map, so they reset
 * when the process restarts and assume a single app instance (fine for a typical
 * Dokploy deployment). For a multi-instance setup this would need a shared store
 * such as Redis.
 */

interface Entry {
  date: string // YYYY-MM-DD (UTC)
  count: number
}

const store = new Map<string, Entry>()

export const DAILY_LIMIT = Math.max(1, Number(process.env.DAILY_DOWNLOAD_LIMIT ?? 5))

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
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

/** Consume one slot if any remain. */
export function consumeLimit(ip: string): LimitStatus & { allowed: boolean } {
  const entry = current(ip)
  if (entry.count >= DAILY_LIMIT) {
    return { allowed: false, limit: DAILY_LIMIT, count: entry.count, remaining: 0 }
  }
  entry.count += 1
  return {
    allowed: true,
    limit: DAILY_LIMIT,
    count: entry.count,
    remaining: Math.max(0, DAILY_LIMIT - entry.count),
  }
}
