'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Check, X, Loader2, ExternalLink, Copy, KeyRound, Plus } from 'lucide-react'

interface Report {
  id: string
  key: string
  url: string
  email: string
  reason: string
  ts: number
  status: 'pending' | 'approved' | 'rejected'
}

interface SupporterKey {
  code: string
  note: string
  ts: number
  revoked: boolean
  email?: string
  plan?: string
  expiresAt?: number | null
}

const PLAN_OPTIONS = [
  { value: '7d', label: '7-Day' },
  { value: '30d', label: '30-Day' },
  { value: '90d', label: '90-Day' },
  { value: 'lifetime', label: 'Lifetime' },
]

const TOKEN_KEY = 'stepbro-admin'

export function AdminReports() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [keys, setKeys] = useState<SupporterKey[]>([])
  const [note, setNote] = useState('')
  const [plan, setPlan] = useState('lifetime')
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (tk: string) => {
    setLoading(true)
    try {
      const auth = { Authorization: `Bearer ${tk}` }
      const [repRes, keyRes] = await Promise.all([
        fetch('/api/admin/reports', { headers: auth }),
        fetch('/api/admin/keys', { headers: auth }),
      ])
      const repData = await repRes.json().catch(() => ({}))
      if (!repRes.ok) throw new Error(repData.error || 'Failed to load')
      const keyData = await keyRes.json().catch(() => ({}))
      setReports(repData.reports ?? [])
      setKeys(keyData.keys ?? [])
      setToken(tk)
      setAuthed(true)
      sessionStorage.setItem(TOKEN_KEY, tk)
    } catch (err) {
      setAuthed(false)
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-unlock if a token was saved this session (deferred → no sync setState).
  useEffect(() => {
    const saved = sessionStorage.getItem(TOKEN_KEY)
    if (saved) load(saved)
  }, [load])

  async function act(id: string, action: 'approve' | 'reject') {
    const res = await fetch('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, action }),
    })
    if (res.ok) {
      toast.success(action === 'approve' ? 'Video blocked' : 'Report rejected')
      load(token)
    } else {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error || 'Action failed')
    }
  }

  async function keyAction(body: { action: string; note?: string; code?: string; plan?: string }) {
    const res = await fetch('/api/admin/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      toast.error(data.error || 'Action failed')
      return
    }
    if (body.action === 'create' && data.key?.code) {
      setNote('')
      toast.success(`Key created: ${data.key.code}`)
    }
    load(token)
  }

  function copyKey(code: string) {
    navigator.clipboard
      .writeText(code)
      .then(() => toast.success('Key copied'))
      .catch(() => toast.error('Clipboard blocked'))
  }

  if (!authed) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          load(token)
        }}
        className="space-y-3"
      >
        <p className="text-sm text-muted-foreground">
          Enter the admin token (the <code>ADMIN_TOKEN</code> env var) to review reports.
        </p>
        <div className="flex gap-2">
          <Input
            type="password"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Admin token"
            className="h-10 rounded-xl"
          />
          <Button type="submit" disabled={loading} className="h-10 shrink-0 gap-1.5 rounded-full px-5">
            {loading && <Loader2 className="size-4 animate-spin" />} Unlock
          </Button>
        </div>
      </form>
    )
  }

  const pending = reports.filter((r) => r.status === 'pending')
  const resolved = reports.filter((r) => r.status !== 'pending')

  function Row({ r }: { r: Report }) {
    return (
      <div className="rounded-2xl bg-muted/60 p-4 text-sm">
        <a
          href={r.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium break-all text-foreground hover:underline"
        >
          {r.url} <ExternalLink className="size-3 shrink-0" />
        </a>
        <div className="mt-1 text-xs text-muted-foreground">
          {r.email} · {new Date(r.ts).toLocaleString()} · <span className="uppercase">{r.status}</span>
        </div>
        {r.reason && <p className="mt-2 text-muted-foreground">{r.reason}</p>}
        {r.status === 'pending' && (
          <div className="mt-3 flex gap-2">
            <Button size="sm" className="h-8 gap-1.5 rounded-full" onClick={() => act(r.id, 'approve')}>
              <Check className="size-3.5" /> Approve &amp; block
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 rounded-full"
              onClick={() => act(r.id, 'reject')}
            >
              <X className="size-3.5" /> Reject
            </Button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="font-display text-lg font-semibold">Pending ({pending.length})</h2>
        <div className="mt-3 space-y-2">
          {pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing to review.</p>
          ) : (
            pending.map((r) => <Row key={r.id} r={r} />)
          )}
        </div>
      </section>

      {resolved.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold">Resolved ({resolved.length})</h2>
          <div className="mt-3 space-y-2">
            {resolved.map((r) => (
              <Row key={r.id} r={r} />
            ))}
          </div>
        </section>
      )}

      <section className="border-t border-border pt-6">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <KeyRound className="size-4" /> Supporter keys ({keys.length})
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          A valid key unlocks unlimited downloads and lifts the duration cap. Generate one per
          supporter and revoke it anytime.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            keyAction({ action: 'create', note, plan })
          }}
          className="mt-3 flex flex-wrap gap-2"
        >
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (e.g. Ko-fi — Juan)"
            className="h-9 min-w-40 flex-1 rounded-xl"
          />
          <select
            value={plan}
            onChange={(e) => setPlan(e.target.value)}
            className="h-9 rounded-xl border border-input bg-transparent px-2.5 text-sm outline-none"
          >
            {PLAN_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
          <Button type="submit" size="sm" className="h-9 shrink-0 gap-1.5 rounded-full px-4">
            <Plus className="size-3.5" /> Generate
          </Button>
        </form>

        <div className="mt-3 space-y-2">
          {keys.length === 0 ? (
            <p className="text-sm text-muted-foreground">No keys yet.</p>
          ) : (
            keys.map((k) => (
              <div
                key={k.code}
                className="flex flex-wrap items-center gap-2 rounded-2xl bg-muted/60 p-3 text-sm"
              >
                <code className={k.revoked ? 'font-mono line-through opacity-50' : 'font-mono'}>
                  {k.code}
                </code>
                <span className="text-xs text-muted-foreground">
                  {(k.plan ?? 'lifetime').toUpperCase()} ·{' '}
                  {k.email && <>{k.email} · </>}
                  {k.note && <>{k.note} · </>}
                  {new Date(k.ts).toLocaleDateString()}
                  {k.expiresAt != null &&
                    (k.expiresAt > Date.now()
                      ? ` · expires ${new Date(k.expiresAt).toLocaleDateString()}`
                      : ' · EXPIRED')}
                  {k.revoked && ' · REVOKED'}
                </span>
                <span className="ml-auto flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 rounded-full px-2.5 text-xs"
                    onClick={() => copyKey(k.code)}
                  >
                    <Copy className="size-3" /> Copy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 rounded-full px-2.5 text-xs"
                    onClick={() => keyAction({ action: k.revoked ? 'restore' : 'revoke', code: k.code })}
                  >
                    {k.revoked ? <Check className="size-3" /> : <X className="size-3" />}
                    {k.revoked ? 'Restore' : 'Revoke'}
                  </Button>
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
