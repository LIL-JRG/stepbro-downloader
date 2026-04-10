'use client'

import { useEffect, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FolderOpen, Download, RefreshCw, Film, Music, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface ServerFile {
  name: string
  size: number
  mtime: string
  type: 'video' | 'audio'
  mime: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(iso))
}

export function FileLibrary({ refreshTrigger }: { refreshTrigger: number }) {
  const [files, setFiles] = useState<ServerFile[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

  const fetchFiles = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/files')
      const data = await res.json()
      setFiles(data.files ?? [])
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchFiles() }, [fetchFiles, refreshTrigger])

  async function handleDelete(name: string) {
    setDeleting(name)
    try {
      const res = await fetch(`/api/files/${encodeURIComponent(name)}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete')
      setFiles((prev) => prev.filter((f) => f.name !== name))
      toast.success('File deleted')
    } catch {
      toast.error('Could not delete file')
    } finally {
      setDeleting(null)
    }
  }

  if (files.length === 0 && !loading) return null

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-4 text-muted-foreground" />
          <h2 className="text-[15px] font-normal text-foreground tracking-[-0.45px]">
            Library
          </h2>
          {files.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
              {files.length}
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          onClick={fetchFiles}
          disabled={loading}
          aria-label="Refresh library"
        >
          <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <ScrollArea className="max-h-80">
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {files.map((file) => (
              <motion.div
                key={file.name}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors group"
              >
                <div className="flex size-7 items-center justify-center rounded-md bg-muted shrink-0">
                  {file.type === 'video'
                    ? <Film className="size-3.5 text-muted-foreground" />
                    : <Music className="size-3.5 text-muted-foreground" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate tracking-[-0.3px]" title={file.name}>
                    {file.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatBytes(file.size)} · {formatDate(file.mtime)}
                  </p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a
                    href={`/api/files/${encodeURIComponent(file.name)}`}
                    download={file.name}
                  >
                    <Button variant="ghost" size="icon" className="size-7" aria-label={`Download ${file.name}`}>
                      <Download className="size-3.5" />
                    </Button>
                  </a>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7 text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${file.name}`}
                    disabled={deleting === file.name}
                    onClick={() => handleDelete(file.name)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  )
}
