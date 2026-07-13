/**
 * Supporter keys, persisted to DATA_DIR/supporters.json.
 *
 * A valid (non-revoked) key unlocks supporter perks — no daily download limit
 * and no duration cap. Keys are generated/revoked by the operator from /admin.
 * File-backed and single-process, like the rate-limiter and DMCA store.
 */
import { randomBytes } from 'crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

export interface SupporterKey {
  code: string
  note: string
  ts: number
  revoked: boolean
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

export function createKey(note: string): SupporterKey {
  let code = generateCode()
  while (keys.some((k) => k.code === code)) code = generateCode()
  const key: SupporterKey = { code, note: note.slice(0, 200), ts: Date.now(), revoked: false }
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
  if (!code) return false
  const key = keys.find((k) => k.code === normalize(code))
  return !!key && !key.revoked
}
