import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { felipePoseUrl } from '../data/team'
import { useGame } from '../store/gameStore'

/** Dr. Felipe aparece no canto, com a pose da fala e o balão de legenda. */
export function Narrator() {
  const cue = useGame((s) => s.narrator)
  const dismiss = useGame((s) => s.dismissNarrator)
  const room = useGame((s) => s.room)
  const stopper = cue?.byPlayerId ? room?.players.find((p) => p.id === cue.byPlayerId) : null

  useEffect(() => {
    if (!cue) return
    const words = cue.line.text.split(/\s+/).length
    const ms = cue.ms && cue.ms > 0 ? cue.ms + 1200 : words * 420 + 2200
    const id = window.setTimeout(dismiss, Math.max(3800, ms))
    return () => window.clearTimeout(id)
  }, [cue, dismiss])

  return (
    <AnimatePresence>
      {cue && (
        <motion.div
          key={cue.key}
          className="narrator"
          initial={{ y: 220, rotate: 8, opacity: 0 }}
          animate={{ y: 0, rotate: 0, opacity: 1 }}
          exit={{ y: 240, rotate: -6, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          onClick={dismiss}
          role="status"
          aria-live="assertive"
        >
          <motion.div
            className="narrator__bubble"
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 16 }}
          >
            <span className="narrator__who">Dr. Felipe{stopper ? ` para ${stopper.name}` : ''}</span>
            <p>“{cue.line.text}”</p>
          </motion.div>
          <motion.img
            className="narrator__img"
            src={felipePoseUrl(cue.line.pose)}
            alt="Dr. Felipe"
            animate={{ rotate: [0, -3, 3, -2, 0] }}
            transition={{ duration: 0.9, repeat: 2 }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  )
}
