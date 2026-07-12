'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme-toggle'
import { VideoInfo, type VideoData } from '@/components/downloader/VideoInfo'
import { DownloadForm, type DownloadConfig } from '@/components/downloader/DownloadForm'
import { ExternalLink, Loader2, Download } from 'lucide-react'

function looksLikeUrl(s: string): boolean {
  return /^https?:\/\/\S+\.\S+/i.test(s.trim())
}

export default function Home() {
  const [url, setUrl] = useState('')
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)

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
      <header className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2 text-white">
          <span className="grid size-8 place-items-center rounded-xl bg-white/15">
            <Download className="size-4" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
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
            <Button variant="ghost" size="icon" className="size-8 text-white hover:bg-white/15 hover:text-white">
              <ExternalLink className="size-4" />
            </Button>
          </a>
          <ThemeToggle className="text-white hover:bg-white/15 hover:text-white" />
        </div>
      </header>

      <main className="flex-1 px-4 pb-16">
        <div className="mx-auto w-full max-w-xl pt-10 sm:pt-16">
          {/* Main converter card */}
          <div className="rounded-3xl bg-card p-5 shadow-xl shadow-black/10 ring-1 ring-black/5 dark:ring-white/10 sm:p-7">
            <div className="mb-5 space-y-1.5 text-center">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-[26px]">
                Download any video
              </h1>
              <p className="text-sm text-muted-foreground">
                Paste a link from YouTube, TikTok, X, Instagram &amp; more
              </p>
            </div>

            <Input
              placeholder="Paste the video URL here…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="mb-3 h-12 rounded-full border-transparent bg-muted px-5 text-base focus-visible:bg-background"
              autoFocus
            />

            <DownloadForm
              targetUrl={targetUrl}
              onDownload={handleDownload}
              isDownloading={isDownloading}
            />
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
                className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-card/70 py-5 text-sm text-muted-foreground shadow-lg shadow-black/5"
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
      </main>
    </div>
  )
}
