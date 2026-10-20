import { randomBytes, randomInt, timingSafeEqual } from 'node:crypto'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { applyIntent, createRoom, tick, viewFor } from '../../frontend/src/game/engine'
import type { EngineResult, Intent, RoomState } from '../../frontend/src/game/types'
import { gameIntent, identity, ProtocolError, record, settings } from './protocol.js'
import type { ErrorCode } from './protocol.js'

export interface ServerOptions {
  port?: number
  host?: string
  tickMs?: number
  roomTtlMs?: number
  lobbyGraceMs?: number
  heartbeatMs?: number
  maxPayloadBytes?: number
  maxMessagesPerSecond?: number
  maxRooms?: number
  maxConnections?: number
  allowedOrigins?: string[]
  now?: () => number
}

interface Client {
  socket: WebSocket
  room: Room | null
  playerId: string | null
  revoked: boolean
  alive: boolean
  windowAt: number
  messages: number
  helloTimer: ReturnType<typeof setTimeout>
  closeTimer?: ReturnType<typeof setTimeout>
}

interface Room {
  state: RoomState
  clients: Map<string, Client>
  sessions: Map<string, string>
  departures: Map<string, number>
  emptySince: number | null
}

const MAX_BUFFERED_BYTES = 1024 * 1024
const MAX_SESSIONS_PER_ROOM = 512

