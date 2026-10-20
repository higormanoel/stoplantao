import assert from 'node:assert/strict'
import test from 'node:test'
import { enterValidation, fixture, fourCategories, identities, intent, startRound } from './helpers.js'

test('rodada STOP preserva privacidade e tolerância, aplica votos e entrega pódio com empate', async (t) => {
  const f = await fixture(t)
  const { client: host, state: lobby } = await f.create({ rounds: 1, categoryIds: fourCategories })
  const { client: guest } = await f.join(lobby.code)
  const { client: third } = await f.join(lobby.code, identities.third)
  const answering = await startRound(f, host)
  const roundId = answering.round!.id
  assert.equal(typeof roundId, 'number')
  const value = `${answering.round!.letter}lfa`
  for (const client of [host, guest]) {
    for (const categoryId of fourCategories) intent(client, { type: 'answer', roundId, categoryId, value })
    await client.barrier()
  }
  const hostAnswered = await host.state((s) => s.players.find((p) => p.id === 'guest')?.filled === 4)
  assert.deepEqual(Object.keys(hostAnswered.round!.answers), ['host'])
  assert.deepEqual(Object.keys(guest.latestState().round!.answers), ['guest'])
  assert.equal(hostAnswered.round!.answers.host!.nome, value)
  assert.ok(!JSON.stringify(third.latestState().round!.answers).includes(value))

  const stopMark = host.mark()
  intent(host, { type: 'stop', roundId })
  const stopped = await host.state((s) => s.phase === 'stopped', stopMark)
  const stopEvent = await host.event('stopCalled', stopMark)
  const guestStop = await guest.event('stopCalled')
  assert.equal(stopped.round!.stopBy, 'host')
  assert.equal(stopped.round!.endedBy, 'stop')
  assert.equal(stopped.round!.stoppedAt, f.now())
  assert.equal(stopEvent.voiceLineId, guestStop.voiceLineId)
  assert.equal(stopEvent.voiceLineId, stopped.lastVoiceLineId)
  assert.deepEqual(Object.keys(stopped.round!.answers), ['host'])

  // The inclusive 1,200 ms boundary protects an answer already in flight.
  f.advance(1200)
  intent(third, { type: 'answer', roundId, categoryId: 'nome', value: `${answering.round!.letter}beta` })
  await third.barrier()
  assert.equal(third.latestState().round!.answers.third!.nome, `${answering.round!.letter}beta`)
  f.advance(1)
  intent(third, { type: 'answer', roundId, categoryId: 'animal', value: `${answering.round!.letter}tardia` })
  await third.barrier()
  assert.equal(third.latestState().round!.answers.third!.animal, undefined)

  let validating = await enterValidation(f, host)
  assert.equal(validating.round!.answers.guest!.nome, value)
  assert.equal(validating.round!.answers.third!.nome, `${answering.round!.letter}beta`)
  for (let index = 0; index < fourCategories.length; index++) {
    const categoryId = fourCategories[index]!
    if (index === 0) {
      for (const client of [host, guest]) {
        intent(client, { type: 'vote', roundId, categoryId, targetId: 'third', valid: false })
        await client.barrier()
      }
      const voted = await host.state((s) => s.round?.votes.nome?.third?.guest === false)
      assert.equal(voted.round!.votes.nome!.third!.host, false)
      assert.equal(voted.round!.votes.nome!.third!.guest, false)
    }
    const mark = host.mark()
    for (const client of [host, guest, third]) intent(client, { type: 'ready', roundId, categoryId })
    if (index + 1 < fourCategories.length) {
      validating = await host.state((s) => s.phase === 'validating' && s.round!.validationIndex === index + 1, mark)
    } else {
      const results = await host.state((s) => s.phase === 'roundResults', mark)
      assert.deepEqual(results.history[0]!.points, { host: 20, guest: 20, third: 0 })
      assert.equal(results.history[0]!.endedBy, 'stop')
      assert.equal(results.history[0]!.cells.host!.nome!.status, 'repeated')
      assert.equal(results.history[0]!.cells.host!.nome!.points, 5)
      assert.equal(results.history[0]!.cells.third!.nome!.status, 'invalid')
      assert.equal(results.history[0]!.cells.third!.animal!.status, 'empty')
      assert.deepEqual(results.players.map((p) => p.score), [20, 20, 0])
      const scored = await host.event('roundScored', mark)
      assert.deepEqual(scored.summary, results.history[0])
    }
  }
  const podiumMark = host.mark()
  intent(host, { type: 'next' })
  await host.state((s) => s.phase === 'podium', podiumMark)
  const gameOver = await host.event('gameOver', podiumMark)
  assert.deepEqual(gameOver.ranking, ['host', 'guest', 'third'])
  assert.deepEqual(gameOver.places, { host: 1, guest: 1, third: 3 })
  for (const client of [host, guest, third]) {
    for (const message of client.messages.filter((m) => m.t === 'state')) {
      assert.equal(message.state!.seed, 0)
      assert.deepEqual(message.state!.voiceBag, { stop: [], nostop: [] })
      assert.deepEqual(message.state!.banned, [])
    }
  }
  const restartMark = host.mark()
  intent(host, { type: 'restart' })
  await host.state((s) => s.phase === 'lobby', restartMark)
  const restarted = await startRound(f, host)
  assert.ok(restarted.round!.id > roundId, 'Reiniciar não pode reutilizar IDs de rodadas anteriores')
})

