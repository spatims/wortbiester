import test from 'node:test';
import assert from 'node:assert/strict';
import { createHunt, MAX_SHIELDS, coinsFor, multFor, rollRarity } from '../js/core/hunt.js';
import { seeded, words, stubFactory } from './helpers.mjs';

const specsFor = (n, box = 2) => words('a', Array.from({ length: n }, (_, i) => 'w' + i))
  .map((w, i) => ({ wordId: w.id, word: w, box, type: 'silben', dir: 'de→en', occ: 0 }));

const types = (events) => events.map((e) => e.type);

test('Kombo-Multiplikator und Münzen', () => {
  assert.equal(multFor(0), 1); assert.equal(multFor(3), 2); assert.equal(multFor(6), 3);
  assert.equal(coinsFor(0, 1), 10);
  assert.equal(coinsFor(2, 2), 30);
  assert.equal(coinsFor(4, 3, { stake: true }), 90);
  assert.equal(coinsFor(1, 1, { keyboard: true }), 15);
});

test('Seltenheit: Boss-Ei ist mindestens selten', () => {
  const rng = seeded(5);
  for (let i = 0; i < 50; i++) assert.notEqual(rollRarity(rng, 'selten'), 'gewoehnlich');
});

test('eine fehlerfreie Jagd: Lagerfeuer nach 4, 8, 12, dann Boss, dann Ergebnis mit gesicherter Beute', () => {
  const hunt = createHunt({ specs: specsFor(16), bossSpecs: () => specsFor(3, 3), taskFactory: stubFactory, rng: seeded(1) });
  let ev = hunt.start();
  assert.equal(ev[0].type, 'aufgabe');
  let feuer = 0;
  for (let i = 0; i < 16; i++) {
    assert.equal(hunt.state().phase, 'aufgabe');
    ev = hunt.answer({ correct: true });
    if (types(ev).includes('lagerfeuer')) {
      feuer++;
      assert.equal(hunt.state().phase, 'lagerfeuer');
      ev = hunt.campfire(feuer === 2 ? 'weiter' : 'sichern');
    }
  }
  assert.equal(feuer, 3);
  assert.equal(hunt.state().phase, 'boss');
  assert.ok(hunt.state().stake);
  for (let i = 0; i < 3; i++) ev = hunt.answer({ correct: true });
  assert.ok(types(ev).includes('boss-besiegt'));
  assert.ok(types(ev).includes('ergebnis'));
  const s = hunt.summary();
  assert.equal(s.richtig, 19);
  assert.equal(s.fehler, 0);
  assert.equal(s.bossBesiegt, true);
  assert.ok(s.coins > 0);
  assert.ok(s.eggs.length >= 1, 'mindestens das Boss-Ei');
  assert.equal(hunt.state().bag.coins, 0, 'nichts bleibt ungesichert');
  assert.equal(s.komboRekord, 19);
  assert.ok(Object.values(s.results).every((r) => r.first === true));
});

test('Fehler: Schild weg, Kombo weg, Nachbau, Wort kommt leichter wieder und zählt nicht mehr als erster Versuch', () => {
  const hunt = createHunt({ specs: specsFor(8, 3), bossSpecs: () => [], taskFactory: stubFactory, rng: seeded(2) });
  hunt.start();
  hunt.answer({ correct: true });
  hunt.answer({ correct: true });
  assert.equal(hunt.state().combo, 2);
  const failedId = hunt.state().task.wordId;
  let ev = hunt.answer({ correct: false });
  assert.deepEqual(types(ev), ['falsch', 'nachbau-start']);
  const st = hunt.state();
  assert.equal(st.shields, MAX_SHIELDS - 1);
  assert.equal(st.combo, 0);
  assert.equal(st.phase, 'nachbau');
  assert.equal(st.task.type, 'nachbau');
  assert.equal(st.task.wordId, failedId);
  ev = hunt.finishNachbau();
  assert.equal(ev[0].type, 'aufgabe');
  // Nach drei weiteren Aufgaben kommt das Wort wieder, als Wahl (eine Stufe leichter als Box 3 → silben)
  const seen = [];
  for (let i = 0; i < 6 && hunt.state().task; i++) {
    seen.push(hunt.state().task);
    if (hunt.state().task.wordId === failedId) break;
    const e = hunt.answer({ correct: true });
    if (types(e).includes('lagerfeuer')) hunt.campfire('sichern');
  }
  const retry = seen[seen.length - 1];
  assert.equal(retry.wordId, failedId);
  assert.equal(retry.type, 'silben');
  hunt.answer({ correct: true });
  assert.equal(hunt.state().results[failedId].first, false, 'erster Versuch bleibt falsch');
});

test('drei Richtige in Folge geben einen Schild zurück', () => {
  const hunt = createHunt({ specs: specsFor(8), bossSpecs: () => [], taskFactory: stubFactory, rng: seeded(3) });
  hunt.start();
  hunt.answer({ correct: false }); hunt.finishNachbau();
  assert.equal(hunt.state().shields, 2);
  let got = false;
  for (let i = 0; i < 3; i++) {
    const ev = hunt.answer({ correct: true });
    if (types(ev).includes('schild-zurueck')) got = true;
    if (types(ev).includes('lagerfeuer')) hunt.campfire('sichern');
  }
  assert.ok(got);
  assert.equal(hunt.state().shields, 3);
});

