import { TEAM_BY_ID, avatarUrl } from '../data/team'

interface Props {
  memberId: string
  size?: number
  ring?: 'none' | 'me' | 'stop' | 'ready' | 'dim'
  className?: string
  title?: string
  /** avatar "pula" pra fora do círculo (cabeça sobressai) */
  pop?: boolean
}

export function Avatar({ memberId, size = 64, ring = 'none', className = '', title, pop = false }: Props) {
  const member = TEAM_BY_ID[memberId]
  const src = avatarUrl(memberId, size > 140 ? 512 : 256)
  return (
    <div
      className={`avatar avatar--ring-${ring} ${pop ? 'avatar--pop' : ''} ${className}`}
      style={{
        width: size,
        height: size,
        ['--avatar-color' as string]: member?.color ?? '#FF4200',
        ['--avatar-inner-radius' as string]: `${Math.max(0, size / 2 - 3)}px`,
        ['--avatar-base-bleed' as string]: `${size * 0.06}px`,
      }}
      title={title ?? member?.name}
    >
      <div className="avatar__disc" />
      <img className="avatar__img" src={src} alt={member?.name ?? ''} draggable={false} loading="lazy" />
    </div>
  )
}
