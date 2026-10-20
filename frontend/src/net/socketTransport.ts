import { TIMINGS } from '../game/rules'
import type { GameEvent, Intent, RoomSettings, RoomState } from '../game/types'
import type { GameTransport, Identity, TransportListener } from './transport'

/**
 * Cliente WebSocket para o servidor Node do Stoplantão.
 * Protocolo completo em docs/BACKEND_CONTRACT.md. Mensagens JSON:
 *
 * cliente -> servidor
 *   { t: 'create', me: Identity, settings: Partial<RoomSettings> }
 *   { t: 'join',   me: Identity, code: string }   // também é a reconexão (com sessionToken)
 *   { t: 'intent', intent: Intent }
 *   { t: 'ping',   clientNow: number }
 *
 * servidor -> cliente
 *   { t: 'welcome', playerId: string, sessionToken: string }
 *   { t: 'state',  state: RoomState, serverNow: number }   // visão já filtrada (viewFor)
 *   { t: 'events', events: GameEvent[] }
 *   { t: 'error',  message: string, code?: ServerErrorCode, fatal?: boolean }
 *   { t: 'pong',   clientNow: number, serverNow: number }
 */
export type ServerErrorCode = 'ROOM_NOT_FOUND' | 'MEMBER_TAKEN' | 'ROOM_FULL' | 'BANNED' | 'BAD_INTENT'

type ServerMessage =
  | { t: 'welcome'; playerId: string; sessionToken: string }
  | { t: 'state'; state: RoomState; serverNow: number }
  | { t: 'events'; events: GameEvent[] }
  | { t: 'error'; message: string; code?: ServerErrorCode; fatal?: boolean }
  | { t: 'pong'; clientNow: number; serverNow: number }

/** última sala (sessionStorage): permite voltar depois de um F5 */
export const LAST_ROOM_KEY = 'stoplantao:lastRoom'
const SESSION_PREFIX = 'stoplantao:session:'

const PING_MS = 10000
const ENTRY_TIMEOUT_MS = 10000
const PONG_TIMEOUT_MS = 30000
const CLOCK_SAMPLES = 5
const STALE_MS = 3000
const OUTBOX_MAX = 40
/** intents que não fazem sentido chegando atrasados */
const EXPIRES = new Set<Intent['type']>(['stop', 'ready', 'vote', 'start', 'next', 'restart', 'kick'])
/** erros de entrada: não adianta insistir */
const JOIN_ERRORS = new Set<ServerErrorCode>(['ROOM_NOT_FOUND', 'MEMBER_TAKEN', 'ROOM_FULL', 'BANNED'])
const CONNECT_FAIL = 'Não consegui conectar no servidor do jogo.'

interface Queued {
  data: string
  at: number
  intent: Intent
}

function save(key: string, value: string | null) {
  try {
    if (value === null) sessionStorage.removeItem(key)
    else sessionStorage.setItem(key, value)
  } catch {
    /* sem storage (modo privado): segue sem persistir */
  }
}

