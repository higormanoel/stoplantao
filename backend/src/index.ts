import { existsSync } from 'node:fs'
import { createGameServer } from './server.js'

if (existsSync('.env')) process.loadEnvFile('.env')

function integer(name: string, fallback: number, min = 1, max = Number.MAX_SAFE_INTEGER) {
  const value = process.env[name]
  if (value === undefined) return fallback
  const parsed = Number(value)
  if (!value.trim() || !Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`${name} precisa ser um inteiro entre ${min} e ${max}`)
  return parsed
}

try {
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map((origin) => origin.trim()).filter(Boolean)
  const game = createGameServer({
    host: process.env.HOST || '0.0.0.0',
    port: integer('PORT', 8787, 0, 65535),
    roomTtlMs: integer('ROOM_TTL_MS', 30 * 60_000),
    lobbyGraceMs: integer('LOBBY_GRACE_MS', 3000, 0),
    maxRooms: integer('MAX_ROOMS', 1000),
    maxConnections: integer('MAX_CONNECTIONS', 1000),
    allowedOrigins: allowedOrigins?.length ? allowedOrigins : undefined,
  })
  const address = await game.listen()
  console.info(`Stoplantão online em ${address.host}:${address.port} — WebSocket /ws, saúde /health`)
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void game.close().catch(() => { process.exitCode = 1 })
    })
  }
} catch (cause) {
  console.error(cause instanceof Error ? cause.message : 'Não foi possível iniciar o servidor')
  process.exitCode = 1
}
