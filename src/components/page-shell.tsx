'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'

// Shared shell for standalone pages (copyright, report): blue canvas, a minimal
// header that links home, and a centered content card matching the main UI.
export function PageShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh flex-col bg-page">
      <header className="px-4 py-3.5 sm:px-6">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-2">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 font-display text-lg font-bold tracking-tight text-white"
          >
            <ArrowLeft className="size-4" />
            stepbro downloader
          </Link>
          <ThemeToggle className="text-white hover:bg-white/20 hover:text-white" />
        </div>
      </header>

      <main className="flex-1 px-4 pb-16">
        <div className="mx-auto w-full max-w-3xl pt-6 sm:pt-10">
          <div className="rounded-3xl bg-card p-6 text-card-foreground shadow-2xl shadow-black/20 ring-1 ring-black/5 sm:p-9 dark:ring-white/10">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
            <div className="mt-5">{children}</div>
          </div>
        </div>
      </main>
    </div>
  )
}
