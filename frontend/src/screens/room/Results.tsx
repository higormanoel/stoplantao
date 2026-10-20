import { animate, motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { sound } from '../../audio/sound'
import { Avatar } from '../../components/Avatar'
import { GameButton } from '../../components/GameButton'
import { IconArrowRight } from '../../components/Icons'
import { CATEGORY_BY_ID } from '../../data/categories'
import type { RoomState } from '../../game/types'
import { useCountdown } from '../../hooks/useCountdown'
import { useGame, useMe } from '../../store/gameStore'

export function Results({ room }: { room: RoomState }) {
  const me = useMe()
  const send = useGame((s) => s.send)
  const summary = room.history[room.history.length - 1]
  if (!summary) return null
  const last = room.roundIndex >= room.settings.rounds
  const rows = room.players.slice().sort((a, b) => (summary.points[b.id] ?? 0) - (summary.points[a.id] ?? 0) || b.score - a.score)
  const stopper = summary.stopBy ? room.players.find((p) => p.id === summary.stopBy) : null

  return (
    <div className="results">
      <div className="results__head">
        <h2 className="title">Placar da rodada {summary.index}</h2>
        <p className="subtitle">
          Letra <b className="hl">{summary.letter}</b> · {stopper ? `STOP de ${stopper.name}` : 'ninguém deu STOP'}
        </p>
      </div>
      <div className="results__legend">
        <span className="dot dot--valid" /> única 10 <span className="dot dot--repeated" /> repetida 5 <span className="dot dot--invalid" /> inválida 0
      </div>
      <ol className="results__list">
        {rows.map((p, i) => (
          <motion.li
            key={p.id}
            className={`rrow ${p.id === me?.id ? 'rrow--me' : ''}`}
            initial={{ opacity: 0, x: -40 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 1.3 + i * 0.12, type: 'spring', stiffness: 300, damping: 24 }}
          >
            <span className="rrow__rank">{i + 1}</span>
            <Avatar memberId={p.memberId} size={48} />
            <div className="rrow__main">
              <b>{p.id === me?.id ? `${p.name} (você)` : p.name}</b>
              <div className="rrow__cells">
                {room.settings.categoryIds.map((c) => {
                  const cell = summary.cells[p.id]?.[c]
                  return (
                    <span key={c} className={`cell cell--${cell?.status ?? 'empty'}`} title={`${CATEGORY_BY_ID[c]?.label}: ${cell?.value || '—'}`}>
                      <small>{CATEGORY_BY_ID[c]?.label}</small>
                      {cell?.value || '—'}
                    </span>
                  )
                })}
              </div>
            </div>
            <div className="rrow__pts">
              <CountUp to={summary.points[p.id] ?? 0} delay={1.5 + i * 0.12} prefix="+" />
              <small>total {p.score}</small>
            </div>
          </motion.li>
        ))}
      </ol>
      <div className="room__actions">
        <NextIn endsAt={room.phaseEndsAt} last={last} />
        {me?.isHost && (
          <GameButton size="lg" icon={<IconArrowRight />} onClick={() => send({ type: 'next' })}>
            {last ? 'Ver pódio' : 'Próxima'}
          </GameButton>
        )}
      </div>
    </div>
  )
}

/** contagem própria: só este rótulo re-renderiza a cada tique, não o placar inteiro */
function NextIn({ endsAt, last }: { endsAt: number | null; last: boolean }) {
  const left = useCountdown(endsAt, 250)
  return (
    <span className="muted">
      {last ? 'Pódio' : 'Próxima rodada'} em {Math.ceil(left / 1000)}s
    </span>
  )
}

function CountUp({ to, delay, prefix = '' }: { to: number; delay: number; prefix?: string }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    let lastCoin = 0
    const controls = animate(0, to, {
      delay,
      duration: Math.min(1.4, 0.3 + to / 80),
      ease: 'easeOut',
      onUpdate: (x) => {
        const r = Math.round(x)
        setV(r)
        if (r - lastCoin >= 10 || (r === to && r !== lastCoin)) {
          lastCoin = r
          sound.play('coin', { pitch: 0.9 + Math.min(0.5, r / 200) })
        }
      },
    })
    return () => controls.stop()
  }, [to, delay])
  return (
    <b className="countup">
      {prefix}
      {v}
    </b>
  )
}
