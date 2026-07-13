import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { ReportForm } from '@/components/report-form'

export const metadata: Metadata = {
  title: 'Report DMCA — stepbro downloader',
  description: 'Rights holders can block a video from being downloaded through the Service.',
}

export default function ReportPage() {
  return (
    <PageShell title="Report DMCA">
      <ReportForm />
    </PageShell>
  )
}
