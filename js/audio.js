// Web Audio manager: card foley with variant/pitch randomisation, positional pan,
// per-theme chimes/ambience/music with crossfades, and procedural fallbacks so the
// game still has sound if a file fails to load.
import { settings } from './store.js';

const SFX_DIR = './assets/sfx/';
const MUSIC_DIR = './assets/music/';

// Pentatonic ladder (semitones) used for the rising foundation chime.
const LADDER = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28];

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.buffers = new Map();
    this.loading = new Map();
    this.last = new Map();
    this.theme = null;
    this.ambience = null; // { src, gain }
    this.music = null;
    this.chain = 0;
    this.chainTime = 0;
  }

  // Must be called from a user gesture the first time.
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC({ latencyHint: 'interactive' });
      const c = this.ctx;
      this.master = c.createGain();
      this.comp = c.createDynamicsCompressor();
      this.comp.threshold.value = -14;
      this.comp.ratio.value = 4;
      this.sfxBus = c.createGain();
      this.musicBus = c.createGain();
      this.ambBus = c.createGain();
      this.sfxBus.connect(this.master);
      this.musicBus.connect(this.master);
      this.ambBus.connect(this.master);
      this.master.connect(this.comp).connect(c.destination);
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
    if (!this.started && this.theme) {
      this.started = true;
      this.startThemeLoops(this.theme);
    }
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = settings.muted ? 0 : settings.master;
    this.master.gain.setTargetAtTime(m, t, 0.05);
    this.sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.05);
    this.musicBus.gain.setTargetAtTime(settings.music * 0.8, t, 0.05);
    this.ambBus.gain.setTargetAtTime(settings.ambience * 0.7, t, 0.05);
  }

  async load(name, dir = SFX_DIR) {
    if (this.buffers.has(name)) return this.buffers.get(name);
    if (this.loading.has(name)) return this.loading.get(name);
    const p = (async () => {
      try {
        const res = await fetch(`${dir}${name}.mp3`);
        if (!res.ok) throw new Error(res.status);
        const data = await res.arrayBuffer();
        // decodeAudioData needs a context; create a suspended one early if required.
        if (!this.ctx) this.unlock();
        const buf = await this.ctx.decodeAudioData(data);
        this.buffers.set(name, buf);
        return buf;
      } catch {
        this.buffers.set(name, null);
        return null;
      }
    })();
    this.loading.set(name, p);
    return p;
  }

  async preload(names, onProgress) {
    let done = 0;
    await Promise.all(
      names.map((n) =>
        this.load(n).then(() => {
          done++;
          onProgress && onProgress(done / names.length);
        })
      )
    );
  }

  // Pick a random variant (name_1..name_n) different from the last one played.
  variant(base, count) {
    let n = 1 + ((Math.random() * count) | 0);
    if (count > 1 && n === this.last.get(base)) n = (n % count) + 1;
    this.last.set(base, n);
    return `${base}_${n}`;
  }

  play(name, { vol = 1, rate = 1, jitter = 0.05, pan = 0, delay = 0, bus = 'sfx', lowpass = 0 } = {}) {
    if (!this.ctx || this.ctx.state !== 'running') return null;
    const buf = this.buffers.get(name);
    if (!buf) {
      this.fallback(name, vol, pan, delay);
      return null;
    }
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate * (1 + (Math.random() * 2 - 1) * jitter);
    const g = c.createGain();
    g.gain.value = vol;
    let node = src;
    node.connect(g);
    node = g;
    if (lowpass) {
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = lowpass;
      node.connect(f);
      node = f;
    }
    if (pan && c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      node = p;
    }
    node.connect(bus === 'sfx' ? this.sfxBus : this.musicBus);
    src.start(c.currentTime + delay);
    return src;
  }

  // --- semantic card sounds ---------------------------------------------------
  pickup(pan = 0) {
    this.play(this.variant('pickup', 3), { vol: 0.9, pan });
  }
  place(pan = 0, speed = 1) {
    // Faster arrivals thump a little louder and brighter.
    const s = Math.min(1, speed / 6);
    this.play(this.variant('place', 4), { vol: 0.55 + 0.45 * s, pan, rate: 0.95 + 0.1 * s });
  }
  slide(pan = 0) {
    this.play(this.variant('slide', 2), { vol: 0.45, pan });
  }
  deal(pan = 0, delay = 0) {
    this.play(this.variant('deal', 3), { vol: 0.6, pan, delay });
  }
  flip(pan = 0, delay = 0) {
    this.play(this.variant('flip', 2), { vol: 0.5, pan, delay });
  }
  shuffle() {
    this.play('shuffle', { vol: 0.9, jitter: 0 });
  }
  invalid() {
    this.play('invalid', { vol: 0.8 });
  }
  undo() {
    this.play('undo', { vol: 0.7 });
  }
  hint() {
    this.play('hint', { vol: 0.7 });
  }
  ui() {
    if (this.theme) this.play(`${this.theme}_ui`, { vol: 0.8, jitter: 0.03 });
  }

  // Rising pentatonic chime; consecutive foundation moves climb the ladder.
  foundation(pan = 0) {
    const now = performance.now();
    this.chain = now - this.chainTime < 2200 ? Math.min(this.chain + 1, LADDER.length - 1) : 0;
    this.chainTime = now;
    const semis = LADDER[this.chain];
    this.play(`${this.theme}_chime`, { vol: 0.75, rate: Math.pow(2, semis / 12), jitter: 0, pan });
  }

  win() {
    this.play(`${this.theme}_win`, { vol: 1, jitter: 0 });
  }

  // --- themes: ambience + music ------------------------------------------------
  async setTheme(theme) {
    this.theme = theme;
    // Warm the theme's one-shots; loops are fetched when audio starts.
    await Promise.all([
      this.load(`${theme}_ui`),
      this.load(`${theme}_chime`),
      this.load(`${theme}_win`),
    ]);
    if (this.ctx && this.started) this.startThemeLoops(theme);
  }

  async startThemeLoops(theme) {
    const [amb, mus] = await Promise.all([
      this.load(`${theme}_ambience`),
      this.load(theme, MUSIC_DIR),
    ]);
    if (this.theme !== theme) return; // switched again while loading
    this.crossfade('ambience', amb, this.ambBus, 1.0, 2.0);
    this.crossfade('music', mus, this.musicBus, 1.0, 3.0);
  }

  crossfade(slot, buffer, bus, vol, seconds) {
    const c = this.ctx;
    const prev = this[slot];
    if (prev) {
      prev.gain.gain.cancelScheduledValues(c.currentTime);
      prev.gain.gain.setValueAtTime(prev.gain.gain.value, c.currentTime);
      prev.gain.gain.linearRampToValueAtTime(0, c.currentTime + seconds);
      prev.src.stop(c.currentTime + seconds + 0.1);
    }
    if (!buffer) {
      this[slot] = null;
      return;
    }
    const src = c.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    const gain = c.createGain();
    gain.gain.value = 0;
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + seconds);
    src.connect(gain).connect(bus);
    src.start();
    this[slot] = { src, gain };
  }

  // Briefly lower the music (e.g. under the win fanfare).
  duck(seconds = 5, depth = 0.25) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const base = settings.music * 0.8;
    const g = this.musicBus.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(base * depth, t + 0.3);
    g.linearRampToValueAtTime(base, t + seconds);
  }

  // --- procedural fallbacks ---------------------------------------------------
  fallback(name, vol, pan, delay) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const g = c.createGain();
    g.connect(this.sfxBus);
    if (/chime|win|hint|ui/.test(name)) {
      const o = c.createOscillator();
      o.type = 'sine';
      o.frequency.value = /win/.test(name) ? 523 : 880;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3 * vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
      o.connect(g);
      o.start(t);
      o.stop(t + 0.55);
      return;
    }
    // Filtered noise burst for card-like sounds.
    const len = Math.floor(c.sampleRate * 0.09);
    const nb = c.createBuffer(1, len, c.sampleRate);
    const d = nb.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const s = c.createBufferSource();
    s.buffer = nb;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 1800;
    g.gain.value = 0.5 * vol;
    s.connect(f).connect(g);
    s.start(t);
  }
}

export const SHARED_SOUNDS = [
  ...[1, 2, 3].map((n) => `pickup_${n}`),
  ...[1, 2, 3, 4].map((n) => `place_${n}`),
  ...[1, 2].map((n) => `slide_${n}`),
  ...[1, 2, 3].map((n) => `deal_${n}`),
  ...[1, 2].map((n) => `flip_${n}`),
  'shuffle',
  'invalid',
  'undo',
  'hint',
];

export const audio = new AudioEngine();
