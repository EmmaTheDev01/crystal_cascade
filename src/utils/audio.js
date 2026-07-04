class GameAudioController {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.pentatonic = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // C4 to C6 Pentatonic scale
  }

  init() {
    if (this.ctx) return;
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      this.ctx = new AudioContextClass();
    }
  }

  resume() {
    this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  toggleMute() {
    this.muted = !this.muted;
    return this.muted;
  }

  isMuted() {
    return this.muted;
  }

  playSwap() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.type = 'triangle';
    const now = this.ctx.currentTime;
    
    // Pitch swoosh
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(380, now + 0.15);

    // Fade out volume
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18);

    osc.start(now);
    osc.stop(now + 0.18);
  }

  playMatch(combo = 1) {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Clamp so baseIndex+2 always lands within the array
    const baseIndex = Math.min(Math.max(0, combo - 1), this.pentatonic.length - 3);
    
    // Play two notes in harmony for matches
    const freqs = [this.pentatonic[baseIndex], this.pentatonic[baseIndex + 2]];

    freqs.forEach((freq, i) => {
      // Guard against undefined / non-finite values
      if (!isFinite(freq) || freq <= 0) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.04);
      // Gentle pitch bounce
      osc.frequency.exponentialRampToValueAtTime(freq * 1.08, now + i * 0.04 + 0.12);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(2000, now);

      gain.gain.setValueAtTime(0.0, now);
      gain.gain.linearRampToValueAtTime(0.15, now + i * 0.04 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.04 + 0.35);

      osc.start(now + i * 0.04);
      osc.stop(now + i * 0.04 + 0.35);
    });

  }

  playBlockBreak() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    
    // Synthesize noise for shattering
    const bufferSize = this.ctx.sampleRate * 0.22; // 220ms
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.setValueAtTime(3.0, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + 0.2);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.ctx.destination);

    noise.start(now);
    noise.stop(now + 0.22);

    // Add a quick sub-thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(90, now);
    subOsc.frequency.linearRampToValueAtTime(45, now + 0.15);
    subGain.gain.setValueAtTime(0.2, now);
    subGain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);

    subOsc.connect(subGain);
    subGain.connect(this.ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 0.15);
  }

  playWin() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Energetic arpeggio (C major 7th / 9th)
    const arpeggio = [261.63, 329.63, 392.00, 493.88, 523.25, 659.25, 783.99, 1046.50];
    
    arpeggio.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.08);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.12, now + idx * 0.08 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.08 + 0.45);
      
      osc.start(now + idx * 0.08);
      osc.stop(now + idx * 0.08 + 0.5);
    });
  }

  playLose() {
    if (this.muted) return;
    this.resume();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    // Melancholy descending minor arpeggio
    const arpeggio = [392.00, 311.13, 261.63, 196.00, 155.56, 130.81];
    
    arpeggio.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now + idx * 0.12);
      
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.08, now + idx * 0.12 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.55);
      
      osc.start(now + idx * 0.12);
      osc.stop(now + idx * 0.12 + 0.6);
    });
  }
}

export const gameAudio = new GameAudioController();
