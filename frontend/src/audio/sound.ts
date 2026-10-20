import { VOICE_BY_ID, VOICE_LINES, voiceUrl } from '../data/voiceLines'
import { playSynth, type SfxName } from './synth'

const STORAGE_KEY = 'stoplantao:audio'

// voz um pouco acima dos efeitos (mesma proporção do HTMLAudio antigo)
const VOICE_BOOST = 1.15

// intervalo mínimo (ms) entre dois disparos do mesmo som; o resto não tem limite
const MIN_GAP: Partial<Record<SfxName, number>> = { coin: 70, type: 25, hover: 45, tick: 120 }
// teto global de disparos numa janela curta; os sons "baratos" caem primeiro
const WINDOW_MS = 100
const WINDOW_CAP = 12
const CHEAP_CAP = 8
const CHEAP = new Set<SfxName>(['coin', 'type', 'hover'])

interface AudioPrefs {
  sfx: boolean
  voice: boolean
  volume: number
}

function loadPrefs(): AudioPrefs {
  try {
    return { sfx: true, voice: true, volume: 0.8, ...JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') }
  } catch {
    return { sfx: true, voice: true, volume: 0.8 }
  }
}

type Listener = () => void

class SoundManager {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private voiceGain: GainNode | null = null
  private buffers = new Map<string, AudioBuffer>()
  private voiceSrc: AudioBufferSourceNode | null = null
  private voices = new Map<string, HTMLAudioElement>()
  private current: HTMLAudioElement | null = null
  private lastAt = new Map<SfxName, number>()
  private recent: number[] = []
  private listeners = new Set<Listener>()
  prefs: AudioPrefs = loadPrefs()

  /** chamar num gesto do usuário (clique) para liberar áudio no navegador */
  unlock() {
    if (!this.ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      this.ctx = new Ctor()
      const comp = this.ctx.createDynamicsCompressor()
      comp.threshold.value = -14
      comp.ratio.value = 4
      this.master = this.ctx.createGain()
      this.master.gain.value = this.prefs.volume
      this.master.connect(comp).connect(this.ctx.destination)
      this.voiceGain = this.ctx.createGain()
      this.voiceGain.gain.value = VOICE_BOOST
      this.voiceGain.connect(this.master)
      this.preloadVoices()
      void this.decodeVoices(this.ctx)
    }
    this.wake()
  }

  /** iOS suspende/interrompe o contexto ao sair da aba; retoma sem estourar erro */
  private wake() {
    const ctx = this.ctx
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') void ctx.resume().catch(() => {})
  }

  /** fallback HTMLAudio: no iOS cada elemento precisa de um play() dentro do toque */
  private preloadVoices() {
    for (const line of VOICE_LINES) {
      const el = new Audio(voiceUrl(line))
      el.preload = 'auto'
      el.muted = true
      el.play()
        .then(() => {
          if (this.current === el) return
          el.pause()
          el.currentTime = 0
        })
        .catch(() => {})
        .finally(() => {
          el.muted = false
        })
      this.voices.set(line.id, el)
    }
  }

  /** decodifica as falas no próprio AudioContext (já liberado), que toca sem gesto no iOS */
  private async decodeVoices(ctx: AudioContext) {
    await Promise.all(
      VOICE_LINES.map(async (line) => {
        try {
          const res = await fetch(voiceUrl(line))
          if (!res.ok) return
          const data = await res.arrayBuffer()
          // forma com callbacks: Safari antigo não devolve Promise
          const buf = await new Promise<AudioBuffer>((ok, fail) => {
            void ctx.decodeAudioData(data, ok, fail)?.catch(fail)
          })
          this.buffers.set(line.id, buf)
        } catch {
          /* fica no HTMLAudio */
        }
      }),
    )
  }

  play(name: SfxName, opts?: { pitch?: number; intensity?: number }) {
    if (!this.prefs.sfx || !this.ctx || !this.master) return
    // anti-spam: contagem de pontos e digitação disparam dezenas de sons por segundo
    const now = performance.now()
    const gap = MIN_GAP[name]
    if (gap && now - (this.lastAt.get(name) ?? -Infinity) < gap) return
    while (this.recent.length && now - this.recent[0] > WINDOW_MS) this.recent.shift()
    if (this.recent.length >= (CHEAP.has(name) ? CHEAP_CAP : WINDOW_CAP)) return
    this.lastAt.set(name, now)
    this.recent.push(now)
    this.wake()
    try {
      playSynth(this.ctx, this.master, name, opts)
    } catch {
      /* áudio nunca pode derrubar o jogo */
    }
  }

  private stopVoice() {
    if (this.voiceSrc) {
      try {
        this.voiceSrc.stop()
      } catch {
        /* já tinha parado */
      }
      this.voiceSrc = null
    }
    if (this.current) {
      this.current.pause()
      this.current.currentTime = 0
    }
  }

  /** toca a fala do Dr. Felipe. Devolve a duração (ms) estimada. */
  speak(lineId: string): number {
    const line = VOICE_BY_ID[lineId]
    if (!line) return 0
    this.stopVoice()
    const buf = this.buffers.get(lineId)
    if (buf && this.ctx && this.voiceGain) {
      const ms = buf.duration * 1000
      if (!this.prefs.voice) return ms
      try {
        this.wake()
        const src = this.ctx.createBufferSource()
        src.buffer = buf
        src.connect(this.voiceGain)
        src.onended = () => {
          if (this.voiceSrc === src) this.voiceSrc = null
        }
        src.start()
        this.voiceSrc = src
        this.current = null
        return ms
      } catch {
        /* cai no HTMLAudio */
      }
    }
    const el = this.voices.get(lineId) ?? new Audio(voiceUrl(line))
    this.current = el
    const ms = Number.isFinite(el.duration) && el.duration > 0 ? el.duration * 1000 : 3800
    if (!this.prefs.voice) return ms
    el.muted = false
    el.volume = Math.min(1, this.prefs.volume * VOICE_BOOST)
    el.currentTime = 0
    void el.play().catch(() => {})
    return ms
  }

  setPrefs(patch: Partial<AudioPrefs>) {
    this.prefs = { ...this.prefs, ...patch }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.prefs))
    if (this.master) this.master.gain.value = this.prefs.volume
    if (this.current) this.current.volume = Math.min(1, this.prefs.volume * VOICE_BOOST)
    if (!this.prefs.voice) this.stopVoice()
    this.listeners.forEach((l) => l())
  }

  subscribe(l: Listener) {
    this.listeners.add(l)
    return () => {
      this.listeners.delete(l)
    }
  }
}

export const sound = new SoundManager()
