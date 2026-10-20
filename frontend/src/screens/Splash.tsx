import { motion } from 'framer-motion'
import { sound } from '../audio/sound'
import { Avatar } from '../components/Avatar'
import { GameButton } from '../components/GameButton'
import { IconPlay } from '../components/Icons'
import { Logo } from '../components/Logo'
import { TEAM, TEAM_BY_ID } from '../data/team'
import { lastRoomCode } from '../net/socketTransport'
import { WS_URL, useGame } from '../store/gameStore'

export function Splash() {
  const go = useGame((s) => s.go)
  const joinRoom = useGame((s) => s.joinRoom)
  const memberId = useGame((s) => s.profile.memberId)
  const enter = () => {
    sound.unlock()
    sound.play('select')
    // personagem salvo que não existe mais no time volta para a escolha
    const known = !!memberId && !!TEAM_BY_ID[memberId]
    // F5 no meio de uma sala online: volta direto para ela (o token da vaga está no sessionStorage)
    const last = known && WS_URL ? lastRoomCode() : null
    if (last) return joinRoom(last)
    go(known ? 'home' : 'who')
  }
  const row = [...TEAM, ...TEAM]
  return (
    <div className="splash">
      <motion.div initial={{ scale: 0.6, opacity: 0, rotate: -6 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }}>
        <Logo size="xl" />
      </motion.div>
      <motion.p className="splash__tag" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        Stop, adedonha, adedanha com o time inteiro do iFH e a voz do Dr. Felipe.
      </motion.p>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}>
        <GameButton size="xl" icon={<IconPlay />} onClick={enter} sfx={null} autoFocus>
          Entrar no plantão
        </GameButton>
      </motion.div>
      <div className="splash__marquee" aria-hidden>
        <div className="splash__track">
          {row.map((m, i) => (
            <Avatar key={`${m.id}-${i}`} memberId={m.id} size={92} pop />
          ))}
        </div>
      </div>
    </div>
  )
}
