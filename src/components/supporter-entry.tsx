'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Loader2, KeyRound } from 'lucide-react'
import { useI18n } from '@/i18n/provider'
import { playCue } from '@/lib/sound'

interface SupporterEntryProps {
  /** Called with the key once the server confirms it's valid. */
  onApply: (key: string) => void
}

// Collapsed "Have a supporter key?" link that expands into a small key form.
export function SupporterEntry({ onApply }: SupporterEntryProps) {
  const { m } = useI18n()
  const [open, setOpen] = useState(false)
  const [key, setKey] = useState('')
  const [checking, setChecking] = useState(false)

  async function apply(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = key.trim()
    if (!trimmed || checking) return
    setChecking(true)
    try {
      const res = await fetch('/api/supporter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trimmed }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || m.supporter.invalid)
      if (!data.valid) throw new Error(m.supporter.invalid)
      playCue('sparkle')
      onApply(trimmed)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setChecking(false)
    }
  }

  if (!open) {
    return (
      <p className="mt-2.5 text-center text-xs">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          <KeyRound className="size-3" /> {m.supporter.have}
        </button>
      </p>
    )
  }

  return (
    <form onSubmit={apply} className="mx-auto mt-2.5 flex max-w-xs items-center gap-2">
      <Input
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder={m.supporter.placeholder}
        autoFocus
        className="h-8 rounded-full px-3 font-mono text-xs uppercase"
      />
      <Button type="submit" size="sm" disabled={checking || !key.trim()} className="h-8 shrink-0 rounded-full px-4">
        {checking ? <Loader2 className="size-3.5 animate-spin" /> : m.supporter.apply}
      </Button>
    </form>
  )
}
