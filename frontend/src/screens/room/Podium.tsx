import confetti from 'canvas-confetti'
import { motion } from 'framer-motion'
import { useEffect } from 'react'
import { Avatar } from '../../components/Avatar'
import { GameButton } from '../../components/GameButton'
import { IconCrown, IconDoor, IconPlay } from '../../components/Icons'
import { TEAM_BY_ID } from '../../data/team'
import { placements } from '../../game/engine'
import type { Player, RoomState } from '../../game/types'
import { useGame, useMe } from '../../store/gameStore'

const IFH_CONFETTI = ['#FF4200', '#FF6A2B', '#FFFFFF', '#FFC93C', '#3DDC97', '#FF8A3D']

export function Podium({ room }: { room: RoomState }) {
  const me = useMe()
  const send = useGame((s) => s.send)
  const leave = useGame((s) => s.leaveRoom)
  // empate divide a colocação (1, 1, 3…): quem empata em 1º sobe junto no bloco do topo
  const placed = placements(room)
  const byPlace = (n: number) => placed.filter((x) => x.place === n)
  const winners = byPlace(1)
  const rest = placed.filter((x) => x.place > 3)

  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) return
    const end = Date.now() + 2600
    let raf = 0
    const frame = () => {
      confetti({ particleCount: 5, angle: 60, spread: 70, origin: { x: 0, y: 0.7 }, colors: IFH_CONFETTI })
      confetti({ particleCount: 5, angle: 120, spread: 70, origin: { x: 1, y: 0.7 }, colors: IFH_CONFETTI })
      if (Date.now() < end) raf = requestAnimationFrame(frame)
    }
    const t = window.setTimeout(() => {
      confetti({ particleCount: 160, spread: 100, origin: { y: 0.45 }, colors: IFH_CONFETTI, scalar: 1.1 })
      frame()
    }, 900)
    return () => {
      window.clearTimeout(t)
      cancelAnimationFrame(raf)
    }
  }, [])

  const nameOf = (p: Player) => (p.id === me?.id ? 'Você' : p.name)
  const names = winners.map((x) => nameOf(x.player))
  const tieNames = names.length > 1 ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}` : ''
  const title = winners.length === 0 ? 'Fim do plantão!' : winners.length > 1 ? 'Empate no plantão!' : `${names[0]} venceu o plantão!`

  return (
    <div className="podium">
      <motion.h2 className="title title--xl" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 12 }}>
        {title}
      </motion.h2>
      {tieNames && <p className="subtitle podium__tie">{tieNames} dividem o 1º lugar</p>}
      <div className="podium__stage">
        {[2, 1, 3].map((place) => {
          const group = byPlace(place)
          if (!group.length) return <div key={place} className="podium__slot podium__slot--empty" />
          const tie = group.length > 1
          const size = (place === 1 ? 128 : 96) * (tie ? 0.75 : 1)
          return (
            <motion.div
              key={place}
              className={`podium__slot podium__slot--${place} ${tie ? 'podium__slot--tie' : ''}`}
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: place === 1 ? 0.9 : place === 2 ? 0.5 : 0.2, type: 'spring', stiffness: 200, damping: 16 }}
              style={{ ['--card-color' as string]: TEAM_BY_ID[group[0].player.memberId]?.color }}
            >
              {place === 1 && <IconCrown className="podium__crown" width={54} height={54} />}
              <div className="podium__people">
                {group.map(({ player: p }) => (
                  <div key={p.id} className="podium__person">
                    <Avatar memberId={p.memberId} size={size} pop ring={p.id === me?.id ? 'me' : 'none'} />
                    <b>{p.name}</b>
                    <span>{p.score} pts</span>
                  </div>
                ))}
              </div>
              <div className="podium__block">{place}º</div>
            </motion.div>
          )
        })}
      </div>
      {rest.length > 0 && (
        <ol className="podium__rest">
          {rest.map(({ player: p, place }) => (
            <li key={p.id} value={place}>
              <small>{place}º</small>
              <Avatar memberId={p.memberId} size={34} /> {p.name} <b>{p.score}</b>
            </li>
          ))}
        </ol>
      )}
      <div className="room__actions">
        {me?.isHost && (
          <GameButton size="lg" icon={<IconPlay />} onClick={() => send({ type: 'restart' })}>
            Jogar de novo
          </GameButton>
        )}
        <GameButton size="lg" variant="ghost" icon={<IconDoor />} onClick={leave} sfx="back">
          Sair
        </GameButton>
      </div>
    </div>
  )
}
