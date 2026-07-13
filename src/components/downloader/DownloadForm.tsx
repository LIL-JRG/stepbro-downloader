'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Video, Music, Download, Loader2, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/provider'
import { Tap } from '@/components/ui/tap'
import {
  AUDIO_OPTIONS,
  AUDIO_LABELS,
  DEFAULT_AUDIO,
  VIDEO_CONTAINERS,
  CONTAINER_LABELS,
  DEFAULT_CONTAINER,
  DEFAULT_RESOLUTION,
  resolutionsFor,
  findAudioOption,
} from '@/lib/formats'

export interface DownloadConfig {
  url: string
  audioOnly: boolean
  container?: string
  quality?: string
  audioOption?: string
}

interface DownloadFormProps {
  targetUrl: string
  onDownload: (config: DownloadConfig) => void
  isDownloading: boolean
  /** When true (e.g. disclaimer not accepted), the Download button is disabled. */
  blocked?: boolean
  /** A valid supporter unlocks the gated (4K/2K/Premium/320/WAV) options. */
  supporter?: boolean
  /** Opens the Supporter modal when a locked option is chosen. */
  onUpsell?: () => void
}

const PREFS_KEY = 'stepbro-prefs'

export function DownloadForm({
  targetUrl,
  onDownload,
  isDownloading,
  blocked,
  supporter = false,
  onUpsell,
}: DownloadFormProps) {
  const { m } = useI18n()
  const [mode, setMode] = useState<'mp4' | 'mp3'>('mp4')
  const [container, setContainer] = useState<string>(DEFAULT_CONTAINER)
  const [resolution, setResolution] = useState(DEFAULT_RESOLUTION)
  const [audioOption, setAudioOption] = useState(DEFAULT_AUDIO)
  const [hydrated, setHydrated] = useState(false)

  // Restore the last-used choices (deferred so it doesn't fire as a synchronous
  // setState in the effect body, and stays hydration-safe).
  useEffect(() => {
    let stored: Record<string, unknown> | null = null
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      stored = raw ? JSON.parse(raw) : null
    } catch {
      /* ignore malformed prefs */
    }
    queueMicrotask(() => {
      if (stored) {
        if (stored.mode === 'mp3' || stored.mode === 'mp4') setMode(stored.mode)
        if (VIDEO_CONTAINERS.includes(stored.container as never)) setContainer(stored.container as string)
        if (typeof stored.resolution === 'string') setResolution(stored.resolution)
        if (findAudioOption(stored.audioOption as string)) setAudioOption(stored.audioOption as string)
      }
      setHydrated(true)
    })
  }, [])

  // Persist choices once restored (localStorage write is external sync, not setState).
  useEffect(() => {
    if (!hydrated) return
    localStorage.setItem(
      PREFS_KEY,
      JSON.stringify({ version: 2, mode, container, resolution, audioOption })
    )
  }, [hydrated, mode, container, resolution, audioOption])

  const resolutions = resolutionsFor(container)

  // Keep the resolution valid for the current container (e.g. 1080p Premium only
  // exists on MP4), and never leave a locked pick selected for a non-supporter.
  useEffect(() => {
    const current = resolutions.find((r) => r.value === resolution)
    if (!current || (current.supporter && !supporter)) {
      queueMicrotask(() => setResolution(DEFAULT_RESOLUTION))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container, supporter])

  useEffect(() => {
    if (!supporter && findAudioOption(audioOption)?.supporter) {
      queueMicrotask(() => setAudioOption(DEFAULT_AUDIO))
    }
  }, [supporter, audioOption])

  const disabled = isDownloading || !targetUrl || !!blocked

  function handleSubmit() {
    if (disabled) return
    if (mode === 'mp3') {
      onDownload({ url: targetUrl, audioOnly: true, audioOption })
    } else {
      onDownload({ url: targetUrl, audioOnly: false, container, quality: resolution })
    }
  }

  const audioLabel = (value: string) => {
    const base = AUDIO_LABELS[value] ?? value
    return value.startsWith('mp3-') ? base.replace('MP3', m.form.mp3 ?? 'MP3') : base
  }
  const resolutionLabel = (r: { value: string; label: string }) =>
    r.value === 'best' ? m.form.auto : r.label

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* MP3 / MP4 segmented toggle */}
      <div className="flex shrink-0 rounded-full bg-muted p-1">
        {(['mp3', 'mp4'] as const).map((md) => (
          <button
            key={md}
            onClick={() => setMode(md)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all',
              mode === md
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {md === 'mp3' ? <Music className="size-3.5" /> : <Video className="size-3.5" />}
            {md.toUpperCase()}
          </button>
        ))}
      </div>

      {mode === 'mp4' ? (
        <>
          {/* Container */}
          <Select value={container} onValueChange={(v) => v && setContainer(v)}>
            <SelectTrigger className="h-10 flex-1 rounded-full px-4 sm:min-w-24">
              <SelectValue>{CONTAINER_LABELS[container]}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {VIDEO_CONTAINERS.map((c) => (
                <SelectItem key={c} value={c}>
                  {CONTAINER_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Resolution — gated tiers stay visible but are locked for non-supporters */}
          <Select
            value={resolution}
            onValueChange={(v) => {
              if (!v) return
              const opt = resolutions.find((r) => r.value === v)
              if (opt?.supporter && !supporter) {
                onUpsell?.()
                return
              }
              setResolution(v)
            }}
          >
            <SelectTrigger className="h-10 flex-1 rounded-full px-4 sm:min-w-28">
              <SelectValue>{resolutionLabel(resolutions.find((r) => r.value === resolution) ?? resolutions[0])}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {resolutions.map((r) => {
                const locked = r.supporter && !supporter
                return (
                  <SelectItem key={r.value} value={r.value} disabled={locked}>
                    <span className="flex items-center gap-2">
                      {resolutionLabel(r)}
                      {r.supporter && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                          <Lock className="size-2.5" /> {m.form.supporterOnly}
                        </span>
                      )}
                    </span>
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>
        </>
      ) : (
        /* Audio format + quality (single combined select) */
        <Select
          value={audioOption}
          onValueChange={(v) => {
            if (!v) return
            const opt = findAudioOption(v)
            if (opt?.supporter && !supporter) {
              onUpsell?.()
              return
            }
            setAudioOption(v)
          }}
        >
          <SelectTrigger className="h-10 flex-1 rounded-full px-4 sm:min-w-40">
            <SelectValue>{audioLabel(audioOption)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AUDIO_OPTIONS.map((o) => {
              const locked = o.supporter && !supporter
              return (
                <SelectItem key={o.value} value={o.value} disabled={locked}>
                  <span className="flex items-center gap-2">
                    {audioLabel(o.value)}
                    {o.supporter && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                        <Lock className="size-2.5" /> {m.form.supporterOnly}
                      </span>
                    )}
                  </span>
                </SelectItem>
              )
            })}
          </SelectContent>
        </Select>
      )}

      {/* Download */}
      <Tap>
        <Button
          onClick={handleSubmit}
          disabled={disabled}
          className="h-10 shrink-0 gap-2 rounded-full px-6 font-semibold"
        >
          {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
          {isDownloading ? m.form.downloading : m.form.download}
        </Button>
      </Tap>
    </div>
  )
}
