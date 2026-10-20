interface Props {
  letter: string | null
  size?: number
  spinning?: boolean
  className?: string
}

/** A letra da rodada vive dentro de uma placa de PARE (octógono). */
export function StopSign({ letter, size = 96, spinning = false, className = '' }: Props) {
  return (
    <div className={`stopsign ${spinning ? 'stopsign--spinning' : ''} ${className}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="stopsign__svg" aria-hidden>
        <polygon points="30,3 70,3 97,30 97,70 70,97 30,97 3,70 3,30" className="stopsign__outer" />
        <polygon points="32,10 68,10 90,32 90,68 68,90 32,90 10,68 10,32" className="stopsign__inner" />
      </svg>
      <span className="stopsign__letter" style={{ fontSize: size * 0.56 }}>
        {letter ?? '?'}
      </span>
    </div>
  )
}