export function createGameServer(options: ServerOptions = {}) {
  const host = options.host ?? '0.0.0.0'
  const port = options.port ?? 8787
  const now = options.now ?? Date.now
  const roomTtlMs = options.roomTtlMs ?? 30 * 60_000
  const lobbyGraceMs = options.lobbyGraceMs ?? 3000
  const maxRate = options.maxMessagesPerSecond ?? 30
  const rooms = new Map<string, Room>()
  const clients = new Map<WebSocket, Client>()
  let closing = false
  let closePromise: Promise<void> | undefined

  const http = createServer((request, response) => {
    if (request.method === 'GET' && request.url?.split('?')[0] === '/health') {
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' })
      response.end(JSON.stringify({ ok: true }))
    } else {
      response.writeHead(404, { 'content-type': 'application/json' })
      response.end(JSON.stringify({ message: 'Recurso não encontrado' }))
    }
  })
  const sockets = new WebSocketServer({ noServer: true, maxPayload: options.maxPayloadBytes ?? 4096, perMessageDeflate: false })

  function send(client: Client, value: unknown) {
    if (client.socket.readyState !== WebSocket.OPEN) return
    if (client.socket.bufferedAmount > MAX_BUFFERED_BYTES) return client.socket.terminate()
    client.socket.send(JSON.stringify(value), (error) => { if (error) client.socket.terminate() })
  }

  function closeSocket(client: Client, code: number, reason: string) {
    if (client.socket.readyState === WebSocket.CLOSED) return
    client.socket.close(code, reason)
    client.closeTimer ??= setTimeout(() => client.socket.terminate(), 2000)
    client.closeTimer.unref()
  }

  function error(client: Client, message: string, code: ErrorCode = 'BAD_INTENT', fatal = false, closeCode = 4000) {
    send(client, { t: 'error', message, code, ...(fatal ? { fatal: true } : {}) })
    if (fatal) {
      client.revoked = true
      closeSocket(client, code === 'BANNED' ? 4003 : closeCode, message)
    }
  }

  function snapshot(room: Room, client: Client, time: number) {
    if (client.playerId) send(client, { t: 'state', state: viewFor(room.state, client.playerId), serverNow: time })
  }

  function publish(room: Room, result: EngineResult, time: number, author?: Client) {
    const changed = room.state !== result.state
    room.state = result.state
    const events = result.events.filter((event) => event.type !== 'rejected')
    for (const event of result.events) {
      if (event.type === 'rejected' && author) error(author, event.reason)
    }
    for (const client of room.clients.values()) {
      if (changed) snapshot(room, client, time)
      if (events.length) send(client, { t: 'events', events })
    }
    for (const event of events) {
      if (event.type !== 'kicked') continue
      const expelled = room.clients.get(event.playerId)
      if (!expelled) continue
      room.clients.delete(event.playerId)
      expelled.room = null
      expelled.revoked = true
      closeSocket(expelled, 4003, 'Você foi removido da sala')
    }
    if (!room.clients.size && room.emptySince === null) room.emptySince = time
  }

  function advance(room: Room, time: number) {
    publish(room, tick(room.state, time), time)
  }

  function act(room: Room, intent: Intent, time: number, author?: Client) {
    advance(room, time)
    publish(room, applyIntent(room.state, intent, time), time, author)
  }

  function disconnect(client: Client, explicit: boolean) {
    const room = client.room
    const playerId = client.playerId
    client.room = null
    if (!room || !playerId || room.clients.get(playerId) !== client) return
    room.clients.delete(playerId)
    const time = now()
    if (!room.clients.size) room.emptySince = time
    if (!closing) {
      if (!explicit && room.state.phase === 'lobby' && lobbyGraceMs > 0) room.departures.set(playerId, time + lobbyGraceMs)
      else {
        room.departures.delete(playerId)
        act(room, { type: 'leave', playerId }, time)
      }
    }
  }

  function bind(client: Client, room: Room, playerId: string, token: string) {
    const previous = room.clients.get(playerId)
    client.room = room
    client.playerId = playerId
    clearTimeout(client.helloTimer)
    room.clients.set(playerId, client)
    room.sessions.set(playerId, token)
    room.departures.delete(playerId)
    room.emptySince = null
    if (previous && previous !== client) {
      previous.room = null
      error(previous, 'Sua vaga foi aberta em outra conexão', 'MEMBER_TAKEN', true)
    }
    send(client, { t: 'welcome', playerId, sessionToken: token })
  }

  function tokenMatches(expected: string, received: string | undefined) {
    if (!received || Buffer.byteLength(received) !== Buffer.byteLength(expected)) return false
    return timingSafeEqual(Buffer.from(expected), Buffer.from(received))
  }

  function enter(client: Client, message: Record<string, unknown>, time: number) {
    if (client.room || client.playerId) throw new ProtocolError('Você já está em uma sala')
    const me = identity(message.me)
    if (message.t === 'create') {
      if (rooms.size >= (options.maxRooms ?? 1000)) throw new ProtocolError('O servidor está cheio. Tente novamente em instantes', 'ROOM_FULL')
      const rules = settings(message.settings)
      let state: RoomState | undefined
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = createRoom({ host: me, settings: rules, seed: randomInt(0, 2 ** 31) })
        if (!rooms.has(candidate.code)) { state = candidate; break }
      }
      if (!state) throw new ProtocolError('Não foi possível criar uma sala. Tente novamente')
      const room: Room = { state, clients: new Map(), sessions: new Map(), departures: new Map(), emptySince: null }
      rooms.set(state.code, room)
      bind(client, room, me.playerId, randomBytes(32).toString('base64url'))
      snapshot(room, client, time)
      return
    }
    if (typeof message.code !== 'string') throw new ProtocolError('Sala não encontrada', 'ROOM_NOT_FOUND')
    const room = rooms.get(message.code.trim().toUpperCase())
    if (!room) throw new ProtocolError('Sala não encontrada', 'ROOM_NOT_FOUND')
    advance(room, time)
    if (room.state.banned.includes(me.playerId)) throw new ProtocolError('Você foi removido desta sala', 'BANNED')
    const token = room.sessions.get(me.playerId)
    if (token && !tokenMatches(token, me.sessionToken)) throw new ProtocolError('Essa vaga já pertence a outra sessão', 'MEMBER_TAKEN')
    const existing = room.state.players.some((player) => player.id === me.playerId)
    if (!existing && (room.state.players.length >= room.state.settings.maxPlayers || room.sessions.size >= MAX_SESSIONS_PER_ROOM)) throw new ProtocolError('Sala cheia', 'ROOM_FULL')
    if (room.state.players.some((player) => player.id !== me.playerId && player.memberId === me.memberId)) throw new ProtocolError('Esse personagem já está na sala', 'MEMBER_TAKEN')
    const result = applyIntent(room.state, { type: 'join', playerId: me.playerId, memberId: me.memberId, name: me.name }, time)
    const rejected = result.events.find((event) => event.type === 'rejected')
    if (rejected?.type === 'rejected') throw new ProtocolError(rejected.reason)
    bind(client, room, me.playerId, token ?? randomBytes(32).toString('base64url'))
    publish(room, result, time)
  }

  function receive(client: Client, data: Buffer | ArrayBuffer | Buffer[], binary: boolean) {
    if (closing || client.revoked) return
    const time = now()
    if (time - client.windowAt >= 1000) { client.windowAt = time; client.messages = 0 }
    if (++client.messages > maxRate) {
      error(client, 'Muitas mensagens. Entre novamente em instantes', 'BAD_INTENT', true, 4008)
      return
    }
    let message: unknown
    try {
      if (binary) throw new ProtocolError('Envie mensagens JSON em texto')
      message = JSON.parse(data.toString())
      if (!record(message)) throw new ProtocolError('Mensagem inválida')
      if (message.t === 'ping') {
        if (typeof message.clientNow !== 'number' || !Number.isFinite(message.clientNow)) throw new ProtocolError('Mensagem inválida')
        send(client, { t: 'pong', clientNow: message.clientNow, serverNow: time })
      } else if (message.t === 'create' || message.t === 'join') {
        enter(client, message, time)
      } else if (message.t === 'intent') {
        const room = client.room
        if (!room || !client.playerId || room.clients.get(client.playerId) !== client) throw new ProtocolError('Entre em uma sala antes de jogar')
        const intent = gameIntent(message.intent, client.playerId)
        if (intent.type === 'leave') {
          disconnect(client, true)
          client.revoked = true
          closeSocket(client, 1000, 'Você saiu da sala')
        } else act(room, intent, time, client)
      } else throw new ProtocolError('Mensagem inválida')
    } catch (caught) {
      const fatal = record(message) && (message.t === 'create' || message.t === 'join')
      if (caught instanceof ProtocolError) error(client, caught.message, caught.code, fatal)
      else error(client, 'Não foi possível processar a mensagem', 'BAD_INTENT', fatal)
    }
  }

  http.on('upgrade', (request, socket, head) => {
    const path = request.url?.split('?')[0]
    let status = ''
    if (closing || sockets.clients.size >= (options.maxConnections ?? 1000)) status = '503 Service Unavailable'
    else if (path !== '/ws' && path !== '/') status = '404 Not Found'
    else if (options.allowedOrigins && !options.allowedOrigins.includes(request.headers.origin ?? '')) status = '403 Forbidden'
    if (status) { socket.end(`HTTP/1.1 ${status}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`); return }
    sockets.handleUpgrade(request, socket, head, (ws) => sockets.emit('connection', ws, request))
  })

  sockets.on('connection', (socket) => {
    const client: Client = {
      socket, room: null, playerId: null, revoked: false, alive: true, windowAt: now(), messages: 0,
      helloTimer: setTimeout(() => error(client, 'O tempo para entrar na sala acabou', 'BAD_INTENT', true), 10_000),
    }
    client.helloTimer.unref()
    clients.set(socket, client)
    socket.on('pong', () => { client.alive = true })
    socket.on('message', (data, binary) => receive(client, data, binary))
    socket.on('error', () => { /* ws fecha a conexão inválida; close faz a limpeza. */ })
    socket.on('close', () => {
      clearTimeout(client.helloTimer)
      if (client.closeTimer) clearTimeout(client.closeTimer)
      clients.delete(socket)
      disconnect(client, false)
    })
  })

  const loop = setInterval(() => {
    const time = now()
    for (const [code, room] of rooms) {
      for (const [playerId, due] of room.departures) {
        if (time >= due) {
          room.departures.delete(playerId)
          if (!room.clients.has(playerId)) act(room, { type: 'leave', playerId }, time)
        }
      }
      advance(room, time)
      if (!room.clients.size && room.emptySince !== null && time - room.emptySince >= roomTtlMs) rooms.delete(code)
    }
  }, options.tickMs ?? 100)
  loop.unref()

  const heartbeat = setInterval(() => {
    for (const client of clients.values()) {
      if (!client.alive) client.socket.terminate()
      else if (client.socket.readyState === WebSocket.OPEN) { client.alive = false; client.socket.ping() }
    }
  }, options.heartbeatMs ?? 30_000)
  heartbeat.unref()

  return {
    listen(): Promise<{ port: number; host: string }> {
      return new Promise((resolve, reject) => {
        const failed = (cause: Error) => reject(cause)
        http.once('error', failed)
        http.listen(port, host, () => {
          http.off('error', failed)
          const address = http.address() as AddressInfo
          resolve({ port: address.port, host: address.address })
        })
      })
    },
    close(): Promise<void> {
      closePromise ??= (async () => {
        closing = true
        clearInterval(loop)
        clearInterval(heartbeat)
        for (const client of clients.values()) {
          clearTimeout(client.helloTimer)
          if (client.closeTimer) clearTimeout(client.closeTimer)
          client.socket.terminate()
        }
        rooms.clear()
        await new Promise<void>((resolve) => sockets.close(() => resolve()))
        if (http.listening) await new Promise<void>((resolve, reject) => http.close((cause) => cause ? reject(cause) : resolve()))
      })()
      return closePromise
    },
  }
}
