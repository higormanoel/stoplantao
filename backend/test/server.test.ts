import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, identities, intent } from './helpers.js'

test('GET /health confirma disponibilidade e ping funciona antes de entrar numa sala', async (t) => {
  const f = await fixture(t)
  const response = await fetch(`${f.httpUrl}/health`)
  assert.equal(response.status, 200)
  const client = await f.client()
  client.send({ t: 'ping', clientNow: 42 })
  const pong = await client.wait((m) => m.t === 'pong')
  assert.equal(pong.clientNow, 42)
  assert.equal(pong.serverNow, f.now())
})

test('create envia welcome com token antes do primeiro estado e nunca expõe segredos', async (t) => {
  const f = await fixture(t)
  const { client, welcome, state } = await f.create()
  assert.equal(welcome.playerId, identities.host.playerId)
  assert.ok(typeof welcome.sessionToken === 'string' && welcome.sessionToken.length >= 22)
  assert.ok(client.messages.findIndex((m) => m.t === 'welcome') < client.messages.findIndex((m) => m.t === 'state'))
  assert.equal(state.phase, 'lobby')
  assert.match(state.code, /^[A-Z2-9]{5}$/)
  assert.equal(state.seed, 0)
  assert.deepEqual(state.voiceBag, { stop: [], nostop: [] })
  assert.deepEqual(state.banned, [])
  assert.ok(!JSON.stringify(state).includes(welcome.sessionToken!))
  assert.equal(state.players[0]?.isHost, true)
  assert.equal(state.players[0]?.isBot, false)
})

test('recusas do motor chegam só ao autor como BAD_INTENT e não permitem personificar o host', async (t) => {
  const f = await fixture(t)
  const { client: host, state } = await f.create()
  const { client: guest } = await f.join(state.code)
  const hostMark = host.mark()
  intent(guest, { type: 'start', playerId: 'host' })
  const error = await guest.wait((m) => m.t === 'error')
  assert.equal(error.code, 'BAD_INTENT')
  assert.notEqual(error.fatal, true)
  await host.barrier()
  assert.equal(host.latestState().phase, 'lobby')
  assert.equal(host.messages.slice(hostMark).some((m) => m.t === 'error' || m.events?.some((e) => e.type === 'rejected')), false)
})