test('timeout avança por relógio até placar e pódio sem depender de mensagens dos jogadores', async (t) => {
  const f = await fixture(t)
  const { client: host, state: lobby } = await f.create({ rounds: 1, categoryIds: fourCategories, answerSeconds: 30 })
  await f.join(lobby.code)
  const answering = await startRound(f, host)
  const mark = host.mark()
  f.advance(30_000)
  const stopped = await host.state((s) => s.phase === 'stopped', mark)
  assert.equal(stopped.round!.endedBy, 'timeout')
  assert.equal(stopped.round!.stopBy, null)
  const timeUp = await host.event('timeUp', mark)
  assert.equal(timeUp.voiceLineId, stopped.lastVoiceLineId)
  assert.notEqual(stopped.round!.startedAt, null)
  assert.equal(stopped.round!.letter, answering.round!.letter)
  await enterValidation(f, host)
  for (let index = 0; index < fourCategories.length; index++) {
    const stepMark = host.mark()
    f.advance(1600)
    await host.state((s) => index === 3 ? s.phase === 'roundResults' : s.phase === 'validating' && s.round!.validationIndex === index + 1, stepMark)
  }
  assert.deepEqual(host.latestState().history[0]!.points, { host: 0, guest: 0 })
  const podiumMark = host.mark()
  f.advance(11_000)
  await host.state((s) => s.phase === 'podium', podiumMark)
  const over = await host.event('gameOver', podiumMark)
  assert.deepEqual(over.places, { host: 1, guest: 1 })
})

test('roundId antigo não modifica resposta, STOP, voto ou ready de uma rodada nova', async (t) => {
  const f = await fixture(t)
  const { client: host, state: lobby } = await f.create({ rounds: 2, categoryIds: fourCategories })
  const { client: guest } = await f.join(lobby.code)
  const first = await startRound(f, host)
  const oldRoundId = first.round!.id
  f.advance(30_000 + 300_000)
  await host.state((s) => s.phase === 'stopped')
  await enterValidation(f, host)
  for (let index = 0; index < 4; index++) {
    const mark = host.mark()
    for (const client of [host, guest]) intent(client, { type: 'ready', roundId: oldRoundId, categoryId: fourCategories[index] })
    await host.state((s) => index === 3 ? s.phase === 'roundResults' : s.phase === 'validating' && s.round!.validationIndex === index + 1, mark)
  }
  const drawingMark = host.mark()
  intent(host, { type: 'next' })
  const drawing = await host.state((s) => s.phase === 'drawing', drawingMark)
  const newRoundId = drawing.round!.id
  assert.ok(newRoundId > oldRoundId)
  f.advance(3400)
  const answering = await host.state((s) => s.phase === 'answering' && s.round!.id === newRoundId, drawingMark)
  for (const categoryId of fourCategories) {
    intent(host, { type: 'answer', roundId: newRoundId, categoryId, value: `${answering.round!.letter}atual` })
  }
  intent(guest, { type: 'answer', roundId: newRoundId, categoryId: 'nome', value: `${answering.round!.letter}colega` })
  await guest.barrier()
  intent(host, { type: 'answer', roundId: oldRoundId, categoryId: 'nome', value: `${answering.round!.letter}antiga` })
  intent(host, { type: 'stop', roundId: oldRoundId })
  await host.barrier()
  assert.equal(host.latestState().phase, 'answering')
  assert.equal(host.latestState().round!.answers.host!.nome, `${answering.round!.letter}atual`)

  f.advance(300_000)
  const stoppedMark = host.mark()
  await host.state((s) => s.phase === 'stopped', stoppedMark)
  const validating = await enterValidation(f, host)
  const mark = host.mark()
  intent(host, { type: 'vote', roundId: oldRoundId, categoryId: 'nome', targetId: 'guest', valid: false })
  intent(host, { type: 'ready', roundId: oldRoundId, categoryId: 'nome' })
  await host.barrier()
  assert.equal(host.latestState().players.find((p) => p.id === 'host')?.ready, false)
  assert.deepEqual(host.latestState().round!.votes, validating.round!.votes)
  assert.equal(host.latestState().round!.validationIndex, 0)
  assert.ok(host.messages.slice(mark).every((m) => !m.events?.some((e) => e.type === 'validationStep')))
})

test('ready atrasado da categoria anterior não pula a categoria atual', async (t) => {
  const f = await fixture(t)
  const { client: host, state: lobby } = await f.create({ rounds: 1, categoryIds: fourCategories })
  const { client: guest } = await f.join(lobby.code)
  const answering = await startRound(f, host)
  f.advance(300_000)
  await host.state((s) => s.phase === 'stopped')
  await enterValidation(f, host)
  const roundId = answering.round!.id
  const mark = host.mark()
  for (const client of [host, guest]) intent(client, { type: 'ready', roundId, categoryId: 'nome' })
  await host.state((s) => s.phase === 'validating' && s.round!.validationIndex === 1, mark)
  intent(host, { type: 'ready', roundId, categoryId: 'nome' })
  await host.barrier()
  assert.equal(host.latestState().players.find((p) => p.id === 'host')?.ready, false)
  assert.equal(host.latestState().round!.validationIndex, 1)
})
