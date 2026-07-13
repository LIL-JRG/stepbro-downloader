'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Video, Music, Download, Loader2, Crown, ChevronDown, ChevronRight, Check } from 'lucide-react'
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

/**
 * Single video-quality control: a dropdown grouped by container (MP4, WebM, …),
 * each collapsible into its resolutions. Supporter-only tiers show a crown and
 * open the upsell instead of selecting when the user isn't a supporter.
 */
function VideoQualityMenu({
  container,
  resolution,
  supporter,
  onChange,
  onUpsell,
}: {
  container: string
  resolution: string
  supporter: boolean
  onChange: (container: string, resolution: string) => void
  onUpsell?: () => void
}) {
  const { m } = useI18n()
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(container)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const resLabel = (value: string, label: string) => (value === 'best' ? m.form.auto : label)
  const triggerLabel = `${CONTAINER_LABELS[container]} · ${resLabel(
    resolution,
    resolutionsFor(container).find((r) => r.value === resolution)?.label ?? ''
  )}`

  return (
    <div ref={ref} className="relative min-w-0 flex-1 sm:min-w-44">
      <button
        type="button"
        onClick={() => {
          setExpanded(container)
          setOpen((o) => !o)
        }}
        className="flex h-10 w-full items-center justify-between gap-1.5 rounded-full border border-input bg-transparent px-4 text-sm font-medium whitespace-nowrap outline-none transition-colors hover:bg-muted/50 dark:bg-input/30"
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-1.5 max-h-80 w-max min-w-full overflow-y-auto rounded-2xl bg-popover p-1.5 shadow-lg ring-1 ring-foreground/10">
          {VIDEO_CONTAINERS.map((c) => {
            const isExpanded = expanded === c
            return (
              <div key={c}>
                <button
                  type="button"
                  onClick={() => setExpanded((e) => (e === c ? null : c))}
                  className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-semibold transition-colors hover:bg-accent"
                >
                  <ChevronRight
                    className={cn('size-3.5 text-muted-foreground transition-transform', isExpanded && 'rotate-90')}
                  />
                  {CONTAINER_LABELS[c]}
                </button>
                {isExpanded &&
                  resolutionsFor(c).map((r) => {
                    const locked = r.supporter && !supporter
                    const selected = container === c && resolution === r.value
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => {
                          setOpen(false)
                          if (locked) {
                            onUpsell?.()
                            return
                          }
                          onChange(c, r.value)
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-lg py-1.5 pr-3 pl-8 text-sm whitespace-nowrap transition-colors hover:bg-accent',
                          selected && 'font-semibold',
                          locked && 'opacity-55'
                        )}
                      >
                        <span>
                          {CONTAINER_LABELS[c]} · {resLabel(r.value, r.label)}
                        </span>
                        {r.supporter && <Crown className="size-3 shrink-0 text-amber-500" />}
                        {selected && <Check className="ml-auto size-3.5 shrink-0" />}
                      </button>
                    )
                  })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

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

  // Keep the resolution valid for the current container (e.g. 1080p Premium only
  // exists on MP4), and never leave a locked pick selected for a non-supporter.
  useEffect(() => {
    const current = resolutionsFor(container).find((r) => r.value === resolution)
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
        <VideoQualityMenu
          container={container}
          resolution={resolution}
          supporter={supporter}
          onChange={(c, r) => {
            setContainer(c)
            setResolution(r)
          }}
          onUpsell={onUpsell}
        />
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
          <SelectTrigger className="h-10 min-w-0 flex-1 rounded-full px-4 sm:min-w-44">
            <SelectValue>{audioLabel(audioOption)}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {AUDIO_OPTIONS.map((o) => {
              const locked = o.supporter && !supporter
              return (
                <SelectItem key={o.value} value={o.value} disabled={locked}>
                  <span className="flex items-center gap-2">
                    {audioLabel(o.value)}
                    {o.supporter && <Crown className="size-3 text-amber-500" />}
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
