'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Globe } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/i18n/provider'
import { LOCALES } from '@/i18n/config'

export function LanguageSelector({ className }: { className?: string }) {
  const { locale, setLocale, m } = useI18n()
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0]

  return (
    <Select value={locale} onValueChange={(v) => v && setLocale(v)}>
      <SelectTrigger
        aria-label={m.lang.choose}
        className={cn(
          'h-8 gap-1.5 rounded-full border-transparent bg-white/15 px-3 text-sm font-medium text-white hover:bg-white/25 focus-visible:ring-white/40',
          className
        )}
      >
        <Globe className="size-3.5" />
        <SelectValue>{current.label}</SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-72">
        {LOCALES.map((l) => (
          <SelectItem key={l.code} value={l.code} dir={l.rtl ? 'rtl' : undefined}>
            {l.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
