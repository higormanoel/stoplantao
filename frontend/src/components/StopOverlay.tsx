import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { useGame } from '../store/gameStore'
import { Avatar } from './Avatar'

/** Explosão de STOP! (ou linha reta de "tempo esgotado") por cima do tabuleiro. */
export function StopOverlay() {
  const flash = useGame((s) => s.stopFlash)
  const room = useGame((s) => s.room)
  const me = useGame((s) => s.profile.playerId)
  const [hiddenKey, setHiddenKey] = useState<number | null>(null)
  const reduce = useReducedMotion()
  const visible = !!flash && flash.key !== hiddenKey

  useEffect(() => {
    if (!flash) return
    const id = window.setTimeout(() => setHiddenKey(flash.key), 2600)
    return () => window.clearTimeout(id)
  }, [flash])

  const stopper = flash?.playerId ? room?.players.find((p) => p.id === flash.playerId) : null

  return (
    <AnimatePresence>
      {visible && flash && (
        <motion.div key={flash.key} className={`stopfx ${stopper ? 'stopfx--stop' : 'stopfx--time'}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          {/* "reduzir movimento": sem clarão branco nem STOP! batendo na tela */}
          {!reduce && <motion.div className="stopfx__flash" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.5 }} />}
          {stopper ? (
            <>
              <div className="stopfx__rays" aria-hidden />
              <motion.div
                className="stopfx__word"
                initial={reduce ? { rotate: -6, opacity: 0 } : { scale: 3.2, rotate: -18, opacity: 0 }}
                animate={{ scale: 1, rotate: -6, opacity: 1 }}
                transition={reduce ? { duration: 0.2 } : { type: 'spring', stiffness: 520, damping: 14 }}
              >
                STOP!
              </motion.div>
              <motion.div className="stopfx__by" initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
                <Avatar memberId={stopper.memberId} size={64} ring="stop" />
                <span>{stopper.id === me ? 'Você deu STOP!' : `${stopper.name} deu STOP!`}</span>
              </motion.div>
            </>
          ) : (
            <>
              <svg className="stopfx__flatline" viewBox="0 0 600 120" aria-hidden>
                <path d="M0 60 H180 l14 -40 l16 80 l14 -60 l10 20 H600" />
              </svg>
              <motion.div className="stopfx__word stopfx__word--time" initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}>
                TEMPO ESGOTADO
              </motion.div>
              <motion.div className="stopfx__by" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                <span>Ninguém deu STOP…</span>
              </motion.div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
