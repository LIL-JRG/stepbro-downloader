'use client'

import { useEffect, useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'

// UI-level language list. Switching stores the preference; wiring real
// translations would require an i18n layer (e.g. next-intl) on top of this.
const LANGUAGES: { code: string; label: string; rtl?: boolean }[] = [
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

const STORAGE_KEY = 'stepbro-lang'

export function LanguageSelector({ className }: { className?: string }) {
  const [lang, setLang] = useState('en')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    // Deferred so the restore doesn't run as a synchronous setState in the effect
    // body (and stays hydration-safe: server renders the default, client restores).
    if (stored && LANGUAGES.some((l) => l.code === stored)) {
      queueMicrotask(() => setLang(stored))
    }
  }, [])

  function handleChange(value: string) {
    setLang(value)
    localStorage.setItem(STORAGE_KEY, value)
  }

  const current = LANGUAGES.find((l) => l.code === lang) ?? LANGUAGES[0]

  return (
    <Select value={lang} onValueChange={(v) => v && handleChange(v)}>
      <SelectTrigger
        aria-label="Choose language"
        className={cn(
          'h-8 gap-1.5 rounded-full border-transparent bg-white/15 px-3 text-sm font-medium text-white hover:bg-white/25 focus-visible:ring-white/40',
          className
        )}
      >
        <Globe className="size-3.5" />
        <SelectValue>{current.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {LANGUAGES.map((l) => (
          <SelectItem key={l.code} value={l.code} dir={l.rtl ? 'rtl' : undefined}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
