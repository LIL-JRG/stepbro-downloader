import type { Metadata } from 'next'
import Link from 'next/link'
import { PageShell } from '@/components/page-shell'

export const metadata: Metadata = {
  title: 'Copyright Disclaimer — stepbro downloader',
  description: 'How stepbro downloader handles copyright, liability, and takedown requests.',
}

export default function CopyrightPage() {
  return (
    <PageShell title="Copyright Disclaimer">
      <div className="space-y-6 text-sm leading-relaxed text-muted-foreground">
        <p className="text-xs">Last updated: 2026-07-12</p>

        <p>
          stepbro downloader (the &ldquo;Service&rdquo;) is an open-source, self-hostable web tool
          for downloading publicly available media from YouTube, TikTok, X, Instagram and many other
          sites. By using it and submitting a link, you confirm that you have read, understood and
          agree to this Copyright Disclaimer.
        </p>

        <section>
          <h2 className="font-display text-lg font-semibold text-foreground">
            1. No copyright infringement
          </h2>
          <p className="mt-2">
            The Service is meant for personal, educational and non-commercial use with content you
            are allowed to download. Downloading, converting or sharing copyrighted material without
            the explicit permission of its owner is not allowed.
          </p>
          <p className="mt-2">It is your responsibility to make sure the content you download is:</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>owned by you;</li>
            <li>in the public domain;</li>
            <li>released under a Creative Commons or similar open license that permits it; or</li>
            <li>explicitly authorized for download by the rights holder.</li>
          </ul>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-foreground">
            2. Limitation of liability
          </h2>
          <p className="mt-2">
            The Service is a neutral tool. Files are fetched to a temporary location, streamed to
            your browser, and then deleted — nothing is stored, catalogued, indexed or redistributed
            on the server. As a result, the operators make no warranties about the legality or
            appropriateness of the content you process, and are not liable for any damages arising
            from misuse. You agree to hold the operators harmless from any claims resulting from your
            use of the Service or your infringement of third-party rights.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-foreground">
            3. Your responsibilities
          </h2>
          <p className="mt-2">
            By using the Service you confirm you hold the rights or permissions needed for the media
            you download. Downloading from unauthorized sources may breach copyright law and the
            terms of service of the source platform (including YouTube&rsquo;s Terms of Service). The
            Service does not pre-screen or review submitted links, and you assume all associated
            legal and financial risk.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-foreground">
            4. Abuse prevention
          </h2>
          <p className="mt-2">
            To protect rights holders and keep the Service healthy, the operator may, at its
            discretion and without notice, block specific videos or URLs, apply daily download
            limits, and restrict access for anyone abusing the tool.
          </p>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold text-foreground">
            5. DMCA &amp; takedown requests
          </h2>
          <p className="mt-2">
            We respect creators&rsquo; rights. If you are a rights holder (or their agent) and believe
            your content is being downloaded through this Service without authorization, you can have
            it blocked from further downloads via the{' '}
            <Link href="/report" className="font-medium text-foreground underline underline-offset-2">
              DMCA report page
            </Link>
            . Valid notices are actioned promptly.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
