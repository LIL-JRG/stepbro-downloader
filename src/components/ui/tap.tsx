'use client'

import { motion } from 'framer-motion'
import { cn } from '@/lib/utils'

// amicro-style tactile press: a tiny spring scale on hover/tap. Wrap any button
// or link to give it a physical feel without changing its markup.
export function Tap({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.span
      className={cn('inline-flex', className)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 600, damping: 25 }}
    >
      {children}
    </motion.span>
  )
}
