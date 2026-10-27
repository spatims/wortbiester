import test from 'node:test';
import assert from 'node:assert/strict';
import { parseList, gapSentence, normalizeSentence, GAP } from '../js/core/parser.js';
import { listFile, readListFile, readBackup, backupFile, uniqueListName } from '../js/sicherung.js';
import { MemoryStorage } from './helpers.mjs';
import * as S from '../js/store.js';

test('Gemini-Format mit Lücke wird gelesen, Satz mit Wort gespeichert, Lücke zur Laufzeit gesetzt', () => {
  const { words, errors } = parseList('explore - erforschen | We want to ______ the old castle.\ntreasure - der Schatz\n# Kommentar\nbad line');
  assert.equal(errors.length, 1);
  assert.equal(words[0].s, 'We want to explore the old castle.');
  assert.equal(gapSentence(words[0].s, 'explore'), `We want to ${GAP} the old castle.`);
  assert.equal(words[1].s, 'Look at the treasure.');
  assert.equal(normalizeSentence('Nothing here.', 'cat'), null);
});

test('Wortbau-Listen und Symbole bleiben lesbar', () => {
  const { words } = parseList('fox - Fuchs - 🦊 | The fox runs.');
  assert.deepEqual(words[0], { en: 'fox', de: 'Fuchs', icon: '🦊', s: 'The fox runs.' });
  const loaded = readListFile('# Wortbau-Liste: Wald\nfox - Fuchs', 'x.txt');
  assert.equal(loaded.name, 'Wald');
  const own = readListFile(listFile('Unit 3', words), 'u.txt');
  assert.equal(own.name, 'Unit 3');
  assert.deepEqual(parseList(own.text).words, words);
});

test('Spielstand: Liste anlegen, Jagd planen, Ergebnis anwenden, Ei schlüpft, Sicherung hin und zurück', () => {
  S.useStorage(new MemoryStorage());
  const r = S.addList('Unit 3', 'explore - erforschen\ntreasure - der Schatz\nbridge - die Brücke\ntorch - die Fackel');
  assert.ok(r.ok);
  assert.equal(S.activeList().name, 'Unit 3');
  assert.equal(S.addList('Unit 3', 'cat - Katze').ok, true);
  assert.equal(S.state().lists[1].name, 'Unit 3 (2)');
  S.setActiveList(r.id);
  const { specs } = S.planHunt({ rng: () => 0.5 });
  assert.ok(specs.length > 0);
  const id = specs[0].wordId;
  S.applyResult(id, true, 1000);
  assert.equal(S.record(id).box, 1);
  S.applyResult(id, null);
  assert.equal(S.record(id).box, 1);
  const h = S.hatch('selten', [id]);
  assert.equal(h.kind, 'fang');
  assert.equal(S.hatch('episch', [id]).kind, 'aufwertung');
  assert.equal(S.hatch('gewoehnlich', [id]).kind, 'zier');
  S.addCoins(120);
  assert.equal(S.spend(200), false);
  assert.equal(S.spend(100), true);
  S.finishHunt({ komboRekord: 7 }, 6, new Date('2026-10-27T10:00:00'));
  S.finishHunt({ komboRekord: 2 }, 6, new Date('2026-10-28T10:00:00'));
  assert.equal(S.state().fackel.reihe, 2);
  assert.equal(S.state().stats.komboRekord, 7);
  const file = backupFile(S.state());
  const data = readBackup(file);
  assert.equal(data.stand.coins, 20);
  assert.throws(() => readBackup('{"app":"wortbau","format":1}'));
  S.restoreState(data.stand);
  assert.equal(S.record(id).box, 1);
  assert.equal(uniqueListName('Unit 3', S.state().lists), 'Unit 3 (3)');
});
