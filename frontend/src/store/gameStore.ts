import { create } from 'zustand'
import { sound } from '../audio/sound'
import { TEAM_BY_ID } from '../data/team'
import { VOICE_BY_ID, type VoiceLine } from '../data/voiceLines'
import type { GameEvent, Intent, RoomSettings, RoomState, RoundSummary } from '../game/types'
import { LocalTransport } from '../net/localTransport'
import { SocketTransport } from '../net/socketTransport'
import type { ConnectionStatus, GameTransport, TransportListener } from '../net/transport'

export type Screen = 'splash' | 'who' | 'home' | 'room'

/** Intent sem playerId (o store preenche com o jogador atual) */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type IntentInput = DistributiveOmit<Intent, 'playerId'> & { playerId?: string }

const PROFILE_KEY = 'stoplantao:profile'
export const WS_URL: string | undefined = import.meta.env.VITE_WS_URL

interface Profile {
  playerId: string
  memberId: string | null
}

function loadProfile(): Profile {
  try {
    const saved = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? 'null')
    if (saved?.playerId) {
      // personagem renomeado/removido do time: volta para a escolha
      const memberId = saved.memberId && TEAM_BY_ID[saved.memberId] ? saved.memberId : null
      return { playerId: saved.playerId, memberId }
    }
  } catch {
    /* perfil corrompido: gera outro */
  }
  const id = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `p-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return { playerId: id, memberId: null }
}

export interface NarratorCue {
  key: number
  line: VoiceLine
  /** quem deu stop (para o balão citar) */
  byPlayerId?: string
  /** duração real da fala (ms), para o balão sair junto com a voz */
  ms?: number
}

export interface Toast {
  key: number
  text: string
  tone: 'info' | 'error'
}

interface GameStore {
  screen: Screen
  profile: Profile
  room: RoomState | null
  serverOffset: number
  transport: GameTransport | null
  narrator: NarratorCue | null
  stopFlash: { key: number; playerId: string | null } | null
  lastSummary: RoundSummary | null
  toasts: Toast[]
  connection: 'idle' | ConnectionStatus

  go(screen: Screen): void
  chooseMember(memberId: string): void
  createRoom(settings: Partial<RoomSettings>, botCount: number, online?: boolean): void
  joinRoom(code: string): void
  send(intent: IntentInput): void
  addBot(): void
  leaveRoom(): void
  toast(text: string, tone?: Toast['tone']): void
  dismissNarrator(): void
  now(): number
}

let seq = 1

/** timers atrasados (sirene, voz, narrador): morrem ao sair/trocar de sala */
const timers = new Set<number>()

function later(fn: () => void, ms: number) {
  const id = window.setTimeout(() => {
    timers.delete(id)
    fn()
  }, ms)
  timers.add(id)
}

function cancelLater() {
  timers.forEach((id) => window.clearTimeout(id))
  timers.clear()
}

export const useGame = create<GameStore>((set, get) => {
  const listener: TransportListener = {
    onState(state, offset) {
      set({ room: state, serverOffset: offset })
    },
    onEvents(events) {
      handleEvents(events)
    },
    onError(message) {
      get().toast(message, 'error')
      sound.play('error')
    },
    onConnection(status) {
      set({ connection: status })
    },
    onClock(offset) {
      set({ serverOffset: offset })
    },
    onFatal(message) {
      exitRoom()
      get().toast(message, 'error')
      sound.play('error')
    },
  }

  /** larga o transporte e volta para a Home */
  function exitRoom() {
    cancelLater()
    get().transport?.dispose()
    set({ transport: null, room: null, narrator: null, stopFlash: null, lastSummary: null, connection: 'idle', screen: 'home' })
  }

  function handleEvents(events: GameEvent[]) {
    const me = get().profile.playerId
    // kick pode vir junto com playerLeft: um som só
    const gone = new Set<string>()
    const left = (id: string) => {
      if (id === me || gone.has(id)) return
      gone.add(id)
      sound.play('leave')
    }
    for (const e of events) {
      switch (e.type) {
        case 'playerJoined':
        case 'playerReconnected':
          if (e.playerId !== me) sound.play('join', { pitch: 0.9 + Math.random() * 0.3 })
          break
        case 'playerLeft':
          left(e.playerId)
          break
        case 'kicked':
          if (e.playerId === me) {
            exitRoom()
            get().toast('Você foi removido da sala', 'error')
            sound.play('leave')
            return
          }
          left(e.playerId)
          break
        case 'drawing':
          set({ lastSummary: null, stopFlash: null })
          break
        case 'roundStarted':
          sound.play('go')
          break
        case 'stopCalled': {
          sound.play('stopSlam')
          later(() => sound.play('siren'), 120)
          const line = VOICE_BY_ID[e.voiceLineId]
          set({ stopFlash: { key: seq++, playerId: e.playerId } })
          if (line) {
            later(() => {
              const ms = sound.speak(line.id)
              set({ narrator: { key: seq++, line, byPlayerId: e.playerId, ms } })
            }, 650)
          }
          break
        }
        case 'timeUp': {
          sound.play('flatline')
          const line = VOICE_BY_ID[e.voiceLineId]
          set({ stopFlash: { key: seq++, playerId: null } })
          if (line) {
            later(() => {
              const ms = sound.speak(line.id)
              set({ narrator: { key: seq++, line, ms } })
            }, 900)
          }
          break
        }
        case 'validationStep':
          sound.play('swipe')
          // o balão do narrador não pode cobrir os botões da validação
          if (e.index === 0) later(() => set({ narrator: null }), 1500)
          break
        case 'roundScored':
          set({ lastSummary: e.summary })
          sound.play('drumroll')
          break
        case 'gameOver':
          sound.play('fanfare')
          break
        case 'backToLobby':
          sound.play('whoosh')
          break
      }
    }
  }

  return {
    screen: 'splash',
    profile: loadProfile(),
    room: null,
    serverOffset: 0,
    transport: null,
    narrator: null,
    stopFlash: null,
    lastSummary: null,
    toasts: [],
    connection: 'idle',

    go(screen) {
      set({ screen })
    },

    chooseMember(memberId) {
      const profile = { ...get().profile, memberId }
      localStorage.setItem(PROFILE_KEY, JSON.stringify(profile))
      set({ profile })
    },

    createRoom(settings, botCount, online = false) {
      const { profile } = get()
      const member = profile.memberId ? TEAM_BY_ID[profile.memberId] : undefined
      if (!member) return set({ screen: 'who' })
      cancelLater()
      get().transport?.dispose()
      const transport: GameTransport = online && WS_URL ? new SocketTransport(WS_URL, listener) : new LocalTransport(listener)
      set({ transport, room: null, narrator: null, stopFlash: null, lastSummary: null, connection: 'idle', screen: 'room' })
      transport.createRoom({ playerId: profile.playerId, memberId: member.id, name: member.shortName }, settings, botCount)
    },

    joinRoom(code) {
      const { profile } = get()
      const member = profile.memberId ? TEAM_BY_ID[profile.memberId] : undefined
      if (!member) return set({ screen: 'who' })
      if (!WS_URL) {
        get().toast('O modo online chega quando o servidor estiver no ar. Bora treinar com o time!', 'info')
        return
      }
      cancelLater()
      get().transport?.dispose()
      const transport = new SocketTransport(WS_URL, listener)
      set({ transport, room: null, narrator: null, stopFlash: null, lastSummary: null, connection: 'idle', screen: 'room' })
      transport.joinRoom({ playerId: profile.playerId, memberId: member.id, name: member.shortName }, code)
    },

    send(intent) {
      const t = get().transport
      if (!t) return
      t.send({ ...intent, playerId: intent.playerId ?? get().profile.playerId } as Intent)
    },

    addBot() {
      get().transport?.addBot?.()
    },

    leaveRoom() {
      const { transport, profile } = get()
      transport?.send({ type: 'leave', playerId: profile.playerId })
      exitRoom()
    },

    toast(text, tone = 'info') {
      const key = seq++
      set({ toasts: [...get().toasts, { key, text, tone }] })
      window.setTimeout(() => set({ toasts: get().toasts.filter((t) => t.key !== key) }), 3800)
    },

    dismissNarrator() {
      set({ narrator: null })
    },

    now() {
      return Date.now() + get().serverOffset
    },
  }
})

export const useMe = () => {
  const room = useGame((s) => s.room)
  const playerId = useGame((s) => s.profile.playerId)
  return room?.players.find((p) => p.id === playerId) ?? null
}
