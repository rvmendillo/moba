// Fully synthesized audio: sound effects, procedural music, ambient wind and announcer voice.
const NOTE = (m) => 440 * Math.pow(2, (m - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null; this.ok = false;
    this.vol = { music: 0.55, sfx: 0.85 };
    this.voice = true;
    this.lx = 0; this.lz = 0; this.yaw = 0;
    this.track = null; this.wantTrack = null;
    this.recent = new Map();
  }
  unlock() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC({ latencyHint: 'interactive' });
    this.ctx = ctx;
    this.master = ctx.createDynamicsCompressor();
    this.master.threshold.value = -14; this.master.ratio.value = 4; this.master.attack.value = 0.004; this.master.release.value = 0.2;
    this.master.connect(ctx.destination);
    this.sfxBus = ctx.createGain(); this.sfxBus.gain.value = this.vol.sfx; this.sfxBus.connect(this.master);
    this.musicBus = ctx.createGain(); this.musicBus.gain.value = this.vol.music * 0.5; this.musicBus.connect(this.master);
    // reverb (synthetic impulse) for that big frozen-hall feel
    this.verb = ctx.createConvolver();
    const len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    this.verb.buffer = ir;
    this.verbGain = ctx.createGain(); this.verbGain.gain.value = 0.28;
    this.verb.connect(this.verbGain); this.verbGain.connect(this.master);
    const nb = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const nd = nb.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
    this.noiseBuf = nb;
    this.ok = true;
    this.startAmbient();
    if (this.wantTrack) this.music(this.wantTrack);
    if (ctx.state !== 'running') ctx.resume();
    // iOS: prime speech synthesis inside the gesture
    try { if (window.speechSynthesis) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); } } catch { /* ignore */ }
  }
  setVolumes(music, sfx) {
    this.vol.music = music; this.vol.sfx = sfx;
    if (!this.ok) return;
    this.musicBus.gain.setTargetAtTime(music * 0.5, this.ctx.currentTime, 0.1);
    this.sfxBus.gain.setTargetAtTime(sfx, this.ctx.currentTime, 0.1);
    if (this.ambGain) this.ambGain.gain.setTargetAtTime(0.05 * sfx, this.ctx.currentTime, 0.3);
  }
  listener(x, z, yaw) { this.lx = x; this.lz = z; this.yaw = yaw; }
  // ---------------------------------------------------------------- primitives
  out(x, z, gain = 1, verb = 0.3) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    let vol = gain;
    let pan = 0;
    if (x !== undefined && x !== null) {
      const dx = x - this.lx, dz = z - this.lz;
      const d = Math.hypot(dx, dz);
      vol *= Math.max(0, Math.min(1, 1.15 - d / 26));
      const sx = dx * Math.cos(this.yaw) - dz * Math.sin(this.yaw);
      pan = Math.max(-0.8, Math.min(0.8, sx / 16));
    }
    if (vol <= 0.01) return null;
    g.gain.value = vol;
    if (ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); p.connect(this.sfxBus); if (verb) { const vg = ctx.createGain(); vg.gain.value = verb; p.connect(vg); vg.connect(this.verb); } }
    else g.connect(this.sfxBus);
    return g;
  }
  tone(dest, t, f, dur, { type = 'sine', vol = 0.3, a = 0.005, f2 = null, det = 0 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); o.detune.value = det;
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  noise(dest, t, dur, { type = 'bandpass', f = 1000, f2 = null, q = 1, vol = 0.3, a = 0.005 } = {}) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(Math.max(30, f2), t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl); fl.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  bell(dest, t, f, dur, vol = 0.2) {
    const ctx = this.ctx;
    const c = ctx.createOscillator(), m = ctx.createOscillator(), mg = ctx.createGain(), g = ctx.createGain();
    c.frequency.value = f; m.frequency.value = f * 3.5; mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + dur);
    m.connect(mg); mg.connect(c.frequency);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    c.connect(g); g.connect(dest); c.start(t); m.start(t); c.stop(t + dur + 0.05); m.stop(t + dur + 0.05);
  }
  // ---------------------------------------------------------------- sound effects
  play(name, x, z, gain = 1) {
    if (!this.ok || this.vol.sfx <= 0) return;
    const now = this.ctx.currentTime;
    const last = this.recent.get(name) || 0;
    if (now - last < 0.045) return;
    this.recent.set(name, now);
    const o = this.out(x, z, gain, 0.25);
    if (!o) return;
    const t = now + 0.005;
    const S = this;
    switch (name) {
      case 'click': S.tone(o, t, 1100, 0.06, { vol: 0.15, f2: 1500 }); break;
      case 'open': S.noise(o, t, 0.25, { f: 600, f2: 2400, q: 2, vol: 0.12 }); S.tone(o, t, 660, 0.18, { vol: 0.06, f2: 990 }); break;
      case 'error': S.tone(o, t, 220, 0.18, { type: 'square', vol: 0.06, f2: 180 }); break;
      case 'buy': case 'coin': S.tone(o, t, 1568, 0.25, { type: 'triangle', vol: 0.18 }); S.tone(o, t + 0.07, 2093, 0.35, { type: 'triangle', vol: 0.15 }); S.bell(o, t + 0.07, 3136, 0.4, 0.04); break;
      case 'levelUp': [72, 76, 79, 84].forEach((m, i) => S.tone(o, t + i * 0.07, NOTE(m), 0.45, { type: 'triangle', vol: 0.15 })); S.bell(o, t + 0.28, NOTE(96), 0.8, 0.05); break;
      case 'swing': S.noise(o, t, 0.16, { f: 2200, f2: 500, q: 1.5, vol: 0.18 }); break;
      case 'hit': S.noise(o, t, 0.08, { type: 'lowpass', f: 1800, vol: 0.25 }); S.tone(o, t, 180, 0.1, { vol: 0.18, f2: 80 }); break;
      case 'hitMetal': S.bell(o, t, 520 + Math.random() * 80, 0.2, 0.1); S.noise(o, t, 0.06, { f: 4000, vol: 0.15 }); break;
      case 'bow': case 'arrow': case 'bowHeavy': S.tone(o, t, 380, 0.12, { type: 'triangle', vol: 0.12, f2: 160 }); S.noise(o, t, 0.1, { f: 3000, f2: 1200, vol: 0.08 }); break;
      case 'magic': S.tone(o, t, 900, 0.18, { vol: 0.08, f2: 1500 }); S.bell(o, t, 1800 + Math.random() * 300, 0.3, 0.05); break;
      case 'towerShot': S.tone(o, t, 900, 0.25, { type: 'sawtooth', vol: 0.05, f2: 300 }); S.bell(o, t, 1200, 0.3, 0.06); break;
      case 'iceCast': case 'charge': S.noise(o, t, 0.35, { f: 3000, f2: 7000, q: 4, vol: 0.08 }); [1760, 2349, 2637].forEach((f, i) => S.bell(o, t + i * 0.04, f, 0.4, 0.05)); break;
      case 'iceHit': case 'freeze': case 'iceBurst': S.noise(o, t, 0.3, { f: 5000, f2: 2000, q: 2, vol: 0.18 }); S.bell(o, t, 1400, 0.5, 0.09); S.bell(o, t + 0.03, 2100, 0.6, 0.06); S.tone(o, t, 140, 0.25, { vol: name === 'iceBurst' ? 0.25 : 0.1, f2: 60 }); break;
      case 'fireCast': S.noise(o, t, 0.4, { type: 'lowpass', f: 800, f2: 3000, vol: 0.15, a: 0.05 }); break;
      case 'explosion': case 'bigExplosion': case 'coreDown': case 'towerDown': {
        const big = name !== 'explosion';
        S.noise(o, t, big ? 1.6 : 0.7, { type: 'lowpass', f: 2500, f2: 120, vol: big ? 0.5 : 0.35 }); S.tone(o, t, big ? 90 : 120, big ? 1.2 : 0.5, { vol: 0.5, f2: 35 }); break;
      }
      case 'meteorFall': S.noise(o, t, 1.2, { f: 400, f2: 2600, q: 1.2, vol: 0.18, a: 0.9 }); break;
      case 'dash': case 'wind': case 'roll': case 'pounce': case 'wing': case 'blink': case 'throw': S.noise(o, t, 0.28, { f: 900, f2: 3200, q: 1.4, vol: 0.16 }); if (name === 'blink') S.bell(o, t, 1975, 0.4, 0.06); break;
      case 'slash': case 'bigSlash': case 'whirl': case 'cutHit': case 'claw': case 'thrust': case 'execute': {
        S.noise(o, t, 0.18, { f: 5200, f2: 1400, q: 2, vol: 0.2 }); S.bell(o, t + 0.02, name === 'bigSlash' ? 330 : 660 + Math.random() * 120, 0.35, 0.07);
        if (name === 'bigSlash' || name === 'execute') S.tone(o, t, 110, 0.4, { vol: 0.3, f2: 45 });
        break;
      }
      case 'quake': case 'bigImpact': case 'slam': case 'snowHit':
        S.tone(o, t, name === 'snowHit' ? 220 : 90, 0.5, { vol: 0.45, f2: 38 }); S.noise(o, t, 0.5, { type: 'lowpass', f: 1200, f2: 150, vol: 0.3 }); if (name === 'bigImpact') S.bell(o, t, 784, 0.9, 0.07); break;
      case 'roar': { const ctx = this.ctx; const os = ctx.createOscillator(), g = ctx.createGain(), lf = ctx.createOscillator(), lg = ctx.createGain(); os.type = 'sawtooth'; os.frequency.setValueAtTime(110, t); os.frequency.exponentialRampToValueAtTime(70, t + 0.9); lf.frequency.value = 18; lg.gain.value = 12; lf.connect(lg); lg.connect(os.frequency); const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 700; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0); os.connect(fl); fl.connect(g); g.connect(o); os.start(t); lf.start(t); os.stop(t + 1.1); lf.stop(t + 1.1); S.noise(o, t, 0.9, { type: 'lowpass', f: 900, vol: 0.2 }); break; }
      case 'heal': case 'purify': [0, 4, 7, 12].forEach((s, i) => S.tone(o, t + i * 0.05, NOTE(72 + s), 0.7, { type: 'sine', vol: 0.09, a: 0.03 })); break;
      case 'shield': case 'bell': case 'sanctuary': S.bell(o, t, 880, 1.4, 0.14); S.bell(o, t + 0.02, 1320, 1.2, 0.07); S.tone(o, t, 440, 1.0, { vol: 0.08, a: 0.05 }); break;
      case 'note': case 'lullaby': case 'anthem': { const notes = name === 'anthem' ? [67, 71, 74, 79] : name === 'lullaby' ? [76, 72, 69] : [79, 84]; notes.forEach((m, i) => S.tone(o, t + i * 0.1, NOTE(m), 0.5, { type: 'triangle', vol: 0.12, a: 0.01 })); break; }
      case 'shuriken': case 'cuts': S.noise(o, t, 0.12, { f: 6000, f2: 3000, q: 3, vol: 0.14 }); break;
      case 'veil': S.noise(o, t, 0.5, { f: 2000, f2: 600, q: 0.8, vol: 0.1, a: 0.1 }); break;
      case 'sniper': S.noise(o, t, 0.3, { type: 'lowpass', f: 6000, f2: 400, vol: 0.4 }); S.tone(o, t, 160, 0.3, { vol: 0.35, f2: 50 }); break;
      case 'scatter': for (let i = 0; i < 4; i++) S.noise(o, t + i * 0.025, 0.08, { f: 3500, vol: 0.15 }); break;
      case 'blizzard': case 'arrowRain': S.noise(o, t, 2.2, { f: name === 'blizzard' ? 1800 : 3500, q: 0.7, vol: 0.12, a: 0.3 }); break;
      case 'recallStart': [0, 7, 12, 19].forEach((s, i) => S.bell(o, t + i * 0.12, NOTE(76 + s), 0.6, 0.05)); break;
      case 'recallEnd': case 'respawn': S.bell(o, t, NOTE(88), 0.9, 0.09); S.noise(o, t, 0.5, { f: 3000, f2: 8000, vol: 0.07 }); break;
      case 'heroDeath': S.tone(o, t, 330, 0.8, { type: 'triangle', vol: 0.12, f2: 110 }); S.noise(o, t, 0.4, { type: 'lowpass', f: 900, vol: 0.12 }); break;
      case 'kill': S.tone(o, t, 660, 0.12, { type: 'square', vol: 0.05 }); S.bell(o, t + 0.05, 1320, 0.5, 0.08); break;
      case 'firstblood': case 'announce': S.tone(o, t, 110, 0.9, { type: 'sawtooth', vol: 0.12, f2: 55 }); S.bell(o, t, 660, 1.2, 0.1); S.bell(o, t + 0.1, 990, 1.0, 0.08); break;
      case 'victory': [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => S.tone(o, t + i * 0.11, NOTE(m), 1.2, { type: 'triangle', vol: 0.14, a: 0.01 })); break;
      case 'defeat': [69, 65, 62, 57].forEach((m, i) => S.tone(o, t + i * 0.22, NOTE(m), 1.2, { type: 'triangle', vol: 0.13, a: 0.02 })); break;
      default: S.noise(o, t, 0.12, { f: 1500, vol: 0.08 });
    }
  }
  // ---------------------------------------------------------------- ambient wind
  startAmbient() {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6;
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 260; lfo.connect(lg); lg.connect(f.frequency);
    const g = ctx.createGain(); g.gain.value = 0.05 * this.vol.sfx;
    const lfo2 = ctx.createOscillator(), lg2 = ctx.createGain(); lfo2.frequency.value = 0.11; lg2.gain.value = 0.025; lfo2.connect(lg2); lg2.connect(g.gain);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(); lfo.start(); lfo2.start();
    this.ambGain = g;
  }
  // ---------------------------------------------------------------- music
  music(name) {
    this.wantTrack = name;
    if (!this.ok) return;
    if (this.track && this.track.name === name) return;
    if (this.track) { const tr = this.track; tr.stop = true; tr.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.6); setTimeout(() => tr.gain.disconnect(), 3000); }
    this.track = null;
    if (!name) return;
    const gain = this.ctx.createGain(); gain.gain.value = 0.0001; gain.connect(this.musicBus);
    const vg = this.ctx.createGain(); vg.gain.value = 0.35; gain.connect(vg); vg.connect(this.verb);
    gain.gain.setTargetAtTime(1, this.ctx.currentTime, 1.2);
    const tr = { name, gain, step: 0, next: this.ctx.currentTime + 0.1, stop: false };
    this.track = tr;
    const SONGS = {
      // original compositions (scale degrees relative to root, chord roots per bar)
      menu: { bpm: 84, root: 62, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2], [0, 4, 7], [-3, 0, 4], [-7, -3, 2], [-5, -1, 2]], mel: [7, 9, 11, 9, 7, 4, 7, -1, 12, 11, 9, 7, 9, -1, -1, -1, 4, 7, 9, 7, 4, 2, 4, -1, 7, 9, 7, 4, 2, -1, -1, -1, 14, 12, 11, 9, 11, 12, 14, -1, 12, 11, 9, 7, 9, -1, 7, -1, 4, 7, 11, 9, 7, 4, 2, -1, 0, 2, 4, 7, 2, -1, -1, -1], swing: 0 },
      battle: { bpm: 112, root: 50, chords: [[0, 3, 7], [-4, 0, 3], [-9, -5, -2], [-2, 2, 5], [0, 3, 7], [-4, 0, 3], [-7, -4, 0], [-5, -2, 2]], mel: [12, -1, 10, 12, 15, -1, 14, 12, 10, -1, 8, 7, 8, 10, -1, -1, 12, -1, 15, 17, 19, -1, 17, 15, 14, 15, 14, 12, 10, -1, -1, -1], drums: true },
    };
    const song = SONGS[name];
    if (!song) return;
    const spb = 60 / song.bpm / 2; // 8th notes
    const tick = () => {
      if (tr.stop || !this.ok) return;
      const ctx = this.ctx;
      while (tr.next < ctx.currentTime + 0.25) {
        const s = tr.step, t = tr.next;
        const bar = Math.floor(s / 8) % song.chords.length, beat = s % 8;
        const ch = song.chords[bar];
        if (beat === 0) {
          // pad
          for (const n of ch) this.pad(gain, t, NOTE(song.root + 12 + n), spb * 8, 0.035);
          this.tone(gain, t, NOTE(song.root - 12 + ch[0]), spb * 7.5, { type: 'sine', vol: 0.12, a: 0.03 });
        }
        // arpeggio (celesta)
        const arp = ch[[0, 1, 2, 1][beat % 4]] + (beat >= 4 ? 12 : 0);
        this.bell(gain, t, NOTE(song.root + 24 + arp), name === 'menu' ? 0.9 : 0.4, name === 'menu' ? 0.03 : 0.022);
        // melody
        const m = song.mel[s % song.mel.length];
        if (m >= 0) this.tone(gain, t, NOTE(song.root + 12 + m), spb * 1.9, { type: 'triangle', vol: 0.06, a: 0.02 });
        if (song.drums) {
          if (beat % 4 === 0) this.tone(gain, t, 120, 0.25, { vol: 0.28, f2: 40 });
          if (beat % 4 === 2) this.noise(gain, t, 0.14, { type: 'highpass', f: 1800, vol: 0.08 });
          this.noise(gain, t, 0.04, { type: 'highpass', f: 7000, vol: 0.03 });
        } else if (Math.random() < 0.12) this.bell(gain, t + spb * 0.5, NOTE(song.root + 36 + ch[Math.floor(Math.random() * 3)]), 1.4, 0.015);
        tr.step++; tr.next += spb;
      }
      setTimeout(tick, 60);
    };
    tick();
  }
  pad(dest, t, f, dur, vol) {
    const ctx = this.ctx;
    const g = ctx.createGain();
    const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = 1400; fl.Q.value = 0.5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.35); g.gain.exponentialRampToValueAtTime(0.0001, t + dur * 1.05);
    for (const det of [-8, 7]) { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = det; o.connect(fl); o.start(t); o.stop(t + dur * 1.1); }
    fl.connect(g); g.connect(dest);
  }
  // ---------------------------------------------------------------- announcer
  speak(text) {
    if (!this.voice || !window.speechSynthesis) return;
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02; u.pitch = 0.82; u.volume = Math.min(1, this.vol.sfx + 0.1);
      const voices = speechSynthesis.getVoices();
      const v = voices.find((x) => /en-(GB|US)/.test(x.lang) && /Daniel|Arthur|Male|Google UK English Male|Aaron/i.test(x.name)) || voices.find((x) => x.lang && x.lang.startsWith('en'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    } catch { /* ignore */ }
  }
}
export const audio = new AudioEngine();
