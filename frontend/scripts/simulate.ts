// Simulação headless: roda partidas inteiras só com bots e relógio falso.
// Uso: npx tsx scripts/simulate.ts [partidas]
// Serve de teste de fumaça do motor (e de referência para o backend).

import { TEAM, type TeamMember } from '../src/data/team'
import { BotBrain } from '../src/game/bots'
import { applyIntent, createRoom, placements, tick, viewFor } from '../src/game/engine'
import { TIMINGS, normalize } from '../src/game/rules'
import type { EngineResult, GameEvent, Intent, RoomState } from '../src/game/types'

const games = Number(process.argv[2] ?? 30)
let failures = 0
const stats = { stops: 0, timeouts: 0, rounds: 0, events: 0 }

function assert(cond: unknown, msg: string, state: RoomState) {
  if (!cond) {
    failures++
    console.error(`✗ ${msg} (sala ${state.code}, fase ${state.phase}, rodada ${state.roundIndex})`)
    throw new Error(msg)
  }
}

/** invariantes checadas a cada passo */
function checkInvariants(state: RoomState) {
  assert(state.players.filter((p) => p.isHost).length <= 1, 'mais de um host', state)
  assert(state.players.filter((p) => p.isHost && p.connected).length <= 1, 'mais de um host conectado', state)
}

/** respostas iguais (normalizadas) na mesma categoria têm sempre o mesmo veredito */
function checkSharedVerdicts(state: RoomState) {
  for (const h of state.history) {
    for (const cat of state.settings.categoryIds) {
      const byKey = new Map<string, string>()
      for (const cells of Object.values(h.cells)) {
        const cell = cells[cat]
        if (!cell || cell.status === 'empty') continue
        const key = normalize(cell.value)
        const seen = byKey.get(key)
        assert(seen === undefined || seen === cell.status, `"${cell.value}" em ${cat} com vereditos diferentes`, state)
        byKey.set(key, cell.status)
      }
    }
  }
}

/** gameOver.places bate com a pontuação (empate divide a posição) */
function checkGameOver(state: RoomState, e: Extract<GameEvent, { type: 'gameOver' }>) {
  const score = (id: string) => state.players.find((p) => p.id === id)?.score ?? 0
  assert(e.ranking.length === state.players.length, 'ranking incompleto', state)
  e.ranking.forEach((id, i) => {
    const expected = 1 + state.players.filter((q) => q.score > score(id)).length
    assert(e.places[id] === expected, `colocação de ${id} errada (${e.places[id]} != ${expected})`, state)
    if (i > 0) assert(score(e.ranking[i - 1]) >= score(id), 'ranking fora de ordem', state)
  })
}

// ---------- cenários determinísticos (achados da revisão) ----------

