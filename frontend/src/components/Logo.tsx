interface Props {
  size?: 'xl' | 'lg' | 'md' | 'sm'
  /** mostra "by iFH" embaixo */
  byline?: boolean
  animated?: boolean
}

/** Wordmark STOPLANTÃO — Montserrat Black (fonte do iFH), linha de ECG cortando a palavra. */
export function Logo({ size = 'lg', byline = true, animated = true }: Props) {
  return (
    <div className={`logo logo--${size} ${animated ? 'logo--animated' : ''}`} role="img" aria-label="Stoplantão, por iFH">
      <svg className="logo__svg" viewBox="0 -22 780 192" aria-hidden>
        <defs>
          <linearGradient id="logo-orange" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#FF6A2B" />
            <stop offset="1" stopColor="#FF3D00" />
          </linearGradient>
        </defs>
        {/* extrusão 3D */}
        <g className="logo__shadow" transform="translate(0 9)">
          <text x="390" y="122" textAnchor="middle" textLength="750" lengthAdjust="spacingAndGlyphs" className="logo__text logo__text--shadow">
            STOPLANTÃO
          </text>
        </g>
        <text x="390" y="122" textAnchor="middle" textLength="750" lengthAdjust="spacingAndGlyphs" className="logo__text logo__text--stroke">
          STOPLANTÃO
        </text>
        <text x="390" y="122" textAnchor="middle" textLength="750" lengthAdjust="spacingAndGlyphs" className="logo__text">
          <tspan fill="url(#logo-orange)">STOP</tspan>
          <tspan fill="#FFFFFF">LANTÃO</tspan>
        </text>
        {/* linha de ECG */}
        <path
          className="logo__ecg"
          d="M10 4 H268 l12 -22 l15 44 l12 -28 l8 6 H770"
          fill="none"
          stroke="#FFFFFF"
          strokeWidth="7"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle className="logo__ecg-dot" cx="770" cy="4" r="8" fill="#FF4200" stroke="#FFFFFF" strokeWidth="4" />
      </svg>
      {byline && (
        <div className="logo__byline">
          <span>o stop do time</span>
          <img src="/assets/brand/logo-ifh.webp" alt="iFH" />
        </div>
      )}
    </div>
  )
}
