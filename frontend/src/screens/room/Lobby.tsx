import { AnimatePresence, motion } from 'framer-motion'
import { sound } from '../../audio/sound'
import { Avatar } from '../../components/Avatar'
import { GameButton } from '../../components/GameButton'
import { IconBot, IconCopy, IconCrown, IconPlay, IconPlus, IconX } from '../../components/Icons'
import { CATEGORY_BY_ID } from '../../data/categories'
import { TEAM, TEAM_BY_ID } from '../../data/team'
import type { RoomState } from '../../game/types'
import { useGame, useMe } from '../../store/gameStore'

export function Lobby({ room }: { room: RoomState }) {
  const me = useMe()
  const send = useGame((s) => s.send)
  const addBot = useGame((s) => s.addBot)
  const toast = useGame((s) => s.toast)
  const transport = useGame((s) => s.transport)
  const isLocal = transport?.kind === 'local'
  const canAdd = room.players.length < Math.min(room.settings.maxPlayers, TEAM.length)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(room.code)
      toast(`Código ${room.code} copiado!`)
    } catch {
      toast(`Código da sala: ${room.code}`)
    }
  }

  return (
    <div className="lobby">
      <div className="lobby__top">
        <div>
          <h2 className="title title--sm">{isLocal ? 'Treino com o time' : 'Sala online'}</h2>
          <button type="button" className="lobby__code" onClick={copy} title="Copiar código">
            Código <b>{room.code}</b> <IconCopy width={18} height={18} />
          </button>
        </div>
        <div className="lobby__rules">
          <span className="pill">{room.settings.rounds} rodadas</span>
          <span className="pill">{room.settings.answerSeconds}s por rodada</span>
          <span className="pill">{room.settings.categoryIds.length} categorias</span>
        </div>
      </div>

      <div className="lobby__cats">
        {room.settings.categoryIds.map((id) => (
          <span key={id} className={`chip chip--static ${CATEGORY_BY_ID[id]?.medical ? 'chip--med' : ''}`}>
            {CATEGORY_BY_ID[id]?.label ?? id}
          </span>
        ))}
      </div>

      <div className="lobby__grid">
        <AnimatePresence>
          {room.players.map((p) => (
            <motion.div
              key={p.id}
              className="lobby__card"
              style={{ ['--card-color' as string]: TEAM_BY_ID[p.memberId]?.color }}
              initial={{ opacity: 0, scale: 0.3, y: 40, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, y: 0, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 420, damping: 18 }}
              layout
            >
              <Avatar memberId={p.memberId} size={84} pop ring={p.id === me?.id ? 'me' : 'none'} />
              <b>{p.name}</b>
              <span>{TEAM_BY_ID[p.memberId]?.role}</span>
              {p.isHost && (
                <span className="lobby__badge lobby__badge--host" title="Host">
                  <IconCrown width={16} height={16} />
                </span>
              )}
              {p.isBot && (
                <span className="lobby__badge" title="Bot do modo treino">
                  <IconBot width={16} height={16} />
                </span>
              )}
              {me?.isHost && p.id !== me.id && (
                <button
                  type="button"
                  className="lobby__kick"
                  aria-label={`Remover ${p.name}`}
                  onClick={() => {
                    // gente de verdade só sai com confirmação (no toque não há hover para "avisar")
                    if (!p.isBot && !window.confirm(`Remover ${p.name} da sala?`)) return
                    send({ type: 'kick', targetId: p.id })
                  }}
                >
                  <IconX width={14} height={14} />
                </button>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {isLocal && me?.isHost && canAdd && (
          <motion.button type="button" className="lobby__card lobby__card--add" onClick={addBot} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.95 }} onMouseEnter={() => sound.play('hover')}>
            <IconPlus width={40} height={40} />
            <b>Chamar colega</b>
          </motion.button>
        )}
      </div>

      <div className="room__actions">
        {me?.isHost ? (
          <GameButton size="xl" icon={<IconPlay />} onClick={() => send({ type: 'start' })} disabled={room.players.length < 2} sfx="go">
            Começar o plantão
          </GameButton>
        ) : (
          <p className="muted">Esperando o host começar…</p>
        )}
      </div>
    </div>
  )
}
