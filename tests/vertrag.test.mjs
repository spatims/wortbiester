// Abnahme-Test für die Pakete A (tasks.js) und B (biester.js, render/biest.js).
// Prüft die Verträge aus docs/ARCHITEKTUR.md gegen die gelieferten Module und spielt eine ganze Jagd
// mit echten Aufgaben durch. Fehlt ein Modul noch, werden seine Tests übersprungen, nicht rot.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { seeded, MemoryStorage } from './helpers.mjs';
import * as srs from '../js/core/srs.js';
import { createHunt } from '../js/core/hunt.js';
import { parseList } from '../js/core/parser.js';
import * as store from '../js/store.js';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const vorhanden = (p) => existsSync(here(p));
const tasksDa = vorhanden('../js/core/tasks.js');
const biesterDa = vorhanden('../js/core/biester.js');
const renderDa = vorhanden('../js/render/biest.js');

const tasks = tasksDa ? await import('../js/core/tasks.js') : null;
const biester = biesterDa ? await import('../js/core/biester.js') : null;
const render = renderDa ? await import('../js/render/biest.js') : null;

const TYPES = ['kennenlernen', 'wahl', 'hoeren-wahl', 'silben', 'buchstaben', 'luecke-wahl', 'luecke-bauen', 'hoeren-bauen', 'blitz', 'nachbau'];
const BAU = ['silben', 'buchstaben', 'luecke-bauen', 'hoeren-bauen', 'nachbau'];
const WAHL = ['wahl', 'hoeren-wahl', 'luecke-wahl'];

// Echte Wörter aus den mitgelieferten Listen
function orbitWords() {
  const lists = ['orbit-1-smaragd-nebel', 'orbit-2-magma-guertel', 'orbit-3-tiefen-vakuum'];
  return lists.flatMap((name) => parseList(readFileSync(here(`../listen/${name}.txt`), 'utf8')).words
    .map((w) => ({ ...w, id: `${name}|${w.en}`, list: name })));
}

// Prüft die Form einer Aufgabe nach ARCHITEKTUR „Konkrete Aufgabe“
function pruefeAufgabe(task, spec) {
  assert.ok(task && typeof task.id === 'string' && task.id, `Aufgabe ohne id (${spec.type})`);
  assert.equal(task.type, spec.type);
  assert.equal(task.wordId, spec.wordId);
  assert.equal(task.answer, spec.word.en, `answer muss en sein (${spec.type})`);
  assert.ok(task.prompt && typeof task.prompt.kind === 'string', `prompt.kind fehlt (${spec.type})`);
  if (WAHL.includes(task.type)) {
    const n = task.type === 'luecke-wahl' ? 3 : 4;
    assert.equal(task.options?.length, n, `${task.type}: ${n} Optionen`);
    assert.equal(task.options.filter((o) => o.correct).length, 1, `${task.type}: genau eine richtige Option`);
    assert.equal(new Set(task.options.map((o) => o.text)).size, n, `${task.type}: Optionen doppelt`);
    assert.ok(task.options.every((o) => typeof o.text === 'string' && o.text.trim()), `${task.type}: leere Option`);
  }
  if (BAU.includes(task.type)) {
    assert.ok(Array.isArray(task.target) && task.target.length, `${task.type}: target fehlt`);
    assert.equal(task.target.join('').toLowerCase(), spec.word.en.toLowerCase(), `${task.type}: target ergibt nicht en`);
    assert.ok(Array.isArray(task.blocks) && task.blocks.length >= task.target.length, `${task.type}: zu wenig Blöcke`);
    assert.equal(new Set(task.blocks.map((b) => b.id)).size, task.blocks.length, `${task.type}: Block-ids doppelt`);
    assert.ok(task.blocks.every((b) => b.text !== ' ' && b.text !== ''), `${task.type}: leerer Block`);
    // jeder Zieltext ist (mit Mehrfachen) unter den Blöcken
    const rest = task.blocks.map((b) => b.text);
    for (const t of task.target) {
      const i = rest.indexOf(t);
      assert.ok(i >= 0, `${task.type}: Zielblock „${t}“ fehlt unter den Blöcken`);
      rest.splice(i, 1);
    }
    if (task.type === 'silben' || task.type === 'nachbau') {
      // Ablenker-Silben nie gleich einer Zielsilbe (sonst zweite richtige Lösung)
      assert.ok(rest.every((r) => !task.target.includes(r)), `${task.type}: Ablenker gleich Zielsilbe`);
    }
    if (task.type !== 'hoeren-bauen') assert.ok(task.prompt.text, `${task.type}: prompt.text fehlt`);
  }
  if (task.type === 'blitz') {
    assert.equal(task.items?.length, 3, 'blitz: drei Items');
    assert.equal(new Set(task.items.map((i) => i.wordId)).size, 3, 'blitz: drei verschiedene Wörter');
    for (const it of task.items) pruefeAufgabe(it, { ...spec, type: 'wahl', wordId: it.wordId, word: it.word });
  }
  if (task.type === 'kennenlernen') {
    assert.equal(task.prompt.kind, 'karte');
    assert.ok(task.prompt.sentence && task.prompt.de, 'kennenlernen: Satz und Bedeutung');
  }
  if (task.type.startsWith('luecke')) {
    assert.ok(task.prompt.sentence?.includes('______'), `${task.type}: Lücke im Satz`);
    assert.ok(!new RegExp(`\\b${spec.word.en}\\b`, 'i').test(task.prompt.sentence), `${task.type}: Wort steht noch im Satz`);
  }
}

