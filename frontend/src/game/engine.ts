// Motor do jogo: funções puras (estado -> novo estado + eventos).
// Roda no navegador (modo local com bots) e foi escrito para ser portado
// tal como está para o servidor Node (modo online). Sem DOM, sem Date.now, sem Math.random.

import { CATEGORY_BY_ID, LETTERS } from '../data/categories'
import { TEAM_BY_ID } from '../data/team'
import { VOICE_LINES } from '../data/voiceLines'
import type { EngineResult, GameEvent, Intent, Player, RoomSettings, RoomState, RoundSummary, CellResult } from './types'
import { LIMITS, POINTS, TIMINGS, isVotable, makeRoomCode, nextRandom, normalize, shuffle } from './rules'

export const DEFAULT_SETTINGS: RoomSettings = {
  rounds: 5,
  categoryIds: ['nome', 'animal', 'cep', 'fruta', 'objeto', 'marca', 'corpo', 'doenca', 'remedio', 'plantao'],
  answerSeconds: 90,
  validateSeconds: 20,
  maxPlayers: 16,
}

const clone = <T>(v: T): T => structuredClone(v)

export function createRoom(opts: {
  host: { playerId: string; memberId: string; name: string }
  settings?: Partial<RoomSettings>
  seed: number
  code?: string
}): RoomState {
  let seed = opts.seed
  let code = opts.code
  if (!code) [code, seed] = makeRoomCode(seed)
  const host: Player = {
    id: opts.host.playerId,
    memberId: opts.host.memberId,
    name: opts.host.name,
    isBot: false,
    isHost: true,
    connected: true,
    score: 0,
    filled: 0,
    ready: false,
  }
  const state: RoomState = {
    code,
    settings: sanitizeSettings({ ...DEFAULT_SETTINGS, ...opts.settings }),
    players: [host],
    phase: 'lobby',
    phaseEndsAt: null,
    roundIndex: 0,
    roundSerial: 0,
    usedLetters: [],
    round: null,
    history: [],
    lastVoiceLineId: null,
    voiceBag: { stop: [], nostop: [] },
    seed,
    banned: [],
  }
  return state
}

/** número vindo do cliente: inválido (NaN, texto) cai no padrão; depois arredonda e limita */
function clampNum(v: unknown, fallback: number, min: number, max: number): number {
  const n = typeof v === 'number' || (typeof v === 'string' && v.trim()) ? Number(v) : NaN
  return Math.min(max, Math.max(min, Math.round(Number.isFinite(n) ? n : fallback)))
}

export function sanitizeSettings(s: Partial<RoomSettings>): RoomSettings {
  const raw: unknown[] = Array.isArray(s.categoryIds) ? s.categoryIds : []
  const known = raw.filter((id): id is string => typeof id === 'string' && Object.hasOwn(CATEGORY_BY_ID, id))
  const ids = Array.from(new Set(known)).slice(0, LIMITS.maxCategories)
  const d = DEFAULT_SETTINGS
  return {
    rounds: clampNum(s.rounds, d.rounds, LIMITS.minRounds, LIMITS.maxRounds),
    categoryIds: ids.length >= LIMITS.minCategories ? ids : d.categoryIds.slice(),
    answerSeconds: clampNum(s.answerSeconds, d.answerSeconds, 30, 300),
    validateSeconds: clampNum(s.validateSeconds, d.validateSeconds, 8, 60),
    maxPlayers: clampNum(s.maxPlayers, d.maxPlayers, 2, 16),
  }
}

// ---------- helpers ----------

function rand(state: RoomState): number {
  const [r, s] = nextRandom(state.seed)
  state.seed = s
  return r
}

function findPlayer(state: RoomState, id: string) {
  return state.players.find((p) => p.id === id)
}

function isHost(state: RoomState, id: string) {
  return !!findPlayer(state, id)?.isHost
}

function activePlayers(state: RoomState) {
  return state.players.filter((p) => p.connected)
}

/** invariante: no máximo um host. Passa a coroa para `id` (null = ninguém) */
function setHost(state: RoomState, id: string | null) {
  for (const p of state.players) p.isHost = p.id === id
}

/** quem entra (ou volta) vira host se não houver outro host conectado */
function claimHost(state: RoomState, joiner: Player) {
  const other = state.players.find((p) => p.isHost && p.connected && p.id !== joiner.id)
  if (other) setHost(state, other.id)
  else if (!joiner.isBot) setHost(state, joiner.id)
}

