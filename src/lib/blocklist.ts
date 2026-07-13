/**
 * DMCA blocklist + report log, persisted to DATA_DIR/dmca.json.
 *
 * When a rights holder submits a report, the video's key is added to the blocklist
 * and further /api/info and /api/download requests for it are refused. Single
 * process + file-backed (mount a volume at DATA_DIR to keep it across redeploys),
 * consistent with the rate-limiter.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

interface Report {
  key: string
  url: string
  email: string
  reason: string
  ts: number
}

interface Store {
  blocked: string[]
  reports: Report[]
}

const DATA_DIR = process.env.DATA_DIR || join(tmpdir(), 'stepbro')
const FILE = join(DATA_DIR, 'dmca.json')

const store: Store = { blocked: [], reports: [] }
try {
  const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Store>
  if (Array.isArray(parsed.blocked)) store.blocked = parsed.blocked
  if (Array.isArray(parsed.reports)) store.reports = parsed.reports
} catch {
  /* no file yet */
}

const blocked = new Set(store.blocked)

/** Normalise a URL to a stable key — the YouTube video id when present. */
export function videoKey(url: string): string {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/)
  if (m) return `yt:${m[1]}`
  return url.trim().replace(/[?#].*$/, '').toLowerCase()
}

export function isBlocked(url: string): boolean {
  return blocked.has(videoKey(url))
}

export function addReport(input: { url: string; email: string; reason: string }): void {
  const key = videoKey(input.url)
  blocked.add(key)
  store.reports.push({ key, url: input.url, email: input.email, reason: input.reason, ts: Date.now() })
  store.blocked = [...blocked]
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(store))
  } catch {
    /* best effort */
  }
}
