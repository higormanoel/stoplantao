// Regras puras (sem DOM). Reutilizáveis no backend.

export const TIMINGS = {
  drawMs: 3400,
  stoppedMs: 6200,
  resultsMs: 11000,
  /** validação de categoria sem respostas votáveis passa rápido */
  emptyStepMs: 1600,
  /** respostas que chegam até este tempo depois do STOP ainda valem (debounce + rede) */
  answerGraceMs: 1200,
}

export const POINTS = { unique: 10, repeated: 5, invalid: 0 }

export const LIMITS = {
  answerMaxLength: 40,
  nameMaxLength: 24,
  minRounds: 1,
  maxRounds: 10,
  minCategories: 4,
  maxCategories: 12,
}

/** minúsculas, sem acento, sem pontuação, espaços colapsados */
export function normalize(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function startsWithLetter(value: string, letter: string): boolean {
  const n = normalize(value)
  return n.length > 0 && n[0] === letter.toLowerCase()
}

/** resposta que entra na votação: preenchida e começando com a letra */
export function isVotable(value: string | undefined, letter: string): boolean {
  return !!value && value.trim().length > 0 && startsWithLetter(value, letter)
}

// RNG determinístico (mulberry32) — o estado vive em RoomState.seed
export function nextRandom(seed: number): [number, number] {
  let t = (seed + 0x6d2b79f5) | 0
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296
  return [value, (seed + 0x6d2b79f5) | 0]
}

export function shuffle<T>(items: T[], seed: number): [T[], number] {
  const out = items.slice()
  let s = seed
  for (let i = out.length - 1; i > 0; i--) {
    const [r, ns] = nextRandom(s)
    s = ns
    const j = Math.floor(r * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return [out, s]
}

export function makeRoomCode(seed: number): [string, number] {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let s = seed
  let code = ''
  for (let i = 0; i < 5; i++) {
    const [r, ns] = nextRandom(s)
    s = ns
    code += alphabet[Math.floor(r * alphabet.length)]
  }
  return [code, s]
}
