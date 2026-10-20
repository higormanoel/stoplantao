import type { GameEvent, Intent, RoomSettings, RoomState } from '../game/types'

export interface Identity {
  playerId: string
  memberId: string
  name: string
  /** segredo da vaga (vem no 'welcome'). Sem ele o servidor não devolve a cadeira na reconexão. */
  sessionToken?: string
}

export type ConnectionStatus = 'connecting' | 'open' | 'reconnecting' | 'closed'

export interface TransportListener {
  /** snapshot (já filtrado para este jogador) + diferença de relógio servidor-cliente */
  onState(state: RoomState, serverOffsetMs: number): void
  onEvents(events: GameEvent[]): void
  onError(message: string): void
  onConnection?(status: ConnectionStatus): void
  /** offset de relógio refinado pelo pong (menor RTT) */
  onClock?(offsetMs: number): void
  /** criar/entrar falhou de vez: o cliente tem que sair da tela da sala */
  onFatal?(message: string): void
}

/**
 * Tudo que a UI precisa da rede. Duas implementações:
 * - LocalTransport: roda o motor no navegador com bots (funciona sem backend)
 * - SocketTransport: fala com o servidor via WebSocket (backend do Codex)
 */
export interface GameTransport {
  readonly kind: 'local' | 'socket'
  createRoom(me: Identity, settings: Partial<RoomSettings>, botCount: number): void
  joinRoom(me: Identity, code: string): void
  send(intent: Intent): void
  /** só no local: adiciona/remove bots no lobby */
  addBot?(): void
  dispose(): void
}
