'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, ArrowUpRight } from 'lucide-react'

// amicro "SlideArrowButton" pattern: the leading icon swaps (heart → arrow) with
// a spring on hover, hinting it opens an external page.
export function DonateButton({ href, label }: { href: string; label: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <motion.a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onHoverStart={() => setHovered(true)}
      onHoverEnd={() => setHovered(false)}
      whileTap={{ scale: 0.96 }}
      className="inline-flex h-8 items-center gap-1.5 rounded-full bg-amber-400 px-3.5 text-sm font-semibold text-amber-950 transition-colors hover:bg-amber-300"
    >
      <span className="grid size-3.5 place-items-center">
        <AnimatePresence mode="popLayout" initial={false}>
          {hovered ? (
            <motion.span
              key="arrow"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ type: 'spring', stiffness: 600, damping: 25 }}
            >
              <ArrowUpRight className="size-3.5" />
            </motion.span>
          ) : (
            <motion.span
              key="heart"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -6 }}
              transition={{ type: 'spring', stiffness: 600, damping: 25 }}
            >
              <Heart className="size-3.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      <span className="hidden sm:inline">{label}</span>
    </motion.a>
  )
}
