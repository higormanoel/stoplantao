import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, identities, intent, startRound } from './helpers.js'

test('payload acima do limite fecha só o infrator com código 1009', async (t) => {
  const f = await fixture(t, { maxPayloadBytes: 512 })
  const oversized = await f.client()
  oversized.raw('x'.repeat(513))
  const closed = await oversized.waitClosed()
  assert.equal(closed.code, 1009)
  const healthy = await f.client()
  await healthy.barrier()
  assert.equal((await fetch(`${f.httpUrl}/health`)).status, 200)
})

test('limite de mensagens inclui ping e fecha com 4008 sem afetar outros clientes', async (t) => {
  const f = await fixture(t, { maxMessagesPerSecond: 3 })
  const abusive = await f.client()
  for (let clientNow = 1; clientNow <= 4; clientNow++) abusive.send({ t: 'ping', clientNow })
  const error = await abusive.wait((m) => m.t === 'error')
  assert.equal(error.code, 'BAD_INTENT')
  assert.equal(error.fatal, true)
  assert.equal((await abusive.waitClosed()).code, 4008)
  const healthy = await f.client()
  await healthy.barrier()
  await healthy.barrier()
  await healthy.barrier()
  f.advance(1000)
  await healthy.barrier()
})

test('limite de salas recusa criação sem tirar a sala existente do ar', async (t) => {
  const f = await fixture(t, { maxRooms: 1 })
  const { client: host, state } = await f.create()
  const excess = await f.client()
  excess.send({ t: 'create', me: identities.guest, settings: {} })
  const error = await excess.wait((m) => m.t === 'error')
  assert.equal(error.fatal, true)
  await host.barrier()
  assert.equal(host.latestState().code, state.code)
})

test('limite de conexões recusa o upgrade adicional e preserva a conexão existente', async (t) => {
  const f = await fixture(t, { maxConnections: 1 })
  const existing = await f.client()
  await assert.rejects(f.client())
  await existing.barrier()
})

test('allowlist de origem bloqueia upgrade proibido e aceita a origem configurada', async (t) => {
  const f = await fixture(t, { allowedOrigins: ['https://stoplantao.example'] })
  await assert.rejects(f.client({ origin: 'https://intruso.example' }))
  const allowed = await f.client({ origin: 'https://stoplantao.example' })
  await allowed.barrier()
})

test('heartbeat remove socket que não responde ao ping e mantém clientes responsivos', async (t) => {
  const f = await fixture(t, { heartbeatMs: 15 })
  const healthy = await f.client()
  const unresponsive = await f.client({ autoPong: false })
  assert.equal((await unresponsive.waitClosed()).code, 1006)
  await healthy.barrier()
})

test('sala sem sockets expira mesmo mantendo jogadores desconectados de uma rodada', async (t) => {
  const f = await fixture(t, { roomTtlMs: 1000 })
  const { client: host, state: abandoned, welcome } = await f.create()
  const { client: guest } = await f.join(abandoned.code)
  await startRound(f, host)
  await guest.close()
  await host.close()

  // A second, live room provides an observable timer tick without sleeping or
  // inspecting server internals. The abandoned room was inserted first.
  const { client: observer, state: sentinel } = await f.create()
  await f.join(sentinel.code)
  await startRound(f, observer)
  const retry = await f.client()
  retry.send({ t: 'join', code: abandoned.code, me: { ...identities.host, sessionToken: welcome.sessionToken } })
  const error = await retry.wait((m) => m.t === 'error')
  assert.equal(error.code, 'ROOM_NOT_FOUND')
  assert.equal(error.fatal, true)
  await observer.barrier()
  assert.equal(observer.latestState().players.length, 2)
})

test('sala em lobby sem sockets também expira e libera o limite de salas', async (t) => {
  const f = await fixture(t, { roomTtlMs: 1000, maxRooms: 2 })
  const { client: host, state: abandoned } = await f.create()
  await host.close()
  const { client: observer, state: sentinel } = await f.create()
  await f.join(sentinel.code)
  await startRound(f, observer)
  const retry = await f.client()
  retry.send({ t: 'join', code: abandoned.code, me: identities.third })
  const error = await retry.wait((m) => m.t === 'error')
  assert.equal(error.code, 'ROOM_NOT_FOUND')
  const newRoom = await f.create()
  assert.equal(newRoom.state.phase, 'lobby')
  intent(observer, { type: 'leave' })
  await observer.waitClosed()
})
