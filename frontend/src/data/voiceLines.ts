import type { FelipePose } from './team'

// Falas do Dr. Felipe — voz clonada no Higgsfield (elemento "Voz-Dr.-Felipe-"), em tom debochado.
// Seed Audio 1.0 na maioria; Qwen Audio 3.0 (direção de emoção) em nostop-proximo, nostop-dormiu e nostop-sucesso.
// O texto aparece no balão de legenda; o áudio está em /public/assets/voice.

export type VoicePool = 'stop' | 'nostop'

export interface VoiceLine {
  id: string
  pool: VoicePool
  text: string
  file: string
  pose: FelipePose
}

export const VOICE_LINES: VoiceLine[] = [
  // Quando alguém aperta STOP
  { id: 'stop-plantao', pool: 'stop', text: 'Ah, tá… dar Stop aqui é fácil, né? Quero ver dar Stop no plantão!', file: 'stop-plantao', pose: 'point' },
  { id: 'stop-ia', pool: 'stop', text: 'Tá de IA, hein? Eu tô vendo, viu… Kkkkk', file: 'stop-ia', pose: 'laugh' },
  { id: 'stop-japa', pool: 'stop', text: 'Uhhh! Stopzinho pericial… pra comer um japa, né?!', file: 'stop-japa', pose: 'point' },
  { id: 'stop-pericia', pool: 'stop', text: 'Hmm… vai dar Perícia, hein!', file: 'stop-pericia', pose: 'stop' },
  { id: 'stop-convenio', pool: 'stop', text: 'Hmm… esse aí deve ser médico de convênio. Certeza!', file: 'stop-convenio', pose: 'point' },
  { id: 'stop-fernandao', pool: 'stop', text: 'Fernandão… desliga a internet dele!', file: 'stop-fernandao', pose: 'stop' },
  // Quando o tempo acaba e ninguém deu STOP
  { id: 'nostop-proximo', pool: 'nostop', text: 'Hahaha! Não foi dessa vez, hein… Desista, porque o próximo Stop será o meu!', file: 'nostop-proximo', pose: 'laugh' },
  { id: 'nostop-dormiu', pool: 'nostop', text: 'Ihhh, dormiu no ponto, hein!', file: 'nostop-dormiu', pose: 'watch' },
  { id: 'nostop-cade', pool: 'nostop', text: 'Cadê? Ninguém?', file: 'nostop-cade', pose: 'watch' },
  { id: 'nostop-sucesso', pool: 'nostop', text: 'Sucesso ama execução, viu? Bora executar, né!', file: 'nostop-sucesso', pose: 'point' },
  { id: 'nostop-ia', pool: 'nostop', text: 'Ahhh, nem usando IA deu certo? Hahaha', file: 'nostop-ia', pose: 'laugh' },
]

export const VOICE_BY_ID: Record<string, VoiceLine> = Object.fromEntries(VOICE_LINES.map((l) => [l.id, l]))

export const voiceUrl = (line: VoiceLine) => `/assets/voice/${line.file}.m4a`
