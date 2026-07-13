'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { VideoInfo, type VideoData } from '@/components/downloader/VideoInfo'
import { DownloadForm, type DownloadConfig } from '@/components/downloader/DownloadForm'
import { ResultPanel } from '@/components/downloader/ResultPanel'
import { InfoSections } from '@/components/InfoSections'
import { LanguageSelector } from '@/components/language-selector'
import { SupporterEntry } from '@/components/supporter-entry'
import { SupporterWidget } from '@/components/supporter-modal'
import { useI18n } from '@/i18n/provider'
import { initSound, playCue } from '@/lib/sound'
import { Loader2, Clipboard, Check, Flag, Film, Music, Zap } from 'lucide-react'

// Ko-fi shop items, one per license tier (prices shown in the Supporter modal).
const SUPPORT_TIERS = [
  { plan: '7d', price: '$9.99', url: 'https://ko-fi.com/s/6256f77fd5' },
  { plan: '30d', price: '$14.99', url: 'https://ko-fi.com/s/1b20036466' },
  { plan: '90d', price: '$24.99', url: 'https://ko-fi.com/s/b1c568c4bb' },
  { plan: 'lifetime', price: '$39.99', url: 'https://ko-fi.com/s/f30c359628' },
] as const
const CONSENT_KEY = 'stepbro-consent'
const SUPPORTER_KEY = 'stepbro-key'
// Last-known supporter status, cached so a reload renders as supporter instantly
// instead of flashing the free UI until /api/limit responds.
const SUPPORTER_CACHE = 'stepbro-supporter'

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(s.trim())
}

