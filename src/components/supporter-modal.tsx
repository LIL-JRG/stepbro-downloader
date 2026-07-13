'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { Star, X, Check, Minus, Loader2, Copy, Heart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/provider'
import { playCue } from '@/lib/sound'

interface SupporterWidgetProps {
  supporter: boolean
  supporterKey: string | null
  /** Active plan details (from /api/limit) for the status view. */
  plan?: string | null
  expiresAt?: number | null
  donateUrl: string
  /** Free-tier numbers shown in the comparison table. */
  freeLimit: number
  maxDuration: number
  onApply: (key: string) => void
  onRemove: () => void
}

type View = 'plans' | 'activate' | 'key'

// Ko-fi-style supporter flow: a navbar widget opening a modal with a Free vs
// Supporter comparison, a "pay on Ko-fi then activate with your payment email"
// view, and a license-key entry/recovery view.
export function SupporterWidget(props: SupporterWidgetProps) {
  const { m } = useI18n()
  const [open, setOpen] = useState(false)
  const [hovered, setHovered] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  // Donate-style amber pill with the amicro icon-swap on hover (star → heart);
  // turns emerald once the supporter license is active.
  const Icon = props.supporter ? Star : hovered ? Heart : Star
  return (
    <>
      <motion.button
        type="button"
        onHoverStart={() => setHovered(true)}
        onHoverEnd={() => setHovered(false)}
        whileTap={{ scale: 0.96 }}
        onClick={() => {
          playCue('bloom')
          setOpen(true)
        }}
        className={cn(
          'inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors',
          props.supporter
            ? 'bg-emerald-400/90 text-emerald-950 hover:bg-emerald-300'
            : 'bg-amber-400 text-amber-950 hover:bg-amber-300'
        )}
      >
        <span className="grid size-3.5 place-items-center">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={Icon === Heart ? 'heart' : 'star'}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ type: 'spring', stiffness: 600, damping: 25 }}
            >
              <Icon className={cn('size-3.5', props.supporter && 'fill-current')} />
            </motion.span>
          </AnimatePresence>
        </span>
        <span className="hidden sm:inline">{m.supporter.widget}</span>
      </motion.button>

      <AnimatePresence>
        {open && <SupporterModal {...props} onClose={() => setOpen(false)} />}
      </AnimatePresence>
    </>
  )
}

