// Audio manager. Web Audio for sound effects and recorded voice clips; the
// browser's speech voice stands in for any voice clip not recorded yet.
// Nothing plays until the first tap (browsers require a user gesture).
import { VOICE, SFX } from './audio-cues.js';
import { store } from './util.js';

const AUDIO = new URL('../assets/audio/', import.meta.url);
let ctx = null;
let master = null;
let muted = store.get('muted', false);
const sfxBuf = new Map();
const voiceBuf = new Map(); // name -> Promise<AudioBuffer|null>
let voiceSrc = null;
let voiceDone = null;
let ttsVoice = null;

function decode(data) {
  // callback form keeps older Safari happy
  return new Promise((res, rej) => ctx.decodeAudioData(data, res, rej));
}

async function loadBuffer(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return decode(await r.arrayBuffer());
}

async function loadVoice(name) {
  for (const ext of ['mp3', 'm4a']) {
    try { return await loadBuffer(new URL(`voice/${name}.${ext}`, AUDIO)); } catch { /* try next */ }
  }
  return null; // not recorded yet: use the speech voice
}

function chooseTTSVoice() {
  if (!('speechSynthesis' in window)) return;
  const voices = speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  const liked = ['Samantha', 'Karen', 'Moira', 'Tessa', 'Google US English', 'Google UK English Female'];
  ttsVoice = liked.map((n) => voices.find((v) => v.name.includes(n))).find(Boolean) ||
    voices.find((v) => v.localService) || voices[0] || null;
}

export function isMuted() { return muted; }

export function setMuted(m) {
  muted = m;
  store.set('muted', m);
  if (master) master.gain.value = m ? 0 : 1;
  if (m) stopVoice();
}

/** Call from inside the first pointer/touch handler. Safe to call repeatedly. */
export function unlock() {
  if (ctx) {
    if (ctx.state !== 'running') ctx.resume();
    return;
  }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 1;
  master.connect(ctx.destination);
  // play one silent sample inside the gesture (iOS)
  const b = ctx.createBuffer(1, 1, 22050);
  const s = ctx.createBufferSource();
  s.buffer = b;
  s.connect(master);
  s.start(0);
  ctx.resume();
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    chooseTTSVoice();
    speechSynthesis.onvoiceschanged = chooseTTSVoice;
  }
  for (const name of SFX) {
    loadBuffer(new URL(`sfx/${name}.mp3`, AUDIO)).then((b) => sfxBuf.set(name, b)).catch(() => {});
  }
  for (const name of Object.keys(VOICE)) voiceBuf.set(name, loadVoice(name));

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { stopVoice(); ctx.suspend(); } else ctx.resume();
  });
}

/** Play a sound effect by name. */
export function sfx(name, { volume = 1, rate = 1 } = {}) {
  if (!ctx || muted) return;
  const buf = sfxBuf.get(name);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = volume;
  src.connect(g).connect(master);
  src.start();
}

export function stopVoice() {
  if (voiceSrc) { try { voiceSrc.stop(); } catch { /* already stopped */ } voiceSrc = null; }
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (voiceDone) { voiceDone(); voiceDone = null; }
}

/**
 * Say a voice cue by name. Stops any voice already playing.
 * Resolves when it finishes (or straight away when muted).
 */
export async function say(name) {
  const cue = VOICE[name];
  if (!cue || !ctx || muted) return;
  stopVoice();
  const myDone = new Promise((res) => { voiceDone = res; });
  const finish = voiceDone;
  const buf = await voiceBuf.get(name);
  if (voiceDone !== finish) return; // something else started meanwhile
  if (buf) {
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(master);
    src.onended = () => { if (voiceSrc === src) { voiceSrc = null; finish(); } };
    voiceSrc = src;
    src.start();
  } else if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(cue.say);
    if (ttsVoice) u.voice = ttsVoice;
    u.rate = 0.92;
    u.pitch = 1.2;
    u.onend = finish;
    u.onerror = finish;
    // iOS sometimes drops speech queued in the same tick as cancel()
    setTimeout(() => speechSynthesis.speak(u), 30);
    setTimeout(finish, 1500 + cue.say.length * 110); // never hang if onend is lost
  } else {
    finish();
  }
  return myDone;
}