/** todos os conectados já marcaram pronto na etapa de validação */
function allReady(state: RoomState) {
  const active = activePlayers(state)
  return active.length > 0 && active.every((p) => p.ready)
}

/** id que não colide com chaves do Object.prototype (__proto__, constructor...) */
function isSafeId(id: unknown): id is string {
  return typeof id === 'string' && id.length > 0 && id.length <= 64 && !(id in Object.prototype)
}

function pickLetter(state: RoomState): string {
  let pool = LETTERS.filter((l) => !state.usedLetters.includes(l))
  if (pool.length === 0) {
    state.usedLetters = []
    pool = LETTERS.slice()
  }
  const letter = pool[Math.floor(rand(state) * pool.length)]
  state.usedLetters.push(letter)
  return letter
}

function pickVoiceLine(state: RoomState, pool: 'stop' | 'nostop'): string {
  if (state.voiceBag[pool].length === 0) {
    const ids = VOICE_LINES.filter((l) => l.pool === pool).map((l) => l.id)
    let [bag, seed] = shuffle(ids, state.seed)
    state.seed = seed
    // evita repetir a última fala logo no começo da nova sacola
    if (bag.length > 1 && bag[0] === state.lastVoiceLineId) bag = [...bag.slice(1), bag[0]]
    state.voiceBag[pool] = bag
  }
  const id = state.voiceBag[pool].shift()!
  state.lastVoiceLineId = id
  return id
}

export function canStop(state: RoomState, playerId: string): boolean {
  if (state.phase !== 'answering' || !state.round) return false
  const mine = state.round.answers[playerId] ?? {}
  return state.settings.categoryIds.every((c) => isVotable(mine[c], state.round!.letter))
}

function countFilled(state: RoomState, playerId: string): number {
  const mine = state.round?.answers[playerId] ?? {}
  return state.settings.categoryIds.filter((c) => (mine[c] ?? '').trim().length > 0).length
}

function startDrawing(state: RoomState, now: number, events: GameEvent[]) {
  const letter = pickLetter(state)
  state.roundIndex += 1
  state.phase = 'drawing'
  state.phaseEndsAt = now + TIMINGS.drawMs
  state.round = {
    id: ++state.roundSerial,
    index: state.roundIndex,
    letter,
    startedAt: null,
    stopBy: null,
    endedBy: null,
    answers: Object.fromEntries(state.players.map((p) => [p.id, {}])),
    votes: {},
    validationIndex: 0,
    stoppedAt: null,
    voters: {},
  }
  for (const p of state.players) {
    p.filled = 0
    p.ready = false
  }
  events.push({ type: 'drawing', roundIndex: state.roundIndex, letter })
}

function endAnswering(state: RoomState, now: number, events: GameEvent[], stopBy: string | null) {
  const round = state.round!
  state.phase = 'stopped'
  state.phaseEndsAt = now + TIMINGS.stoppedMs
  round.stoppedAt = now
  round.stopBy = stopBy
  round.endedBy = stopBy ? 'stop' : 'timeout'
  if (stopBy) {
    events.push({ type: 'stopCalled', playerId: stopBy, voiceLineId: pickVoiceLine(state, 'stop') })
  } else {
    events.push({ type: 'timeUp', voiceLineId: pickVoiceLine(state, 'nostop') })
  }
}

function stepHasVotables(state: RoomState, index: number): boolean {
  const round = state.round!
  const cat = state.settings.categoryIds[index]
  return state.players.some((p) => isVotable(round.answers[p.id]?.[cat], round.letter))
}

function startValidationStep(state: RoomState, index: number, now: number, events: GameEvent[]) {
  const round = state.round!
  round.validationIndex = index
  state.phase = 'validating'
  // snapshot de eleitores: quem entra depois não conta; votos dados antes de cair permanecem
  round.voters[state.settings.categoryIds[index]] = activePlayers(state).map((p) => p.id)
  for (const p of state.players) p.ready = false
  const hasVotables = stepHasVotables(state, index)
  state.phaseEndsAt = now + (hasVotables ? state.settings.validateSeconds * 1000 : TIMINGS.emptyStepMs)
  events.push({ type: 'validationStep', categoryId: state.settings.categoryIds[index], index })
}

