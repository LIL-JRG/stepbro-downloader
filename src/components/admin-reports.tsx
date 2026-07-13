'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Check, X, Loader2, ExternalLink } from 'lucide-react'

interface Report {
  id: string
  key: string
  url: string
  email: string
  reason: string
  ts: number
  status: 'pending' | 'approved' | 'rejected'
}

const TOKEN_KEY = 'stepbro-admin'

export function AdminReports() {
  const [token, setToken] = useState('')
  const [authed, setAuthed] = useState(false)
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(false)

  const load = useCallback(async (tk: string) => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/reports', { headers: { Authorization: `Bearer ${tk}` } })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setReports(data.reports ?? [])
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
    </div>
  )
}
