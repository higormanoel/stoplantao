import assert from 'node:assert/strict'
import type { TestContext } from 'node:test'
import WebSocket from 'ws'
import { createGameServer } from '../src/server.js'
import type { RoomState } from '../../frontend/src/game/types.js'

export type Message = {
  t: string
  state?: RoomState
  events?: Array<{ type: string; [key: string]: unknown }>
  playerId?: string
  sessionToken?: string
  code?: string
  fatal?: boolean
  message?: string
  clientNow?: number
  serverNow?: number
}

type Predicate = (message: Message) => boolean

/** Buffer frames before callers await them, so fast server replies cannot be lost. */
export class Client {
  readonly messages: Message[] = []
  readonly socket: WebSocket
  closed: { code: number; reason: string } | undefined
  private listeners = new Set<() => void>()
  private pingSerial = 0

  constructor(url: string, options?: WebSocket.ClientOptions) {
    this.socket = new WebSocket(url, options)
    this.socket.on('message', (raw) => {
      this.messages.push(JSON.parse(raw.toString()) as Message)
      for (const listener of this.listeners) listener()
    })
    this.socket.on('close', (code, reason) => {
      this.closed = { code, reason: reason.toString() }
      for (const listener of this.listeners) listener()
    })
    // Tests inspect open/close failures explicitly, and unexpected errors must not
    // become an unhandled EventEmitter error while the fixture tears down.
    this.socket.on('error', () => {})
  }

  async open(): Promise<this> {
    if (this.socket.readyState === WebSocket.OPEN) return this
    await new Promise<void>((resolve, reject) => {
      this.socket.once('open', resolve)
      this.socket.once('error', reject)
    })
    return this
  }

  mark(): number { return this.messages.length }

  send(message: unknown): void { this.socket.send(JSON.stringify(message)) }
  raw(message: string): void { this.socket.send(message) }

  async wait(predicate: Predicate, after = 0, timeoutMs = 2500): Promise<Message> {
    return new Promise<Message>((resolve, reject) => {
      const find = () => {
        const found = this.messages.slice(after).find(predicate)
        if (!found) return
        cleanup()
        resolve(found)
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error(`Frame não recebido; mensagens: ${JSON.stringify(this.messages.slice(after))}`))
      }, timeoutMs)
      const cleanup = () => {
        clearTimeout(timer)
        this.listeners.delete(find)
      }
      this.listeners.add(find)
      find()
    })
  }

  async state(predicate: (state: RoomState) => boolean = () => true, after = 0): Promise<RoomState> {
    const message = await this.wait((m) => m.t === 'state' && !!m.state && predicate(m.state), after)
    return message.state!
  }

  latestState(): RoomState {
    const state = this.messages.slice().reverse().find((m) => m.t === 'state')?.state
    assert.ok(state, 'O cliente precisa ter recebido um estado')
    return state
  }

  async event(type: string, after = 0): Promise<{ type: string; [key: string]: unknown }> {
    const message = await this.wait((m) => m.t === 'events' && !!m.events?.some((e) => e.type === type), after)
    return message.events!.find((e) => e.type === type)!
  }

  async barrier(): Promise<void> {
    const clientNow = ++this.pingSerial
    const after = this.mark()
    this.send({ t: 'ping', clientNow })
    await this.wait((m) => m.t === 'pong' && m.clientNow === clientNow, after)
  }

  async close(): Promise<{ code: number; reason: string }> {
    if (!this.closed) this.socket.close()
    return this.waitClosed()
  }

  async waitClosed(timeoutMs = 2500): Promise<{ code: number; reason: string }> {
    if (this.closed) return this.closed
    return new Promise((resolve, reject) => {
      const onClose = () => {
        if (!this.closed) return
        cleanup()
        resolve(this.closed)
      }
      const timer = setTimeout(() => {
        cleanup()
        reject(new Error('O socket não foi fechado'))
      }, timeoutMs)
      const cleanup = () => {
        clearTimeout(timer)
        this.listeners.delete(onClose)
      }
      this.listeners.add(onClose)
      onClose()
    })
  }
}

export const identities = {
  host: { playerId: 'host', memberId: 'felipe', name: 'Felipe' },
  guest: { playerId: 'guest', memberId: 'higor', name: 'Higor' },
  third: { playerId: 'third', memberId: 'jonathan', name: 'Jonathan' },
}

export const fourCategories = ['nome', 'animal', 'cep', 'cor']
type Options = NonNullable<Parameters<typeof createGameServer>[0]>

export async function fixture(t: TestContext, options: Options = {}) {
  let clock = 1_800_000_000_000
  const server = createGameServer({
    host: '127.0.0.1', port: 0, tickMs: 10, lobbyGraceMs: 0,
    heartbeatMs: 60_000, maxMessagesPerSecond: 1000,
    now: () => clock, ...options,
  })
  const address = await server.listen()
  const url = `ws://127.0.0.1:${address.port}/ws`
  const clients: Client[] = []
  t.after(async () => {
    for (const client of clients) client.socket.terminate()
    await server.close()
  })
  return {
    url,
    httpUrl: `http://127.0.0.1:${address.port}`,
    now: () => clock,
    advance(ms: number) { clock += ms },
    async client(clientOptions?: WebSocket.ClientOptions) {
      const client = new Client(url, clientOptions)
      clients.push(client)
      return client.open()
    },
    async create(settings: Record<string, unknown> = {}) {
      const client = await this.client()
      client.send({ t: 'create', me: identities.host, settings })
      const welcome = await client.wait((m) => m.t === 'welcome')
      const state = await client.state()
      return { client, welcome, state }
    },
    async join(code: string, me: Record<string, unknown> = identities.guest) {
      const client = await this.client()
      client.send({ t: 'join', me, code })
      const welcome = await client.wait((m) => m.t === 'welcome')
      const state = await client.state()
      return { client, welcome, state }
    },
  }
}

export function intent(client: Client, value: Record<string, unknown>) {
  client.send({ t: 'intent', intent: { playerId: 'host', ...value } })
}

export async function startRound(f: Awaited<ReturnType<typeof fixture>>, host: Client): Promise<RoomState> {
  const mark = host.mark()
  intent(host, { type: 'start' })
  await host.state((s) => s.phase === 'drawing', mark)
  f.advance(3400)
  const state = await host.state((s) => s.phase === 'answering', mark)
  await host.event('roundStarted', mark)
  return state
}

export async function enterValidation(f: Awaited<ReturnType<typeof fixture>>, host: Client): Promise<RoomState> {
  const mark = host.mark()
  f.advance(6200)
  const state = await host.state((s) => s.phase === 'validating', mark)
  await host.event('validationStep', mark)
  return state
}
