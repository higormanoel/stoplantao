import assert from 'node:assert/strict'
import { after, test } from 'node:test'
import { TEAM } from '../src/data/team'
import { applyIntent, createRoom, DEFAULT_SETTINGS, sanitizeSettings, tick } from '../src/game/engine'
import type { Intent, RoomState } from '../src/game/types'
import { SocketTransport } from '../src/net/socketTransport'

const me = { playerId: 'host', memberId: TEAM[0].id, name: TEAM[0].shortName }
const peer = { playerId: 'peer', memberId: TEAM[1].id, name: TEAM[1].shortName }
function started(): RoomState {
  let s = createRoom({ host: me, seed: 17, settings: { rounds: 1 }, code: 'TEST' })
  s = applyIntent(s, { type: 'join', ...peer }, 0).state
  return applyIntent(s, { type: 'start', playerId: me.playerId }, 0).state
}
function answering(): RoomState {
  const s = started()
  return tick(s, s.phaseEndsAt!).state
}
function validating(): RoomState {
  let s = answering()
  s = tick(s, s.phaseEndsAt!).state
  return tick(s, s.phaseEndsAt!).state
}
function apply(s: RoomState, intent: object) {
  return applyIntent(s, { playerId: me.playerId, ...intent } as Intent, 5000)
}

test('round IDs remain unique after returning to the lobby', () => {
  let s = started()
  assert.equal(s.round!.id, 1)
  while (s.phase !== 'podium') s = tick(s, s.phaseEndsAt!).state
  s = apply(s, { type: 'restart' }).state
  assert.equal(s.roundSerial, 1)
  s = apply(s, { type: 'start' }).state
  assert.equal(s.round!.id, 2)
})
test('previous-round answers cannot overwrite the current round', () => {
  const s = answering()
  const result = apply(s, { type: 'answer', roundId: -1, categoryId: 'nome', value: `${s.round!.letter}ntigo` })
  assert.equal(result.state, s)
  assert.deepEqual(result.events, [])
})
test('previous-round STOP cannot end the current answering phase', () => {
  let s = answering()
  for (const categoryId of s.settings.categoryIds) s = apply(s, { type: 'answer', roundId: s.round!.id, categoryId, value: `${s.round!.letter}teste` }).state
  assert.equal(apply(s, { type: 'stop', roundId: -1 }).state, s)
})
test('previous-round votes and readiness cannot affect validation', () => {
  const s = validating()
  const categoryId = s.settings.categoryIds[0]
  s.round!.answers[peer.playerId][categoryId] = `${s.round!.letter}teste`
  assert.equal(apply(s, { type: 'vote', roundId: -1, categoryId, targetId: peer.playerId, valid: false }).state, s)
  assert.equal(apply(s, { type: 'ready', roundId: -1, categoryId }).state, s)
})
test('duplicate readiness from the previous category cannot advance the next category', () => {
  let s = validating()
  const [first, second] = s.settings.categoryIds
  const roundId = s.round!.id
  s = apply(s, { type: 'ready', roundId, categoryId: first }).state
  s = apply(s, { type: 'ready', playerId: peer.playerId, roundId, categoryId: first }).state
  assert.equal(s.round!.validationIndex, 1)
  assert.equal(apply(s, { type: 'ready', roundId, categoryId: first }).state, s)
  assert.equal(apply(s, { type: 'ready', roundId, categoryId: second }).state.players[0].ready, true)
})
test('settings reject JSON objects without coercing them or throwing', () => {
  const poison = JSON.parse('{"valueOf":null,"toString":null}')
  const settings = sanitizeSettings({ rounds: poison, answerSeconds: [], validateSeconds: {}, maxPlayers: null } as never)
  assert.deepEqual(settings, DEFAULT_SETTINGS)
})