test('Paket A: jede Aufgabenart baut gültige Aufgaben für alle Orbit-Wörter', { skip: !tasksDa && 'tasks.js fehlt noch' }, () => {
  const all = orbitWords();
  const rng = seeded(7);
  for (const word of all) {
    const pool = tasks.poolFor(word, all);
    assert.ok(pool.length >= 6, 'Pool mindestens 6');
    for (const type of TYPES) for (const dir of ['de→en', 'en→de']) {
      const spec = { wordId: word.id, word, box: 2, type, dir, occ: 0 };
      pruefeAufgabe(tasks.buildTask(spec, pool, rng), spec);
    }
  }
});

test('Paket A: deterministisch mit festem Zufall', { skip: !tasksDa && 'tasks.js fehlt noch' }, () => {
  const all = orbitWords();
  const word = all[0];
  const spec = { wordId: word.id, word, box: 1, type: 'silben', dir: 'de→en', occ: 0 };
  const a = tasks.buildTask(spec, tasks.poolFor(word, all), seeded(3));
  const b = tasks.buildTask(spec, tasks.poolFor(word, all), seeded(3));
  assert.deepEqual(a, b);
});

test('Paket A: similarWords nie das Wort selbst, nie doppelt, nie gleiche Bedeutung', { skip: !tasksDa && 'tasks.js fehlt noch' }, () => {
  const all = orbitWords();
  const extra = { id: 'x|escape2', list: 'x', en: 'flee', de: 'entkommen / fliehen', icon: null, s: 'Flee now.' };
  const pool = [...all, extra];
  for (const w of all) {
    const got = tasks.similarWords(w, pool, 3, seeded(1));
    assert.equal(got.length, 3);
    assert.ok(got.every((g) => g.en !== w.en), 'Wort selbst als Ablenker');
    assert.equal(new Set(got.map((g) => g.en)).size, 3, 'Ablenker doppelt');
    assert.ok(got.every((g) => g.de !== w.de), 'Ablenker mit gleicher Bedeutung');
  }
});

