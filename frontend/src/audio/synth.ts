// Efeitos sonoros sintetizados na hora com Web Audio — sem arquivos, sem latência.
// Tema: game show + plantão (bipe de monitor, sirene, linha reta).

export type SfxName =
  | 'click'
  | 'hover'
  | 'pop'
  | 'select'
  | 'back'
  | 'whoosh'
  | 'spinTick'
  | 'letterReveal'
  | 'go'
  | 'type'
  | 'fieldOk'
  | 'error'
  | 'monitorBeep'
  | 'flatline'
  | 'siren'
  | 'stopSlam'
  | 'voteValid'
  | 'voteInvalid'
  | 'coin'
  | 'drumroll'
  | 'fanfare'
  | 'tick'
  | 'swipe'
  | 'join'
  | 'leave'

type Ctx = AudioContext

function env(gain: GainNode, t: number, attack: number, peak: number, decay: number) {
  gain.gain.cancelScheduledValues(t)
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), t + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay)
}

function tone(
  ctx: Ctx,
  out: AudioNode,
  o: { type?: OscillatorType; freq: number; to?: number; at?: number; dur: number; vol?: number; attack?: number; glide?: number },
) {
  const t = ctx.currentTime + (o.at ?? 0)
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + (o.glide ?? o.dur))
  env(g, t, o.attack ?? 0.005, o.vol ?? 0.3, o.dur)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + (o.attack ?? 0.005) + o.dur + 0.05)
}

let noiseBuffer: AudioBuffer | null = null
function noise(ctx: Ctx) {
  if (!noiseBuffer) {
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate)
    const d = noiseBuffer.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  }
  return noiseBuffer
}

function noiseBurst(
  ctx: Ctx,
  out: AudioNode,
  o: { at?: number; dur: number; vol?: number; filter?: BiquadFilterType; freq?: number; to?: number; q?: number; attack?: number },
) {
  const t = ctx.currentTime + (o.at ?? 0)
  const src = ctx.createBufferSource()
  src.buffer = noise(ctx)
  const f = ctx.createBiquadFilter()
  f.type = o.filter ?? 'bandpass'
  f.frequency.setValueAtTime(o.freq ?? 1000, t)
  if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + o.dur)
  f.Q.value = o.q ?? 1
  const g = ctx.createGain()
  env(g, t, o.attack ?? 0.003, o.vol ?? 0.3, o.dur)
  src.connect(f).connect(g).connect(out)
  src.start(t, Math.random())
  src.stop(t + (o.attack ?? 0.003) + o.dur + 0.05)
}

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12)