// O socket e o relógio são as únicas fronteiras substituídas: exercitamos o transporte real.
const originalWindow = globalThis.window
const originalSocket = globalThis.WebSocket
const originalNow = Date.now
let now = 1_700_000_000_000
let serial = 0
const timers = new Map<number, { at: number; fn: () => void; every?: number }>()
function timer(fn: () => void, ms: number, every?: number) {
  const id = ++serial
  timers.set(id, { at: now + ms, fn, every })
  return id
}
function advance(ms: number) {
  const until = now + ms
  while (true) {
    const next = [...timers].filter(([, t]) => t.at <= until).sort((a, b) => a[1].at - b[1].at)[0]
    if (!next) break
    now = next[1].at
    if (next[1].every) next[1].at += next[1].every
    else timers.delete(next[0])
    next[1].fn()
  }
  now = until
}
class FakeSocket {
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = 0
  sent: { t: string; intent?: Intent }[] = []
  onopen: (() => void) | null = null
  onclose: (() => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(_url: string) { FakeSocket.instances.push(this) }
  send(data: string) { this.sent.push(JSON.parse(data)) }
  open() { this.readyState = 1; this.onopen?.() }
  close() { this.readyState = 3; this.onclose?.() }
  receive(msg: object) { this.onmessage?.({ data: JSON.stringify(msg) }) }
  intents() { return this.sent.filter((m) => m.t === 'intent') }
}
globalThis.window = {
  setTimeout: (fn: () => void, ms: number) => timer(fn, ms),
  clearTimeout: (id: number) => timers.delete(id),
  setInterval: (fn: () => void, ms: number) => timer(fn, ms, ms),
  clearInterval: (id: number) => timers.delete(id),
} as unknown as Window & typeof globalThis
globalThis.WebSocket = FakeSocket as unknown as typeof WebSocket
Date.now = () => now
after(() => {
  globalThis.window = originalWindow
  globalThis.WebSocket = originalSocket
  Date.now = originalNow
})
function transport() {
  timers.clear()
  FakeSocket.instances = []
  const fatals: string[] = []
  const t = new SocketTransport('ws://test/ws', { onState() {}, onEvents() {}, onError() {}, onFatal: (m) => fatals.push(m) })
  t.joinRoom(me, 'TEST')
  return { t, ws: FakeSocket.instances[0], fatals }
}
function state(ws: FakeSocket, s: RoomState) { ws.receive({ t: 'state', state: s, serverNow: now }) }

test('an open socket waits for the room state before sending queued actions', () => {
  const { t, ws } = transport()
  const s = answering()
  ws.open()
  t.send({ type: 'answer', playerId: me.playerId, roundId: s.round!.id, categoryId: 'nome', value: 'teste' })
  assert.equal(ws.intents().length, 0)
  state(ws, s)
  assert.equal(ws.intents().length, 1)
  t.dispose()
})
test('reconnection drops answers and STOP from another round after confirming entry', () => {
  const { t, ws } = transport()
  const s = answering()
  ws.open(); state(ws, s); ws.close()
  t.send({ type: 'answer', playerId: me.playerId, roundId: s.round!.id, categoryId: 'nome', value: 'velha' })
  t.send({ type: 'stop', playerId: me.playerId, roundId: s.round!.id })
  advance(500)
  const next = FakeSocket.instances[1]
  next.open()
  assert.equal(next.intents().length, 0)
  const current = structuredClone(s)
  current.round!.id = 9
  state(next, current)
  assert.equal(next.intents().length, 0)
  t.dispose()
})
test('reconnection drops votes and readiness for a previous validation category', () => {
  const { t, ws } = transport()
  const s = validating()
  const categoryId = s.settings.categoryIds[0]
  ws.open(); state(ws, s); ws.close()
  t.send({ type: 'ready', playerId: me.playerId, roundId: s.round!.id, categoryId })
  t.send({ type: 'vote', playerId: me.playerId, roundId: s.round!.id, categoryId, targetId: peer.playerId, valid: false })
  advance(500)
  const next = FakeSocket.instances[1]
  next.open()
  const current = structuredClone(s)
  current.round!.validationIndex = 1
  state(next, current)
  assert.equal(next.intents().length, 0)
  t.dispose()
})
test('an open socket without a successful join keeps increasing retry delays', () => {
  const { t, ws } = transport()
  ws.open(); state(ws, answering()); ws.close()
  advance(500)
  const next = FakeSocket.instances[1]
  next.open(); next.close()
  advance(500)
  assert.equal(FakeSocket.instances.length, 2)
  advance(500)
  assert.equal(FakeSocket.instances.length, 3)
  t.dispose()
})
test('entry timeout returns an error instead of waiting indefinitely', () => {
  const { t, ws, fatals } = transport()
  ws.open()
  advance(10001)
  assert.equal(fatals.length, 1)
  t.dispose()
})
test('a joined socket without pongs is closed so reconnection can recover it', () => {
  const { t, ws } = transport()
  ws.open(); state(ws, answering())
  advance(30001)
  assert.equal(ws.readyState, 3)
  t.dispose()
})
