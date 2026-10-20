// Tipos do jogo. Este arquivo é o CONTRATO entre front e backend:
// o backend deve manter estas formas (ver docs/BACKEND_CONTRACT.md).

export type Phase =
  | 'lobby' // sala aberta, esperando o host começar
  | 'drawing' // sorteio da letra (animação)
  | 'answering' // preenchendo categorias
  | 'stopped' // alguém deu STOP ou o tempo acabou (overlay + voz do Dr. Felipe)
  | 'validating' // votação "vale ou não vale", uma categoria por vez
  | 'roundResults' // placar da rodada
  | 'podium' // fim de jogo

export interface RoomSettings {
  rounds: number
  categoryIds: string[]
  answerSeconds: number
  /** tempo por categoria na validação */
  validateSeconds: number
  maxPlayers: number
}

export interface Player {
  id: string
  /** id do personagem do time (data/team.ts) */
  memberId: string
  name: string
  isBot: boolean
  isHost: boolean
  connected: boolean
  score: number
  /** quantas categorias preenchidas na rodada atual (progresso público) */
  filled: number
  /** terminou a etapa atual de validação */
  ready: boolean
}

export type CellStatus = 'valid' | 'repeated' | 'invalid' | 'empty'

export interface CellResult {
  value: string
  status: CellStatus
  points: number
}

export interface RoundSummary {
  index: number
  letter: string
  stopBy: string | null
  endedBy: 'stop' | 'timeout'
  /** playerId -> pontos na rodada */
  points: Record<string, number>
  /** playerId -> categoryId -> resultado */
  cells: Record<string, Record<string, CellResult>>
}

export interface RoundState {
  /** identidade monotônica da rodada dentro da sala, preservada entre partidas */
  id: number
  index: number
  letter: string
  startedAt: number | null
  stopBy: string | null
  endedBy: 'stop' | 'timeout' | null
  /** epoch ms em que a fase 'answering' acabou (janela de tolerância para respostas em trânsito) */
  stoppedAt: number | null
  /** playerId -> categoryId -> resposta. Durante 'answering' e 'stopped' o servidor só envia as respostas do próprio jogador. */
  answers: Record<string, Record<string, string>>
  /** votes[categoryId][targetPlayerId][voterId] = válido? (ausente = válido) */
  votes: Record<string, Record<string, Record<string, boolean>>>
  /** índice da categoria em validação (settings.categoryIds) */
  validationIndex: number
  /** categoryId -> quem pode votar (jogadores conectados quando a etapa começou) */
  voters: Record<string, string[]>
}

export interface RoomState {
  code: string
  settings: RoomSettings
  players: Player[]
  phase: Phase
  /** epoch ms em que a fase atual termina (null = sem limite) */
  phaseEndsAt: number | null
  /** quantas rodadas já começaram (1-based na UI) */
  roundIndex: number
  /** contador de rodadas iniciadas; nunca volta a zero ao reiniciar a partida */
  roundSerial: number
  usedLetters: string[]
  round: RoundState | null
  history: RoundSummary[]
  /** id da fala do Dr. Felipe tocada no último 'stopped' */
  lastVoiceLineId: string | null
  /** sacolas embaralhadas de falas — evita repetir em sequência (só no servidor: viewFor esvazia) */
  voiceBag: { stop: string[]; nostop: string[] }
  /** estado do RNG determinístico (só no servidor: viewFor zera) */
  seed: number
  /** playerIds removidos pelo host: não podem voltar (só no servidor: viewFor esvazia) */
  banned: string[]
}

// Intents: o que o cliente pede. O servidor valida e aplica.
export type Intent =
  | { type: 'join'; playerId: string; memberId: string; name: string; isBot?: boolean }
  | { type: 'leave'; playerId: string }
  | { type: 'kick'; playerId: string; targetId: string }
  | { type: 'updateSettings'; playerId: string; settings: Partial<RoomSettings> }
  | { type: 'start'; playerId: string }
  | { type: 'answer'; playerId: string; roundId: number; categoryId: string; value: string }
  | { type: 'stop'; playerId: string; roundId: number }
  | { type: 'vote'; playerId: string; roundId: number; categoryId: string; targetId: string; valid: boolean }
  | { type: 'ready'; playerId: string; roundId: number; categoryId: string }
  | { type: 'next'; playerId: string }
  | { type: 'restart'; playerId: string }

// Eventos: o que aconteceu. Disparam som, voz e animações no cliente.
export type GameEvent =
  | { type: 'playerJoined'; playerId: string }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'playerReconnected'; playerId: string }
  /** o host removeu o jogador (vem antes do playerLeft dele) */
  | { type: 'kicked'; playerId: string }
  | { type: 'drawing'; roundIndex: number; letter: string }
  | { type: 'roundStarted'; letter: string }
  | { type: 'stopCalled'; playerId: string; voiceLineId: string }
  | { type: 'timeUp'; voiceLineId: string }
  | { type: 'validationStep'; categoryId: string; index: number }
  | { type: 'roundScored'; summary: RoundSummary }
  /** ranking: ids em ordem; places: id -> colocação (empate divide a posição: 1, 1, 3) */
  | { type: 'gameOver'; ranking: string[]; places: Record<string, number> }
  | { type: 'backToLobby' }
  | { type: 'rejected'; playerId: string; reason: string }

export interface EngineResult {
  state: RoomState
  events: GameEvent[]
}