export function scoreRound(state: RoomState): RoundSummary {
  const round = state.round!
  const cells: Record<string, Record<string, CellResult>> = {}
  const points: Record<string, number> = {}
  for (const p of state.players) {
    cells[p.id] = {}
    points[p.id] = 0
  }
  for (const cat of state.settings.categoryIds) {
    const eligible = round.voters[cat] ?? activePlayers(state).map((p) => p.id)
    // respostas iguais (normalizadas) formam um grupo com um veredito só
    const groups = new Map<string, string[]>()
    for (const p of state.players) {
      const value = (round.answers[p.id]?.[cat] ?? '').trim()
      if (!value) {
        cells[p.id][cat] = { value: '', status: 'empty', points: 0 }
        continue
      }
      cells[p.id][cat] = { value, status: 'invalid', points: POINTS.invalid }
      if (!isVotable(value, round.letter)) continue
      const key = normalize(value)
      groups.set(key, [...(groups.get(key) ?? []), p.id])
    }
    for (const ids of groups.values()) {
      const voters = eligible.filter((v) => !ids.includes(v))
      const invalid = voters.filter((v) => ids.some((id) => round.votes[cat]?.[id]?.[v] === false)).length
      if (invalid > voters.length - invalid) continue
      const status = ids.length > 1 ? 'repeated' : 'valid'
      const pts = ids.length > 1 ? POINTS.repeated : POINTS.unique
      for (const id of ids) cells[id][cat] = { ...cells[id][cat], status, points: pts }
    }
    for (const p of state.players) points[p.id] += cells[p.id][cat].points
  }
  return {
    index: round.index,
    letter: round.letter,
    stopBy: round.stopBy,
    endedBy: round.endedBy ?? 'timeout',
    points,
    cells,
  }
}

function finishRound(state: RoomState, now: number, events: GameEvent[]) {
  const summary = scoreRound(state)
  for (const p of state.players) p.score += summary.points[p.id] ?? 0
  state.history.push(summary)
  state.phase = 'roundResults'
  state.phaseEndsAt = now + TIMINGS.resultsMs
  events.push({ type: 'roundScored', summary })
}

/** colocação com empate (1, 1, 3): place = 1 + quantos têm pontuação maior. Desempate da ordem: quem entrou antes */
export function placements(state: RoomState): { player: Player; place: number }[] {
  return state.players
    .map((player, i) => ({ player, i }))
    .sort((a, b) => b.player.score - a.player.score || a.i - b.i)
    .map(({ player }) => ({ player, place: 1 + state.players.filter((q) => q.score > player.score).length }))
}

export function ranking(state: RoomState): Player[] {
  return placements(state).map((x) => x.player)
}

function afterResults(state: RoomState, now: number, events: GameEvent[]) {
  if (state.roundIndex >= state.settings.rounds) {
    state.phase = 'podium'
    state.phaseEndsAt = null
    const placed = placements(state)
    events.push({
      type: 'gameOver',
      ranking: placed.map((x) => x.player.id),
      places: Object.fromEntries(placed.map((x) => [x.player.id, x.place])),
    })
  } else {
    startDrawing(state, now, events)
  }
}

// ---------- API ----------

