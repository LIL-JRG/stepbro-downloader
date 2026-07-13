/**
 * DMCA reports + blocklist, persisted to DATA_DIR/dmca.json.
 *
 * Reports are NOT auto-blocking: a submission is queued as `pending` and only
 * blocks the video once an operator approves it from the admin review page. This
 * prevents anyone from taking down arbitrary videos. The effective blocklist is
 * always derived from approved reports. File-backed and single-process, like the
 * rate-limiter (mount a volume at DATA_DIR to persist across redeploys).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { v4 as uuid } from 'uuid'

export type ReportStatus = 'pending' | 'approved' | 'rejected'

export interface Report {
  id: string
  key: string
  url: string
  email: string
  reason: string
  ts: number
  status: ReportStatus
}

const DATA_DIR = process.env.DATA_DIR || join(tmpdir(), 'stepbro')
const FILE = join(DATA_DIR, 'dmca.json')

let reports: Report[] = []
try {
  const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as { reports?: Report[] }
  if (Array.isArray(parsed.reports)) reports = parsed.reports
} catch {
  /* no file yet */
}

// Effective blocklist is derived from approved reports only.
let blocked = new Set(reports.filter((r) => r.status === 'approved').map((r) => r.key))

function persist(): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify({ blocked: [...blocked], reports }))
  } catch {
    /* best effort */
  }
}

function rebuildBlocked(): void {
  blocked = new Set(reports.filter((r) => r.status === 'approved').map((r) => r.key))
}

/** Normalise a URL to a stable key — the YouTube video id when present. */
export function videoKey(url: string): string {
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/shorts\/|\/embed\/|\/live\/)([A-Za-z0-9_-]{11})/)
  if (m) return `yt:${m[1]}`
  return url.trim().replace(/[?#].*$/, '').toLowerCase()
}

export function isBlocked(url: string): boolean {
  return blocked.has(videoKey(url))
}

/** Queue a report for review. Deduplicates against an existing open report. */
export function addReport(input: { url: string; email: string; reason: string }): Report {
  const key = videoKey(input.url)
  const open = reports.find((r) => r.key === key && r.status !== 'rejected')
  if (open) return open
  const report: Report = {
    id: uuid(),
    key,
    url: input.url,
    email: input.email,
    reason: input.reason,
    ts: Date.now(),
    status: 'pending',
  }
  reports.push(report)
  persist()
  return report
}

export function listReports(): Report[] {
  return [...reports].sort((a, b) => b.ts - a.ts)
}

/** Approve or reject a report; the blocklist is recomputed from approvals. */
export function setReportStatus(id: string, status: ReportStatus): boolean {
  const report = reports.find((r) => r.id === id)
  if (!report) return false
  report.status = status
  rebuildBlocked()
  persist()
  return true
}
