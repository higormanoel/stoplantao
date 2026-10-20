import { AnimatePresence, motion } from 'framer-motion'
import { TEAM_BY_ID } from '../data/team'
import type { RoomState } from '../game/types'
import { useGame } from '../store/gameStore'
import { Avatar } from './Avatar'
import { IconBot, IconCheck, IconCrown } from './Icons'

export function PlayerList({ room }: { room: RoomState }) {
  const me = useGame((s) => s.profile.playerId)
  const total = room.settings.categoryIds.length
  const players = room.phase === 'lobby' ? room.players : room.players.slice().sort((a, b) => b.score - a.score)
  const showProgress = room.phase === 'answering'
  const showReady = room.phase === 'validating'
  // anel/etiqueta de STOP só enquanto a rodada que ele parou está em jogo (não no pódio)
  const stopPhase = room.phase === 'stopped' || room.phase === 'validating' || room.phase === 'roundResults'
  return (
    <aside className="plist" aria-label="Jogadores">
      <div className="plist__head">
        <span>Jogadores</span>
        <b>
          {room.players.filter((p) => p.connected).length}/{room.settings.maxPlayers}
        </b>
      </div>
      <ul className="plist__items">
        <AnimatePresence initial={false}>
          {players.map((p) => {
            const member = TEAM_BY_ID[p.memberId]
            const isStopper = stopPhase && room.round?.stopBy === p.id
            return (
              <motion.li
                key={p.id}
                layout
                initial={{ opacity: 0, x: -30, scale: 0.8 }}
                animate={{ opacity: p.connected ? 1 : 0.45, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                className={`plist__item ${p.id === me ? 'plist__item--me' : ''} ${isStopper ? 'plist__item--stop' : ''}`}
              >
                {/* empate divide a posição (igual ao pódio) */}
                {room.phase !== 'lobby' && <span className="plist__rank">{1 + room.players.filter((q) => q.score > p.score).length}</span>}
                <Avatar memberId={p.memberId} size={46} ring={isStopper ? 'stop' : p.id === me ? 'me' : 'none'} />
                <div className="plist__info">
                  <div className="plist__name">
                    {p.name}
                    {p.isHost && <IconCrown className="plist__crown" width={14} height={14} />}
                    {p.isBot && <IconBot className="plist__bot" width={14} height={14} />}
                  </div>
                  {showProgress ? (
                    <div className="plist__progress" aria-label={`${p.filled} de ${total}`}>
                      {Array.from({ length: total }, (_, k) => (
                        <span key={k} className={k < p.filled ? 'on' : ''} />
                      ))}
                    </div>
                  ) : (
                    <div className="plist__score">
                      <span className="plist__coin">●</span> {p.score} pts
                      {room.phase === 'lobby' && <span className="plist__role">{member?.role}</span>}
                    </div>
                  )}
                </div>
                {showReady && p.ready && (
                  <span className="plist__ready" title="Pronto">
                    <IconCheck width={16} height={16} />
                  </span>
                )}
                {isStopper && <span className="plist__stoptag">STOP</span>}
              </motion.li>
            )
          })}
        </AnimatePresence>
      </ul>
    </aside>
  )
}
