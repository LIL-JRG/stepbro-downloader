// Lazy, client-only wrapper around cuelume so Web Audio is never touched during
// SSR. Sounds are best-effort: if the module fails to load, everything no-ops.
//
// Available cues: chime, sparkle, droplet, bloom, whisper, tick, press, release,
// toggle, success.

export type Cue =
  | 'chime'
  | 'sparkle'
  | 'droplet'
  | 'bloom'
  | 'whisper'
  | 'tick'
  | 'press'
  | 'release'
  | 'toggle'
  | 'success'

let play: ((cue: Cue) => void) | null = null
let loader: Promise<void> | null = null

/** Load cuelume once and wire any data-cuelume-* attributes. Safe to call often. */
export function initSound(): void {
  if (typeof window === 'undefined' || loader) return
  loader = import('cuelume')
    .then((m) => {
      m.bind()
      play = m.play
    })
    .catch(() => {
      /* sounds are optional */
    })
}

/** Play an interaction cue (no-op until cuelume has loaded). */
export function playCue(cue: Cue): void {
  try {
    play?.(cue)
  } catch {
    /* ignore */
  }
}