function SupporterModal({
  supporter,
  supporterKey,
  plan,
  expiresAt,
  donateUrl,
  freeLimit,
  maxDuration,
  onApply,
  onRemove,
  onClose,
}: SupporterWidgetProps & { onClose: () => void }) {
  const { m } = useI18n()
  const [view, setView] = useState<View>('plans')
  const [email, setEmail] = useState('')
  const [keyInput, setKeyInput] = useState('')
  const [busy, setBusy] = useState(false)

  async function lookupEmail(value: string) {
    const res = await fetch('/api/supporter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: value }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.key) throw new Error(data.error || m.supporter.invalid)
    return data.key as string
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault()
    if (busy || !email.trim()) return
    setBusy(true)
    try {
      const key = await lookupEmail(email.trim())
      playCue('sparkle')
      onApply(key)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  async function submitKey(e: React.FormEvent) {
    e.preventDefault()
    const value = keyInput.trim()
    if (busy || !value) return
    setBusy(true)
    try {
      if (value.includes('@')) {
        const key = await lookupEmail(value)
        playCue('sparkle')
        onApply(key)
        return
      }
      const res = await fetch('/api/supporter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: value }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.valid) throw new Error(m.supporter.invalid)
      playCue('sparkle')
      onApply(value)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  function copyKey() {
    if (!supporterKey) return
    navigator.clipboard
      .writeText(supporterKey)
      .then(() => {
        playCue('tick')
        toast.success(m.result.copied)
      })
      .catch(() => {})
  }

  const hours = maxDuration > 0 ? Math.floor(maxDuration / 3600) : 0

  const rows: { label: string; free: React.ReactNode; sup: React.ReactNode }[] = [
    { label: m.supporter.fQuality, free: <Yes />, sup: <Yes /> },
    { label: m.supporter.fExtras, free: <Yes />, sup: <Yes /> },
    {
      label: m.supporter.fDaily,
      free: <span className="text-xs">{m.supporter.fDailyFree.replace('{limit}', String(freeLimit))}</span>,
      sup: <span className="text-xs font-semibold">{m.supporter.unlimited}</span>,
    },
    ...(hours > 0
      ? [{ label: m.supporter.fLength.replace('{hours}', String(hours)), free: <No />, sup: <Yes /> }]
      : []),
    { label: m.supporter.fSupport, free: <No />, sup: <Yes /> },
  ]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ type: 'spring', stiffness: 400, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-3xl bg-card p-6 text-card-foreground shadow-2xl shadow-black/30 ring-1 ring-black/5 dark:ring-white/10"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="font-display text-xl font-bold tracking-tight">
            {supporter
              ? m.supporter.activeTitle
              : view === 'activate'
                ? m.supporter.activateTitle
                : view === 'key'
                  ? m.supporter.keyTitle
                  : m.supporter.becomeTitle}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={m.supporter.close}
            className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-4" />
          </button>
        </div>

        {supporter ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">{m.supporter.activeText}</p>
            <p className="text-sm font-medium">
              {plan === '7d'
                ? m.supporter.plan7d
                : plan === '30d'
                  ? m.supporter.plan30d
                  : plan === '90d'
                    ? m.supporter.plan90d
                    : m.supporter.planLifetime}
              {expiresAt != null && (
                <span className="ml-2 font-normal text-muted-foreground">
                  {m.supporter.expires.replace('{date}', new Date(expiresAt).toLocaleDateString())}
                </span>
              )}
            </p>
            {supporterKey && (
              <div>
                <p className="text-xs text-muted-foreground">{m.supporter.yourKey}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="rounded-lg bg-muted px-3 py-1.5 font-mono text-sm">{supporterKey}</code>
                  <Button variant="outline" size="sm" className="h-8 gap-1 rounded-full" onClick={copyKey}>
                    <Copy className="size-3" /> {m.supporter.copy}
                  </Button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={onRemove}
              className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            >
              {m.supporter.remove}
            </button>
          </div>
        ) : view === 'plans' ? (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">{m.supporter.becomeSubtitle}</p>

            <div className="overflow-hidden rounded-2xl bg-muted/60 text-sm">
              <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 px-4 py-2 text-xs font-semibold text-muted-foreground">
                <span />
                <span className="w-14 text-center">{m.supporter.free}</span>
                <span className="w-16 text-center text-foreground">{m.supporter.widget}</span>
              </div>
              {rows.map((r, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t border-border/60 px-4 py-2.5"
                >
                  <span className="text-xs leading-snug">{r.label}</span>
                  <span className="grid w-14 place-items-center">{r.free}</span>
                  <span className="grid w-16 place-items-center">{r.sup}</span>
                </div>
              ))}
            </div>

            <a
              href={donateUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setView('activate')}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-full bg-amber-400 font-semibold text-amber-950 transition-colors hover:bg-amber-300"
            >
              <Heart className="size-4" /> {m.supporter.become}
            </a>

            <p className="text-center text-[11px] text-muted-foreground">{m.supporter.tiers}</p>

            <p className="text-center text-xs">
              <button
                type="button"
                onClick={() => setView('key')}
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                {m.supporter.alreadyKey}
              </button>
            </p>
          </div>
        ) : view === 'activate' ? (
          <form onSubmit={activate} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">{m.supporter.activateText}</p>
            <Input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={m.supporter.emailPlaceholder}
              autoFocus
              className="h-11 rounded-xl"
            />
            <Button type="submit" disabled={busy || !email.trim()} className="h-11 w-full gap-2 rounded-full font-semibold">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {m.supporter.activate}
            </Button>
            <p className="text-center text-xs text-muted-foreground">{m.supporter.justPaid}</p>
            <p className="text-center text-xs">
              <button
                type="button"
                onClick={() => setView('key')}
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                {m.supporter.alreadyKey}
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={submitKey} className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">{m.supporter.keyText}</p>
            <Input
              required
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              placeholder={m.supporter.keyPlaceholder}
              autoFocus
              className="h-11 rounded-xl font-mono text-sm"
            />
            <Button type="submit" disabled={busy || !keyInput.trim()} className="h-11 w-full gap-2 rounded-full font-semibold">
              {busy && <Loader2 className="size-4 animate-spin" />}
              {m.supporter.submit}
            </Button>
            <p className="text-center text-xs">
              <button
                type="button"
                onClick={() => setView('plans')}
                className="text-muted-foreground underline-offset-2 hover:underline"
              >
                {m.supporter.becomeTitle}
              </button>
            </p>
          </form>
        )}
      </motion.div>
    </motion.div>
  )
}

function Yes() {
  return <Check className="size-4 text-emerald-500" />
}
function No() {
  return <Minus className="size-4 text-muted-foreground/50" />
}
