'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Download, Image as ImageIcon, FileText, Copy, Check, Eye, RotateCcw } from 'lucide-react'
import { useI18n } from '@/i18n/provider'
import { playCue } from '@/lib/sound'
import { Tap } from '@/components/ui/tap'
import type { VideoData } from './VideoInfo'

interface ResultPanelProps {
  token: string
  filename: string
  video: VideoData
  onReset: () => void
}

export function ResultPanel({ token, filename, video, onReset }: ResultPanelProps) {
  const { m } = useI18n()
  const url = video.webpage_url ?? ''

  // Manual subs first, then curated auto-caption languages (labelled "auto").
  const manual = video.subtitleLangs ?? []
  const auto = (video.autoSubLangs ?? []).filter((l) => !manual.includes(l))
  const subOptions = [
    ...manual.map((l) => ({ value: l, label: l })),
    ...auto.map((l) => ({ value: l, label: `${l} · ${m.result.auto}` })),
  ]
  const langs = subOptions.map((o) => o.value)

  const [lang, setLang] = useState(langs[0] ?? '')
  const [srt, setSrt] = useState<string | null>(null)
  const [loadingSub, setLoadingSub] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showThumb, setShowThumb] = useState(false)

  // Always JPG for maximum compatibility.
  const thumbSrc = video.thumbnail ? `/api/thumbnail?url=${encodeURIComponent(video.thumbnail)}` : ''

  async function toggleView() {
    if (srt !== null) { setSrt(null); return }
    setLoadingSub(true)
    try {
      const res = await fetch(`/api/subtitles?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}`)
      const data = await res.json()
      if (res.ok) setSrt(data.srt ?? '')
    } catch {
      /* ignore */
    } finally {
      setLoadingSub(false)
    }
  }

  async function copySrt() {
    if (!srt) return
    try {
      await navigator.clipboard.writeText(srt)
      setCopied(true)
      playCue('tick')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard blocked */
    }
  }

  return (
    <div className="space-y-3 rounded-2xl bg-card p-4 shadow-lg shadow-black/5 ring-1 ring-black/5 dark:ring-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-semibold">{m.result.ready}</p>
        <button
          onClick={onReset}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3" /> {m.result.another}
        </button>
      </div>

      {/* Primary actions — save the media, toggle the thumbnail preview */}
      <div className="flex flex-wrap gap-2">
        <Tap>
          <a href={`/api/download/${token}`} download={filename}>
            <Button className="h-9 gap-1.5 rounded-full px-4">
              <Download className="size-4" /> {m.result.saveFile}
            </Button>
          </a>
        </Tap>
        {video.thumbnail && (
          <Button
            variant="outline"
            className="h-9 gap-1.5 rounded-full px-4"
            onClick={() => setShowThumb((v) => !v)}
            aria-pressed={showThumb}
          >
            <ImageIcon className="size-4" /> {m.result.thumbnail}
          </Button>
        )}
      </div>

      {/* Thumbnail preview + download, only while toggled on */}
      {video.thumbnail && showThumb && (
        <div className="space-y-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumbSrc} alt="thumbnail" className="max-h-56 w-auto rounded-xl" />
          <a href={`${thumbSrc}&download=1`} download>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full">
              <Download className="size-3.5" /> {m.result.download}
            </Button>
          </a>
        </div>
      )}

      {/* Subtitles */}
      {langs.length > 0 ? (
        <div className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">{m.result.subtitles}</span>
            <Select
              value={lang}
              onValueChange={(v) => {
                if (v) {
                  setLang(v)
                  setSrt(null)
                }
              }}
            >
              <SelectTrigger className="h-8 rounded-full px-3 text-xs">
                <SelectValue>{subOptions.find((o) => o.value === lang)?.label ?? lang}</SelectValue>
              </SelectTrigger>
              <SelectContent className="max-h-64">
                {subOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full" onClick={toggleView} disabled={loadingSub}>
              <Eye className="size-3.5" /> {srt !== null ? m.result.hide : m.result.view}
            </Button>
            <a
              href={`/api/subtitles?url=${encodeURIComponent(url)}&lang=${encodeURIComponent(lang)}&download=1`}
              download
            >
              <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-full">
                <FileText className="size-3.5" /> {m.result.downloadSrt}
              </Button>
            </a>
          </div>
          {srt !== null && (
            <div className="relative">
              <pre className="max-h-56 overflow-auto rounded-xl bg-muted/60 p-3 text-xs whitespace-pre-wrap">
                {srt || '—'}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2 h-7 gap-1 rounded-full"
                onClick={copySrt}
              >
                {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                {copied ? m.result.copied : m.result.copy}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="border-t border-border pt-3 text-xs text-muted-foreground">{m.result.none}</p>
      )}
    </div>
  )
}
