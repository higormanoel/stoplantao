// Time iFH: cada colaborador vira um personagem jogável.
// Avatares gerados por IA (Higgsfield, GPT Image 2.5) a partir das fotos em /reference/team.

export interface TeamMember {
  id: string
  name: string
  shortName: string
  role: string
  /** cor do círculo do avatar */
  color: string
  /** 0..1 — quão bem o bot conhece as palavras */
  skill: number
  /** multiplicador de velocidade do bot (maior = mais rápido) */
  speed: number
}

export const TEAM: TeamMember[] = [
  { id: 'felipe', name: 'Dr. Felipe Hurtado', shortName: 'Dr. Felipe', role: 'CEO e Expert', color: '#FF4200', skill: 0.92, speed: 1.25 },
  { id: 'higor', name: 'Higor Manoel', shortName: 'Higor', role: 'Designer', color: '#5B8CFF', skill: 0.85, speed: 1.05 },
  { id: 'jonathan', name: 'Jonathan Dantas', shortName: 'Jonathan', role: 'Time iFH', color: '#2EC4B6', skill: 0.82, speed: 1.0 },
  { id: 'luiza', name: 'Luíza Garoni', shortName: 'Luíza', role: 'Time iFH', color: '#B26BFF', skill: 0.84, speed: 1.05 },
  { id: 'julia', name: 'Julia Toledo', shortName: 'Julia', role: 'Social Media', color: '#FF5E9C', skill: 0.8, speed: 1.1 },
  { id: 'eduardo', name: 'Eduardo Alves', shortName: 'Eduardo', role: 'Videomaker 🎬', color: '#FFB21E', skill: 0.78, speed: 0.95 },
  { id: 'marcus', name: 'Marcus Araujo', shortName: 'Marcus', role: 'Analista de Operações', color: '#3DDC84', skill: 0.83, speed: 0.95 },
  { id: 'pedro', name: 'Pedro Henrique Dias Oriente', shortName: 'Pedro', role: 'Designer Gráfico', color: '#00B3D7', skill: 0.79, speed: 1.0 },
  { id: 'fernando-santiago', name: 'Fernando Santiago', shortName: 'Fernandão', role: 'Líder de Operações', color: '#47C9A2', skill: 0.88, speed: 1.1 },
  { id: 'fernando-castilho', name: 'Fernando Castilho', shortName: 'Castilho', role: 'Time iFH', color: '#FF8A3D', skill: 0.84, speed: 1.0 },
  { id: 'gabriel', name: 'Gabriel Oliveira', shortName: 'Gabriel', role: 'Customer Success', color: '#8E7CFF', skill: 0.8, speed: 0.9 },
  { id: 'joao-pedro', name: 'João Pedro', shortName: 'João Pedro', role: 'Time iFH', color: '#F25F5C', skill: 0.78, speed: 1.0 },
  { id: 'leandro', name: 'Leandro', shortName: 'Leandro', role: 'Analista Financeiro', color: '#4CC9F0', skill: 0.82, speed: 0.9 },
  { id: 'vinny', name: 'Vinny Reis', shortName: 'Vinny', role: 'Copywriter', color: '#FFD93D', skill: 0.9, speed: 1.05 },
  { id: 'wellington', name: 'Wellington Barbosa', shortName: 'Wellington', role: 'Closer', color: '#FF6F61', skill: 0.83, speed: 1.15 },
  { id: 'tatiane', name: 'Tatiane De Abreu Bachini', shortName: 'Tatiane', role: 'SDR | BDR', color: '#F7A072', skill: 0.81, speed: 1.1 },
]

export const TEAM_BY_ID: Record<string, TeamMember> = Object.fromEntries(TEAM.map((m) => [m.id, m]))

export const avatarUrl = (memberId: string, size: 256 | 512 = 512) => `/assets/avatars/${memberId}-${size}.webp`

/** Poses extras do Dr. Felipe para o narrador */
export type FelipePose = 'default' | 'laugh' | 'point' | 'stop' | 'watch'
export const felipePoseUrl = (pose: FelipePose) =>
  pose === 'default' ? avatarUrl('felipe') : `/assets/avatars/felipe-${pose}-512.webp`