function load(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

/** código da sala de antes do F5 (null se saiu de propósito ou nunca entrou) */
export function lastRoomCode(): string | null {
  try {
    const code: unknown = JSON.parse(load(LAST_ROOM_KEY) ?? 'null')?.code
    return typeof code === 'string' && code ? code : null
  } catch {
    return null
  }
}

export class SocketTransport implements GameTransport {
  readonly kind = 'socket' as const
  private ws: WebSocket | null = null
  private outbox: Queued[] = []
  private offset = 0
  private samples: { rtt: number; offset: number }[] = []
  private pingTimer: number | null = null
  private retryTimer: number | null = null
  private entryTimer: number | null = null
  private lastPongAt = 0
  /** confirmação de entrada referente ao socket atual, não à conexão anterior */
  private confirmed = false
  private attempts = 0
  private disposed = false
  /** já recebeu o primeiro 'state' (entrou na sala) */
  private inRoom = false
  private me: Identity | null = null
  private code: string | null = null
  private settings: Partial<RoomSettings> = {}

  private url: string
  private listener: TransportListener

  constructor(url: string, listener: TransportListener) {
    this.url = url
    this.listener = listener
  }

  private connect() {
    if (this.disposed) return
    if (this.ws && this.ws.readyState <= WebSocket.OPEN) return
    if (!this.inRoom) this.listener.onConnection?.('connecting')
    let ws: WebSocket
    try {
      ws = new WebSocket(this.url)
    } catch {
      return this.fail(CONNECT_FAIL)
    }
    this.ws = ws
    this.confirmed = false
    this.entryTimer = window.setTimeout(() => {
      this.entryTimer = null
      if (this.ws !== ws || this.confirmed) return
      if (!this.inRoom) this.fail(CONNECT_FAIL)
      else ws.close()
    }, ENTRY_TIMEOUT_MS)
    ws.onopen = () => {
      if (this.ws !== ws) return
      this.hello(ws)
      this.lastPongAt = Date.now()
      this.ping()
      this.stopPing()
      this.pingTimer = window.setInterval(() => {
        if (Date.now() - this.lastPongAt >= PONG_TIMEOUT_MS) ws.close()
        else this.ping()
      }, PING_MS)
    }
    ws.onclose = () => {
      if (this.ws !== ws) return
      this.ws = null
      this.confirmed = false
      this.stopEntryTimeout()
      this.stopPing()
      if (this.disposed) return
      // caiu antes de entrar: não reenvia 'create' (criaria outra sala)
      if (!this.inRoom) return this.fail(CONNECT_FAIL)
      this.listener.onConnection?.('reconnecting')
      const delay = Math.min(8000, 500 * 2 ** Math.min(this.attempts++, 4))
      this.retryTimer = window.setTimeout(() => {
        this.retryTimer = null
        this.connect()
      }, delay)
    }
    ws.onmessage = (ev) => { if (this.ws === ws) this.receive(ev) }
  }

  /** primeira mensagem de cada conexão: cria a sala ou (re)entra nela */
  private hello(ws: WebSocket) {
    if (!this.me) return
    if (this.code) ws.send(JSON.stringify({ t: 'join', me: this.me, code: this.code }))
    else ws.send(JSON.stringify({ t: 'create', me: this.me, settings: this.settings }))
  }

  private receive(ev: MessageEvent) {
    let msg: ServerMessage
    try {
      msg = JSON.parse(ev.data)
    } catch {
      return
    }
    if (!msg || typeof msg !== 'object') return
    if (msg.t === 'state') {
      // serverNow só vale até o primeiro pong (é enviesado pela latência de ida)
      if (!this.samples.length) this.offset = msg.serverNow - Date.now()
      if (!this.inRoom) {
        this.inRoom = true
        if (!this.code) this.code = msg.state.code
        this.remember()
      }
      const entering = !this.confirmed
      this.confirmed = true
      this.attempts = 0
      this.stopEntryTimeout()
      if (entering) this.listener.onConnection?.('open')
      this.listener.onState(msg.state, this.offset)
      if (entering && this.ws?.readyState === WebSocket.OPEN) this.flush(this.ws, msg.state)
    } else if (msg.t === 'events') this.listener.onEvents(msg.events)
    else if (msg.t === 'welcome') {
      if (this.me) this.me = { ...this.me, sessionToken: msg.sessionToken }
      if (this.code) save(SESSION_PREFIX + this.code, msg.sessionToken)
    } else if (msg.t === 'error') {
      if (msg.fatal || (msg.code && JOIN_ERRORS.has(msg.code))) this.fail(msg.message)
      else this.listener.onError(msg.message)
    } else if (msg.t === 'pong') {
      const now = Date.now()
      const rtt = now - msg.clientNow
      if (!Number.isFinite(rtt) || rtt < 0 || !Number.isFinite(msg.serverNow)) return
      this.lastPongAt = now
      this.samples.push({ rtt, offset: Math.round(msg.serverNow + rtt / 2 - now) })
      if (this.samples.length > CLOCK_SAMPLES) this.samples.shift()
      const best = this.samples.reduce((a, b) => (b.rtt < a.rtt ? b : a))
      if (best.offset !== this.offset) {
        this.offset = best.offset
        this.listener.onClock?.(this.offset)
      }
    }
  }

  private remember() {
    if (!this.code) return
    save(LAST_ROOM_KEY, JSON.stringify({ code: this.code }))
    if (this.me?.sessionToken) save(SESSION_PREFIX + this.code, this.me.sessionToken)
  }

  /** fila antes da confirmação da sala: preserva o contexto capturado na ação */
  private queue(intent: Intent, data: string) {
    if (intent.type === 'answer') {
      this.outbox = this.outbox.filter((q) => !(q.intent.type === 'answer' && q.intent.roundId === intent.roundId && q.intent.categoryId === intent.categoryId))
    } else if (intent.type === 'updateSettings') this.outbox = this.outbox.filter((q) => q.intent.type !== 'updateSettings')
    this.outbox.push({ data, at: Date.now(), intent })
    if (this.outbox.length > OUTBOX_MAX) this.outbox.splice(0, this.outbox.length - OUTBOX_MAX)
  }

  private flush(ws: WebSocket, state: RoomState) {
    const now = Date.now()
    for (const q of this.outbox.splice(0)) {
      const intent = q.intent
      if (EXPIRES.has(intent.type) && now - q.at > STALE_MS) continue
      if (intent.type === 'answer' || intent.type === 'stop' || intent.type === 'vote' || intent.type === 'ready') {
        const round = state.round
        if (!round || intent.roundId !== round.id) continue
        if (intent.type === 'answer') {
          const grace = state.phase === 'stopped' && round.stoppedAt !== null && now + this.offset - round.stoppedAt <= TIMINGS.answerGraceMs
          if ((state.phase !== 'answering' && !grace) || !state.settings.categoryIds.includes(intent.categoryId)) continue
        } else if (intent.type === 'stop') {
          if (state.phase !== 'answering') continue
        } else if (state.phase !== 'validating' || intent.categoryId !== state.settings.categoryIds[round.validationIndex]) continue
      }
      ws.send(q.data)
    }
  }

  private ping() {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify({ t: 'ping', clientNow: Date.now() }))
  }

  private stopEntryTimeout() {
    if (this.entryTimer !== null) window.clearTimeout(this.entryTimer)
    this.entryTimer = null
  }

  private stopPing() {
    if (this.pingTimer) window.clearInterval(this.pingTimer)
    this.pingTimer = null
  }

  private fail(message: string) {
    if (this.disposed) return
    this.dispose()
    this.listener.onConnection?.('closed')
    if (this.listener.onFatal) this.listener.onFatal(message)
    else this.listener.onError(message)
  }

  private start(me: Identity, code: string | null, settings: Partial<RoomSettings>) {
    this.disposed = false
    this.inRoom = false
    this.confirmed = false
    this.samples = []
    this.outbox = []
    this.attempts = 0
    this.me = me
    this.code = code
    this.settings = settings
    if (this.ws?.readyState === WebSocket.OPEN) this.hello(this.ws)
    else this.connect()
  }

  createRoom(me: Identity, settings: Partial<RoomSettings>) {
    this.start({ ...me }, null, settings)
  }

  joinRoom(me: Identity, code: string) {
    const c = code.trim().toUpperCase()
    this.start({ ...me, sessionToken: me.sessionToken ?? load(SESSION_PREFIX + c) ?? undefined }, c, {})
  }

  send(intent: Intent) {
    if (this.disposed) return
    const data = JSON.stringify({ t: 'intent', intent })
    if (this.confirmed && this.ws?.readyState === WebSocket.OPEN) this.ws.send(data)
    else this.queue(intent, data)
  }

  dispose() {
    this.disposed = true
    this.confirmed = false
    this.stopEntryTimeout()
    this.stopPing()
    if (this.retryTimer) window.clearTimeout(this.retryTimer)
    this.retryTimer = null
    const ws = this.ws
    this.ws = null
    if (ws) {
      ws.onopen = null
      ws.onclose = null
      ws.onmessage = null
      ws.onerror = null
      ws.close()
    }
    this.outbox = []
    // saída de propósito (ou erro fatal): F5 não deve voltar para esta sala
    save(LAST_ROOM_KEY, null)
  }
}
