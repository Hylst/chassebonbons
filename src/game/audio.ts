type WaveType = OscillatorType;

const STEP_DUR = 0.17;
const CHORDS = [
  { root: 45, arp: [69, 72, 76, 72, 69, 72, 76, 81] }, // La mineur
  { root: 41, arp: [65, 69, 72, 69, 65, 69, 72, 77] }, // Fa
  { root: 43, arp: [67, 71, 74, 71, 67, 71, 74, 79] }, // Sol
  { root: 40, arp: [64, 68, 71, 68, 64, 68, 71, 76] }, // Mi (harmonique)
];

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

class Chiptune {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;
  private timer: number | null = null;
  private nextT = 0;
  private step = 0;
  private playing = false;
  muted = false;

  ensure(): boolean {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate * 0.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return true;
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  private tone(freq: number, dur: number, type: WaveType, vol: number, freq2 = 0, when = -1) {
    if (!this.ctx || !this.master) return;
    const t = when < 0 ? this.ctx.currentTime : when;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (freq2 > 0) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq2), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.03);
  }

  private noise(dur: number, vol: number, when = -1) {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const t = when < 0 ? this.ctx.currentTime : when;
    const s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g);
    g.connect(this.master);
    s.start(t);
    s.stop(t + dur + 0.03);
  }

  sfx(name: string, n = 0) {
    if (!this.ensure() || !this.ctx) return;
    const t = this.ctx.currentTime;
    switch (name) {
      case 'jump':
        this.tone(320, 0.12, 'square', 0.06, 640);
        break;
      case 'bounce':
        this.tone(180, 0.35, 'square', 0.09, 1000);
        this.tone(360, 0.3, 'triangle', 0.08, 1400, t + 0.05);
        break;
      case 'candy': {
        const f = 660 * Math.pow(2, Math.min(n, 12) / 12);
        this.tone(f, 0.07, 'square', 0.06);
        this.tone(f * 1.5, 0.12, 'square', 0.06, 0, t + 0.06);
        break;
      }
      case 'stomp':
        this.tone(500, 0.18, 'square', 0.09, 90);
        this.noise(0.1, 0.08);
        break;
      case 'hurt':
        this.noise(0.35, 0.16);
        this.tone(320, 0.4, 'sawtooth', 0.1, 50);
        break;
      case 'shield':
        this.noise(0.18, 0.1);
        this.tone(900, 0.2, 'triangle', 0.09, 200);
        break;
      case 'power':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.12, 'square', 0.06, 0, t + i * 0.06));
        break;
      case 'rush':
        this.tone(200, 0.5, 'sawtooth', 0.07, 1400);
        this.tone(100, 0.5, 'square', 0.06, 700);
        break;
      case 'crumble':
        this.noise(0.18, 0.08);
        break;
      case 'start':
        [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.1, 'square', 0.06, 0, t + i * 0.07));
        break;
      case 'over':
        [440, 392, 349, 330, 262].forEach((f, i) => this.tone(f, 0.28, 'triangle', 0.12, f * 0.97, t + i * 0.2));
        break;
      case 'fall':
        this.tone(500, 0.6, 'square', 0.07, 60);
        break;
    }
  }

  private playStep(i: number, when: number) {
    const chord = CHORDS[Math.floor(i / 8) % CHORDS.length];
    const k = i % 8;
    if (k % 2 === 0) this.tone(mtof(chord.root + (k === 4 ? 12 : 0)), 0.15, 'triangle', 0.13, 0, when);
    this.tone(mtof(chord.arp[k]), 0.13, 'square', 0.028, 0, when);
    if (k % 4 === 0) this.tone(130, 0.12, 'sine', 0.2, 40, when);
    if (k % 2 === 1) this.noise(0.04, 0.025, when);
    if (i % 32 === 30) this.tone(mtof(chord.arp[7] + 12), 0.1, 'square', 0.02, 0, when);
  }

  private schedule = () => {
    if (!this.playing || !this.ctx) return;
    while (this.nextT < this.ctx.currentTime + 0.25) {
      this.playStep(this.step, this.nextT);
      this.nextT += STEP_DUR;
      this.step = (this.step + 1) % 32;
    }
    this.timer = window.setTimeout(this.schedule, 60);
  };

  startMusic() {
    if (this.playing || !this.ensure() || !this.ctx) return;
    this.playing = true;
    this.nextT = this.ctx.currentTime + 0.08;
    this.schedule();
  }

  stopMusic() {
    this.playing = false;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
  }
}

export const audio = new Chiptune();
