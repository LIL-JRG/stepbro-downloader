'use client'

import {
  Clipboard,
  SlidersHorizontal,
  Download,
  Zap,
  ShieldCheck,
  Smartphone,
  Volume2,
} from 'lucide-react'
import { useI18n } from '@/i18n/provider'

const STEP_ICONS = [Clipboard, SlidersHorizontal, Download]
const REASON_ICONS = [Zap, ShieldCheck, Smartphone, Volume2]

export function InfoSections() {
  const { m } = useI18n()
  const info = m.info

  return (
    <section className="mx-auto mt-10 w-full max-w-3xl rounded-3xl bg-card p-6 text-card-foreground shadow-xl shadow-black/10 ring-1 ring-black/5 sm:mt-12 sm:p-9 dark:ring-white/10">
      {/* Intro */}
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">{info.title}</h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">{info.intro}</p>

      {/* How it works */}
      <h3 className="mt-8 font-display text-lg font-semibold">{info.howTitle}</h3>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {info.steps.map((s, i) => {
          const Icon = STEP_ICONS[i] ?? Clipboard
          return (
            <li key={i} className="rounded-2xl bg-muted/60 p-4">
              <div className="flex items-center gap-2">
                <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                  <Icon className="size-4" />
                </span>
                <span className="text-xs font-semibold text-muted-foreground">{i + 1}</span>
              </div>
              <p className="mt-2 font-medium">{s.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
            </li>
          )
        })}
      </ol>

      {/* Why choose */}
      <h3 className="mt-8 font-display text-lg font-semibold">{info.whyTitle}</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {info.reasons.map((r, i) => {
          const Icon = REASON_ICONS[i] ?? Zap
          return (
            <div key={i} className="flex gap-3 rounded-2xl bg-muted/60 p-4">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-foreground ring-1 ring-black/5 dark:ring-white/10">
                <Icon className="size-4" />
              </span>
              <div>
                <p className="font-medium">{r.title}</p>
                <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Formats & quality */}
      <h3 className="mt-8 font-display text-lg font-semibold">{info.formatsTitle}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {info.formats.map((f, i) => (
          <li key={i}>
            <span className="font-medium text-foreground">{f.label}</span> {f.text}
          </li>
        ))}
      </ul>

      {/* Tips */}
      <h3 className="mt-8 font-display text-lg font-semibold">{info.tipsTitle}</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {info.tips.map((t, i) => (
          <li key={i}>
            <span className="font-medium text-foreground">{t.label}</span> {t.text}
          </li>
        ))}
      </ul>

      {/* Legality */}
      <h3 className="mt-8 font-display text-lg font-semibold">{info.safetyTitle}</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{info.safety}</p>

      {/* FAQ */}
      <h3 className="mt-8 font-display text-lg font-semibold">{info.faqTitle}</h3>
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-muted/60">
        {info.faq.map((item, i) => (
          <details key={i} className="group px-4">
            <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 font-medium">
              {item.q}
              <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
