import test from 'node:test';
import assert from 'node:assert/strict';
import { GAP } from '../js/core/parser.js';
import { poolFor, buildTask, syllabify, similarWords, scrambleLetters } from '../js/core/tasks.js';
import { seeded, words } from './helpers.mjs';

const W = (en, de, list = 'a', s) => ({
  id: `${list}|${en}`,
  list,
  en,
  de,
  icon: null,
  s: s || `I like the ${en}.`,
});

const explore = W('explore', 'erforschen', 'a', 'We want to explore the old castle.');
const pool = [
  explore,
  W('explode', 'explodieren'),
  W('export', 'ausführen'),
  W('ignore', 'ignorieren'),
  W('window', 'das Fenster'),
  W('garden', 'der Garten'),
  W('sister', 'die Schwester'),
  W('tiger', 'der Tiger'),
  W('paper', 'das Papier'),
  W('happy', 'fröhlich'),
];

const specFor = (type, word = explore, extra = {}) => ({
  wordId: word.id,
  word,
  box: extra.box ?? 2,
  type,
  dir: extra.dir ?? 'de→en',
  occ: extra.occ ?? 0,
});

function assertBase(t, spec) {
  assert.equal(t.type, spec.type);
  assert.equal(t.wordId, spec.wordId);
  assert.equal(t.answer, spec.word.en);
  assert.equal(t.word, spec.word);
  assert.equal(t.box, spec.box);
  assert.equal(t.dir, spec.dir || 'de→en');
  assert.equal(t.id, `${spec.wordId}#${spec.type}#${spec.occ ?? 0}`);
}

function assertOptions(t, n, correctText) {
  assert.equal(t.options.length, n);
  assert.equal(t.options.filter((o) => o.correct).length, 1);
  assert.equal(t.options.find((o) => o.correct).text, correctText);
  const texts = t.options.map((o) => o.text);
  assert.equal(new Set(texts).size, texts.length, 'keine doppelten Optionen');
}

function assertBuild(t, en) {
  assert.ok(Array.isArray(t.target) && t.target.length >= 1);
  assert.equal(t.target.join(''), en);
  const remaining = t.blocks.map((b) => b.text);
  for (const x of t.target) {
    const i = remaining.indexOf(x);
    assert.ok(i >= 0, `Block für „${x}“ fehlt`);
    remaining.splice(i, 1);
  }
  const ziel = new Set(t.target);
  for (const d of remaining) {
    assert.ok(!ziel.has(d), `Ablenker „${d}“ gleicht einem Zielblock`);
  }
  const ids = t.blocks.map((b) => b.id);
  assert.equal(new Set(ids).size, ids.length, 'Block-ids müssen eindeutig sein');
}

test('poolFor: eigene Liste, unter 6 Wörtern um alle anderen ergänzt', () => {
  const small = [...words('a', ['one', 'two', 'three']), ...words('b', ['four', 'five'])];
  const p = poolFor(small[0], small);
  assert.equal(p.length, 5);
  assert.ok(p.some((w) => w.list === 'b'));

  const big = words('a', ['a', 'b', 'c', 'd', 'e', 'f', 'g']);
  const p2 = poolFor(big[0], [...big, ...words('b', ['x'])]);
  assert.equal(p2.length, 7);
  assert.ok(p2.every((w) => w.list === 'a'));
});

test('similarWords: nie das Wort selbst, nie doppelt, nie gleiche Bedeutung, ähnliche zuerst', () => {
  const word = W('house', 'das Haus');
  const others = [
    word,
    W('horse', 'das Pferd'),
    W('mouse', 'die Maus'),
    W('home', 'das Heim'),
    W('playing', 'spielen'),
    W('residence', 'das Haus'),
    W('happy', 'fröhlich'),
  ];
  const got = similarWords(word, others, 5, seeded(4));
  const ens = got.map((w) => w.en);
  assert.ok(!ens.includes('house'));
  assert.equal(new Set(ens).size, ens.length);
  assert.ok(!got.some((w) => w.de === 'das Haus'));
  const iHorse = ens.indexOf('horse');
  const iHome = ens.indexOf('home');
  const iPlay = ens.indexOf('playing');
  assert.ok(iHorse >= 0 && iHome >= 0);
  assert.ok(iPlay < 0 || (iHorse < iPlay && iHome < iPlay), 'ähnliche vor Rest');
});

