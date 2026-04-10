'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CheckCircle, XCircle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type DownloadStatus = 'running' | 'complete' | 'failed'

export interface DownloadJob {
  id: string
  title: string
  status: DownloadStatus
  percent: number
  speed?: string
  eta?: string
  size?: string
  log: string[]
}

function StatusIcon({ status }: { status: DownloadStatus }) {
  if (status === 'complete') return <CheckCircle className="size-4 text-green-500 shrink-0" />
  if (status === 'failed') return <XCircle className="size-4 text-destructive shrink-0" />
  return <Loader2 className="size-4 text-muted-foreground shrink-0 animate-spin" />
}

export function DownloadProgress({ jobs }: { jobs: DownloadJob[] }) {
  if (jobs.length === 0) return null

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <h2 className="text-[15px] font-normal text-foreground tracking-[-0.45px]">
        Downloads
      </h2>
      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {jobs.map((job) => (
            <motion.div
              key={job.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
            >
              <div className="flex items-start gap-2">
                <StatusIcon status={job.status} />
                <p className="text-sm font-medium leading-snug line-clamp-1 flex-1 tracking-[-0.3px]">
                  {job.title}
                </p>
              </div>

              <Progress
                value={job.percent}
                className={cn(
                  'h-1',
                  job.status === 'complete' && '[&>div]:bg-green-500',
                  job.status === 'failed' && '[&>div]:bg-destructive'
                )}
              />

              <div className="flex gap-3 text-xs text-muted-foreground">
                <span>{job.percent.toFixed(1)}%</span>
                {job.size && <span>{job.size}</span>}
                {job.speed && job.status === 'running' && <span>{job.speed}</span>}
                {job.eta && job.status === 'running' && <span>ETA {job.eta}</span>}
                {job.status === 'complete' && <span className="text-green-500">Complete</span>}
                {job.status === 'failed' && <span className="text-destructive">Failed</span>}
              </div>

              {job.log.length > 0 && (
                <ScrollArea className="h-16 w-full">
                  <div className="space-y-0.5">
                    {job.log.slice(-10).map((line, i) => (
                      <p key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">
                        {line}
                      </p>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
