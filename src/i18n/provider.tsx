'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { getMessages, DEFAULT_LOCALE, STORAGE_KEY, LOCALES, isRtl } from './config'
import type { Messages } from './en'

interface I18nContextValue {
  locale: string
  setLocale: (code: string) => void
  m: Messages
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState(DEFAULT_LOCALE)

  // Restore the saved locale after mount (deferred → hydration-safe + no
  // synchronous setState in the effect body).
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored !== DEFAULT_LOCALE && LOCALES.some((l) => l.code === stored)) {
      queueMicrotask(() => setLocaleState(stored))
    }
  }, [])

  // Keep <html lang> and text direction in sync with the active locale.
  useEffect(() => {
    document.documentElement.lang = locale
    document.documentElement.dir = isRtl(locale) ? 'rtl' : 'ltr'
  }, [locale])

  function setLocale(code: string) {
    setLocaleState(code)
    localStorage.setItem(STORAGE_KEY, code)
  }

  const m = useMemo(() => getMessages(locale), [locale])

  return <I18nContext.Provider value={{ locale, setLocale, m }}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