test('syllabify-Tabelle: Ausnahmen, Regeln, kurze Wörter, Mehrwort', () => {
  const table = {
    people: ['peo', 'ple'],
    every: ['ev', 'ery'],
    little: ['lit', 'tle'],
    favourite: ['fa', 'vour', 'ite'],
    interesting: ['in', 'ter', 'est', 'ing'],
    beautiful: ['beau', 'ti', 'ful'],
    because: ['be', 'cause'],
    through: ['through'],
    knowledge: ['knowl', 'edge'],
    orange: ['or', 'ange'],
    window: ['win', 'dow'],
    sister: ['sis', 'ter'],
    tiger: ['ti', 'ger'],
    paper: ['pa', 'per'],
    table: ['ta', 'ble'],
    explore: ['ex', 'plore'],
    playing: ['play', 'ing'],
    slowly: ['slow', 'ly'],
    teacher: ['teach', 'er'],
    fishing: ['fish', 'ing'],
    about: ['a', 'bout'],
    event: ['e', 'vent'],
    cat: ['cat'],
    tree: ['tree'],
    book: ['book'],
    "don't": ["don't"],
    'ice cream': ['ice', ' cream'],
    happy: ['hap', 'py'],
    water: ['wa', 'ter'],
    apple: ['ap', 'ple'],
    morning: ['morn', 'ing'],
    darkness: ['dark', 'ness'],
    movement: ['move', 'ment'],
    enough: ['e', 'nough'],
    question: ['ques', 'tion'],
    children: ['chil', 'dren'],
  };
  const keys = Object.keys(table);
  assert.ok(keys.length >= 30, `mindestens 30 Wörter, sind ${keys.length}`);
  for (const [en, want] of Object.entries(table)) {
    assert.deepEqual(syllabify(en), want, en);
    assert.equal(want.join(''), en, `Silben von ${en} ergeben das Wort`);
    want.forEach((s, i) => {
      const n = (s.match(/[a-z]/gi) || []).length;
      if (i === 0) return;
      assert.ok(n >= 2, `${en}: Silbe „${s}“ zu kurz`);
    });
  }
});

test('scrambleLetters: Ziel ergibt das Wort, Ablenker nicht im Wort, eindeutige ids', () => {
  const { blocks, target } = scrambleLetters('explore', seeded(1), 2);
  assert.equal(target.join(''), 'explore');
  assert.equal(target.filter((ch) => ch === 'e').length, 2);
  assert.equal(blocks.length, target.length + 2);
  const extra = [];
  const rest = blocks.map((b) => b.text);
  for (const x of target) rest.splice(rest.indexOf(x), 1);
  extra.push(...rest);
  for (const ch of extra) {
    assert.equal(ch.length, 1);
    assert.ok(!'explore'.includes(ch), `Ablenker ${ch} steckt im Wort`);
  }
  assert.equal(new Set(blocks.map((b) => b.id)).size, blocks.length);
  const again = scrambleLetters('explore', seeded(1), 2);
  assert.deepEqual(again, scrambleLetters('explore', seeded(1), 2));
});

test('kennenlernen: Karte ohne Antwortfeld', () => {
  const spec = specFor('kennenlernen', explore, { box: 0 });
  const t = buildTask(spec, pool, seeded(1));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'karte');
  assert.equal(t.prompt.text, 'explore');
  assert.equal(t.prompt.de, 'erforschen');
  assert.equal(t.prompt.sentence, explore.s);
  assert.equal(t.options, undefined);
  assert.equal(t.blocks, undefined);
});

test('wahl de→en: vier englische Optionen, genau eine richtig', () => {
  const spec = specFor('wahl', explore, { dir: 'de→en' });
  const t = buildTask(spec, pool, seeded(2));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'de');
  assert.equal(t.prompt.text, 'erforschen');
  assertOptions(t, 4, 'explore');
  assert.ok(t.options.every((o) => o.text !== 'erforschen'), 'Optionen sind englische Wörter');
});

test('wahl en→de: vier deutsche Bedeutungen', () => {
  const spec = specFor('wahl', explore, { dir: 'en→de' });
  const t = buildTask(spec, pool, seeded(3));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'en');
  assert.equal(t.prompt.text, 'explore');
  assertOptions(t, 4, 'erforschen');
});

test('hoeren-wahl: Ton-Prompt, vier deutsche Optionen', () => {
  const spec = specFor('hoeren-wahl', explore);
  const t = buildTask(spec, pool, seeded(4));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'audio');
  assert.equal(t.prompt.text, 'explore');
  assertOptions(t, 4, 'erforschen');
});

test('silben: Zielsilben plus 2 Ablenker, keine zweite Lösung', () => {
  const spec = specFor('silben');
  const t = buildTask(spec, pool, seeded(5));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'de');
  assert.equal(t.prompt.sentence, `We want to ${GAP} the old castle.`);
  assert.deepEqual(t.target, ['ex', 'plore']);
  assert.equal(t.blocks.length, 4);
  assertBuild(t, 'explore');
});

