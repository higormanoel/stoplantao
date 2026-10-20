import { useState } from 'react'
import { Modal, SoundToggles } from '../../components/Chrome'
import { GameButton } from '../../components/GameButton'
import { IconDoor, IconX } from '../../components/Icons'
import { Logo } from '../../components/Logo'
import { PlayerList } from '../../components/PlayerList'
import { StopOverlay } from '../../components/StopOverlay'
import { StopSign } from '../../components/StopSign'
import type { RoomState } from '../../game/types'
import { useGame } from '../../store/gameStore'
import { Answering } from './Answering'
import { Drawing } from './Drawing'
import { Lobby } from './Lobby'
import { Podium } from './Podium'
import { Results } from './Results'
import { Validation } from './Validation'

export function Room() {
  const current = useGame((s) => s.room)
  const transport = useGame((s) => s.transport)
  const connection = useGame((s) => s.connection)
  const leave = useGame((s) => s.leaveRoom)
  // ao sair, o store zera a sala antes da animação de saída: segura a última para não piscar o "Abrindo a sala…"
  const [last, setLast] = useState(current)
  if (current && current !== last) setLast(current)
  const room = current ?? (transport ? null : last)
  if (!room) {
    return (
      <div className="frame room room--loading">
        <Logo size="md" />
        <p className="muted">Abrindo a sala…</p>
        <GameButton variant="ghost" icon={<IconX />} onClick={leave} sfx="back">
          Cancelar
        </GameButton>
      </div>
    )
  }
  const reconnecting = !!current && transport?.kind === 'socket' && (connection === 'reconnecting' || connection === 'closed')
  return (
    <div className={`frame room room--${room.phase}`}>
      {reconnecting && (
        <div className="room__reconnect" role="status">
          Reconectando…
        </div>
      )}
      <RoomHeader room={room} />
      <div className="room__body">
        <PlayerList room={room} />
        <main className="room__main">
          <PhaseView room={room} />
        </main>
      </div>
      <StopOverlay />
    </div>
  )
}

function PhaseView({ room }: { room: RoomState }) {
  switch (room.phase) {
    case 'lobby':
      return <Lobby room={room} />
    case 'drawing':
      return <Drawing room={room} />
    case 'answering':
    case 'stopped':
      return <Answering room={room} />
    case 'validating':
      return <Validation room={room} />
    case 'roundResults':
      return <Results room={room} />
    case 'podium':
      return <Podium room={room} />
  }
}

function RoomHeader({ room }: { room: RoomState }) {
  const leave = useGame((s) => s.leaveRoom)
  const [confirm, setConfirm] = useState(false)
  const inGame = room.phase !== 'lobby' && room.phase !== 'podium'
  const showLetter = room.phase !== 'lobby' && room.phase !== 'drawing' && room.phase !== 'podium'
  return (
    <header className="room__head">
      <Logo size="sm" byline={false} animated={false} />
      <div className="room__hud">
        <div className="room__rounds">
          <span>Rodada</span>
          <b>
            {Math.max(room.roundIndex, room.phase === 'lobby' ? 0 : 1)}/{room.settings.rounds}
          </b>
        </div>
        <StopSign letter={showLetter ? (room.round?.letter ?? null) : null} size={84} className={showLetter ? '' : 'stopsign--idle'} />
        <div className="room__code" title="Código da sala">
          <span>Sala</span>
          <b>{room.code}</b>
        </div>
        <SoundToggles />
      </div>
      <GameButton variant="ghost" size="sm" icon={<IconX />} onClick={() => (inGame ? setConfirm(true) : leave())} sfx="back">
        Sair
      </GameButton>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Sair da sala?">
        <p className="muted">A partida continua sem você. Tem certeza?</p>
        <div className="row">
          <GameButton variant="secondary" onClick={() => setConfirm(false)}>
            Ficar
          </GameButton>
          <GameButton variant="danger" icon={<IconDoor />} onClick={leave}>
            Sair
          </GameButton>
        </div>
      </Modal>
    </header>
  )
}
