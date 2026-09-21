export class AudioSystem {
  constructor(getVolume) {
    this.getVolume = getVolume;
    this.context = null;
    this.ambient = null;
    this.ambientGain = null;
  }

  ensureContext() {
    if (!this.context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return null;
      this.context = new AudioContext();
    }
    if (this.context.state === "suspended") this.context.resume();
    return this.context;
  }

  volume(multiplier = 1) {
    return Math.max(0, Math.min(1, Number(this.getVolume()) / 100)) * multiplier;
  }

  startAmbient() {
    const ctx = this.ensureContext();
    if (!ctx || this.ambient) return;

    const oscillator = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 54;
    filter.type = "lowpass";
    filter.frequency.value = 120;
    gain.gain.value = this.volume(0.035);
    oscillator.connect(filter).connect(gain).connect(ctx.destination);
    oscillator.start();
    this.ambient = oscillator;
    this.ambientGain = gain;
  }

  updateVolume() {
    if (!this.ambientGain || !this.context) return;
    this.ambientGain.gain.setTargetAtTime(this.volume(0.035), this.context.currentTime, 0.08);
  }

  beep(kind = "confirm") {
    const ctx = this.ensureContext();
    if (!ctx || this.volume() === 0) return;
    const now = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const frequencies = { confirm: 620, focus: 430, alert: 190, unlock: 780, error: 145 };
    oscillator.type = kind === "alert" || kind === "error" ? "square" : "sine";
    oscillator.frequency.setValueAtTime(frequencies[kind] || 520, now);
    if (kind === "unlock") oscillator.frequency.exponentialRampToValueAtTime(1040, now + 0.12);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0002, this.volume(0.12)), now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.18);
  }
}

