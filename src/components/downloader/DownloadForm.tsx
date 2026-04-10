'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Settings, Video, Music, Download, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { VideoData } from './VideoInfo'

export interface DownloadConfig {
  url: string
  quality: string
  container: string
  audioOnly: boolean
  audioFormat?: string
  audioQuality?: string
}

interface DownloadFormProps {
  videoData: VideoData
  onDownload: (config: DownloadConfig) => void
  isDownloading: boolean
}

const QUALITY_OPTIONS = [
  { label: 'Best available', value: 'best' },
  { label: '4K (2160p)', value: '2160' },
  { label: '1440p', value: '1440' },
  { label: '1080p', value: '1080' },
  { label: '720p', value: '720' },
  { label: '480p', value: '480' },
  { label: '360p', value: '360' },
]

const CONTAINER_OPTIONS = [
  { label: 'Auto (best)', value: 'any' },
  { label: 'MP4', value: 'mp4' },
  { label: 'WebM', value: 'webm' },
  { label: 'MKV', value: 'mkv' },
]

const AUDIO_FORMATS = [
  { label: 'Best (original)', value: 'best' },
  { label: 'MP3', value: 'mp3' },
  { label: 'AAC', value: 'aac' },
  { label: 'FLAC', value: 'flac' },
  { label: 'Opus', value: 'opus' },
  { label: 'M4A', value: 'm4a' },
  { label: 'WAV', value: 'wav' },
]

const AUDIO_QUALITY_OPTIONS = [
  { label: 'Best', value: 'best' },
  { label: '320 kbps', value: '320K' },
  { label: '256 kbps', value: '256K' },
  { label: '192 kbps', value: '192K' },
  { label: '128 kbps', value: '128K' },
  { label: '64 kbps', value: '64K' },
]

const LOSSLESS_FORMATS = new Set(['flac', 'wav'])

export function DownloadForm({ videoData, onDownload, isDownloading }: DownloadFormProps) {
  const [tab, setTab] = useState<'video' | 'audio'>('video')
  const [quality, setQuality] = useState('best')
  const [container, setContainer] = useState('mp4')
  const [audioFormat, setAudioFormat] = useState('best')
  const [audioQuality, setAudioQuality] = useState('best')

  const isLossless = LOSSLESS_FORMATS.has(audioFormat)

  function handleSubmit() {
    if (tab === 'audio') {
      onDownload({
        url: videoData.webpage_url ?? '',
        quality: 'best',
        container: 'any',
        audioOnly: true,
        audioFormat: audioFormat !== 'best' ? audioFormat : undefined,
        audioQuality: (!isLossless && audioQuality !== 'best') ? audioQuality : undefined,
      })
    } else {
      onDownload({
        url: videoData.webpage_url ?? '',
        quality,
        container,
        audioOnly: false,
      })
    }
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Settings className="size-4 text-muted-foreground" />
        <h2 className="text-[15px] font-normal text-foreground tracking-[-0.45px]">
          Download Options
        </h2>
      </div>

      <div className="flex rounded-lg bg-muted p-0.5 gap-0.5">
        {(['video', 'audio'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-all',
              tab === t
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {t === 'video' ? <Video className="size-3.5" /> : <Music className="size-3.5" />}
            {t === 'video' ? 'Video' : 'Audio only'}
          </button>
        ))}
      </div>

      {tab === 'video' ? (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Video className="size-3.5" />
              Quality
            </Label>
            <Select value={quality} onValueChange={(v) => v && setQuality(v)}>
              <SelectTrigger className="h-9">
                <SelectValue>{QUALITY_OPTIONS.find((o) => o.value === quality)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Settings className="size-3.5" />
              Format
            </Label>
            <Select value={container} onValueChange={(v) => v && setContainer(v)}>
              <SelectTrigger className="h-9">
                <SelectValue>{CONTAINER_OPTIONS.find((o) => o.value === container)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {CONTAINER_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-sm text-muted-foreground flex items-center gap-2">
              <Music className="size-3.5" />
              Format
            </Label>
            <Select value={audioFormat} onValueChange={(v) => { if (v) { setAudioFormat(v); if (LOSSLESS_FORMATS.has(v)) setAudioQuality('best') } }}>
              <SelectTrigger className="h-9">
                <SelectValue>{AUDIO_FORMATS.find((f) => f.value === audioFormat)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AUDIO_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={cn('text-sm flex items-center gap-2', isLossless ? 'text-muted-foreground/40' : 'text-muted-foreground')}>
              <Settings className="size-3.5" />
              Quality
            </Label>
            <Select value={audioQuality} onValueChange={(v) => v && setAudioQuality(v)} disabled={isLossless}>
              <SelectTrigger className="h-9">
                <SelectValue>{AUDIO_QUALITY_OPTIONS.find((o) => o.value === audioQuality)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AUDIO_QUALITY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}

      <Button className="w-full gap-2" onClick={handleSubmit} disabled={isDownloading}>
        {isDownloading
          ? <Loader2 className="size-4 animate-spin" />
          : <Download className="size-4" />
        }
        {isDownloading ? 'Downloading…' : 'Download'}
      </Button>
    </div>
  )
}
