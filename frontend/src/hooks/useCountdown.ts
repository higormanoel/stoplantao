import { useEffect, useState } from 'react'
import { useGame } from '../store/gameStore'

/** ms restantes até `endsAt` (relógio do servidor), atualizado a cada `step` ms */
export function useCountdown(endsAt: number | null, step = 100): number {
  const now = useGame((s) => s.now)
  const [clock, setClock] = useState(() => now())
  useEffect(() => {
    const id = window.setInterval(() => setClock(now()), step)
    return () => window.clearInterval(id)
  }, [step, now])
  return endsAt ? Math.max(0, endsAt - clock) : 0
}
