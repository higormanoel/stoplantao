import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { sound } from '../audio/sound'
import { useGame } from '../store/gameStore'
import { IconMic, IconMicOff, IconMute, IconVolume, IconX } from './Icons'

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts" aria-live="polite">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.key}
            className={`toast toast--${t.tone}`}
            initial={{ y: -30, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: -20, opacity: 0 }}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}

function useAudioPrefs() {
  return useSyncExternalStore(
    (cb) => sound.subscribe(cb),
    () => sound.prefs,
  )
}

export function SoundToggles() {
  const prefs = useAudioPrefs()
  return (
    <div className="soundtoggles">
      <button
        type="button"
        className={`iconbtn ${prefs.sfx ? '' : 'iconbtn--off'}`}
        onClick={() => {
          sound.setPrefs({ sfx: !prefs.sfx })
          if (!prefs.sfx) sound.play('click')
        }}
        aria-label={prefs.sfx ? 'Desligar efeitos sonoros' : 'Ligar efeitos sonoros'}
        title="Efeitos sonoros"
      >
        {prefs.sfx ? <IconVolume /> : <IconMute />}
      </button>
      <button
        type="button"
        className={`iconbtn ${prefs.voice ? '' : 'iconbtn--off'}`}
        onClick={() => sound.setPrefs({ voice: !prefs.voice })}
        aria-label={prefs.voice ? 'Silenciar a voz do Dr. Felipe' : 'Ligar a voz do Dr. Felipe'}
        title="Voz do Dr. Felipe"
      >
        {prefs.voice ? <IconMic /> : <IconMicOff />}
      </button>
    </div>
  )
}

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
/** modais abertos ao mesmo tempo: o fundo só volta a ser interativo quando fecha o último */
let openModals = 0

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  const cardRef = useRef<HTMLDivElement>(null)
  // onClose costuma ser uma arrow nova a cada render: guarda numa ref para o efeito não reiniciar (e roubar o foco)
  const closeRef = useRef(onClose)
  useEffect(() => {
    closeRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const card = cardRef.current
    const active = document.activeElement
    // quem abriu o modal (um autoFocus dentro do card já roubou o foco: aí não há o que devolver)
    const prev = active instanceof HTMLElement && !card?.contains(active) ? active : null
    const app = document.querySelector<HTMLElement>('#root .app')
    openModals++
    app?.setAttribute('inert', '')
    const focusables = () => Array.from(card?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
    // foco entra no modal: o primeiro controle do corpo (o campo, no "Entrar com código")
    if (card && !card.contains(document.activeElement)) {
      const first = card.querySelector<HTMLElement>(`.modal__body :is(${FOCUSABLE})`) ?? focusables()[0] ?? card
      first.focus()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return closeRef.current()
      if (e.key !== 'Tab' || !card) return
      // prende o Tab dentro do card
      const els = focusables()
      if (!els.length) {
        e.preventDefault()
        card.focus()
        return
      }
      const first = els[0]
      const last = els[els.length - 1]
      const inside = card.contains(document.activeElement)
      if (e.shiftKey && (!inside || document.activeElement === first)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && (!inside || document.activeElement === last)) {
        e.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      openModals = Math.max(0, openModals - 1)
      if (!openModals) app?.removeAttribute('inert')
      // devolve o foco para quem abriu (se ainda estiver na tela)
      if (prev?.isConnected) prev.focus()
    }
  }, [open])

  // portal no body: o .app inteiro fica inert enquanto o modal está aberto
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div className="modal" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
          <motion.div
            ref={cardRef}
            tabIndex={-1}
            className={`modal__card ${wide ? 'modal__card--wide' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 26 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <header className="modal__head">
              <h2>{title}</h2>
              <button
                type="button"
                className="iconbtn iconbtn--plain"
                onClick={() => {
                  sound.play('back')
                  onClose()
                }}
                aria-label="Fechar"
              >
                <IconX />
              </button>
            </header>
            <div className="modal__body">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

const FLOATERS = 'ABCDEFGHIJLMNOPQRSTUVZ'.split('')

/** Fundo animado: letras e losangos do iFH flutuando, linha de ECG no rodapé. */
export function Background() {
  const items = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        i,
        kind: i % 3 === 0 ? 'diamond' : 'letter',
        letter: FLOATERS[(i * 7) % FLOATERS.length],
        left: (i * 37) % 100,
        top: (i * 53) % 100,
        size: 26 + ((i * 17) % 50),
        dur: 18 + ((i * 11) % 22),
        delay: -((i * 13) % 20),
        rot: (i * 29) % 360,
      })),
    [],
  )
  const [reduced] = useState(() => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  return (
    <div className="bg" aria-hidden>
      <div className="bg__glow" />
      {!reduced &&
        items.map((it) =>
          it.kind === 'diamond' ? (
            <svg
              key={it.i}
              className="bg__float bg__float--diamond"
              viewBox="0 0 40 40"
              style={{ left: `${it.left}%`, top: `${it.top}%`, width: it.size, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s`, rotate: `${it.rot}deg` }}
            >
              <path d="M10 2 L18 10 L10 18 L2 10 Z M30 2 L38 10 L30 18 L22 10 Z M10 22 L18 30 L10 38 L2 30 Z M30 22 L38 30 L30 38 L22 30 Z" />
            </svg>
          ) : (
            <span
              key={it.i}
              className="bg__float bg__float--letter"
              style={{ left: `${it.left}%`, top: `${it.top}%`, fontSize: it.size, animationDuration: `${it.dur}s`, animationDelay: `${it.delay}s`, rotate: `${it.rot / 8 - 20}deg` }}
            >
              {it.letter}
            </span>
          ),
        )}
      <svg className="bg__ecg" viewBox="0 0 1200 80" preserveAspectRatio="none">
        <path d="M0 40 H300 l14 -26 l16 52 l14 -36 l10 10 H700 l14 -26 l16 52 l14 -36 l10 10 H1200" />
      </svg>
    </div>
  )
}
