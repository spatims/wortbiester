// Töne über WebAudio, Sprache über speechSynthesis.
// Ohne setEnabled(true) bleiben die Töne stumm; speak() läuft weiter (Lernen).
// Ruhe-Modus (Klasse html.ruhe, setzt app.js) dämpft die Lautstärke, schaltet nicht ab.
// Kein eigener Schalter für die Stimme: der Auftrag nennt nur den Ton-Schalter.

let kontext = null;
let an = true;

function ruhe() {
  return typeof document !== 'undefined' && document.documentElement.classList.contains('ruhe');
}

export function setEnabled(on) { an = !!on; }

export function unlock() {
  const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AC) return null;
  if (!kontext) kontext = new AC();
  if (kontext.state === 'suspended') kontext.resume();
  return kontext;
}

function huelle(gain, start, dauer, spitze) {
  const wert = Math.max(0.0002, spitze);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(wert, start + Math.min(0.02, dauer / 2));
  gain.gain.exponentialRampToValueAtTime(0.0001, start + dauer);
}

function ton(freq, dauer, art, spitze, ziel) {
  if (!kontext) return;
  const t = kontext.currentTime;
  const o = kontext.createOscillator();
  const g = kontext.createGain();
  o.type = art;
  o.frequency.setValueAtTime(Math.max(1, freq), t);
  if (ziel) o.frequency.exponentialRampToValueAtTime(Math.max(1, ziel), t + dauer);
  huelle(g, t, dauer, spitze);
  o.connect(g).connect(kontext.destination);
  o.start(t);
  o.stop(t + dauer + 0.02);
}

function tonAb(freq, dauer, art, spitze, versatz) {
  if (!kontext) return;
  const t = kontext.currentTime + versatz;
  const o = kontext.createOscillator();
  const g = kontext.createGain();
  o.type = art;
  o.frequency.setValueAtTime(Math.max(1, freq), t);
  huelle(g, t, dauer, spitze);
  o.connect(g).connect(kontext.destination);
  o.start(t);
  o.stop(t + dauer + 0.02);
}

function rauschen(dauer, spitze, frequenz) {
  if (!kontext) return;
  const n = Math.max(1, Math.floor(kontext.sampleRate * dauer));
  const buffer = kontext.createBuffer(1, n, kontext.sampleRate);
  const daten = buffer.getChannelData(0);
  for (let i = 0; i < n; i++) daten[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const quelle = kontext.createBufferSource();
  quelle.buffer = buffer;
  const filter = kontext.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = frequenz;
  const g = kontext.createGain();
  huelle(g, kontext.currentTime, dauer, spitze);
  quelle.connect(filter).connect(g).connect(kontext.destination);
  quelle.start();
}

export function play(name) {
  if (!an) return;
  const c = unlock();
  if (!c) return;
  const laut = ruhe() ? 0.4 : 1;
  const p = (x) => x * laut;
  if (name === 'tipp') ton(740, 0.045, 'sine', p(0.07));
  else if (name === 'richtig') { ton(523.25, 0.12, 'sine', p(0.08)); tonAb(659.25, 0.14, 'sine', p(0.08), 0.09); }
  else if (name === 'falsch') ton(98, 0.2, 'triangle', p(0.04), 70);
  else if (name === 'muenze') { ton(988, 0.09, 'sine', p(0.06)); tonAb(1318, 0.1, 'sine', p(0.05), 0.07); }
  else if (name === 'schild') { ton(320, 0.18, 'triangle', p(0.05), 80); rauschen(0.1, p(0.035), 380); }
  else if (name === 'ei') { ton(620, 0.04, 'sine', p(0.05)); tonAb(280, 0.07, 'triangle', p(0.05), 0.05); }
  else if (name === 'boss') ton(90, 0.22, 'sine', p(0.08), 48);
  else if (name === 'feuer') rauschen(0.22, p(0.028), 650);
  else if (name === 'blitz') ton(880, 0.14, 'sine', p(0.05), 1760);
  else if (name === 'fanfare') {
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => tonAb(freq, 0.2, 'sine', p(0.055), i * 0.16));
  }
}

function stimme() {
  const ss = globalThis.speechSynthesis;
  if (!ss?.getVoices) return null;
  const stimmen = ss.getVoices();
  return stimmen.find((v) => /^en-GB/i.test(v.lang))
    || stimmen.find((v) => /^en-US/i.test(v.lang))
    || stimmen.find((v) => /^en/i.test(v.lang))
    || null;
}

export function speak(en) {
  const ss = globalThis.speechSynthesis;
  if (!ss) return;
  const text = String(en ?? '').trim();
  if (!text) return;
  ss.cancel();
  const satz = new SpeechSynthesisUtterance(text);
  const v = stimme();
  if (v) { satz.voice = v; satz.lang = v.lang; }
  else satz.lang = 'en-GB';
  satz.rate = 0.9;
  ss.speak(satz);
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => { try { unlock(); } catch { /* kein Audio */ } }, { passive: true });
  try { window.speechSynthesis?.getVoices?.(); } catch { /* Stimmen kommen später */ }
}
