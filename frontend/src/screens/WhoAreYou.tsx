import { motion } from 'framer-motion'
import { useState } from 'react'
import { sound } from '../audio/sound'
import { Avatar } from '../components/Avatar'
import { GameButton } from '../components/GameButton'
import { IconArrowRight } from '../components/Icons'
import { Logo } from '../components/Logo'
import { TEAM, TEAM_BY_ID } from '../data/team'
import { useGame } from '../store/gameStore'

export function WhoAreYou() {
  const current = useGame((s) => s.profile.memberId)
  const choose = useGame((s) => s.chooseMember)
  const go = useGame((s) => s.go)
  const [picked, setPicked] = useState<string | null>(current && TEAM_BY_ID[current] ? current : null)
  const member = picked ? TEAM_BY_ID[picked] : null

  const confirm = () => {
    if (!picked) return
    choose(picked)
    sound.play('select')
    go('home')
  }

  return (
    <div className="frame who">
      <header className="who__head">
        <Logo size="sm" byline={false} />
        <div>
          <h1 className="title">Quem é você?</h1>
          <p className="subtitle">Escolha seu personagem. Cada um foi desenhado a partir do time de verdade.</p>
        </div>
      </header>

      <div className="who__grid" role="radiogroup" aria-label="Personagens">
        {TEAM.map((m, i) => (
          <motion.button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={picked === m.id}
            className={`who__card ${picked === m.id ? 'who__card--on' : ''}`}
            style={{ ['--card-color' as string]: m.color }}
            initial={{ opacity: 0, y: 24, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.02 * i, type: 'spring', stiffness: 380, damping: 22 }}
            whileHover={{ y: -6, rotate: i % 2 ? 1.5 : -1.5 }}
            whileTap={{ scale: 0.94 }}
            onMouseEnter={() => sound.play('hover')}
            onClick={() => {
              setPicked(m.id)
              sound.play('pop', { pitch: 0.85 + (i % 6) * 0.06 })
            }}
            onDoubleClick={() => {
              setPicked(m.id)
              choose(m.id)
              sound.play('select')
              go('home')
            }}
          >
            <Avatar memberId={m.id} size={104} pop />
            <span className="who__name">{m.shortName}</span>
            <span className="who__role">{m.role}</span>
          </motion.button>
        ))}
      </div>

      <footer className="who__foot">
        <div className="who__picked" aria-live="polite">
          {member ? (
            <>
              <Avatar memberId={member.id} size={56} ring="me" />
              <div className="who__pickedtext">
                <b className="who__full">{member.name}</b>
                <b className="who__short">{member.shortName}</b>
                <span>{member.role}</span>
              </div>
            </>
          ) : (
            <span className="muted">Toque no seu rosto 👆</span>
          )}
        </div>
        <GameButton size="lg" icon={<IconArrowRight />} disabled={!picked} onClick={confirm} sfx={null}>
          Sou eu!
        </GameButton>
      </footer>
    </div>
  )
}