export function playSynth(ctx: Ctx, out: AudioNode, name: SfxName, opts: { pitch?: number; intensity?: number } = {}) {
  const p = opts.pitch ?? 1
  switch (name) {
    case 'click':
      tone(ctx, out, { freq: 720 * p, to: 360 * p, dur: 0.07, vol: 0.28, type: 'triangle' })
      noiseBurst(ctx, out, { dur: 0.02, vol: 0.08, freq: 4000 })
      break
    case 'hover':
      tone(ctx, out, { freq: 1500 * p, dur: 0.03, vol: 0.05, type: 'sine' })
      break
    case 'pop':
    case 'join':
      tone(ctx, out, { freq: 260 * p, to: 920 * p, dur: 0.12, vol: 0.32, glide: 0.08 })
      tone(ctx, out, { freq: 1240 * p, at: 0.06, dur: 0.12, vol: 0.12 })
      break
    case 'leave':
      tone(ctx, out, { freq: 700, to: 220, dur: 0.18, vol: 0.2, type: 'triangle' })
      break
    case 'select':
      ;[84, 88, 91, 96].forEach((n, i) => tone(ctx, out, { freq: NOTE(n), at: i * 0.055, dur: 0.22, vol: 0.18, type: 'triangle' }))
      noiseBurst(ctx, out, { at: 0.18, dur: 0.25, vol: 0.06, filter: 'highpass', freq: 6000 })
      break
    case 'back':
      tone(ctx, out, { freq: 620, to: 310, dur: 0.12, vol: 0.2, type: 'triangle' })
      break
    case 'whoosh':
      noiseBurst(ctx, out, { dur: 0.38, vol: 0.22, freq: 300, to: 3200, q: 0.8, attack: 0.12 })
      break
    case 'swipe':
      noiseBurst(ctx, out, { dur: 0.16, vol: 0.14, freq: 1800, to: 5200, q: 1.2, attack: 0.03 })
      break
    case 'spinTick':
      tone(ctx, out, { freq: 1900 * p, dur: 0.03, vol: 0.22, type: 'triangle' })
      tone(ctx, out, { freq: 950 * p, dur: 0.04, vol: 0.12, type: 'square' })
      break
    case 'letterReveal':
      tone(ctx, out, { freq: 160, to: 45, dur: 0.45, vol: 0.55, type: 'sine', glide: 0.3 })
      noiseBurst(ctx, out, { dur: 0.18, vol: 0.25, filter: 'lowpass', freq: 2200 })
      ;[NOTE(84), NOTE(88), NOTE(91)].forEach((f) => tone(ctx, out, { freq: f, at: 0.04, dur: 0.9, vol: 0.12, type: 'sine' }))
      noiseBurst(ctx, out, { at: 0.05, dur: 0.9, vol: 0.05, filter: 'highpass', freq: 7000 })
      break
    case 'go':
      ;[72, 76, 79, 84].forEach((n, i) => tone(ctx, out, { freq: NOTE(n), at: i * 0.07, dur: 0.18, vol: 0.14, type: 'square' }))
      tone(ctx, out, { freq: NOTE(84), at: 0.28, dur: 0.5, vol: 0.12, type: 'sawtooth' })
      break
    case 'type':
      noiseBurst(ctx, out, { dur: 0.018, vol: 0.06, freq: 2600 * (0.8 + Math.random() * 0.5), q: 3 })
      break
    case 'fieldOk':
      tone(ctx, out, { freq: NOTE(88), dur: 0.12, vol: 0.12 })
      tone(ctx, out, { freq: NOTE(95), at: 0.06, dur: 0.2, vol: 0.1 })
      break
    case 'error':
      tone(ctx, out, { freq: 150, dur: 0.18, vol: 0.18, type: 'square' })
      tone(ctx, out, { freq: 142, at: 0.02, dur: 0.18, vol: 0.12, type: 'sawtooth' })
      break
    case 'monitorBeep': {
      const urgency = opts.intensity ?? 0
      tone(ctx, out, { freq: 980 + urgency * 220, dur: 0.09, vol: 0.2 + urgency * 0.1, type: 'sine', attack: 0.004 })
      break
    }
    case 'flatline':
      tone(ctx, out, { freq: 980, dur: 1.8, vol: 0.2, type: 'sine', attack: 0.01 })
      break
    case 'siren': {
      const t = ctx.currentTime
      const osc = ctx.createOscillator()
      const lp = ctx.createBiquadFilter()
      const g = ctx.createGain()
      osc.type = 'sawtooth'
      lp.type = 'lowpass'
      lp.frequency.value = 2400
      for (let i = 0; i < 4; i++) {
        osc.frequency.setValueAtTime(i % 2 ? 740 : 960, t + i * 0.32)
      }
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(0.16, t + 0.03)
      g.gain.setValueAtTime(0.16, t + 1.15)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.32)
      osc.connect(lp).connect(g).connect(out)
      osc.start(t)
      osc.stop(t + 1.4)
      break
    }
    case 'stopSlam':
      tone(ctx, out, { freq: 220, to: 38, dur: 0.6, vol: 0.7, type: 'sine', glide: 0.4 })
      tone(ctx, out, { freq: 110, to: 30, dur: 0.5, vol: 0.4, type: 'triangle' })
      noiseBurst(ctx, out, { dur: 0.3, vol: 0.45, filter: 'lowpass', freq: 3000, to: 300 })
      noiseBurst(ctx, out, { at: 0.02, dur: 0.12, vol: 0.25, filter: 'highpass', freq: 3000 })
      break
    case 'voteValid':
      tone(ctx, out, { freq: NOTE(79), dur: 0.08, vol: 0.16, type: 'triangle' })
      tone(ctx, out, { freq: NOTE(86), at: 0.06, dur: 0.14, vol: 0.16, type: 'triangle' })
      break
    case 'voteInvalid':
      tone(ctx, out, { freq: 320, to: 160, dur: 0.18, vol: 0.16, type: 'square' })
      break
    case 'coin':
      tone(ctx, out, { freq: NOTE(83) * p, dur: 0.06, vol: 0.12, type: 'square' })
      tone(ctx, out, { freq: NOTE(88) * p, at: 0.05, dur: 0.16, vol: 0.12, type: 'square' })
      break
    case 'drumroll': {
      const n = 34
      for (let i = 0; i < n; i++) {
        noiseBurst(ctx, out, { at: i * 0.05, dur: 0.05, vol: 0.05 + (i / n) * 0.2, filter: 'bandpass', freq: 380, q: 0.9 })
      }
      noiseBurst(ctx, out, { at: n * 0.05, dur: 1.2, vol: 0.28, filter: 'highpass', freq: 5000 })
      tone(ctx, out, { freq: 90, to: 40, at: n * 0.05, dur: 0.5, vol: 0.5 })
      break
    }
    case 'fanfare': {
      const seq: [number, number, number][] = [
        [67, 0, 0.14],
        [72, 0.14, 0.14],
        [76, 0.28, 0.14],
        [79, 0.42, 0.3],
        [76, 0.74, 0.12],
        [79, 0.88, 0.9],
      ]
      for (const [n, at, dur] of seq) {
        tone(ctx, out, { freq: NOTE(n), at, dur, vol: 0.13, type: 'sawtooth' })
        tone(ctx, out, { freq: NOTE(n + 12), at, dur, vol: 0.05, type: 'square' })
      }
      ;[60, 64, 67, 72].forEach((n) => tone(ctx, out, { freq: NOTE(n), at: 0.88, dur: 1.2, vol: 0.07, type: 'triangle' }))
      noiseBurst(ctx, out, { at: 0.88, dur: 1.4, vol: 0.12, filter: 'highpass', freq: 6000 })
      break
    }
    case 'tick':
      tone(ctx, out, { freq: 2400, dur: 0.02, vol: 0.12, type: 'square' })
      break
  }
}
