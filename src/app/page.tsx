'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { ThemeToggle } from '@/components/theme-toggle'
import { VideoInfo, type VideoData } from '@/components/downloader/VideoInfo'
import { DownloadForm, type DownloadConfig } from '@/components/downloader/DownloadForm'
import { Search, ExternalLink, Loader2 } from 'lucide-react'

export default function Home() {
  const [url, setUrl] = useState('')
  const [videoData, setVideoData] = useState<VideoData | null>(null)
  const [isFetching, setIsFetching] = useState(false)
  const [isDownloading, setIsDownloading] = useState(false)
  const urlInputRef = useRef<HTMLInputElement>(null)

  // Sync browser-restored input value (session restore doesn't fire onChange)
  useEffect(() => {
    const el = urlInputRef.current
    if (el?.value) setUrl(el.value)
  }, [])

  async function fetchInfo() {
    const trimmed = url.trim() || urlInputRef.current?.value.trim() || ''
    if (!trimmed) return
    if (url !== trimmed) setUrl(trimmed)
    setIsFetching(true)
    setVideoData(null)
    try {
      const res = await fetch('/api/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Unknown error')
      setVideoData(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err))
    } finally {
      setIsFetching(false)
    }
  }

  function handleDownload(config: DownloadConfig) {
    if (isDownloading) return
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
              // Trigger browser download directly — no file saved on server long-term
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
    <div className="h-svh overflow-hidden lg:p-2 w-full">
      <div className="lg:border lg:rounded-xl overflow-hidden flex flex-col bg-background h-full w-full">

        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 py-2.5 sm:px-6 md:px-8 shrink-0">
          <h1 className="text-base sm:text-lg font-medium text-foreground tracking-[-0.45px]">
            stepbro downloader
          </h1>
          <div className="flex items-center gap-1.5">
            <a href="https://github.com/LIL-JRG/stepbro-downloader" target="_blank" rel="noopener noreferrer" aria-label="yt-dlp on GitHub">
              <Button variant="ghost" size="icon" className="size-8">
                <ExternalLink className="size-4" />
              </Button>
            </a>
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-4">

            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Search className="size-4 text-muted-foreground" />
                <h2 className="text-[15px] font-normal text-foreground tracking-[-0.45px]">
                  Video URL
                </h2>
              </div>
              <div className="flex gap-2">
                <Input
                  ref={urlInputRef}
                  placeholder="YouTube, TikTok, Twitter/X, Instagram, and more…"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchInfo()}
                  className="h-9"
                />
                <Button
                  size="sm"
                  onClick={fetchInfo}
                  disabled={isFetching}
                  className="gap-1.5 shrink-0"
                >
                  {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
                  {isFetching ? 'Loading…' : 'Fetch'}
                </Button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {videoData && (
                <motion.div
                  key={videoData.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-4"
                >
                  <VideoInfo data={videoData} />
                  <DownloadForm
                    videoData={videoData}
                    onDownload={handleDownload}
                    isDownloading={isDownloading}
                  />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </main>
      </div>
    </div>
  )
}
