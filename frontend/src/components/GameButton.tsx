import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { sound } from '../audio/sound'
import type { SfxName } from '../audio/synth'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'mint'
  size?: 'sm' | 'md' | 'lg' | 'xl'
  icon?: ReactNode
  sfx?: SfxName | null
  block?: boolean
}

export function GameButton({ variant = 'primary', size = 'md', icon, sfx = 'click', block, className = '', children, onClick, onMouseEnter, ...rest }: Props) {
  return (
    <button
      type="button"
      className={`gbtn gbtn--${variant} gbtn--${size} ${block ? 'gbtn--block' : ''} ${className}`}
      onClick={(e) => {
        if (sfx) sound.play(sfx)
        onClick?.(e)
      }}
      onMouseEnter={(e) => {
        if (!rest.disabled) sound.play('hover')
        onMouseEnter?.(e)
      }}
      {...rest}
    >
      {icon && <span className="gbtn__icon">{icon}</span>}
      {children && <span className="gbtn__label">{children}</span>}
    </button>
  )
}