export function applyIntent(prev: RoomState, intent: Intent, now: number): EngineResult {
  // o servidor aplica JSON do cliente: nada aqui pode lançar exceção
  const pid = typeof intent?.playerId === 'string' ? intent.playerId : ''
  const reject = (reason: string): EngineResult => ({ state: prev, events: [{ type: 'rejected', playerId: pid, reason }] })
  const ignore: EngineResult = { state: prev, events: [] }
  if (!intent || typeof intent !== 'object' || !pid) return reject('Intent inválido')
  if (intent.type !== 'join') {
    // removido ou desconectado não age mais na sala (sair de novo é só no-op)
    const sender = findPlayer(prev, pid)
    if (!sender || !sender.connected) return intent.type === 'leave' ? ignore : reject('Você não está nesta sala')
  }
  if (intent.type === 'answer' || intent.type === 'stop' || intent.type === 'vote' || intent.type === 'ready') {
    if (!prev.round || intent.roundId !== prev.round.id) return ignore
    if (intent.type === 'ready' && intent.categoryId !== prev.settings.categoryIds[prev.round.validationIndex]) return ignore
  }
  const state = clone(prev)
  const events: GameEvent[] = []

  switch (intent.type) {
    case 'join': {
      if (!isSafeId(pid)) return reject('Intent inválido')
      const member = typeof intent.memberId === 'string' && Object.hasOwn(TEAM_BY_ID, intent.memberId) ? TEAM_BY_ID[intent.memberId] : null
      if (!member) return reject('Personagem inválido')
      const name = (typeof intent.name === 'string' ? intent.name.trim().slice(0, LIMITS.nameMaxLength).trim() : '') || member.shortName
      if (state.banned.includes(pid)) return reject('Você foi removido desta sala')
      const taken = state.players.some((p) => p.id !== pid && p.memberId === member.id)
      const existing = findPlayer(state, pid)
      if (existing) {
        // reconexão: pode ter trocado de personagem enquanto estava fora
        if (existing.memberId !== member.id) {
          if (taken) return reject('Esse personagem já está na sala')
          existing.memberId = member.id
        }
        existing.name = name
        existing.connected = true
        if (state.phase === 'validating' && state.round) {
          const cat = state.settings.categoryIds[state.round.validationIndex]
          if (!(state.round.voters[cat] ?? []).includes(pid)) existing.ready = true
        }
        claimHost(state, existing)
        events.push({ type: 'playerReconnected', playerId: pid })
        return { state, events }
      }
      if (state.players.length >= state.settings.maxPlayers) return reject('Sala cheia')
      if (taken) return reject('Esse personagem já está na sala')
      const joiner: Player = {
        id: pid,
        memberId: member.id,
        name,
        isBot: intent.isBot === true,
        isHost: false,
        connected: true,
        score: 0,
        filled: 0,
        // quem entra no meio da validação não trava a etapa atual
        ready: state.phase === 'validating',
      }
      state.players.push(joiner)
      claimHost(state, joiner)
      if (state.round) state.round.answers[pid] = {}
      events.push({ type: 'playerJoined', playerId: pid })
      return { state, events }
    }

    case 'leave':
    case 'kick': {
      const kick = intent.type === 'kick'
      if (kick && typeof intent.targetId !== 'string') return reject('Intent inválido')
      const targetId = kick ? intent.targetId : pid
      if (kick && !isHost(state, pid)) return reject('Só o host pode remover jogadores')
      if (kick && targetId === pid) return ignore
      const target = findPlayer(state, targetId)
      if (!target) return ignore
      const wasHost = target.isHost
      target.isHost = false
      if (state.phase === 'lobby' || target.isBot) {
        state.players = state.players.filter((p) => p.id !== targetId)
      } else {
        target.connected = false
      }
      if (kick && !target.isBot && !state.banned.includes(targetId)) state.banned.push(targetId)
      // sem outro humano conectado a sala fica sem host; quem voltar primeiro assume
      if (wasHost) setHost(state, state.players.find((p) => p.connected && !p.isBot)?.id ?? null)
      if (kick) events.push({ type: 'kicked', playerId: targetId })
      events.push({ type: 'playerLeft', playerId: targetId })
      if (state.phase === 'validating' && allReady(state)) advanceValidation(state, now, events)
      return { state, events }
    }

    case 'updateSettings': {
      const s = intent.settings
      if (typeof s !== 'object' || s === null || Array.isArray(s)) return reject('Intent inválido')
      if (!isHost(state, pid)) return reject('Só o host muda as regras')
      if (state.phase !== 'lobby') return reject('Regras só mudam no lobby')
      state.settings = sanitizeSettings({ ...state.settings, ...s })
      return { state, events }
    }

    case 'start': {
      if (!isHost(state, pid)) return reject('Só o host pode começar')
      if (state.phase !== 'lobby') return reject('O jogo já começou')
      if (activePlayers(state).length < 2) return reject('Precisa de pelo menos 2 jogadores')
      state.history = []
      state.roundIndex = 0
      for (const p of state.players) p.score = 0
      startDrawing(state, now, events)
      return { state, events }
    }

    case 'answer': {
      if (typeof intent.categoryId !== 'string' || typeof intent.value !== 'string') return reject('Intent inválido')
      if (!state.settings.categoryIds.includes(intent.categoryId)) return reject('Intent inválido')
      const round = state.round
      if (!round) return ignore
      // janela de tolerância: o que estava em trânsito quando alguém deu STOP ainda vale
      const inGrace = state.phase === 'stopped' && round.stoppedAt !== null && now - round.stoppedAt <= TIMINGS.answerGraceMs
      if (state.phase !== 'answering' && !inGrace) return ignore
      const me = findPlayer(state, pid)!
      const value = intent.value.slice(0, LIMITS.answerMaxLength)
      round.answers[pid] = { ...(round.answers[pid] ?? {}), [intent.categoryId]: value }
      me.filled = countFilled(state, pid)
      return { state, events }
    }

    case 'stop': {
      // perdeu a corrida do STOP (outro já parou): ignora em silêncio
      if (state.phase !== 'answering' || !state.round) return ignore
      if (!canStop(state, pid)) return reject('Preencha todas as categorias com a letra sorteada')
      endAnswering(state, now, events, pid)
      return { state, events }
    }

    case 'vote': {
      if (typeof intent.categoryId !== 'string' || typeof intent.targetId !== 'string' || typeof intent.valid !== 'boolean') {
        return reject('Intent inválido')
      }
      if (!state.settings.categoryIds.includes(intent.categoryId)) return reject('Intent inválido')
      const round = state.round
      if (state.phase !== 'validating' || !round) return ignore
      const cat = state.settings.categoryIds[round.validationIndex]
      if (intent.categoryId !== cat || intent.targetId === pid) return ignore
      const target = round.answers[intent.targetId]?.[cat]
      if (!isVotable(target, round.letter)) return ignore
      // o voto vale para todas as respostas iguais (normalizadas), menos a do próprio eleitor
      const key = normalize(target!)
      const byCat = (round.votes[cat] ??= {})
      for (const p of state.players) {
        const value = round.answers[p.id]?.[cat]
        if (p.id === pid || !isVotable(value, round.letter) || normalize(value!) !== key) continue
        ;(byCat[p.id] ??= {})[pid] = intent.valid
      }
      return { state, events }
    }

    case 'ready': {
      if (state.phase !== 'validating') return ignore
      const me = findPlayer(state, pid)!
      if (me.ready) return ignore
      me.ready = true
      if (allReady(state)) advanceValidation(state, now, events)
      return { state, events }
    }

    case 'next': {
      if (!isHost(state, pid)) return reject('Só o host avança')
      if (state.phase !== 'roundResults') return ignore
      afterResults(state, now, events)
      return { state, events }
    }

    case 'restart': {
      if (!isHost(state, pid)) return reject('Só o host reinicia')
      if (state.phase !== 'podium') return ignore
      state.phase = 'lobby'
      state.phaseEndsAt = null
      state.round = null
      state.roundIndex = 0
      state.history = []
      state.usedLetters = []
      state.players = state.players.filter((p) => p.connected)
      for (const p of state.players) {
        p.score = 0
        p.filled = 0
        p.ready = false
      }
      events.push({ type: 'backToLobby' })
      return { state, events }
    }

    default:
      return reject('Intent inválido')
  }
}

