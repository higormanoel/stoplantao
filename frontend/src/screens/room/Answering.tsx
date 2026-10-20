import { motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState } from 'react'
import { sound } from '../../audio/sound'
import { GameButton } from '../../components/GameButton'
import { TimerBar } from '../../components/TimerBar'
import { CATEGORY_BY_ID } from '../../data/categories'
import { isVotable } from '../../game/rules'
import type { RoomState } from '../../game/types'
import { useGame } from '../../store/gameStore'

const SEND_DEBOUNCE_MS = 160

export function Answering({ room }: { room: RoomState }) {
  const me = useGame((s) => s.profile.playerId)
  const send = useGame((s) => s.send)
  const round = room.round!
  const letter = round.letter
  const cats = room.settings.categoryIds
  const locked = room.phase !== 'answering'
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...(round.answers[me] ?? {}) }))
  const timers = useRef<Record<string, number>>({})
  /** valores digitados que ainda não saíram (debounce) */
  const pending = useRef<Record<string, string>>({})
  const inputs = useRef<(HTMLInputElement | null)[]>([])
  const okBefore = useRef<Record<string, boolean>>({})

  // nova rodada: limpa o formulário
  useEffect(() => {
    setValues({ ...(round.answers[me] ?? {}) })
    okBefore.current = {}
    pending.current = {}
    window.setTimeout(() => inputs.current[0]?.focus(), 80)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round.id])

  useEffect(() => () => Object.values(timers.current).forEach((t) => window.clearTimeout(t)), [])

  // STOP/tempo esgotado: manda na hora o que ainda estava no debounce (o motor aceita durante a tolerância)
  useEffect(() => {
    if (!locked) return
    for (const [catId, value] of Object.entries(pending.current)) {
      window.clearTimeout(timers.current[catId])
      send({ type: 'answer', roundId: round.id, categoryId: catId, value })
    }
    pending.current = {}
  }, [locked, round.id, send])

  const flush = (catId: string, value: string) => {
    window.clearTimeout(timers.current[catId])
    delete pending.current[catId]
    send({ type: 'answer', roundId: round.id, categoryId: catId, value })
  }

  const onChange = (catId: string, raw: string) => {
    if (locked) return
    const value = raw.length === 1 ? raw.toUpperCase() : raw
    setValues((v) => ({ ...v, [catId]: value }))
    sound.play('type')
    const ok = isVotable(value, letter)
    if (ok && !okBefore.current[catId]) sound.play('fieldOk')
    okBefore.current[catId] = ok
    window.clearTimeout(timers.current[catId])
    pending.current[catId] = value
    timers.current[catId] = window.setTimeout(() => flush(catId, value), SEND_DEBOUNCE_MS)
  }

  const filledOk = useMemo(() => cats.filter((c) => isVotable(values[c], letter)).length, [cats, values, letter])
  const allOk = filledOk === cats.length
  const missing = cats.length - filledOk

  const pressStop = () => {
    if (!allOk || locked) {
      sound.play('error')
      return
    }
    cats.forEach((c) => flush(c, values[c] ?? ''))
    send({ type: 'stop', roundId: round.id })
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if ((e.metaKey || e.ctrlKey) && allOk) return pressStop()
      const next = inputs.current[idx + 1]
      if (next) next.focus()
      else if (allOk) pressStop()
    }
  }

  return (
    <div className={`answering ${locked ? 'answering--locked' : ''}`}>
      <TimerBar endsAt={room.phase === 'answering' ? room.phaseEndsAt : null} totalMs={room.settings.answerSeconds * 1000} />
      <div className="answering__head">
        <h2 className="title title--sm">
          Tudo com <span className="hl">{letter}</span>
        </h2>
        <span className="answering__count">
          {filledOk}/{cats.length} certinhas
        </span>
      </div>
      <div className="answering__grid">
        {cats.map((catId, idx) => {
          const cat = CATEGORY_BY_ID[catId]
          const v = values[catId] ?? ''
          const state = !v.trim() ? 'empty' : isVotable(v, letter) ? 'ok' : 'bad'
          return (
            <motion.label
              key={catId}
              className={`field field--${state} ${cat?.medical ? 'field--med' : ''}`}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <span className="field__label">
                {cat?.label ?? catId}
                <small>{cat?.hint}</small>
              </span>
              <input
                ref={(el) => {
                  inputs.current[idx] = el
                }}
                value={v}
                disabled={locked}
                onChange={(e) => onChange(catId, e.target.value)}
                onBlur={() => {
                  if (catId in pending.current) flush(catId, pending.current[catId])
                  if (state === 'bad') sound.play('error')
                }}
                onKeyDown={(e) => onKeyDown(e, idx)}
                placeholder={`${letter}…`}
                maxLength={40}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={idx === cats.length - 1 ? 'done' : 'next'}
                aria-invalid={state === 'bad'}
              />
              {state === 'bad' && <span className="field__err">Começa com {letter}!</span>}
            </motion.label>
          )
        })}
      </div>
      <div className="room__actions">
        {locked ? (
          <p className="answering__locked">{round.endedBy === 'stop' ? 'STOP! Canetas no chão…' : 'Tempo esgotado! Recolhendo as respostas…'}</p>
        ) : (
          <>
            <GameButton size="xl" variant={allOk ? 'danger' : 'secondary'} className={`stopbtn ${allOk ? 'stopbtn--armed' : ''}`} onClick={pressStop} sfx={null} disabled={!allOk} aria-disabled={!allOk}>
              STOP!
            </GameButton>
            <span className="answering__hint">{allOk ? 'Aperta! (ou Ctrl + Enter)' : `Faltam ${missing} com a letra ${letter}`}</span>
          </>
        )}
      </div>
    </div>
  )
}
