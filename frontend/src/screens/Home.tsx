import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useEffect, useState } from 'react'
import { sound } from '../audio/sound'
import { Avatar } from '../components/Avatar'
import { Modal, SoundToggles } from '../components/Chrome'
import { GameButton } from '../components/GameButton'
import { IconCheck, IconDoor, IconGear, IconKey, IconPencil, IconPlay, IconThumbDown, IconThumbUp, IconTrophy } from '../components/Icons'
import { Logo } from '../components/Logo'
import { StopSign } from '../components/StopSign'
import { CATEGORIES, DEFAULT_CATEGORY_IDS } from '../data/categories'
import { TEAM, TEAM_BY_ID, felipePoseUrl } from '../data/team'
import { LIMITS } from '../game/rules'
import { WS_URL, useGame } from '../store/gameStore'

export function Home() {
  const memberId = useGame((s) => s.profile.memberId)
  const go = useGame((s) => s.go)
  const createRoom = useGame((s) => s.createRoom)
  const [createOpen, setCreateOpen] = useState(false)
  const [joinOpen, setJoinOpen] = useState(false)
  const member = memberId ? TEAM_BY_ID[memberId] : null

  // personagem desconhecido (renomeado/removido do time): manda escolher de novo
  useEffect(() => {
    if (!member) go('who')
  }, [member, go])

  if (!member) return null

  return (
    <div className="frame home">
      <header className="home__head">
        <Logo size="md" />
        <SoundToggles />
      </header>

      <div className="home__grid">
        <section className="panel home__play">
          <h2 className="panel__title">Jogue agora</h2>
          <div className="home__me">
            <button type="button" className="home__avatarbtn" onClick={() => go('who')} aria-label="Trocar personagem" onMouseEnter={() => sound.play('hover')}>
              <Avatar memberId={member.id} size={168} ring="me" pop />
              <span className="home__edit">
                <IconPencil width={18} height={18} />
              </span>
            </button>
            <div className="home__name">
              <b>{member.shortName}</b>
              <span>{member.role}</span>
            </div>
          </div>
          <div className="home__actions">
            <GameButton size="lg" block icon={<IconPlay />} onClick={() => createRoom({}, 5)}>
              Jogar
            </GameButton>
            <GameButton size="lg" block variant="secondary" icon={<IconGear />} onClick={() => setCreateOpen(true)}>
              Criar sala
            </GameButton>
            <GameButton size="lg" block variant="ghost" icon={<IconKey />} onClick={() => setJoinOpen(true)}>
              Entrar com código
            </GameButton>
          </div>
        </section>

        <section className="panel home__how">
          <h2 className="panel__title">Como jogar</h2>
          <HowTo />
        </section>
      </div>

      <footer className="home__foot">
        <img src="/assets/brand/logo-ifh.webp" alt="iFH" />
        <p>
          Stoplantão é o Stop (adedonha) do time iFH. Sorteia a letra, preenche as categorias, alguém grita <b>STOP!</b> e o time vota: <b>10 pontos</b> para respostas únicas,{' '}
          <b>5</b> para repetidas e <b>0</b> para inválidas.
        </p>
      </footer>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <JoinModal open={joinOpen} onClose={() => setJoinOpen(false)} />
    </div>
  )
}

const STEPS = [
  { title: '1. Sorteio da letra', text: 'Cada rodada começa com uma letra sorteada na placa de PARE.' },
  { title: '2. Corre, doutor!', text: 'Preencha as categorias com palavras que começam com a letra.' },
  { title: '3. STOP!', text: 'Completou tudo? Aperte STOP e trava a rodada de todo mundo. O Dr. Felipe vai comentar…' },
  { title: '4. Vale ou não vale?', text: 'Vote nas respostas do time. A treta é garantida.' },
  { title: '5. Vença com estilo', text: '10 pontos por resposta única, 5 por repetida e 0 se for inválida.' },
]

// personagens das ilustrações: usa o id se ainda existir no time, senão cai num membro por índice
const demo = (id: string, i: number) => (TEAM_BY_ID[id] ?? TEAM[i % TEAM.length]).id

