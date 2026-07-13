import type { Metadata } from 'next'
import { PageShell } from '@/components/page-shell'
import { AdminReports } from '@/components/admin-reports'

export const metadata: Metadata = {
  title: 'Review reports — stepbro downloader',
  robots: { index: false, follow: false },
}

export default function AdminPage() {
  return (
    <PageShell title="Review DMCA reports">
      <AdminReports />
    </PageShell>
  )
}
