import assert from 'node:assert/strict'
import test from 'node:test'
import { fixture, identities, intent } from './helpers.js'

test('JSON malformado e mensagens fora do contrato não derrubam a conexão nem o processo', async (t) => {
  const f = await fixture(t)
  const client = await f.client()
  for (const raw of ['{', 'null', '42', '[]', '{"t":"desconhecido"}', '{"t":"intent","intent":null}']) {
    const mark = client.mark()
    client.raw(raw)
    const error = await client.wait((m) => m.t === 'error', mark)
    assert.equal(error.code, 'BAD_INTENT')
    assert.notEqual(error.fatal, true)
    assert.equal(typeof error.message, 'string')
    await client.barrier()
  }
  assert.equal((await fetch(`${f.httpUrl}/health`)).status, 200)
})

test('frame binário é rejeitado sem derrubar a sessão de texto', async (t) => {
  const f = await fixture(t)
  const client = await f.client()
  client.socket.send(Buffer.from('{"t":"ping","clientNow":42}'))
  const error = await client.wait((m) => m.t === 'error')
  assert.equal(error.code, 'BAD_INTENT')
  assert.notEqual(error.fatal, true)
  await client.barrier()
})

test('create recusa identidade inválida e settings numéricos hostis sem lançar exceção', async (t) => {
  const f = await fixture(t)
  const cases = [
    { me: null },
    { me: { ...identities.host, playerId: '__proto__' } },
    { me: { ...identities.host, memberId: 'inexistente' } },
    { me: identities.host, settings: { rounds: { toString: [] } } },
  ]
  for (const value of cases) {
    const client = await f.client()
    client.send({ t: 'create', settings: {}, ...value })
    const error = await client.wait((m) => m.t === 'error')
    assert.equal(error.code, 'BAD_INTENT')
    assert.equal(error.fatal, true)
  }
  const { state } = await f.create()
  assert.equal(state.players.length, 1)
  assert.equal((await fetch(`${f.httpUrl}/health`)).status, 200)
})

test('intents join não criam vagas nem mudam identidade fora do handshake autenticado', async (t) => {
  const f = await fixture(t)
  const { client: host, state } = await f.create()
  const { client: guest } = await f.join(state.code)
  intent(guest, { type: 'join', ...identities.third })
  const error = await guest.wait((m) => m.t === 'error')
  assert.equal(error.code, 'BAD_INTENT')
  await guest.barrier()
  assert.deepEqual(guest.latestState().players.map((p) => p.id), ['host', 'guest'])
  assert.equal(host.latestState().players.length, 2)
})

test('updateSettings hostil é rejeitado só para o remetente e servidor continua aceitando ping', async (t) => {
  const f = await fixture(t)
  const { client: host } = await f.create()
  intent(host, { type: 'updateSettings', settings: { answerSeconds: { valueOf: null, toString: null } } })
  const error = await host.wait((m) => m.t === 'error')
  assert.equal(error.code, 'BAD_INTENT')
  assert.notEqual(error.fatal, true)
  await host.barrier()
})