function HowTo() {
  const [i, setI] = useState(0)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()
  useEffect(() => {
    // sem auto-avanço com "reduzir movimento" ou enquanto o usuário interage
    if (reduce || paused) return
    const id = window.setInterval(() => setI((v) => (v + 1) % STEPS.length), 5200)
    return () => window.clearInterval(id)
  }, [i, reduce, paused])
  return (
    <div
      className="howto"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="howto__stage">
        <AnimatePresence mode="wait">
          <motion.div key={i} className="howto__art" initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.28 }}>
            {i === 0 && <StopSign letter="P" size={130} spinning />}
            {i === 1 && (
              <div className="howto__typing">
                <Avatar memberId={demo('julia', 4)} size={110} pop />
                <div className="howto__field">
                  <span>Doença</span>
                  <b>Pneumonia</b>
                </div>
              </div>
            )}
            {i === 2 && <img className="howto__felipe" src={felipePoseUrl('stop')} alt="" />}
            {i === 3 && (
              <div className="howto__vote">
                <Avatar memberId={demo('vinny', 13)} size={96} pop />
                <span className="howto__thumb howto__thumb--up">
                  <IconThumbUp width={34} height={34} />
                </span>
                <span className="howto__thumb howto__thumb--down">
                  <IconThumbDown width={34} height={34} />
                </span>
              </div>
            )}
            {i === 4 && (
              <div className="howto__win">
                <Avatar memberId={demo('tatiane', 15)} size={104} pop />
                <IconTrophy className="howto__trophy" width={70} height={70} />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
      <h3>{STEPS[i].title}</h3>
      <p>{STEPS[i].text}</p>
      <div className="howto__dots">
        {STEPS.map((s, k) => (
          <button
            key={s.title}
            type="button"
            className={k === i ? 'on' : ''}
            aria-label={s.title}
            onClick={() => {
              sound.play('swipe')
              setI(k)
            }}
          />
        ))}
      </div>
    </div>
  )
}

function CreateRoomModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createRoom = useGame((s) => s.createRoom)
  const memberId = useGame((s) => s.profile.memberId)
  const [rounds, setRounds] = useState(5)
  const [answerSeconds, setAnswerSeconds] = useState(90)
  const [bots, setBots] = useState(5)
  const [cats, setCats] = useState<string[]>(DEFAULT_CATEGORY_IDS)
  const [online, setOnline] = useState(false)
  const maxBots = TEAM.filter((m) => m.id !== memberId).length

  // decide e toca o som no clique; o setState fica puro (StrictMode roda updaters 2x)
  const toggleCat = (id: string) => {
    const on = cats.includes(id)
    if (on ? cats.length <= LIMITS.minCategories : cats.length >= LIMITS.maxCategories) {
      sound.play('error')
      return
    }
    sound.play(on ? 'voteInvalid' : 'voteValid')
    setCats(on ? cats.filter((c) => c !== id) : [...cats, id])
  }

  return (
    <Modal open={open} onClose={onClose} title="Criar sala" wide>
      <div className="form">
        <Choice label="Rodadas" value={rounds} options={[3, 5, 7, 10]} onChange={setRounds} />
        <Choice label="Tempo por rodada" value={answerSeconds} options={[60, 90, 120, 180]} format={(v) => `${v}s`} onChange={setAnswerSeconds} />
        {!online && (
          <div className="form__row">
            <label htmlFor="bots">
              Colegas no modo treino <b>{bots}</b>
            </label>
            <input
              id="bots"
              type="range"
              min={1}
              max={maxBots}
              value={bots}
              onChange={(e) => {
                setBots(Number(e.target.value))
                sound.play('tick')
              }}
            />
          </div>
        )}
        <div className="form__row">
          <span className="form__label">
            Categorias <b>{cats.length}</b> <small>(mín. {LIMITS.minCategories}, máx. {LIMITS.maxCategories})</small>
          </span>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" className={`chip ${cats.includes(c.id) ? 'chip--on' : ''} ${c.medical ? 'chip--med' : ''}`} onClick={() => toggleCat(c.id)} aria-pressed={cats.includes(c.id)}>
                {cats.includes(c.id) && <IconCheck width={14} height={14} />}
                {c.label}
              </button>
            ))}
          </div>
        </div>
        {WS_URL && (
          <label className="form__check">
            <input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} /> Sala online (amigos entram com o código)
          </label>
        )}
        <GameButton
          size="lg"
          block
          icon={<IconPlay />}
          onClick={() => {
            onClose()
            createRoom({ rounds, answerSeconds, categoryIds: cats }, bots, online)
          }}
        >
          Abrir sala
        </GameButton>
      </div>
    </Modal>
  )
}

function Choice<T extends number>({ label, value, options, onChange, format }: { label: string; value: T; options: T[]; onChange: (v: T) => void; format?: (v: T) => string }) {
  return (
    <div className="form__row">
      <span className="form__label">{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            className={`seg__opt ${o === value ? 'seg__opt--on' : ''}`}
            onClick={() => {
              sound.play('click')
              onChange(o)
            }}
            aria-pressed={o === value}
          >
            {format ? format(o) : o}
          </button>
        ))}
      </div>
    </div>
  )
}

function JoinModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const joinRoom = useGame((s) => s.joinRoom)
  const [code, setCode] = useState('')
  return (
    <Modal open={open} onClose={onClose} title="Entrar com código">
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          if (code.trim().length < 4) {
            sound.play('error')
            return
          }
          onClose()
          joinRoom(code.trim())
        }}
      >
        <input className="codeinput" value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))} placeholder="CÓDIGO" aria-label="Código da sala" />
        {!WS_URL && <p className="muted small">O modo online liga quando o backend estiver no ar (VITE_WS_URL). Por enquanto, jogue o treino com o time.</p>}
        <GameButton type="submit" size="lg" block icon={<IconDoor />}>
          Entrar
        </GameButton>
      </form>
    </Modal>
  )
}