test('ohne Schilde bricht die Jagd ab: ungesicherte Beute weg, gesicherte bleibt, Lernstand bleibt', () => {
  const hunt = createHunt({ specs: specsFor(16), bossSpecs: () => [], taskFactory: stubFactory, rng: seeded(4) });
  hunt.start();
  for (let i = 0; i < 4; i++) {
    const ev = hunt.answer({ correct: true });
    if (types(ev).includes('lagerfeuer')) hunt.campfire('sichern');
  }
  const safeCoins = hunt.state().safe.coins;
  assert.ok(safeCoins > 0);
  hunt.answer({ correct: true });
  assert.ok(hunt.state().bag.coins > 0, 'ungesicherte Beute vorhanden');
  let ev;
  for (let i = 0; i < 3; i++) { ev = hunt.answer({ correct: false }); if (hunt.state().phase === 'nachbau') hunt.finishNachbau(); }
  assert.ok(types(ev).includes('abbruch'));
  assert.ok(types(ev).includes('ergebnis'));
  const s = hunt.summary();
  assert.equal(s.abgebrochen, true);
  assert.equal(s.coins, safeCoins);
  assert.equal(hunt.state().bag.coins, 0);
  assert.ok(Object.values(s.results).some((r) => r.first === false));
  assert.ok(Object.values(s.results).some((r) => r.first === true));
});

test('Kennenlernen wird weggetippt, zählt nicht und gibt keine Münzen', () => {
  const w = words('a', ['new'])[0];
  const specs = [
    { wordId: w.id, word: w, box: 0, type: 'kennenlernen', dir: 'de→en', occ: 0 },
    { wordId: w.id, word: w, box: 0, type: 'wahl', dir: 'de→en', occ: 1 },
  ];
  const hunt = createHunt({ specs, bossSpecs: () => [], taskFactory: stubFactory, rng: seeded(1) });
  hunt.start();
  assert.equal(hunt.state().task.type, 'kennenlernen');
  const ev = hunt.answer({ correct: true });   // UI darf auch answer rufen; Automat behandelt es wie Weitertippen
  assert.equal(ev[0].type, 'aufgabe');
  assert.equal(hunt.state().bag.coins, 0);
  assert.equal(hunt.state().task.type, 'wahl');
  hunt.answer({ correct: true });
  assert.equal(hunt.summary().results[w.id].first, true);
});

test('Hilfe benutzt: Aufgabe zählt nicht als erster Versuch, Münzen gibt es trotzdem', () => {
  const hunt = createHunt({ specs: specsFor(4), bossSpecs: () => [], taskFactory: stubFactory, rng: seeded(1) });
  hunt.start();
  const id = hunt.state().task.wordId;
  hunt.answer({ correct: true, usedHint: true });
  assert.equal(hunt.summary().results[id].first, null);
  assert.equal(hunt.summary().results[id].hinted, true);
  assert.ok(hunt.state().bag.coins > 0);
});

test('Boss: falsche Antwort kostet Schild, Frage kommt wieder; drei Treffer besiegen ihn', () => {
  const hunt = createHunt({ specs: specsFor(2), bossSpecs: () => specsFor(3, 3), taskFactory: stubFactory, rng: seeded(9) });
  hunt.start();
  hunt.answer({ correct: true });
  let ev = hunt.answer({ correct: true });
  assert.ok(types(ev).includes('boss-start'));
  assert.equal(hunt.state().phase, 'boss');
  ev = hunt.answer({ correct: false });
  assert.equal(hunt.state().phase, 'nachbau');
  hunt.finishNachbau();
  assert.equal(hunt.state().phase, 'boss');
  assert.equal(hunt.state().boss.left, 3);
  let besiegt = false;
  for (let i = 0; i < 4 && !besiegt; i++) { ev = hunt.answer({ correct: true }); besiegt = types(ev).includes('boss-besiegt'); }
  assert.ok(besiegt);
  assert.equal(hunt.state().phase, 'ergebnis');
});

test('Route zeigt 16 Aufgaben, 3 Feuer, 1 Boss und die aktuelle Position; Wiederholungen verlängern sie nicht', () => {
  const hunt = createHunt({ specs: specsFor(16), bossSpecs: () => [], taskFactory: stubFactory, rng: seeded(1) });
  hunt.start();
  const r = hunt.state().route;
  assert.equal(r.filter((x) => x.kind === 'aufgabe').length, 16);
  assert.equal(r.filter((x) => x.kind === 'feuer').length, 3);
  assert.equal(r.filter((x) => x.kind === 'boss').length, 1);
  assert.equal(r.findIndex((x) => x.current), 0);
  hunt.answer({ correct: false }); hunt.finishNachbau();
  hunt.answer({ correct: true });
  assert.equal(hunt.state().route.filter((x) => x.done).length, 2);
});
