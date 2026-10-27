import test from 'node:test';
import assert from 'node:assert/strict';
import * as srs from '../js/core/srs.js';
import { seeded, words } from './helpers.mjs';

const H = 3600000, D = 86400000;

test('richtig hebt die Box, falsch senkt sie und macht in 5 Minuten fällig', () => {
  const now = 1000000;
  let r = srs.applyResult(null, true, now);
  assert.equal(r.box, 1);
  assert.equal(r.due, now + 60 * 60000);
  r = srs.applyResult(r, true, now);
  assert.equal(r.box, 2);
  r = srs.applyResult(r, false, now);
  assert.equal(r.box, 1);
  assert.equal(r.due, now + 5 * 60000);
  assert.equal(r.fails, 1);
  for (let i = 0; i < 10; i++) r = srs.applyResult(r, true, now);
  assert.equal(r.box, srs.MAX_BOX);
});

test('neue Wörter bekommen Kennenlernen und dann Wahl; höhere Boxen keine Kennenlern-Karte', () => {
  assert.equal(srs.typeFor(0, 0), 'kennenlernen');
  assert.equal(srs.typeFor(0, 1), 'wahl');
  const rng = seeded(3);
  for (let box = 1; box <= 5; box++) {
    for (let k = 0; k < 20; k++) assert.notEqual(srs.typeFor(box, 0, rng), 'kennenlernen');
  }
  assert.ok(!['blitz'].includes(srs.typeFor(5, 0, seeded(1), { blitz: false })));
});

test('eine Jagd mit 16 Aufgaben: 4 neue Wörter doppelt, fällige zuerst, ältere eingestreut, kein Wort direkt doppelt', () => {
  const now = Date.now();
  const cur = words('a', ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']);
  const older = words('b', ['alt1', 'alt2', 'alt3', 'alt4']);
  const recs = {
    'a|one': { box: 2, due: now - H, seen: 3, ok: 2, fails: 1 },
    'a|two': { box: 1, due: now - 2 * H, seen: 1, ok: 1, fails: 0 },
    'a|three': { box: 4, due: now + 3 * D, seen: 6, ok: 6, fails: 0 },
    'b|alt1': { box: 1, due: now - D, seen: 2, ok: 1, fails: 1 },
    'b|alt2': { box: 5, due: now + 10 * D, seen: 9, ok: 9, fails: 0 },
  };
  const rec = (w) => recs[w.id] || null;
  const { specs } = srs.pickHunt({ cur, older, rec, target: 16, now, rng: seeded(7) });
  assert.equal(specs.length, 16);
  const kennen = specs.filter((s) => s.type === 'kennenlernen');
  assert.equal(kennen.length, 4, 'vier neue Wörter');
  kennen.forEach((k) => {
    const i = specs.indexOf(k);
    assert.equal(specs[i + 1].wordId, k.wordId, 'Wahl folgt direkt auf Kennenlernen');
    assert.equal(specs[i + 1].type, 'wahl');
  });
  assert.ok(specs.some((s) => s.wordId === 'a|one'), 'fälliges Wort dabei');
  assert.ok(specs.some((s) => s.wordId === 'a|two'), 'fälliges Wort dabei');
  const oldOnes = specs.filter((s) => s.word.list === 'b');
  assert.equal(oldOnes.length, 2, 'nur schon gesehene ältere Wörter, nie ungelernte aus fremden Listen');
  assert.equal(oldOnes[0].wordId, 'b|alt1', 'fälliges altes Wort zuerst');
  assert.notEqual(specs[0].word.list, 'b');
  for (let i = 1; i < specs.length; i++) {
    if (specs[i - 1].type === 'kennenlernen') continue;
    assert.notEqual(specs[i].wordId, specs[i - 1].wordId, `kein Wort doppelt hintereinander bei ${i}`);
  }
  const perWord = {};
  specs.forEach((s) => { perWord[s.wordId] = (perWord[s.wordId] || 0) + 1; });
  assert.ok(Object.values(perWord).every((n) => n <= 2));
});

test('kleine Liste ohne ältere Wörter füllt sinnvoll auf und bricht nicht', () => {
  const cur = words('a', ['cat', 'dog', 'cow']);
  const { specs } = srs.pickHunt({ cur, older: [], rec: () => null, target: 12, rng: seeded(2) });
  assert.ok(specs.length >= 6 && specs.length <= 12);
  assert.equal(specs.filter((s) => s.type === 'kennenlernen').length, 3);
});

test('Boss nimmt Fehler-Wörter zuerst, dann die schwächsten, nie Kennenlernen', () => {
  const ws = words('a', ['one', 'two', 'three', 'four', 'five']);
  const recs = { 'a|one': { box: 5 }, 'a|two': { box: 0 }, 'a|three': { box: 3 }, 'a|four': { box: 1 } };
  const results = { 'a|one': { first: false }, 'a|three': { first: true } };
  const boss = srs.pickBoss(ws, { results, rec: (w) => recs[w.id] || null, rng: seeded(1) });
  assert.equal(boss.length, 3);
  assert.equal(boss[0].wordId, 'a|one');
  assert.ok(boss.every((b) => b.type !== 'kennenlernen' && b.box >= 1));
});

test('overview zählt fällig und neu und nennt die nächste Fälligkeit', () => {
  const now = 5000000;
  const cur = words('a', ['x', 'y', 'z']);
  const recs = { 'a|x': { box: 1, due: now - 1, seen: 1 }, 'a|y': { box: 2, due: now + 500, seen: 2 } };
  const o = srs.overview(cur, [], (w) => recs[w.id] || null, now);
  assert.deepEqual(o, { faellig: 1, neu: 1, naechste: now + 500 });
});