test('buchstaben: ab 6 Buchstaben zwei Ablenker, Mehrfach-Buchstaben mit eigener id', () => {
  const spec = specFor('buchstaben');
  const t = buildTask(spec, pool, seeded(6));
  assertBase(t, spec);
  assert.equal(t.target.join(''), 'explore');
  assert.equal(t.target.length, 7);
  assert.equal(t.blocks.length, 9);
  assertBuild(t, 'explore');
  const eBlocks = t.blocks.filter((b) => b.text === 'e');
  assert.equal(eBlocks.length, 2);
  assert.notEqual(eBlocks[0].id, eBlocks[1].id);

  const short = W('table', 'der Tisch');
  const t2 = buildTask(specFor('buchstaben', short), pool, seeded(6));
  assert.equal(t2.target.length, 5);
  assert.equal(t2.blocks.length, 5, 'unter 6 Buchstaben keine Ablenker');
});

test('luecke-wahl: Satz mit Lücke, drei englische Optionen', () => {
  const spec = specFor('luecke-wahl');
  const t = buildTask(spec, pool, seeded(7));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'satz');
  assert.ok(t.prompt.sentence.includes(GAP));
  assertOptions(t, 3, 'explore');
});

test('luecke-bauen und hoeren-bauen: Blöcke wie buchstaben', () => {
  const a = buildTask(specFor('luecke-bauen'), pool, seeded(8));
  assertBase(a, specFor('luecke-bauen'));
  assert.equal(a.prompt.kind, 'satz');
  assertBuild(a, 'explore');

  const b = buildTask(specFor('hoeren-bauen'), pool, seeded(8));
  assertBase(b, specFor('hoeren-bauen'));
  assert.equal(b.prompt.kind, 'audio');
  assert.equal(b.prompt.de, 'erforschen');
  assertBuild(b, 'explore');
  assert.deepEqual(a.target, b.target);
});

test('nachbau: wie silben, nur ein Ablenker', () => {
  const spec = specFor('nachbau');
  const t = buildTask(spec, pool, seeded(9));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'de');
  assert.equal(t.blocks.length, t.target.length + 1);
  assertBuild(t, 'explore');
});

test('blitz: drei wahl-Items, drei Wörter, Richtung abwechselnd', () => {
  const spec = specFor('blitz', explore, { box: 4, dir: 'de→en' });
  const t = buildTask(spec, pool, seeded(10));
  assertBase(t, spec);
  assert.equal(t.prompt.kind, 'blitz');
  assert.equal(t.items.length, 3);
  const ens = t.items.map((it) => it.word.en);
  assert.equal(ens[0], 'explore');
  assert.equal(new Set(ens).size, 3);
  assert.deepEqual(t.items.map((it) => it.dir), ['de→en', 'en→de', 'de→en']);
  t.items.forEach((it) => {
    assert.equal(it.type, 'wahl');
    assert.equal(it.options.filter((o) => o.correct).length, 1);
    assert.equal(it.options.length, 4);
  });
});

test('blitz bei Pool unter 3 Wörtern: trotzdem drei Items aus der Fallback-Liste', () => {
  const fox = W('fox', 'Fuchs');
  const spec = specFor('blitz', fox, { box: 5, dir: 'en→de' });
  const t = buildTask(spec, [fox], seeded(11));
  assert.equal(t.items.length, 3);
  assert.equal(new Set(t.items.map((it) => it.word.en)).size, 3);
  assert.deepEqual(t.items.map((it) => it.dir), ['en→de', 'de→en', 'en→de']);
});

test('Mehrwort und Apostroph: Blöcke nie nur Leerzeichen, target ergibt en', () => {
  const ice = W('ice cream', 'das Eis');
  const dont = W("don't", 'nicht');
  const t1 = buildTask(specFor('silben', ice), [ice, ...pool], seeded(12));
  assertBuild(t1, 'ice cream');
  assert.ok(t1.blocks.every((b) => b.text.trim().length > 0));
  const t2 = buildTask(specFor('buchstaben', ice), [ice, ...pool], seeded(13));
  assertBuild(t2, 'ice cream');
  assert.ok(t2.target.some((u) => u.startsWith(' ')));
  const t3 = buildTask(specFor('buchstaben', dont), [dont, ...pool], seeded(14));
  assertBuild(t3, "don't");
  assert.equal(t3.blocks.length, t3.target.length, "don't hat 4 Buchstaben, keine Ablenker");
});

test('buildTask ist deterministisch mit seeded', () => {
  const spec = specFor('silben');
  assert.deepEqual(buildTask(spec, pool, seeded(21)), buildTask(spec, pool, seeded(21)));
  const w = specFor('wahl', explore, { dir: 'en→de' });
  assert.deepEqual(buildTask(w, pool, seeded(22)), buildTask(w, pool, seeded(22)));
  const b = specFor('blitz', explore, { box: 4 });
  assert.deepEqual(buildTask(b, pool, seeded(23)), buildTask(b, pool, seeded(23)));
});
