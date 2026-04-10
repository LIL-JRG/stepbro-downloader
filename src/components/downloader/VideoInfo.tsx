'use client'

import { Badge } from '@/components/ui/badge'
import { Eye, Clock, Calendar, User } from 'lucide-react'

export interface VideoData {
  id: string
  title: string
  thumbnail?: string
  duration?: number
  duration_string?: string
  uploader?: string
  channel?: string
  upload_date?: string
  view_count?: number
  extractor?: string
  webpage_url?: string
  formats?: FormatData[]
}

export interface FormatData {
  format_id: string
  format_note?: string
  ext: string
  height?: number
  width?: number
  fps?: number
  tbr?: number
  vcodec?: string
  acodec?: string
  filesize?: number
}

function formatNumber(n?: number): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function formatDate(d?: string): string {
  if (!d || d.length !== 8) return '—'
  return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`
}

export function VideoInfo({ data }: { data: VideoData }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex gap-3">
        {data.thumbnail && (
          <div className="shrink-0 w-36 h-20 rounded-lg overflow-hidden bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/thumbnail?url=${encodeURIComponent(data.thumbnail)}`}
              alt={data.title}
              className="w-full h-full object-cover"
              loading="eager"
              fetchPriority="high"
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
            />
          </div>
        )}
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-sm font-medium leading-snug line-clamp-2 tracking-[-0.3px]">
            {data.title}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {data.extractor && (
              <Badge variant="secondary" className="text-[10px] font-medium capitalize h-4 px-1.5">
                {data.extractor}
              </Badge>
            )}
            {data.formats && (
              <Badge variant="outline" className="text-[10px] font-medium h-4 px-1.5">
                {data.formats.length} formats
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
            {(data.channel || data.uploader) && (
              <span className="flex items-center gap-1">
                <User className="size-3" />
                {data.channel || data.uploader}
              </span>
            )}
            {data.duration_string && (
              <span className="flex items-center gap-1">
                <Clock className="size-3" />
                {data.duration_string}
              </span>
            )}
            {data.view_count !== undefined && (
              <span className="flex items-center gap-1">
                <Eye className="size-3" />
                {formatNumber(data.view_count)}
              </span>
            )}
            {data.upload_date && (
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(data.upload_date)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
