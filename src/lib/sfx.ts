/**
 * Game SFX.
 * Dice rolls use real recorded WAVs (CC0 from SFXMint — plastic/wood table dice).
 */

let ctx: AudioContext | null = null;
let diceBuffers: AudioBuffer[] = [];
let diceLoading: Promise<AudioBuffer[]> | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

const DICE_URLS = ["/sounds/dice-roll.wav", "/sounds/dice-roll-b.wav"];

async function loadDiceBuffers(): Promise<AudioBuffer[]> {
  const c = audio();
  if (!c) return [];
  if (diceBuffers.length) return diceBuffers;
  if (diceLoading) return diceLoading;
  diceLoading = (async () => {
    const loaded: AudioBuffer[] = [];
    await Promise.all(
      DICE_URLS.map(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const raw = await res.arrayBuffer();
          loaded.push(await c.decodeAudioData(raw.slice(0)));
        } catch {
          /* skip broken alternate */
        }
      }),
    );
    diceBuffers = loaded;
    return loaded;
  })().finally(() => {
    diceLoading = null;
  });
  return diceLoading;
}

/** Warm samples on first interaction so the next roll is instant. */
export function prefetchSfx() {
  void loadDiceBuffers();
}

function noiseBuffer(c: AudioContext, seconds: number) {
  const n = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(
  c: AudioContext,
  {
    duration,
    gain = 0.2,
    type = "bandpass",
    freq = 800,
    q = 1,
    when = 0,
  }: {
    duration: number;
    gain?: number;
    type?: BiquadFilterType;
    freq?: number;
    q?: number;
    when?: number;
  },
) {
  const t0 = c.currentTime + when;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(c, Math.max(duration, 0.05));
  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
  src.stop(t0 + duration + 0.02);
}

function tone(
  c: AudioContext,
  {
    freq,
    duration,
    type = "sine",
    gain = 0.12,
    when = 0,
    slideTo,
  }: {
    freq: number;
    duration: number;
    type?: OscillatorType;
    gain?: number;
    when?: number;
    slideTo?: number;
  },
) {
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + duration);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}

/** Real recorded dice tumble (random variant + slight pitch variety). */
export function playDiceRoll() {
  const c = audio();
  if (!c) return;
  void (async () => {
    const buffers = await loadDiceBuffers();
    if (!buffers.length) return;
    const buf = buffers[Math.floor(Math.random() * buffers.length)]!;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = 0.97 + Math.random() * 0.06;
    const g = c.createGain();
    g.gain.value = 1;
    // Gentle high shelf so plastic clicks stay clear without harshness
    const filter = c.createBiquadFilter();
    filter.type = "highshelf";
    filter.frequency.value = 3500;
    filter.gain.value = -2.5;
    src.connect(filter);
    filter.connect(g);
    g.connect(c.destination);
    src.start(0);
  })();
}

/** Soft step when a pawn advances one square. */
export function playMoveStep() {
  const c = audio();
  if (!c) return;
  tone(c, { freq: 520, duration: 0.06, type: "triangle", gain: 0.07 });
  tone(c, { freq: 780, duration: 0.05, type: "sine", gain: 0.035, when: 0.02 });
}

/** Rumbling eruption when a hidden volcano detonates. */
export function playVolcanoBurst() {
  const c = audio();
  if (!c) return;
  tone(c, { freq: 60, duration: 0.55, type: "sawtooth", gain: 0.12, slideTo: 35 });
  tone(c, { freq: 90, duration: 0.45, type: "square", gain: 0.04, slideTo: 40, when: 0.05 });
  playNoise(c, { duration: 0.5, gain: 0.28, type: "lowpass", freq: 420, q: 0.7, when: 0.08 });
  playNoise(c, { duration: 0.35, gain: 0.16, type: "bandpass", freq: 900, q: 0.8, when: 0.12 });
  for (let i = 0; i < 5; i++) {
    playNoise(c, {
      duration: 0.08,
      gain: 0.08,
      type: "highpass",
      freq: 2000 + i * 400,
      q: 2,
      when: 0.2 + i * 0.07,
    });
  }
  tone(c, { freq: 400, duration: 0.28, type: "sine", gain: 0.08, slideTo: 140, when: 0.55 });
}
