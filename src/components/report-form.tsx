'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Tap } from '@/components/ui/tap'
import { toast } from 'sonner'
import { CheckCircle2, Loader2, ShieldAlert } from 'lucide-react'

export function ReportForm() {
  const [url, setUrl] = useState('')
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, email, reason }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not submit the report')
      setDone(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <CheckCircle2 className="size-10 text-emerald-500" />
        <p className="font-medium text-foreground">Report received</p>
        <p className="max-w-md text-sm text-muted-foreground">
          Thanks — this video has been blocked from further downloads through the Service. We may
          email you if we need clarification or to handle a counter-notice.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <p className="flex items-start gap-2 rounded-2xl bg-muted/70 px-4 py-3 text-sm text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        Are you the rights holder of a video being downloaded through our site? Submit the URL below
        and it will be blocked from further downloads.
      </p>

      <div className="space-y-1.5">
        <label htmlFor="dmca-url" className="text-sm font-medium text-foreground">
          Video URL
        </label>
        <Input
          id="dmca-url"
          required
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          className="h-11 rounded-xl"
        />
        <p className="text-xs text-muted-foreground">Paste the full video link.</p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dmca-email" className="text-sm font-medium text-foreground">
          Your email
        </label>
        <Input
          id="dmca-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="h-11 rounded-xl"
        />
        <p className="text-xs text-muted-foreground">
          We may contact you for clarification or counter-notice handling.
        </p>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="dmca-reason" className="text-sm font-medium text-foreground">
          Reason
        </label>
        <textarea
          id="dmca-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          placeholder="Briefly describe your claim (optional)."
          className="w-full rounded-xl border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </div>

      <Tap>
        <Button type="submit" disabled={submitting} className="h-11 gap-2 rounded-full px-6 font-semibold">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          Submit report
        </Button>
      </Tap>
    </form>
  )
}