export default function Home() {
  const { m } = useI18n()
  const [url, setUrl] = useState('')
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [agreed, setAgreed] = useState(true)
  const [usage, setUsage] = useState<{ limit: number; remaining: number } | null>(null)
  const [maxDuration, setMaxDuration] = useState(0)
  const [progress, setProgress] = useState<{ percent: number; speed?: string; eta?: string } | null>(null)
  const [result, setResult] = useState<{ token: string; filename: string } | null>(null)
  const [supporterKey, setSupporterKey] = useState<string | null>(null)
  const [supporter, setSupporter] = useState(false)
  const [supporterInfo, setSupporterInfo] = useState<{ plan?: string; expiresAt?: number | null }>({})
  const [supporterOpen, setSupporterOpen] = useState(false)
  const downloadAbort = useRef<AbortController | null>(null)

  // Load interaction sounds (cuelume) once on the client.
  useEffect(() => {
    initSound()
  }, [])

  // Restore a saved supporter key and, if we cached a valid status last time,
  // render as supporter immediately (deferred → hydration-safe). /api/limit
  // below then reconciles with the server, so a revoked/expired key still gets
  // corrected — we just avoid the free-UI flash on every reload.
  useEffect(() => {
    const stored = localStorage.getItem(SUPPORTER_KEY)
    if (!stored) return
    let cache: { plan?: string; expiresAt?: number | null } | null = null
    try {
      cache = JSON.parse(localStorage.getItem(SUPPORTER_CACHE) || 'null')
    } catch {
      /* ignore */
    }
    queueMicrotask(() => {
      setSupporterKey(stored)
      if (cache) {
        setSupporter(true)
        setSupporterInfo({ plan: cache.plan, expiresAt: cache.expiresAt ?? null })
        setMaxDuration(0)
      }
    })
  }, [])

  function applySupporterKey(key: string | null) {
    setSupporterKey(key)
    setSupporter(false) // /api/limit below confirms the perks server-side
    if (key) {
      localStorage.setItem(SUPPORTER_KEY, key)
    } else {
      localStorage.removeItem(SUPPORTER_KEY)
      localStorage.removeItem(SUPPORTER_CACHE)
    }
  }

  // Fetch the current daily download allowance (server is the source of truth).
  // A valid supporter key flips the response to unlimited.
  useEffect(() => {
    let active = true
    fetch('/api/limit', {
      headers: supporterKey ? { 'x-supporter-key': supporterKey } : undefined,
    })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return
        if (d?.supporter) {
          setSupporter(true)
          setSupporterInfo({ plan: d.plan, expiresAt: d.expiresAt ?? null })
          setUsage(null)
          setMaxDuration(0)
          localStorage.setItem(
            SUPPORTER_CACHE,
            JSON.stringify({ plan: d.plan, expiresAt: d.expiresAt ?? null })
          )
        } else if (typeof d?.limit === 'number') {
          setSupporter(false)
          setUsage({ limit: d.limit, remaining: d.remaining })
          setMaxDuration(typeof d.maxDuration === 'number' ? d.maxDuration : 0)
          // The key we sent (if any) is no longer valid — drop the optimistic cache.
          if (supporterKey) localStorage.removeItem(SUPPORTER_CACHE)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [supporterKey])

  // Remember the copyright consent across visits (deferred restore for hydration
  // safety + to avoid a synchronous setState in the effect body).
  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY)
    if (stored !== null) queueMicrotask(() => setAgreed(stored === 'true'))
  }, [])

  function toggleAgreed() {
    const next = !agreed
    setAgreed(next)
    localStorage.setItem(CONSENT_KEY, String(next))
  }

  // Auto-fetch a preview once the URL looks valid — no explicit "Fetch" step.
  // All state updates happen inside the deferred timer (never synchronously in the
  // effect body) so a fresh keystroke cancels the previous request cleanly.
  useEffect(() => {
    const trimmed = url.trim()
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      if (!looksLikeUrl(trimmed)) {
        setVideoData(null)
        setIsFetching(false)
        return
      }
      setIsFetching(true)
      try {
        const res = await fetch('/api/info', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
          signal: controller.signal,
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Could not load video')
        setVideoData(data)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') setVideoData(null)
      } finally {
        setIsFetching(false)
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [url])

  // Download uses the canonical webpage_url when we have a preview, else the raw input.
  const targetUrl = videoData?.webpage_url ?? url.trim()
  const tooLong = maxDuration > 0 && !!videoData?.duration && videoData.duration > maxDuration

  function cancelDownload() {
    downloadAbort.current?.abort()
    downloadAbort.current = null
    setIsDownloading(false)
    setProgress(null)
  }

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch {
      toast.error(m.toast.clipboard)
    }
  }

  function handleDownload(config: DownloadConfig) {
    if (isDownloading) return
    if (!agreed) {
      toast.error(m.toast.needConsent)
      return
    }
    if (!config.url) {
      toast.error(m.toast.needUrl)
      return
    }
    if (!supporter && usage && usage.remaining <= 0) {
      toast.error(m.toast.limit)
      return
    }
    setIsDownloading(true)
    setResult(null)
    setProgress({ percent: 0 })
    playCue('press')
    const controller = new AbortController()
    downloadAbort.current = controller

    fetch('/api/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(supporterKey ? { 'x-supporter-key': supporterKey } : {}),
      },
      body: JSON.stringify(config),
      signal: controller.signal,
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({})) as { error?: string; limit?: number; remaining?: number }
        if (res.status === 429 && typeof data.limit === 'number') {
          setUsage({ limit: data.limit, remaining: data.remaining ?? 0 })
        }
        throw new Error(data.error || m.toast.failed)
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data: ')) continue
          try {
            const event = JSON.parse(line.slice(6)) as {
              type: string
              token?: string
              filename?: string
              message?: string
              remaining?: number
              limit?: number
              percent?: number
              speed?: string
              eta?: string
            }
            if (event.type === 'progress' && typeof event.percent === 'number') {
              setProgress({ percent: event.percent, speed: event.speed, eta: event.eta })
            } else if (event.type === 'ready' && event.token) {
              // Show the result panel with save/thumbnail/subtitle actions
              // (no auto-download — the user picks what to save).
              setResult({ token: event.token, filename: event.filename ?? 'download' })
              if (typeof event.remaining === 'number' && typeof event.limit === 'number') {
                setUsage({ limit: event.limit, remaining: event.remaining })
              }
              toast.success(m.result.ready)
              playCue('success')
              setProgress(null)
              downloadAbort.current = null
              setIsDownloading(false)
            } else if (event.type === 'failed') {
              toast.error(event.message ?? m.toast.failed)
              playCue('droplet')
              setProgress(null)
              downloadAbort.current = null
              setIsDownloading(false)
            }
          } catch { /* ignore parse errors */ }
        }
      }
    }).catch((err) => {
      // User-initiated cancel — reset quietly.
      if ((err as Error).name === 'AbortError') {
        setProgress(null)
        setIsDownloading(false)
        return
      }
      toast.error(err instanceof Error ? err.message : String(err))
      setProgress(null)
      setIsDownloading(false)
    })
  }

  return (
    <div className="flex min-h-svh flex-col bg-page">
      <header className="px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2">
          <span className="font-display text-lg font-bold tracking-tight text-white">
            stepbro downloader
          </span>
          <div className="flex items-center gap-2 text-white">
            <SupporterWidget
              supporter={supporter}
              supporterKey={supporterKey}
              plan={supporterInfo.plan}
              expiresAt={supporterInfo.expiresAt}
              tiers={[...SUPPORT_TIERS]}
              freeLimit={usage?.limit ?? 5}
              maxDuration={supporter ? 3600 : maxDuration}
              onApply={applySupporterKey}
              onRemove={() => applySupporterKey(null)}
              open={supporterOpen}
              onOpenChange={setSupporterOpen}
            />
            <LanguageSelector />
            <ThemeToggle className="text-white hover:bg-white/20 hover:text-white" />
          </div>
        </div>
      </header>

      <main className="flex-1 px-4 pb-16">
        <div className="mx-auto w-full max-w-2xl pt-6 sm:pt-12">
          {/* Main converter card */}
          <div className="rounded-3xl bg-card p-5 shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/10 sm:p-7">
            <div className="mb-5 space-y-1.5 text-center">
              <h1 className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-3xl">
                {m.hero.title}
              </h1>
              <p className="text-sm text-muted-foreground">
                {m.hero.subtitle}
              </p>
            </div>

            {/* URL input with a paste button */}
            <div className="relative">
              <Input
                placeholder={m.hero.placeholder}
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value)
                  setResult(null)
                }}
                className="h-12 rounded-full border-transparent bg-muted pr-12 pl-5 text-base shadow-inner focus-visible:bg-background"
                autoFocus
              />
              <button
                type="button"
                onClick={pasteFromClipboard}
                aria-label={m.hero.paste}
                className="absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
              >
                <Clipboard className="size-4" />
              </button>
            </div>

            <div className="mt-3">
              <DownloadForm
                targetUrl={targetUrl}
                onDownload={handleDownload}
                isDownloading={isDownloading}
                blocked={!agreed || (!supporter && (tooLong || (usage !== null && usage.remaining <= 0)))}
                supporter={supporter}
                onUpsell={() => setSupporterOpen(true)}
              />

              {isDownloading ? (
                <div className="mt-3 space-y-2">
                  <Progress value={progress?.percent ?? 0} />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {progress && progress.percent < 100
                        ? `${Math.round(progress.percent)}%` +
                          (progress.speed ? ` · ${progress.speed}` : '') +
                          (progress.eta ? ` · ETA ${progress.eta}` : '')
                        : m.progress.processing}
                    </span>
                    <button
                      type="button"
                      onClick={cancelDownload}
                      className="font-medium text-foreground hover:underline"
                    >
                      {m.form.cancel}
                    </button>
                  </div>
                </div>
              ) : supporter ? (
                <p className="mt-2.5 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  ★ {m.supporter.active}
                  <button
                    type="button"
                    onClick={() => applySupporterKey(null)}
                    className="ml-2 font-normal text-muted-foreground underline-offset-2 hover:underline"
                  >
                    {m.supporter.remove}
                  </button>
                </p>
              ) : tooLong ? (
                <p className="mt-2.5 text-center text-xs font-medium text-destructive">
                  {m.usage.tooLong.replace('{hours}', String(Math.floor(maxDuration / 3600)))}
                </p>
              ) : usage ? (
                <p
                  className={cn(
                    'mt-2.5 text-center text-xs',
                    usage.remaining <= 0 ? 'font-medium text-destructive' : 'text-muted-foreground'
                  )}
                >
                  {usage.remaining > 0
                    ? m.usage.left
                        .replace('{remaining}', String(usage.remaining))
                        .replace('{limit}', String(usage.limit))
                    : m.usage.reached}
                </p>
              ) : null}

              {!supporter && !isDownloading && <SupporterEntry onApply={applySupporterKey} />}
            </div>

            {/* Disclaimer */}
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-muted/70 px-4 py-3">
              <button
                type="button"
                onClick={toggleAgreed}
                aria-pressed={agreed}
                aria-label={m.disclaimer.agree}
                className={cn(
                  'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors',
                  agreed ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
                )}
              >
                {agreed && <Check className="size-3" />}
              </button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {(() => {
                  const [before, after] = m.disclaimer.text.split('{terms}')
                  if (after === undefined) return m.disclaimer.text
                  return (
                    <>
                      {before}
                      <Link
                        href="/copyright"
                        className="font-medium text-foreground underline underline-offset-2 hover:text-foreground/80"
                      >
                        {m.disclaimer.terms}
                      </Link>
                      {after}
                    </>
                  )
                })()}
              </p>
            </div>

            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              <a href="/report" className="inline-flex items-center gap-1 hover:text-foreground">
                <Flag className="size-3" /> {m.disclaimer.report}
              </a>
            </p>
          </div>

          {/* Feature pills */}
          <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 font-medium text-white backdrop-blur">
              <Zap className="size-3.5" /> {m.pills.fast}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 font-semibold text-foreground shadow-lg">
              <Film className="size-3.5" /> {m.pills.quality}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 font-medium text-white backdrop-blur">
              <Music className="size-3.5" /> {m.pills.mp3}
            </span>
          </div>

          {/* Live preview */}
          <AnimatePresence mode="wait">
            {isFetching && !videoData ? (
              <motion.div
                key="loading"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-card/80 py-5 text-sm text-muted-foreground shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10"
              >
                <Loader2 className="size-4 animate-spin" />
                {m.preview.loading}
              </motion.div>
            ) : videoData ? (
              <motion.div
                key={videoData.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="mt-4"
              >
                <VideoInfo data={videoData} />
              </motion.div>
            ) : null}
          </AnimatePresence>

          <AnimatePresence>
            {result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className="mt-4"
              >
                <ResultPanel
                  token={result.token}
                  filename={result.filename}
                  video={videoData ?? { id: '', title: result.filename }}
                  onReset={() => setResult(null)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <InfoSections />
      </main>

      <footer className="px-4 pb-8 text-center text-xs text-white/70">
        <a href="/copyright" className="hover:text-white">Copyright disclaimer</a>
        <span className="mx-2">·</span>
        <a href="/report" className="hover:text-white">Report DMCA</a>
      </footer>
    </div>
  )
}
