// Start der App: Router zwischen Bildschirmen, Verbindung von Kern (store, srs, hunt) und Oberfläche.
import * as store from './store.js';
import * as srs from './core/srs.js';
import { createHunt } from './core/hunt.js';
import { buildTask, poolFor } from './core/tasks.js';
import * as biester from './core/biester.js';
import { drawBiest } from './render/biest.js';
import * as audio from './audio.js';
import * as heute from './ui/heute.js';
import * as jagd from './ui/jagd.js';
import * as rudel from './ui/rudel.js';
import * as laden from './ui/laden.js';
import * as eltern from './ui/eltern.js';

const SCREENS = { heute, jagd, rudel, laden, eltern };
const root = document.getElementById('app');
let current = null;
let hasKeyboard = false;

const ctx = {
  store, srs, audio, biester, drawBiest,
  hunt: null,
  huntStartedAt: 0,
  get hasKeyboard() { return hasKeyboard; },
  go, startHunt, finishHunt,
};

function go(name, params = {}) {
  if (current?.unmount) current.unmount();
  current = SCREENS[name] || heute;
  root.innerHTML = '';
  root.dataset.screen = name;
  window.scrollTo(0, 0);
  current.mount(root, ctx, params);
}

// Baut aus dem Plan der Abstandswiederholung die Aufgaben und startet den Jagd-Automaten.
function startHunt() {
  const { specs, words } = store.planHunt();
  if (!specs.length) { go('heute'); return; }
  const all = store.allWords();
  const taskFactory = (spec) => buildTask(spec, poolFor(spec.word, all), Math.random);
  const bossSpecs = (results) => srs.pickBoss(words, { results, rec: store.record, settings: store.state().settings });
  const perks = biester.perksFor(store.state().begleiter.map((id) => biester.biestFor(wordById(all, id), store.record(id), store.state().biester[id], listColor(id))));
  ctx.hunt = createHunt({ specs, bossSpecs, taskFactory, perks, settings: store.state().settings });
  ctx.huntStartedAt = Date.now();
  go('jagd');
}

// Ergebnis einer Jagd in den Spielstand schreiben. Eier schlüpfen zu Wörtern dieser Jagd.
function finishHunt(summary) {
  const minutes = (Date.now() - ctx.huntStartedAt) / 60000;
  const ids = Object.keys(summary.results);
  for (const id of ids) store.applyResult(id, summary.results[id].first);
  store.addCoins(summary.coins);
  // Nur gefangene Wörter (Box ≥ 1) können ein Biest bekommen.
  const catchable = ids.filter((id) => (store.record(id)?.box ?? 0) >= 1);
  const hatched = summary.eggs.map((rarity) => store.hatch(rarity, catchable, biester.randomSpecies));
  store.finishHunt(summary, minutes);
  ctx.hunt = null;
  return hatched;
}

const wordById = (all, id) => all.find((w) => w.id === id) || null;
const listColor = (id) => store.state().lists.find((l) => l.id === id.split('|')[0])?.color || '#6fcf6a';

// Tastatur erkannt → am Rechner darf ab Box 2 getippt werden (Bonus), am Tablet nie Pflicht.
window.addEventListener('keydown', (e) => { if (e.key.length === 1) hasKeyboard = true; }, { passive: true });

// Einstellungen auf das Dokument spiegeln (Ruhe-Modus, Lesehilfe).
export function applySettings() {
  const s = store.state().settings;
  document.documentElement.classList.toggle('ruhe', !!s.ruhe || matchMedia('(prefers-reduced-motion: reduce)').matches);
  document.documentElement.classList.toggle('lesehilfe', !!s.lesehilfe);
  audio.setEnabled(!!s.ton);
}
ctx.applySettings = applySettings;

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').catch(() => { /* offline-Start dann eben nicht */ });
}

applySettings();
go('heute');