function advanceValidation(state: RoomState, now: number, events: GameEvent[]) {
  const round = state.round!
  const next = round.validationIndex + 1
  if (next < state.settings.categoryIds.length) startValidationStep(state, next, now, events)
  else finishRound(state, now, events)
}

/** Avança fases por tempo. Chamar periodicamente (ex.: a cada 100–250 ms). */
export function tick(prev: RoomState, now: number): EngineResult {
  if (prev.phaseEndsAt === null || now < prev.phaseEndsAt) return { state: prev, events: [] }
  const state = clone(prev)
  const events: GameEvent[] = []
  switch (state.phase) {
    case 'drawing':
      state.phase = 'answering'
      state.round!.startedAt = now
      state.phaseEndsAt = now + state.settings.answerSeconds * 1000
      events.push({ type: 'roundStarted', letter: state.round!.letter })
      break
    case 'answering':
      endAnswering(state, now, events, null)
      break
    case 'stopped':
      startValidationStep(state, 0, now, events)
      break
    case 'validating':
      advanceValidation(state, now, events)
      break
    case 'roundResults':
      afterResults(state, now, events)
      break
    default:
      return { state: prev, events: [] }
  }
  return { state, events }
}

/**
 * Visão de um jogador (o servidor deve mandar SEMPRE a visão filtrada, nunca o estado cru):
 * - sempre zera os campos só do servidor (seed, voiceBag, banned): com o seed dá para prever as letras;
 * - durante 'answering' e 'stopped' (janela de tolerância) esconde as respostas dos outros.
 * round.letter continua indo no 'drawing' (a roleta precisa dela).
 */
export function viewFor(state: RoomState, playerId: string): RoomState {
  const view: RoomState = { ...state, seed: 0, voiceBag: { stop: [], nostop: [] }, banned: [] }
  if (state.round && (state.phase === 'answering' || state.phase === 'stopped')) {
    view.round = { ...state.round, answers: { [playerId]: state.round.answers[playerId] ?? {} } }
  }
  return view
}
