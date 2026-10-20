import { motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { sound } from '../../audio/sound'
import { StopSign } from '../../components/StopSign'
import { LETTERS } from '../../data/categories'
import type { RoomState } from '../../game/types'

/** Roleta de letras desacelerando até parar na letra sorteada. */
export function Drawing({ room }: { room: RoomState }) {
  const target = room.round?.letter ?? 'A'
  const [shown, setShown] = useState(LETTERS[0])
  const [done, setDone] = useState(false)
  const reduce = useReducedMotion()

  // o componente monta de novo a cada rodada (a fase muda), então o estado inicial já zera
  useEffect(() => {
    let delay = 45
    let elapsed = 0
    let i = Math.floor(Math.random() * LETTERS.length)
    let timer = 0
    const step = () => {
      elapsed += delay
      if (elapsed > 2300) {
        setShown(target)
        setDone(true)
        sound.play('letterReveal')
        return
      }
      i = (i + 1) % LETTERS.length
      setShown(LETTERS[i])
      sound.play('spinTick', { pitch: 0.85 + Math.random() * 0.3 })
      delay = Math.min(260, delay * 1.13)
      timer = window.setTimeout(step, delay)
    }
    timer = window.setTimeout(step, delay)
    return () => window.clearTimeout(timer)
  }, [target, room.roundIndex])

  return (
    <div className="drawing">
      <p className="drawing__label">{done ? 'A letra é…' : 'Sorteando a letra…'}</p>
      {/* "reduzir movimento": sem tremedeira infinita nem pulo na revelação */}
      <motion.div
        animate={reduce ? undefined : done ? { scale: [1, 1.35, 1], rotate: [0, -8, 0] } : { rotate: [0, 3, -3, 0] }}
        transition={done ? { duration: 0.6 } : { repeat: Infinity, duration: 0.3 }}
      >
        <StopSign letter={shown} size={240} className={done ? 'stopsign--reveal' : ''} />
      </motion.div>
      {/* leitor de tela ouve só a letra final, não a roleta */}
      <p className="sr-only" aria-live="polite">
        {done ? `Letra da rodada: ${target}` : ''}
      </p>
      {done && (
        <motion.p className="drawing__go" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          Rodada {room.roundIndex} de {room.settings.rounds} · prepare os dedos!
        </motion.p>
      )}
    </div>
  )
}
