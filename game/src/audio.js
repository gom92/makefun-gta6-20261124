// WebAudio sound, synthesized on the spot: no files, no network. The context is created on the
// first key press (browsers require a gesture), and every effect is a handful of oscillators.

export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  let engineOsc = null;
  let engineFilter = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenOn = false;
  let sirenTimer = 0;
  let sirenHigh = false;
  let noiseBuffer = null;

  function makeNoise() {
    const length = Math.floor(ctx.sampleRate * 0.4);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function ensure() {
    if (ctx) return ctx;
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return null;
    ctx = new AudioCtor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.45;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise();

    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 55;
    engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();

    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'square';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    return ctx;
  }

  function unlock() {
    const context = ensure();
    if (!context) return;
    if (context.state === 'suspended') context.resume();
  }

  function tone(freq, type, duration, gain, when = 0, slideTo = null) {
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + duration);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), start + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(env);
    env.connect(master);
    osc.start(start);
    osc.stop(start + duration + 0.05);
  }

  function noise(duration, gain, when = 0, filterFreq = 1200) {
    if (!ctx) return;
    const start = ctx.currentTime + when;
    const source = ctx.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, start);
    env.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(env);
    env.connect(master);
    source.start(start);
    source.stop(start + duration + 0.02);
  }

  function click() {
    if (!ctx) return;
    tone(760, 'square', 0.06, 0.07);
  }

  function pickup() {
    if (!ctx) return;
    tone(660, 'sine', 0.11, 0.12);
    tone(990, 'sine', 0.16, 0.1, 0.09);
  }

  function crash() {
    if (!ctx) return;
    noise(0.3, 0.3, 0, 900);
    tone(120, 'sawtooth', 0.34, 0.16, 0, 38);
  }

  function punch() {
    if (!ctx) return;
    noise(0.09, 0.22, 0, 1600);
    tone(180, 'triangle', 0.08, 0.08, 0, 90);
  }

  function win() {
    if (!ctx) return;
    const notes = [523, 659, 784, 1046];
    notes.forEach((freq, i) => tone(freq, 'triangle', 0.22, 0.13, i * 0.12));
  }

  function fail() {
    if (!ctx) return;
    tone(330, 'sawtooth', 0.7, 0.13, 0, 78);
    tone(220, 'triangle', 0.5, 0.08, 0.12, 60);
  }

  function setEngine(ratio) {
    if (!ctx) return;
    const value = Math.max(0, Math.min(1, ratio));
    engineOsc.frequency.setTargetAtTime(55 + value * 130, ctx.currentTime, 0.08);
    engineFilter.frequency.setTargetAtTime(360 + value * 900, ctx.currentTime, 0.1);
    engineGain.gain.setTargetAtTime(value > 0.02 ? 0.055 : 0, ctx.currentTime, 0.09);
  }

  function setSiren(on) {
    sirenOn = on;
    if (!ctx) return;
    if (!on) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
  }

  function update(dt) {
    if (!ctx) return;
    if (sirenOn) {
      sirenGain.gain.setTargetAtTime(0.032, ctx.currentTime, 0.08);
      sirenTimer -= dt;
      if (sirenTimer <= 0) {
        sirenTimer = 0.42;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.02);
      }
    } else {
      sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.12);
    }
  }

  function setMuted(value) {
    muted = value;
    if (ctx) master.gain.setTargetAtTime(muted ? 0 : 0.45, ctx.currentTime, 0.05);
  }

  function toggleMute() {
    setMuted(!muted);
    return muted;
  }

  return {
    unlock,
    click,
    pickup,
    crash,
    punch,
    win,
    fail,
    setEngine,
    setSiren,
    update,
    setMuted,
    toggleMute,
    isMuted: () => muted,
    get ready() {
      return ctx !== null;
    },
  };
}