test('Paket A: syllabify-Grundregeln', { skip: !tasksDa && 'tasks.js fehlt noch' }, () => {
  for (const [en, erwartet] of [
    ['explore', ['ex', 'plore']], ['window', ['win', 'dow']], ['tiger', ['ti', 'ger']], ['people', ['peo', 'ple']],
    ['little', ['lit', 'tle']], ['about', ['a', 'bout']], ['ice cream', ['ice', ' cream']],
  ]) assert.deepEqual(tasks.syllabify(en), erwartet, en);
  for (const en of ['melt', 'orbit', 'shield', 'heavy', 'galaxy', 'knowledge', 'dangerous']) {
    const s = tasks.syllabify(en);
    assert.equal(s.join(''), en, `${en}: Silben ergeben das Wort`);
    assert.ok(s.every((x, i) => x.length >= 2 || i === 0), `${en}: Silbe mit einem Buchstaben: ${s.join('·')}`);
  }
  for (const en of ['cat', 'blue', 'is']) assert.deepEqual(tasks.syllabify(en), [en], 'kurze Wörter bleiben eine Silbe');
});

test('Paket A + Kern: ganze Jagd mit echten Aufgaben, inklusive Fehler, Nachbau, Lagerfeuer und Boss', { skip: !tasksDa && 'tasks.js fehlt noch' }, () => {
  store.useStorage(new MemoryStorage());
  store.reset();
  const lists = ['orbit-1-smaragd-nebel', 'orbit-2-magma-guertel', 'orbit-3-tiefen-vakuum'];
  for (const name of lists) store.addList(name, readFileSync(here(`../listen/${name}.txt`), 'utf8'));
  store.setActiveList(store.state().lists[0].id);
  // ältere Listen gelten als schon gesehen
  const now = Date.now();
  for (const w of store.olderWords()) store.applyResult(w.id, true, now - 10 * 86400000);

  const rng = seeded(11);
  const { specs, words } = store.planHunt({ now, rng });
  assert.equal(specs.length, 16);
  const all = store.allWords();
  const taskFactory = (spec) => tasks.buildTask(spec, tasks.poolFor(spec.word, all), rng);
  const hunt = createHunt({
    specs, taskFactory, rng, settings: store.state().settings,
    bossSpecs: (results) => srs.pickBoss(words, { results, rec: store.record, rng, settings: store.state().settings }),
  });
  hunt.start();
  let schritte = 0;
  let fehlerGemacht = false;
  while (hunt.state().phase !== 'ergebnis' && schritte++ < 200) {
    const st = hunt.state();
    if (st.phase === 'lagerfeuer') { hunt.campfire(st.index === 8 ? 'weiter' : 'sichern'); continue; }
    if (st.phase === 'nachbau') { pruefeAufgabe(st.task, { ...st.task, word: st.task.word }); hunt.finishNachbau(); continue; }
    const task = st.task;
    assert.ok(task, `Phase ${st.phase} ohne Aufgabe`);
    pruefeAufgabe(task, { type: task.type, wordId: task.wordId, word: task.word });
    if (task.type === 'kennenlernen') { hunt.skipKennenlernen(); continue; }
    // ein Fehler bei der fünften Aufgabe, danach alles richtig
    if (!fehlerGemacht && st.index === 4 && st.phase === 'aufgabe') {
      fehlerGemacht = true;
      if (BAU.includes(task.type)) { let f = false; for (let i = 0; i < 3 && !f; i++) f = hunt.wrongBlock(); assert.ok(f, 'dritter falscher Block zählt als Fehler'); }
      hunt.answer({ correct: false });
      continue;
    }
    hunt.answer({ correct: true });
  }
  assert.equal(hunt.state().phase, 'ergebnis', 'Jagd endet im Ergebnis');
  const s = hunt.summary();
  assert.ok(s.fehler >= 1 && s.richtig > 10, `Zusammenfassung: ${s.richtig} richtig, ${s.fehler} falsch`);
  for (const [id, r] of Object.entries(s.results)) store.applyResult(id, r.first, now);
  assert.ok(Object.keys(store.state().words).length > 8, 'Lernstand wurde geschrieben');
});

