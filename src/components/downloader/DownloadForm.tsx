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
import { Video, Music, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

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
}

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

export function DownloadForm({ targetUrl, onDownload, isDownloading }: DownloadFormProps) {
  const [mode, setMode] = useState<'mp4' | 'mp3'>('mp4')
  const [videoQuality, setVideoQuality] = useState('best')
  const [container, setContainer] = useState('mp4')
  const [audioBitrate, setAudioBitrate] = useState('best')
  const [audioFormat, setAudioFormat] = useState('mp3')

  const disabled = isDownloading || !targetUrl

  // First dropdown = quality, second = format — mirrors ytmp3's two-select row.
  const primary = mode === 'mp4' ? VIDEO_QUALITY : AUDIO_BITRATE
  const primaryValue = mode === 'mp4' ? videoQuality : audioBitrate
  const setPrimary = mode === 'mp4' ? setVideoQuality : setAudioBitrate
  const secondary = mode === 'mp4' ? CONTAINER : AUDIO_FORMAT
  const secondaryValue = mode === 'mp4' ? container : audioFormat
  const setSecondary = mode === 'mp4' ? setContainer : setAudioFormat

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
        {(['mp3', 'mp4'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={cn(
              'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all',
              mode === m
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {m === 'mp3' ? <Music className="size-3.5" /> : <Video className="size-3.5" />}
            {m.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Quality */}
      <Select value={primaryValue} onValueChange={(v) => v && setPrimary(v)}>
        <SelectTrigger className="h-10 flex-1 rounded-full px-4 sm:min-w-28">
          <SelectValue>{primary.find((o) => o.value === primaryValue)?.label}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {primary.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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
      <Button
        onClick={handleSubmit}
        disabled={disabled}
        className="h-10 shrink-0 gap-2 rounded-full px-6 font-semibold"
      >
        {isDownloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
        {isDownloading ? 'Downloading…' : 'Download'}
      </Button>
    </div>
  )
}
