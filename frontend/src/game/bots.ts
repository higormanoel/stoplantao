// Cérebro dos bots (modo local). Cada bot é um colaborador do time:
// preenche categorias com o banco de palavras, às vezes erra, dá STOP e vota.

import wordbankJson from '../data/wordbank.json'
import { TEAM_BY_ID } from '../data/team'
import type { Intent, RoomState } from './types'
import { isVotable, normalize } from './rules'

const WORDBANK = wordbankJson as Record<string, Record<string, string[]>>

const BANK_INDEX: Record<string, Set<string>> = Object.fromEntries(
  Object.entries(WORDBANK).map(([cat, byLetter]) => [cat, new Set(Object.values(byLetter).flat().map(normalize))]),
)

export function wordIsKnown(categoryId: string, value: string): boolean {
  return BANK_INDEX[categoryId]?.has(normalize(value)) ?? false
}

interface Scheduled {
  at: number
  intent: Intent
}

const rnd = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)]

/** escolhe palavra com viés para as mais comuns (início da lista) -> gera repetidas */
function pickWord(words: string[]): string {
  const top = Math.min(words.length, 3)
  return Math.random() < 0.65 ? words[Math.floor(Math.random() * top)] : pick(words)
}

function wrongAnswer(categoryId: string, letter: string): string | null {
  // palavra de OUTRA categoria com a mesma letra -> deve ser votada como inválida
  const others = Object.keys(WORDBANK).filter((c) => c !== categoryId)
  for (let i = 0; i < 6; i++) {
    const words = WORDBANK[pick(others)]?.[letter] ?? []
    const w = words.length ? pick(words) : null
    if (w && !wordIsKnown(categoryId, w)) return w
  }
  return null
}

export class BotBrain {
  private queue: Scheduled[] = []
  private plannedKey = ''

  /** retorna intents vencidos para aplicar agora */
  update(state: RoomState, now: number): Intent[] {
    const key = this.keyFor(state)
    if (key !== this.plannedKey) {
      this.plannedKey = key
      this.queue = this.plan(state, now)
    }
    const due = this.queue.filter((s) => s.at <= now)
    if (due.length) this.queue = this.queue.filter((s) => s.at > now)
    return due.sort((a, b) => a.at - b.at).map((s) => s.intent)
  }

  reset() {
    this.queue = []
    this.plannedKey = ''
  }

  private keyFor(state: RoomState) {
    return `${state.code}:${state.phase}:${state.round?.id ?? 0}:${state.round?.validationIndex ?? 0}`
  }

  private bots(state: RoomState) {
    return state.players.filter((p) => p.isBot && p.connected)
  }

  private plan(state: RoomState, now: number): Scheduled[] {
    switch (state.phase) {
      case 'answering':
        return this.planAnswering(state, now)
      case 'validating':
        return this.planValidation(state, now)
      default:
        return []
    }
  }

  private planAnswering(state: RoomState, now: number): Scheduled[] {
    const round = state.round!
    const letter = round.letter
    const total = state.settings.answerSeconds * 1000
    const out: Scheduled[] = []
    for (const bot of this.bots(state)) {
      const member = TEAM_BY_ID[bot.memberId]
      const skill = member?.skill ?? 0.8
      const speed = member?.speed ?? 1
      let lastAt = now
      let complete = true
      const times = state.settings.categoryIds.map(() => now + (2500 + Math.random() * total * 0.6) / speed).sort((a, b) => a - b)
      state.settings.categoryIds.forEach((cat, i) => {
        const words = WORDBANK[cat]?.[letter] ?? []
        let value: string | null = null
        if (words.length && Math.random() < skill) value = pickWord(words)
        else if (Math.random() < 0.22) value = wrongAnswer(cat, letter)
        if (!value) {
          complete = false
          return
        }
        lastAt = times[i]
        out.push({ at: times[i], intent: { type: 'answer', roundId: round.id, playerId: bot.id, categoryId: cat, value } })
      })
      if (complete) {
        const stopAt = Math.max(lastAt + rnd(1200, 5000) / speed, now + 15000)
        if (stopAt < now + total - 1500) out.push({ at: stopAt, intent: { type: 'stop', roundId: round.id, playerId: bot.id } })
      }
    }
    return out
  }

  private planValidation(state: RoomState, now: number): Scheduled[] {
    const round = state.round!
    const cat = state.settings.categoryIds[round.validationIndex]
    const stepMs = (state.phaseEndsAt ?? now + 15000) - now
    const out: Scheduled[] = []
    for (const bot of this.bots(state)) {
      const voteAt = now + rnd(900, Math.max(1200, Math.min(3500, stepMs * 0.3)))
      for (const target of state.players) {
        if (target.id === bot.id) continue
        const value = round.answers[target.id]?.[cat]
        if (!isVotable(value, round.letter)) continue
        const known = wordIsKnown(cat, value!)
        // palavra do banco: quase sempre vale. Desconhecida de humano: benefício da dúvida. De bot: é o "erro" plantado.
        const pValid = known ? 0.97 : target.isBot ? 0.12 : 0.72
        const valid = Math.random() < pValid
        if (!valid) out.push({ at: voteAt + rnd(0, 800), intent: { type: 'vote', roundId: round.id, playerId: bot.id, categoryId: cat, targetId: target.id, valid } })
      }
      out.push({ at: voteAt + rnd(600, 1600), intent: { type: 'ready', roundId: round.id, categoryId: cat, playerId: bot.id } })
    }
    return out
  }
}