function scenarios() {
  let now = 1_600_000_000_000
  const [a, b, c, d] = TEAM
  const run = (s: RoomState, intent: Intent): EngineResult => {
    const r = applyIntent(s, intent, now)
    checkInvariants(r.state)
    return r
  }
  const join = (s: RoomState, id: string, m: TeamMember, isBot = false) =>
    run(s, { type: 'join', playerId: id, memberId: m.id, name: m.shortName, isBot })
  const hosts = (s: RoomState) => s.players.filter((p) => p.isHost).map((p) => p.id).join()
  const get = (s: RoomState, id: string) => s.players.find((p) => p.id === id)!

  // entrada maliciosa não pode lançar exceção nem quebrar a sala
  let s = createRoom({ host: { playerId: 'H', memberId: a.id, name: a.shortName }, seed: 7 })
  const junk: unknown[] = [
    null,
    42,
    {},
    { type: 'nope', playerId: 'H' },
    { type: 'answer', playerId: 'H', categoryId: 'nome', value: 5 },
    { type: 'answer', playerId: 'H', categoryId: 'xyz', value: 'a' },
    { type: 'vote', playerId: 'H', categoryId: 'nome', targetId: 'P', valid: 'sim' },
    { type: 'updateSettings', playerId: 'H', settings: null },
    { type: 'kick', playerId: 'H', targetId: 7 },
    { type: 'join', playerId: '__proto__', memberId: b.id, name: 'x' },
    { type: 'join', playerId: 'Z', memberId: 'ninguem', name: 'x' },
    { type: 'join', playerId: 'Z', memberId: b.id, name: 42 },
  ]
  for (const j of junk) run(s, j as Intent)
  const bad = run(s, { type: 'updateSettings', playerId: 'H', settings: { rounds: 'abc', answerSeconds: 'x', categoryIds: 'nope', maxPlayers: null } as never }).state
  const nums = [bad.settings.rounds, bad.settings.answerSeconds, bad.settings.validateSeconds, bad.settings.maxPlayers]
  assert(nums.every(Number.isFinite) && bad.settings.categoryIds.length >= 4, 'settings inválidas passaram', bad)
  const longName = join(s, 'Z', b, false).state
  assert(get(longName, 'Z').name.length <= 24, 'nome sem limite', longName)
  const longer = run(s, { type: 'join', playerId: 'Z', memberId: b.id, name: 'x'.repeat(100) }).state
  assert(get(longer, 'Z').name.length === 24, 'nome deveria ser cortado em 24', longer)

  // host sozinho no lobby sai e volta: continua host (#32)
  s = run(s, { type: 'leave', playerId: 'H' }).state
  assert(s.players.length === 0, 'lobby deveria esvaziar', s)
  s = join(s, 'H', a).state
  assert(hosts(s) === 'H', 'host sozinho deveria voltar como host', s)

  // host cai no meio da partida e volta: um host só (#0)
  s = join(s, 'P', b).state
  s = join(s, 'Q', c, true).state
  s = run(s, { type: 'start', playerId: 'H' }).state
  s = run(s, { type: 'leave', playerId: 'H' }).state
  assert(hosts(s) === 'P', 'host deveria passar para P', s)
  assert(run(s, { type: 'next', playerId: 'H' }).events[0]?.type === 'rejected', 'desconectado não deveria agir', s)
  s = join(s, 'H', a).state
  assert(hosts(s) === 'P', 'P continua host quando H volta', s)
  s = run(s, { type: 'leave', playerId: 'P' }).state
  assert(hosts(s) === 'H', 'host volta para H', s)
  s = join(s, 'P', b).state
  assert(hosts(s) === 'H', 'P volta sem ser host', s)

  // visão nunca leva seed/voiceBag/banned
  const v0 = viewFor(s, 'P')
  assert(v0.seed === 0 && v0.voiceBag.stop.length === 0 && v0.banned.length === 0, 'viewFor vazou campos do servidor', s)

  // rodada: respostas iguais, STOP, corrida, tolerância
  now += TIMINGS.drawMs
  s = tick(s, now).state
  assert(s.phase === 'answering', 'deveria estar respondendo', s)
  const L = s.round!.letter
  const [cat0, cat1] = s.settings.categoryIds
  for (const cat of s.settings.categoryIds) s = run(s, { type: 'answer', roundId: s.round!.id, playerId: 'H', categoryId: cat, value: `${L}${cat}` }).state
  s = run(s, { type: 'answer', roundId: s.round!.id, playerId: 'H', categoryId: cat0, value: `${L}iblah` }).state
  s = run(s, { type: 'answer', roundId: s.round!.id, playerId: 'P', categoryId: cat0, value: ` ${L.toLowerCase()}íblah! ` }).state
  s = run(s, { type: 'answer', roundId: s.round!.id, playerId: 'Q', categoryId: cat0, value: `${L}outro` }).state
  assert(Object.keys(viewFor(s, 'P').round!.answers).join() === 'P', 'answering vazou respostas', s)
  s = run(s, { type: 'stop', roundId: s.round!.id, playerId: 'H' }).state
  assert(s.phase === 'stopped', 'STOP deveria parar', s)
  const race = run(s, { type: 'stop', roundId: s.round!.id, playerId: 'P' })
  assert(race.state === s && race.events.length === 0, 'STOP perdido deveria ser silencioso (#7)', s)
  assert(Object.keys(viewFor(s, 'P').round!.answers).join() === 'P', 'stopped vazou respostas', s)
  now += TIMINGS.answerGraceMs - 200
  s = run(s, { type: 'answer', roundId: s.round!.id, playerId: 'P', categoryId: cat1, value: `${L}tarde` }).state
  assert(s.round!.answers.P[cat1] === `${L}tarde`, 'resposta na tolerância deveria valer (#6)', s)
  now += 400
  s = run(s, { type: 'answer', roundId: s.round!.id, playerId: 'P', categoryId: cat1, value: `${L}tardissimo` }).state
  assert(s.round!.answers.P[cat1] === `${L}tarde`, 'resposta depois da tolerância não vale', s)

  // validação: voto se espalha para respostas iguais (#5) e saída destrava a etapa (#4)
  now += TIMINGS.stoppedMs
  s = tick(s, now).state
  assert(s.phase === 'validating' && s.round!.voters[cat0].length === 3, 'snapshot de eleitores', s)
  s = run(s, { type: 'vote', roundId: s.round!.id, playerId: 'Q', categoryId: cat0, targetId: 'H', valid: false }).state
  assert(s.round!.votes[cat0].P?.Q === false, 'voto deveria valer para a resposta igual de P', s)
  s = run(s, { type: 'ready', roundId: s.round!.id, categoryId: s.settings.categoryIds[s.round!.validationIndex], playerId: 'H' }).state
  s = run(s, { type: 'ready', roundId: s.round!.id, categoryId: s.settings.categoryIds[s.round!.validationIndex], playerId: 'Q' }).state
  s = run(s, { type: 'leave', playerId: 'P' }).state
  assert(s.round!.validationIndex === 1, 'saída do último não-pronto deveria avançar (#4)', s)
  assert(!s.round!.voters[cat1].includes('P'), 'P não vota na etapa seguinte', s)

  // volta com outro personagem (#37)
  assert(join(s, 'P', c).events[0]?.type === 'rejected', 'personagem de Q está ocupado', s)
  const back = join(s, 'P', d)
  s = back.state
  assert(back.events.some((e) => e.type === 'playerReconnected'), 'sem playerReconnected', s)
  assert(get(s, 'P').memberId === d.id && get(s, 'P').ready, 'reconexão deveria trocar personagem e entrar pronto', s)

  for (let i = 0; i < 200 && s.phase === 'validating'; i++) {
    now += 1000
    s = tick(s, now).state
  }
  assert(s.phase === 'roundResults', 'deveria chegar no placar', s)
  const cells = s.history[0].cells
  assert(cells.H[cat0].status === 'invalid' && cells.P[cat0].status === 'invalid', 'grupo igual deveria cair junto', s)
  assert(cells.Q[cat0].status === 'valid', 'resposta única sem voto contra vale', s)
  checkSharedVerdicts(s)

  // kick: banido, avisado e sem poder agir (#33)
  const kicked = run(s, { type: 'kick', playerId: 'H', targetId: 'P' })
  s = kicked.state
  assert(kicked.events[0]?.type === 'kicked' && s.banned.includes('P'), 'kick deveria banir e avisar', s)
  assert(run(s, { type: 'next', playerId: 'P' }).events[0]?.type === 'rejected', 'expulso não age', s)
  const rejoin = join(s, 'P', d).events[0]
  assert(rejoin?.type === 'rejected' && rejoin.reason === 'Você foi removido desta sala', 'expulso não volta', s)
  s = run(s, { type: 'kick', playerId: 'H', targetId: 'Q' }).state
  assert(!s.players.some((p) => p.id === 'Q') && !s.banned.includes('Q'), 'bot removido sem ban', s)

  // empate divide a posição, desempate por ordem de entrada (#8)
  const t = structuredClone(s)
  t.players = ['A', 'B', 'C', 'D'].map((id, i) => ({ ...get(s, 'H'), id, isHost: i === 0, score: [10, 20, 20, 5][i] }))
  const placed = placements(t).map((x) => `${x.player.id}${x.place}`).join()
  assert(placed === 'B1,C1,A3,D4', `placements errado: ${placed}`, t)
}

