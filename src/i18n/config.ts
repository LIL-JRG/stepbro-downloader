import { en, type Messages, type DeepPartial } from './en'
import { translations } from './translations'

export interface LocaleMeta {
  code: string
  label: string
  rtl?: boolean
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية', rtl: true },
  { code: 'bn', label: 'বাংলা' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'tl', label: 'Filipino' },
  { code: 'fr', label: 'Français' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'id', label: 'Bahasa Indonesia' },
  { code: 'it', label: 'Italiano' },
  { code: 'ja', label: '日本語' },
  { code: 'ko', label: '한국어' },
  { code: 'my', label: 'မြန်မာ' },
  { code: 'ms', label: 'Bahasa Melayu' },
  { code: 'pt', label: 'Português' },
  { code: 'ru', label: 'Русский' },
  { code: 'th', label: 'ไทย' },
  { code: 'tr', label: 'Türkçe' },
  { code: 'ur', label: 'اردو', rtl: true },
  { code: 'vi', label: 'Tiếng Việt' },
  { code: 'hu', label: 'Magyar' },
  { code: 'bg', label: 'Български' },
]

export const DEFAULT_LOCALE = 'en'
export const STORAGE_KEY = 'stepbro-lang'

export function isRtl(code: string): boolean {
  return LOCALES.find((l) => l.code === code)?.rtl ?? false
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function deepMerge<T>(base: T, override: DeepPartial<T> | undefined): T {
  if (!override) return base
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) }
  for (const key of Object.keys(override as Record<string, unknown>)) {
    const o = (override as Record<string, unknown>)[key]
    const b = (base as Record<string, unknown>)[key]
    if (isPlainObject(b) && isPlainObject(o)) {
      out[key] = deepMerge(b, o as DeepPartial<typeof b>)
    } else if (o !== undefined) {
      out[key] = o
    }
  }
  return out as T
}

/** Full message catalogue for a locale, with English filling any gaps. */
export function getMessages(locale: string): Messages {
  return deepMerge(en, translations[locale])
}
