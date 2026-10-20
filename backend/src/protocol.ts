import { TEAM_BY_ID } from '../../frontend/src/data/team'
import { LIMITS } from '../../frontend/src/game/rules'
import type { Intent, RoomSettings } from '../../frontend/src/game/types'

export type ErrorCode = 'ROOM_NOT_FOUND' | 'MEMBER_TAKEN' | 'ROOM_FULL' | 'BANNED' | 'BAD_INTENT'
export class ProtocolError extends Error {
  constructor(message: string, public code: ErrorCode = 'BAD_INTENT') { super(message) }
}

export interface Identity {
  playerId: string
  memberId: string
  name: string
  sessionToken?: string
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function invalid(): never { throw new ProtocolError('Mensagem inválida') }

export function identity(value: unknown): Identity {
  if (!record(value)) return invalid()
  const { playerId, memberId, name, sessionToken } = value
  if (typeof playerId !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(playerId) || playerId in Object.prototype) return invalid()
  if (typeof memberId !== 'string' || !Object.hasOwn(TEAM_BY_ID, memberId)) throw new ProtocolError('Personagem inválido')
  if (typeof name !== 'string' || (sessionToken !== undefined && (typeof sessionToken !== 'string' || sessionToken.length > 128))) return invalid()
  return {
    playerId, memberId,
    name: name.trim().slice(0, LIMITS.nameMaxLength).trim() || TEAM_BY_ID[memberId].shortName,
    ...(typeof sessionToken === 'string' ? { sessionToken } : {}),
  }
}

export function settings(value: unknown): Partial<RoomSettings> {
  if (value === undefined) return {}
  if (!record(value)) return invalid()
  const result: Partial<RoomSettings> = {}
  for (const key of ['rounds', 'answerSeconds', 'validateSeconds', 'maxPlayers'] as const) {
    if (value[key] !== undefined) {
      if (typeof value[key] !== 'number' || !Number.isFinite(value[key])) return invalid()
      result[key] = value[key]
    }
  }
  if (value.categoryIds !== undefined) {
    if (!Array.isArray(value.categoryIds) || !value.categoryIds.every((v) => typeof v === 'string')) return invalid()
    result.categoryIds = value.categoryIds
  }
  return result
}

/** Build a fresh intent; client fields never control the authenticated player. */
export function gameIntent(value: unknown, playerId: string): Intent {
  if (!record(value) || typeof value.type !== 'string') return invalid()
  const base = { playerId }
  const roundId = value.roundId
  const categoryId = value.categoryId
  switch (value.type) {
    case 'join': throw new ProtocolError('Use a entrada da sala para recuperar sua vaga')
    case 'leave': case 'start': case 'next': case 'restart': return { ...base, type: value.type }
    case 'kick':
      if (typeof value.targetId !== 'string') return invalid()
      return { ...base, type: 'kick', targetId: value.targetId }
    case 'updateSettings': return { ...base, type: 'updateSettings', settings: settings(value.settings) }
    case 'answer': case 'stop': case 'vote': case 'ready': {
      if (typeof roundId !== 'number' || !Number.isSafeInteger(roundId) || roundId < 1) return invalid()
      if (value.type === 'stop') return { ...base, type: 'stop', roundId }
      if (typeof categoryId !== 'string') return invalid()
      if (value.type === 'ready') return { ...base, type: 'ready', roundId, categoryId }
      if (value.type === 'answer') {
        if (typeof value.value !== 'string') return invalid()
        return { ...base, type: 'answer', roundId, categoryId, value: value.value }
      }
      if (typeof value.targetId !== 'string' || typeof value.valid !== 'boolean') return invalid()
      return { ...base, type: 'vote', roundId, categoryId, targetId: value.targetId, valid: value.valid }
    }
    default: return invalid()
  }
}
