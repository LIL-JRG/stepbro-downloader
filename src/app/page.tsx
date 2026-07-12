'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { ThemeToggle } from '@/components/theme-toggle'
import { VideoInfo, type VideoData } from '@/components/downloader/VideoInfo'
import { DownloadForm, type DownloadConfig } from '@/components/downloader/DownloadForm'
import { InfoSections } from '@/components/InfoSections'
import { ExternalLink, Loader2, Download, Clipboard, Check, Flag, Film, Music, Zap } from 'lucide-react'

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(s.trim())
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const [agreed, setAgreed] = useState(true)

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

  async function pasteFromClipboard() {
    try {
      const text = await navigator.clipboard.readText()
      if (text) setUrl(text.trim())
    } catch {
      toast.error('Clipboard access is blocked by the browser')
    }
  }

  function handleDownload(config: DownloadConfig) {
    if (isDownloading) return
    if (!config.url) {
      toast.error('Paste a video URL first')
      return
    }
    setIsDownloading(true)

    fetch('/api/download', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    }).then(async (res) => {
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error || 'Download failed')
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
            }
            if (event.type === 'ready' && event.token) {
              const a = document.createElement('a')
              a.href = `/api/download/${event.token}`
              a.download = event.filename ?? 'download'
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
              toast.success('Download started')
              setIsDownloading(false)
            } else if (event.type === 'failed') {
              toast.error(event.message ?? 'Download failed')
              setIsDownloading(false)
            }
          } catch { /* ignore parse errors */ }
        }
      }
    }).catch((err) => {
      toast.error(err instanceof Error ? err.message : String(err))
      setIsDownloading(false)
    })
  }

  return (
    <div className="flex min-h-svh flex-col bg-page">
      <header className="flex items-center justify-between px-4 py-3.5 sm:px-6">
        <div className="flex items-center gap-2 text-white">
          <span className="grid size-8 place-items-center rounded-xl bg-white/20">
            <Download className="size-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">
            stepbro downloader
          </span>
        </div>
        <div className="flex items-center gap-1 text-white">
          <a
            href="https://github.com/LIL-JRG/stepbro-downloader"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="stepbro downloader on GitHub"
          >
            <Button variant="ghost" size="icon" className="size-8 text-white hover:bg-white/20 hover:text-white">
              <ExternalLink className="size-4" />
            </Button>
          </a>
          <ThemeToggle className="text-white hover:bg-white/20 hover:text-white" />
        </div>
      </header>

      <main className="flex-1 px-4 pb-16">
        <div className="mx-auto w-full max-w-2xl pt-6 sm:pt-12">
          {/* Main converter card */}
          <div className="rounded-3xl bg-card p-5 shadow-2xl shadow-black/20 ring-1 ring-black/5 dark:ring-white/10 sm:p-7">
            <div className="mb-5 space-y-1.5 text-center">
              <h1 className="font-display text-[26px] font-bold tracking-tight text-foreground sm:text-3xl">
                Download any video
              </h1>
              <p className="text-sm text-muted-foreground">
                YouTube, TikTok, X, Instagram &amp; more — MP4 or MP3, up to 4K
              </p>
            </div>

            {/* URL input with a paste button */}
            <div className="relative">
              <Input
                placeholder="Paste the video URL here…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="h-12 rounded-full border-transparent bg-muted pr-12 pl-5 text-base shadow-inner focus-visible:bg-background"
                autoFocus
              />
              <button
                type="button"
                onClick={pasteFromClipboard}
                aria-label="Paste from clipboard"
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
              />
            </div>

            {/* Disclaimer */}
            <div className="mt-4 flex items-start gap-2.5 rounded-2xl bg-muted/70 px-4 py-3">
              <button
                type="button"
                onClick={() => setAgreed((v) => !v)}
                aria-pressed={agreed}
                aria-label="I agree"
                className={cn(
                  'mt-0.5 grid size-4 shrink-0 place-items-center rounded-[5px] border transition-colors',
                  agreed ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-background'
                )}
              >
                {agreed && <Check className="size-3" />}
              </button>
              <p className="text-xs leading-relaxed text-muted-foreground">
                I confirm I have read and agree to the{' '}
                <a href="#" className="font-medium text-foreground underline-offset-2 hover:underline">
                  copyright terms
                </a>{' '}
                and will not download copyrighted content.
              </p>
            </div>

            <p className="mt-2.5 text-center text-xs text-muted-foreground">
              <a href="#" className="inline-flex items-center gap-1 hover:text-foreground">
                <Flag className="size-3" /> Report copyrighted content
              </a>
            </p>
          </div>

          {/* Feature pills */}
          <div className="mx-auto mt-4 flex flex-wrap items-center justify-center gap-2 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 font-medium text-white backdrop-blur">
              <Zap className="size-3.5" /> Fast &amp; free
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 font-semibold text-foreground shadow-lg">
              <Film className="size-3.5" /> Up to 4K with audio
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3.5 py-1.5 font-medium text-white backdrop-blur">
              <Music className="size-3.5" /> MP3 audio
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
                Loading preview…
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
