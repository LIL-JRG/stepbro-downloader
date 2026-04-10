import { rm } from 'fs/promises'
import { dirname } from 'path'

interface TempEntry {
  filePath: string
  filename: string
  ttlTimeout: ReturnType<typeof setTimeout>
}

// Module-level map — lives for the lifetime of the Node.js process.
// Fine for single-instance self-hosted deployments.
const store = new Map<string, TempEntry>()

const TTL_MS = 15 * 60 * 1000 // 15 minutes to claim the file

async function deleteEntry(filePath: string) {
  try {
    await rm(dirname(filePath), { recursive: true, force: true })
  } catch { /* ignore */ }
}

export function registerTempFile(token: string, filePath: string, filename: string) {
  const ttlTimeout = setTimeout(() => {
    const entry = store.get(token)
    if (entry) {
      store.delete(token)
      deleteEntry(entry.filePath)
    }
  }, TTL_MS)

  store.set(token, { filePath, filename, ttlTimeout })
}

export function claimTempFile(token: string): { filePath: string; filename: string } | null {
  const entry = store.get(token)
  if (!entry) return null
  clearTimeout(entry.ttlTimeout)
  store.delete(token)
  return { filePath: entry.filePath, filename: entry.filename }
}
