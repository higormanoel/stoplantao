import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { sound } from '../../audio/sound'
import { Avatar } from '../../components/Avatar'
import { GameButton } from '../../components/GameButton'
import { IconCheck, IconThumbDown, IconThumbUp } from '../../components/Icons'
import { TimerBar } from '../../components/TimerBar'
import { CATEGORY_BY_ID } from '../../data/categories'
import { TIMINGS, isVotable } from '../../game/rules'
import type { RoomState } from '../../game/types'
import { useGame, useMe } from '../../store/gameStore'

export function Validation({ room }: { room: RoomState }) {
  const me = useMe()
  const send = useGame((s) => s.send)
  const round = room.round!
  const idx = round.validationIndex
  const catId = room.settings.categoryIds[idx]
  const cat = CATEGORY_BY_ID[catId]
  const votes = round.votes[catId] ?? {}
  // duplo clique em "Avaliar" não pode pular a próxima categoria
  const armedAt = useRef(0)
  useEffect(() => {
    armedAt.current = Date.now() + 700
  }, [idx, round.id])

  const rows = room.players.map((p) => {
    const value = (round.answers[p.id]?.[catId] ?? '').trim()
    const votable = isVotable(value, round.letter)
    const v = votes[p.id] ?? {}
    const against = Object.values(v).filter((x) => x === false).length
    const myVote = me ? v[me.id] !== false : true
    return { p, value, votable, against, myVote }
  })
  // categoria sem resposta votável: o motor encurta a etapa (emptyStepMs) e não há o que bipar
  const hasVotables = rows.some((r) => r.votable)

  const toggle = (targetId: string, current: boolean) => {
    if (!me || me.ready) return
    sound.play(current ? 'voteInvalid' : 'voteValid')
    send({ type: 'vote', roundId: round.id, categoryId: catId, targetId, valid: !current })
  }

  return (
    <div className="validation">
      <TimerBar
        key={`${round.id}-${catId}`}
        endsAt={room.phaseEndsAt}
        totalMs={hasVotables ? room.settings.validateSeconds * 1000 : TIMINGS.emptyStepMs}
        beepLast={hasVotables ? 5 : 0}
        beepSound="tick"
      />
      <AnimatePresence mode="wait">
        <motion.div key={catId} className="validation__panel" initial={{ x: 80, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -80, opacity: 0 }} transition={{ type: 'spring', stiffness: 380, damping: 30 }}>
          <div className="validation__head">
            <h2 className="title">{cat?.label ?? catId}</h2>
            <p className="subtitle">
              Vale ou não vale? <b>{idx + 1}</b>/{room.settings.categoryIds.length} · letra <b className="hl">{round.letter}</b>
            </p>
          </div>
          <ul className="validation__list">
            {rows.map(({ p, value, votable, against, myVote }, i) => {
              const mine = p.id === me?.id
              return (
                <motion.li key={p.id} className="vrow" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Avatar memberId={p.memberId} size={44} />
                  <span className="vrow__name">{mine ? 'Você' : p.name}</span>
                  {!votable ? (
                    <span className="answerchip answerchip--dead">
                      <span className="answerchip__text">{value ? <s>{value}</s> : <em>em branco</em>}</span>
                    </span>
                  ) : mine ? (
                    <span className="answerchip answerchip--mine" title={value}>
                      <span className="answerchip__text">{value}</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      className={`answerchip answerchip--vote ${myVote ? 'is-valid' : 'is-invalid'}`}
                      onClick={() => toggle(p.id, myVote)}
                      disabled={me?.ready}
                      aria-pressed={!myVote}
                      title={myVote ? 'Clique para invalidar' : 'Clique para validar'}
                    >
                      {myVote ? <IconThumbUp width={18} height={18} /> : <IconThumbDown width={18} height={18} />}
                      <span className="answerchip__text">{value}</span>
                    </button>
                  )}
                  {votable && against > 0 && (
                    <span className="vrow__against" title={`${against} voto(s) contra`}>
                      <IconThumbDown width={14} height={14} /> {against}
                    </span>
                  )}
                </motion.li>
              )
            })}
          </ul>
        </motion.div>
      </AnimatePresence>
      <div className="room__actions">
        {me?.ready ? (
          <p className="muted">
            <IconCheck width={18} height={18} /> Pronto! Esperando o time…
          </p>
        ) : (
          <GameButton size="lg" variant="mint" icon={<IconCheck />} onClick={() => Date.now() >= armedAt.current && send({ type: 'ready', roundId: round.id, categoryId: catId })}>
            Avaliar
          </GameButton>
        )}
      </div>
    </div>
  )
}