test('Paket B: Arten stabil und verteilt, Stufen, Vorteile 4/4/4', { skip: !biesterDa && 'biester.js fehlt noch' }, () => {
  assert.equal(biester.SPECIES.length, 12);
  assert.equal(biester.STAGE_NAMES.length, 6);
  assert.equal(biester.speciesFor('explore'), biester.speciesFor('explore'));
  const rng = seeded(5);
  const counts = new Array(12).fill(0);
  for (let i = 0; i < 2000; i++) {
    const w = Array.from({ length: 3 + Math.floor(rng() * 8) }, () => 'abcdefghijklmnopqrstuvwxyz'[Math.floor(rng() * 26)]).join('');
    counts[biester.speciesFor(w)]++;
  }
  assert.ok(counts.every((c) => c >= 60), `Verteilung: ${counts.join(' ')}`);
  assert.deepEqual([-1, 0, 1, 2, 3, 4, 5, 9].map(biester.stageFor), [0, 0, 1, 2, 3, 4, 5, 5]);
  const perks = biester.SPECIES.map((sp) => sp.perk);
  for (const p of ['schild', 'kombo-schutz', 'muenzen']) assert.equal(perks.filter((x) => x === p).length, 4, p);
  const word = { id: 'l|explore', list: 'l', en: 'explore', de: 'erforschen', icon: null, s: 'Explore it.' };
  const wild = biester.biestFor(word, null, undefined, '#6fcf6a');
  assert.equal(wild.stage, 0);
  assert.equal(wild.hungrig, false);
  const zahm = biester.biestFor(word, { box: 4, due: Date.now() - 1000 }, { rarity: 'selten' }, '#6fcf6a');
  assert.equal(zahm.stage, 4);
  assert.equal(zahm.hungrig, true);
  assert.equal(zahm.rarity, 'selten');
  assert.ok(['schild', 'kombo-schutz', 'muenzen'].includes(biester.perkFor(zahm)));
  assert.equal(biester.perkFor(wild), null);
  assert.deepEqual(biester.perksFor([wild]), []);
  assert.equal(typeof biester.describePerk('schild'), 'string');
  for (let i = 0; i < 50; i++) assert.ok(['selten', 'episch'].includes(biester.rollRarity(seeded(i), 'selten')));
});

test('Paket B: drawBiest zeichnet alle Arten, Stufen, Seltenheiten und Stimmungen ohne Ausnahme', { skip: !(biesterDa && renderDa) && 'biester.js oder render/biest.js fehlt noch' }, () => {
  // Attrappe eines 2D-Kontexts: jede Methode ist ein Nichtstuer, jede Eigenschaft setzbar
  const calls = { n: 0 };
  const ctx2d = new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : (...args) => { calls.n++; return k === 'measureText' ? { width: 10 } : k === 'createLinearGradient' || k === 'createRadialGradient' ? { addColorStop() {} } : undefined; }),
    set: (t, k, v) => { t[k] = v; return true; },
  });
  const word = { id: 'l|explore', list: 'l', en: 'explore', de: 'erforschen', icon: null, s: 'Explore it.' };
  for (let species = 0; species < 12; species++) for (let stage = 0; stage <= 5; stage++) for (const rarity of ['gewoehnlich', 'selten', 'episch']) {
    const biest = { species, stage, rarity, color: '#6fcf6a', hat: stage > 2 ? 'krone' : null, skin: stage > 3 ? 'punkte' : null, name: 'explore', wordId: word.id };
    for (const mood of ['ruhig', 'jubel', 'ducken', 'hungrig', 'ei']) render.drawBiest(ctx2d, biest, { mood, t: 1.5, size: 96 });
  }
  assert.ok(calls.n > 1000, 'es wurde gezeichnet');
});
