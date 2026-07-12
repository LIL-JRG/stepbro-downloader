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
import { Video, Music, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/provider'
import { Tap } from '@/components/ui/tap'

export interface DownloadConfig {
  url: string
  quality: string
  container: string
  audioOnly: boolean
  audioFormat?: string
  audioQuality?: string
}

interface DownloadFormProps {
  targetUrl: string
  onDownload: (config: DownloadConfig) => void
  isDownloading: boolean
  /** When true (e.g. disclaimer not accepted), the Download button is disabled. */
  blocked?: boolean
}

const PREFS_KEY = 'stepbro-prefs'

const VIDEO_QUALITY = [
  { label: 'Best', value: 'best' },
  { label: '4K · 2160p', value: '2160' },
  { label: '1440p', value: '1440' },
  { label: '1080p', value: '1080' },
  { label: '720p', value: '720' },
  { label: '480p', value: '480' },
  { label: '360p', value: '360' },
]

const CONTAINER = [
  { label: 'MP4', value: 'mp4' },
  { label: 'WebM', value: 'webm' },
  { label: 'MKV', value: 'mkv' },
]

const AUDIO_BITRATE = [
  { label: 'Best', value: 'best' },
  { label: '320 kbps', value: '320K' },
  { label: '192 kbps', value: '192K' },
  { label: '128 kbps', value: '128K' },
]

const AUDIO_FORMAT = [
  { label: 'MP3', value: 'mp3' },
  { label: 'M4A', value: 'm4a' },
  { label: 'AAC', value: 'aac' },
  { label: 'Opus', value: 'opus' },
  { label: 'FLAC', value: 'flac' },
  { label: 'WAV', value: 'wav' },
]

export function DownloadForm({ targetUrl, onDownload, isDownloading, blocked }: DownloadFormProps) {
  const { m } = useI18n()
  const [mode, setMode] = useState<'mp4' | 'mp3'>('mp4')
  const [videoQuality, setVideoQuality] = useState('best')
  const [container, setContainer] = useState('mp4')
  const [audioBitrate, setAudioBitrate] = useState('best')
  const [audioFormat, setAudioFormat] = useState('mp3')
  const [hydrated, setHydrated] = useState(false)

  // Restore the last-used choices (deferred so it doesn't fire as a synchronous
  // setState in the effect body, and stays hydration-safe).
  useEffect(() => {
    let stored: Record<string, unknown> | null = null
    try {
      const raw = localStorage.getItem(PREFS_KEY)
      stored = raw ? JSON.parse(raw) : null
    } catch { /* ignore malformed prefs */ }
    queueMicrotask(() => {
      if (stored) {
        if (stored.mode === 'mp3' || stored.mode === 'mp4') setMode(stored.mode)
        if (VIDEO_QUALITY.some((o) => o.value === stored!.videoQuality)) setVideoQuality(stored.videoQuality as string)
        if (CONTAINER.some((o) => o.value === stored!.container)) setContainer(stored.container as string)
        if (AUDIO_BITRATE.some((o) => o.value === stored!.audioBitrate)) setAudioBitrate(stored.audioBitrate as string)
        if (AUDIO_FORMAT.some((o) => o.value === stored!.audioFormat)) setAudioFormat(stored.audioFormat as string)
      }
      setHydrated(true)
    })
  }, [])

  // Persist choices once restored (localStorage write is external sync, not setState).
  useEffect(() => {
    if (!hydrated) return
    const prefs = { version: 1, mode, videoQuality, container, audioBitrate, audioFormat }
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }, [hydrated, mode, videoQuality, container, audioBitrate, audioFormat])

  const disabled = isDownloading || !targetUrl || !!blocked

  // First dropdown = quality, second = format — mirrors ytmp3's two-select row.
  const primary = mode === 'mp4' ? VIDEO_QUALITY : AUDIO_BITRATE
  const primaryValue = mode === 'mp4' ? videoQuality : audioBitrate
  const setPrimary = mode === 'mp4' ? setVideoQuality : setAudioBitrate
  const secondary = mode === 'mp4' ? CONTAINER : AUDIO_FORMAT
  const secondaryValue = mode === 'mp4' ? container : audioFormat
  const setSecondary = mode === 'mp4' ? setContainer : setAudioFormat

  // Only "Best" is localised; resolutions and codecs are universal.
  const qualityLabel = (value: string) => {
    const o = primary.find((x) => x.value === value)
    if (!o) return ''
    return o.value === 'best' ? m.form.best : o.label
  }

  function handleSubmit() {
    if (disabled) return
    if (mode === 'mp3') {
      onDownload({
        url: targetUrl,
        quality: 'best',
        container: 'any',
        audioOnly: true,
        audioFormat,
        audioQuality: audioBitrate !== 'best' ? audioBitrate : undefined,
      })
    } else {
      onDownload({ url: targetUrl, quality: videoQuality, container, audioOnly: false })
    }
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

      {/* Quality */}
      <Select value={primaryValue} onValueChange={(v) => v && setPrimary(v)}>
        <SelectTrigger className="h-10 flex-1 rounded-full px-4 sm:min-w-28">
          <SelectValue>{qualityLabel(primaryValue)}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {primary.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.value === 'best' ? m.form.best : o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Format / container */}
      <Select value={secondaryValue} onValueChange={(v) => v && setSecondary(v)}>
        <SelectTrigger className="h-10 flex-1 rounded-full px-4 sm:min-w-24">
          <SelectValue>{secondary.find((o) => o.value === secondaryValue)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {secondary.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

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
