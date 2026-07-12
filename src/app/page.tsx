'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { VideoInfo, type VideoData } from '@/components/downloader/VideoInfo'
import { DownloadForm, type DownloadConfig } from '@/components/downloader/DownloadForm'
import { InfoSections } from '@/components/InfoSections'
import { LanguageSelector } from '@/components/language-selector'
import { useI18n } from '@/i18n/provider'
import { Loader2, Clipboard, Check, Flag, Film, Music, Zap, Heart } from 'lucide-react'

// Where the Donate button points — change to your own sponsor/donation page.
const DONATE_URL = 'https://ko-fi.com/jorgerasgado'
const CONSENT_KEY = 'stepbro-consent'

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
  const downloadAbort = useRef<AbortController | null>(null)

  // Fetch the current daily download allowance (server is the source of truth).
  useEffect(() => {
    let active = true
    fetch('/api/limit')
      .then((r) => r.json())
      .then((d) => {
        if (active && typeof d?.limit === 'number') {
          setUsage({ limit: d.limit, remaining: d.remaining })
          setMaxDuration(typeof d.maxDuration === 'number' ? d.maxDuration : 0)
        }
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

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
    if (usage && usage.remaining <= 0) {
      toast.error(m.toast.limit)
      return
    }
    setIsDownloading(true)
    setProgress({ percent: 0 })
    const controller = new AbortController()
    downloadAbort.current = controller

    fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
              const a = document.createElement('a')
              a.href = `/api/download/${event.token}`
              a.download = event.filename ?? 'download'
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              if (typeof event.remaining === 'number' && typeof event.limit === 'number') {
                setUsage({ limit: event.limit, remaining: event.remaining })
              }
              toast.success(m.toast.started)
              setProgress(null)
              downloadAbort.current = null
              setIsDownloading(false)
            } else if (event.type === 'failed') {
              toast.error(event.message ?? m.toast.failed)
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
            <a href={DONATE_URL} target="_blank" rel="noopener noreferrer">
              <Button className="h-8 gap-1.5 rounded-full bg-amber-400 px-3.5 font-semibold text-amber-950 hover:bg-amber-300">
                <Heart className="size-3.5" />
                <span className="hidden sm:inline">{m.nav.donate}</span>
              </Button>
            </a>
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
                onChange={(e) => setUrl(e.target.value)}
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
                blocked={!agreed || tooLong || (usage !== null && usage.remaining <= 0)}
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
                {m.disclaimer.text}
              </p>
            </div>

            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              <a href="#" className="inline-flex items-center gap-1 hover:text-foreground">
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
        </div>

        <InfoSections />
      </main>
    </div>
  )
}
