import {
  Clipboard,
  SlidersHorizontal,
  Download,
  Zap,
  ShieldCheck,
  Smartphone,
  Volume2,
} from 'lucide-react'

const STEPS = [
  {
    icon: Clipboard,
    title: 'Copy the link',
    text: 'Grab the URL from your browser’s address bar or the Share menu in any app.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Paste & choose',
    text: 'Paste it above, pick MP4 or MP3, then a resolution (360p → 4K) or audio bitrate.',
  },
  {
    icon: Download,
    title: 'Download',
    text: 'Hit Download and your file arrives with audio. On mobile, keep the tab in front.',
  },
]

const REASONS = [
  { icon: Zap, title: 'Fast & unlimited', text: 'No account and no limits — grab as many files as you want.' },
  { icon: ShieldCheck, title: 'No ads, no clutter', text: 'A clean interface with no pop-ups or fake buttons.' },
  { icon: Smartphone, title: 'Any device', text: 'Works on iPhone, Android, Windows, macOS and most TVs.' },
  { icon: Volume2, title: 'Always with audio', text: 'Video + audio are merged automatically into one file.' },
]

const FAQ = [
  {
    q: 'Is it free and safe?',
    a: 'Yes — it’s free, ad-free and runs entirely in your browser. No sign-up or extra steps.',
  },
  {
    q: 'Why is there no sound at some qualities?',
    a: 'For a few videos a given resolution may be video-only. Pick MP4 here and audio is merged automatically; if a source track is missing, choose a nearby quality that includes audio.',
  },
  {
    q: 'Does it work on iPhone and Android?',
    a: 'Yes. On iPhone (Safari) use the download arrow and “Save to Files”. On Android, files land in your Downloads folder. No app or extension needed.',
  },
  {
    q: 'Can I download long videos?',
    a: 'Yes, though longer or higher-resolution files take more time and depend on your connection. Keep the tab active on mobile and prefer stable Wi-Fi.',
  },
  {
    q: 'Do I need to install anything?',
    a: 'No. Everything is browser-based: paste a link, pick a quality and download.',
  },
  {
    q: 'What about private or region-locked videos?',
    a: 'Private, members-only or geo-restricted content isn’t supported. Try a different link if access is limited.',
  },
]

export function InfoSections() {
  return (
    <section className="mx-auto mt-10 w-full max-w-3xl rounded-3xl bg-card p-6 text-card-foreground shadow-xl shadow-black/10 ring-1 ring-black/5 sm:mt-12 sm:p-9 dark:ring-white/10">
      {/* Intro */}
      <h2 className="font-display text-2xl font-bold tracking-tight sm:text-[28px]">
        The simplest way to save video &amp; audio
      </h2>
      <p className="mt-3 leading-relaxed text-muted-foreground">
        stepbro downloader turns links from YouTube, TikTok, X, Instagram and thousands of other
        sites into a clean MP4 (up to 4K) or an MP3 audio file. MP4 plays on virtually every phone,
        laptop, TV and media app, so you never have to worry about compatibility. Paste a link, pick
        a quality, and download — no apps, no sign-ups and no pop-ups.
      </p>

      {/* How it works */}
      <h3 className="mt-8 font-display text-lg font-semibold">How it works</h3>
      <ol className="mt-4 grid gap-3 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.title} className="rounded-2xl bg-muted/60 p-4">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                <s.icon className="size-4" />
              </span>
              <span className="text-xs font-semibold text-muted-foreground">Step {i + 1}</span>
            </div>
            <p className="mt-2 font-medium">{s.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.text}</p>
          </li>
        ))}
      </ol>

      {/* Why choose */}
      <h3 className="mt-8 font-display text-lg font-semibold">Why people choose it</h3>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {REASONS.map((r) => (
          <div key={r.title} className="flex gap-3 rounded-2xl bg-muted/60 p-4">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background text-foreground ring-1 ring-black/5 dark:ring-white/10">
              <r.icon className="size-4" />
            </span>
            <div>
              <p className="font-medium">{r.title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{r.text}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Formats & quality */}
      <h3 className="mt-8 font-display text-lg font-semibold">Supported formats &amp; quality</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Video:</span> MP4, WebM or MKV — from 360p
          up to 2160p (4K) when the source offers it.
        </li>
        <li>
          <span className="font-medium text-foreground">Audio:</span> MP3, M4A, AAC, Opus and more,
          at your chosen bitrate.
        </li>
        <li>
          <span className="font-medium text-foreground">Compatibility:</span> MP4 works on iPhone,
          Android, Windows, macOS and most TVs and players.
        </li>
        <li>
          <span className="font-medium text-foreground">Availability:</span> if a resolution is
          missing, the original simply wasn’t uploaded in that quality.
        </li>
      </ul>

      {/* Tips */}
      <h3 className="mt-8 font-display text-lg font-semibold">Tips &amp; troubleshooting</h3>
      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground">
        <li>
          <span className="font-medium text-foreground">Missing 1080p/4K:</span> the source probably
          wasn’t uploaded at that resolution — try another quality.
        </li>
        <li>
          <span className="font-medium text-foreground">Stuck on a download:</span> refresh, paste
          again and pick a different quality; disable aggressive ad/script blockers for this page.
        </li>
        <li>
          <span className="font-medium text-foreground">Long videos:</span> keep the tab active on
          mobile and prefer a stable Wi-Fi connection.
        </li>
      </ul>

      {/* Legality */}
      <h3 className="mt-8 font-display text-lg font-semibold">Safety &amp; legality</h3>
      <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
        Use stepbro downloader for content you own or have permission to download. Respect each
        platform’s Terms of Service and the copyright laws in your region. We don’t encourage
        downloading copyrighted content without authorization.
      </p>

      {/* FAQ */}
      <h3 className="mt-8 font-display text-lg font-semibold">Frequently asked questions</h3>
      <div className="mt-4 divide-y divide-border overflow-hidden rounded-2xl bg-muted/60">
        {FAQ.map((item) => (
          <details key={item.q} className="group px-4">
            <summary className="flex cursor-pointer list-none items-center justify-between py-3.5 font-medium">
              {item.q}
              <span className="ml-3 text-muted-foreground transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="pb-4 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}
