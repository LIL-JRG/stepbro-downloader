/**
 * Single source of truth for the download format options and which of them are
 * gated behind a supporter license. Imported by BOTH the client (DownloadForm,
 * for what to show and disable) and the server (/api/download, for enforcement)
 * so the UI and the actual gating can never drift apart.
 *
 * Free tier caps at 1080p standard quality with lossy/standard audio.
 * Supporters unlock 4K/2K, the 1080p "Premium" (high-bitrate) tier, MP3 320 kbps
 * and lossless WAV.
 */

export interface AudioOption {
  value: string
  /** yt-dlp --audio-format value. */
  format: string
  /** yt-dlp --audio-quality (bitrate like '320K'); omitted = best. */
  quality?: string
  supporter?: boolean
}

// Order matches the dropdown. Only MP3 exposes bitrate tiers; the rest download
// at best quality. OGG maps to yt-dlp's "vorbis".
export const AUDIO_OPTIONS: AudioOption[] = [
  { value: 'mp3-320', format: 'mp3', quality: '320K', supporter: true },
  { value: 'mp3-192', format: 'mp3', quality: '192K' },
  { value: 'mp3-128', format: 'mp3', quality: '128K' },
  { value: 'mp3-64', format: 'mp3', quality: '64K' },
  { value: 'wav', format: 'wav', supporter: true },
  { value: 'm4a', format: 'm4a' },
  { value: 'ogg', format: 'vorbis' },
  { value: 'opus', format: 'opus' },
  { value: 'flac', format: 'flac' },
  { value: 'aac', format: 'aac' },
  { value: 'alac', format: 'alac' },
]

// Display labels (kept out of AudioOption so the same list drives both UIs; MP3
// tiers combine a localised "MP3" with a universal bitrate).
export const AUDIO_LABELS: Record<string, string> = {
  'mp3-320': 'MP3 · 320 kbps',
  'mp3-192': 'MP3 · 192 kbps',
  'mp3-128': 'MP3 · 128 kbps',
  'mp3-64': 'MP3 · 64 kbps',
  wav: 'WAV',
  m4a: 'M4A',
  ogg: 'OGG',
  opus: 'Opus',
  flac: 'FLAC',
  aac: 'AAC',
  alac: 'ALAC',
}

export const DEFAULT_AUDIO = 'mp3-192'

export const VIDEO_CONTAINERS = ['mp4', 'webm', 'mkv', 'avi', 'flv', 'mov'] as const
export type VideoContainer = (typeof VIDEO_CONTAINERS)[number]

export const CONTAINER_LABELS: Record<string, string> = {
  mp4: 'MP4',
  webm: 'WebM',
  mkv: 'MKV',
  avi: 'AVI',
  flv: 'FLV',
  mov: 'MOV',
}

export interface ResolutionOption {
  /** 'best' | '2160' | '1440' | '1080premium' | '1080' | '720' | '480' | '360' | '144' */
  value: string
  label: string
  supporter: boolean
}

/**
 * Resolutions offered for a container, highest first. 4K is supporter-only
 * everywhere; 2K is supporter-only except on WebM; MP4 additionally offers a
 * supporter-only "1080p Premium" (high-bitrate) tier.
 */
export function resolutionsFor(container: string): ResolutionOption[] {
  const list: ResolutionOption[] = [
    { value: '2160', label: '4K', supporter: true },
    { value: '1440', label: '2K', supporter: container !== 'webm' },
  ]
  if (container === 'mp4') {
    list.push({ value: '1080premium', label: '1080p Premium', supporter: true })
  }
  list.push(
    { value: '1080', label: '1080p', supporter: false },
    { value: '720', label: '720p', supporter: false },
    { value: '480', label: '480p', supporter: false },
    { value: '360', label: '360p', supporter: false },
    { value: '144', label: '144p', supporter: false }
  )
  return list
}

export const DEFAULT_CONTAINER: VideoContainer = 'mp4'

/** Highest resolution a user may pick by default: 4K for supporters, 1080p free. */
export function defaultResolution(supporter: boolean): string {
  return supporter ? '2160' : '1080'
}

/** Highest resolution (in px) a non-supporter may download. */
export const FREE_MAX_HEIGHT = 1080

// ── Server-side gating (authoritative) ───────────────────────────────────────

export function findAudioOption(value: string | undefined): AudioOption | undefined {
  return AUDIO_OPTIONS.find((o) => o.value === value)
}

export function audioRequiresSupporter(value: string | undefined): boolean {
  return !!findAudioOption(value)?.supporter
}

export function videoRequiresSupporter(container: string, quality: string): boolean {
  return resolutionsFor(container).find((r) => r.value === quality)?.supporter ?? false
}
