import { TEAM } from '../data/team'
import { BotBrain } from '../game/bots'
import { applyIntent, createRoom, tick, viewFor } from '../game/engine'
import type { GameEvent, Intent, RoomSettings, RoomState } from '../game/types'
import type { GameTransport, Identity, TransportListener } from './transport'

const TICK_MS = 100

/** Servidor de mentirinha dentro do navegador: mesmo motor, bots do time no lugar dos amigos. */
export class LocalTransport implements GameTransport {
  readonly kind = 'local' as const
  private state: RoomState | null = null
  private me: Identity | null = null
  private brain = new BotBrain()
  private timer: number | null = null
  private joinTimers: number[] = []

  private listener: TransportListener

  constructor(listener: TransportListener) {
    this.listener = listener
  }

  createRoom(me: Identity, settings: Partial<RoomSettings>, botCount: number) {
    this.dispose()
    this.me = me
    this.state = createRoom({ host: me, settings, seed: Math.floor(Math.random() * 2 ** 31) })
    this.emit([])
    this.timer = window.setInterval(() => this.loop(), TICK_MS)
    // bots entram na sala aos poucos (efeito de "chegando gente")
    const pool = TEAM.filter((m) => m.id !== me.memberId).sort(() => Math.random() - 0.5)
    pool.slice(0, botCount).forEach((m, i) => {
      this.joinTimers.push(window.setTimeout(() => this.addSpecificBot(m.id), 500 + i * 420 + Math.random() * 250))
    })
  }

  joinRoom() {
    const msg = 'Entrar por código precisa do servidor online. Jogue no modo treino com o time!'
    if (this.listener.onFatal) this.listener.onFatal(msg)
    else this.listener.onError(msg)
  }

  addBot() {
    if (!this.state) return
    const taken = new Set(this.state.players.map((p) => p.memberId))
    const free = TEAM.filter((m) => !taken.has(m.id))
    if (free.length) this.addSpecificBot(free[Math.floor(Math.random() * free.length)].id)
  }

  private addSpecificBot(memberId: string) {
    if (!this.state || this.state.phase !== 'lobby') return
    const member = TEAM.find((m) => m.id === memberId)!
    this.apply({ type: 'join', playerId: `bot-${memberId}`, memberId, name: member.shortName, isBot: true })
  }

  send(intent: Intent) {
    this.apply(intent)
  }

  private apply(intent: Intent) {
    if (!this.state) return
    const { state, events } = applyIntent(this.state, intent, Date.now())
    this.state = state
    const visible = events.filter((e) => e.type !== 'rejected' || e.playerId === this.me?.playerId)
    const rejected = visible.find((e) => e.type === 'rejected')
    if (rejected && rejected.type === 'rejected') this.listener.onError(rejected.reason)
    this.emit(visible.filter((e) => e.type !== 'rejected'))
  }

  private loop() {
    if (!this.state) return
    const now = Date.now()
    const collected: GameEvent[] = []
    const t = tick(this.state, now)
    this.state = t.state
    collected.push(...t.events)
    for (const intent of this.brain.update(this.state, now)) {
      const r = applyIntent(this.state, intent, now)
      this.state = r.state
      collected.push(...r.events.filter((e) => e.type !== 'rejected'))
    }
    this.emit(collected)
  }

  private lastEmitted: RoomState | null = null

  private emit(events: GameEvent[]) {
    if (!this.state || !this.me) return
    if (this.state !== this.lastEmitted) {
      this.lastEmitted = this.state
      this.listener.onState(viewFor(this.state, this.me.playerId), 0)
    }
    if (events.length) this.listener.onEvents(events)
  }

  dispose() {
    if (this.timer) window.clearInterval(this.timer)
    this.joinTimers.forEach((t) => window.clearTimeout(t))
    this.joinTimers = []
    this.timer = null
    this.state = null
    this.lastEmitted = null
    this.brain.reset()
  }
}