scenarios()

// ---------- partidas completas com bots ----------

for (let g = 0; g < games; g++) {
  let now = 1_700_000_000_000 + g * 1e7
  const rounds = 1 + (g % 4)
  const host = TEAM[g % TEAM.length]
  let state = createRoom({
    host: { playerId: 'host', memberId: host.id, name: host.shortName },
    settings: { rounds, answerSeconds: 30 + (g % 3) * 30, validateSeconds: 10 },
    seed: 1000 + g,
  })
  const brain = new BotBrain()
  const botCount = 2 + (g % 8)
  for (const m of TEAM.filter((t) => t.id !== host.id).slice(0, botCount)) {
    state = applyIntent(state, { type: 'join', playerId: `bot-${m.id}`, memberId: m.id, name: m.shortName, isBot: true }, now).state
  }
  // o host humano também é tratado como bot nesta simulação
  state.players[0].isBot = true
  state = applyIntent(state, { type: 'start', playerId: 'host' }, now).state
  assert(state.phase === 'drawing', 'start deveria ir para drawing', state)

  const seen: GameEvent[] = []
  let steps = 0
  while (state.phase !== 'podium') {
    now += 250
    const t = tick(state, now)
    state = t.state
    seen.push(...t.events)
    for (const intent of brain.update(state, now)) {
      const r = applyIntent(state, intent, now)
      state = r.state
      seen.push(...r.events)
    }
    checkInvariants(state)
    // jogador sai no meio da partida 1 a cada 7 jogos
    if (g % 7 === 3 && state.roundIndex === 1 && state.phase === 'validating' && state.players.some((p) => p.id === 'host' && p.connected)) {
      state = applyIntent(state, { type: 'leave', playerId: 'host' }, now).state
      assert(state.players.some((p) => p.isHost && p.connected) || state.players.every((p) => p.isBot), 'host deveria passar adiante', state)
    }
    assert(++steps < 200_000, 'partida não terminou', state)
  }

  const scored = seen.filter((e) => e.type === 'roundScored')
  assert(scored.length === rounds, `esperava ${rounds} placares, veio ${scored.length}`, state)
  assert(state.history.length === rounds, 'histórico incompleto', state)
  for (const p of state.players) {
    const sum = state.history.reduce((acc, h) => acc + (h.points[p.id] ?? 0), 0)
    assert(sum === p.score, `pontuação de ${p.name} não bate (${sum} != ${p.score})`, state)
  }
  for (const h of state.history) {
    for (const [pid, cells] of Object.entries(h.cells)) {
      for (const cell of Object.values(cells)) {
        assert([0, 5, 10].includes(cell.points), `ponto inválido ${cell.points}`, state)
        if (cell.status === 'repeated') assert(cell.points === 5, 'repetida deveria valer 5', state)
      }
      assert(Object.keys(cells).length === state.settings.categoryIds.length, `células faltando para ${pid}`, state)
    }
  }
  checkSharedVerdicts(state)
  const over = seen.find((e) => e.type === 'gameOver')
  assert(over, 'sem gameOver', state)
  if (over?.type === 'gameOver') checkGameOver(state, over)
  stats.stops += seen.filter((e) => e.type === 'stopCalled').length
  stats.timeouts += seen.filter((e) => e.type === 'timeUp').length
  stats.rounds += rounds
  stats.events += seen.length
}

console.log(`${games} partidas, ${stats.rounds} rodadas: ${stats.stops} STOPs, ${stats.timeouts} tempos esgotados, ${stats.events} eventos`)
if (failures) process.exit(1)
console.log('✓ motor ok')
