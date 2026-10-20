import { useEffect, useRef } from 'react'
import { sound } from '../audio/sound'
import { useCountdown } from '../hooks/useCountdown'
import { IconHeartbeat } from './Icons'

interface Props {
  endsAt: number | null
  totalMs: number
  /** últimos N segundos tocam o bipe de monitor */
  beepLast?: number
  beepSound?: 'monitorBeep' | 'tick'
  label?: string
}

/** Barra de tempo estilo monitor cardíaco. Nos segundos finais o bipe acelera. */
export function TimerBar({ endsAt, totalMs, beepLast = 10, beepSound = 'monitorBeep', label }: Props) {
  const left = useCountdown(endsAt, 100)
  const secs = Math.ceil(left / 1000)
  const lastBeep = useRef<number | null>(null)
  const pct = totalMs > 0 ? Math.max(0, Math.min(1, left / totalMs)) : 0
  const danger = secs <= beepLast && left > 0

  useEffect(() => {
    if (!danger) return
    if (lastBeep.current === secs) return
    lastBeep.current = secs
    sound.play(beepSound, { intensity: 1 - secs / beepLast })
  }, [secs, danger, beepLast, beepSound])

  return (
    <div className={`timer ${danger ? 'timer--danger' : ''}`} role="timer" aria-label={`${secs} segundos`}>
      <IconHeartbeat className="timer__icon" />
      <div className="timer__track">
        <div className="timer__fill" style={{ transform: `scaleX(${pct})` }} />
        <svg className="timer__ecg" viewBox="0 0 400 20" preserveAspectRatio="none" aria-hidden>
          <path d="M0 10 H60 l6 -8 l7 16 l6 -12 l4 4 H160 l6 -8 l7 16 l6 -12 l4 4 H260 l6 -8 l7 16 l6 -12 l4 4 H400" />
        </svg>
      </div>
      <span className="timer__secs">
        {label ? `${label} ` : ''}
        {secs}s
      </span>
    </div>
  )
}
