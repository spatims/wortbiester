// Abstandswiederholung und Auswahl einer Jagd. Reine Logik, kein DOM, kein Speicher.
// Die Boxen 0–5 und ihre Abstände in Minuten: neu/5 min, 1 h, 1 Tag, 3 Tage, 7 Tage, 21 Tage.

export const INTERVALS = [5, 60, 1440, 4320, 10080, 30240];
export const MAX_BOX = 5;
export const ZAHM_BOX = 4;          // ab hier gilt ein Wort als gekonnt

export const wordId = (listId, en) => `${listId}|${en}`;

export function freshRecord(now = Date.now()) {
  return { box: 0, due: now, seen: 0, ok: 0, fails: 0 };
}

// Ergebnis des ersten Versuchs einer Jagd. Gibt den neuen Datensatz zurück, ändert nichts.
export function applyResult(record, first, now = Date.now()) {
  const r = { ...(record || freshRecord(now)) };
  r.seen++;
  if (first) {
    r.ok++;
    r.box = Math.min(MAX_BOX, r.box + 1);
    r.due = now + INTERVALS[r.box] * 60000;
  } else {
    r.fails++;
    r.box = Math.max(0, r.box - 1);
    r.due = now + INTERVALS[0] * 60000;
  }
  return r;
}

export const isDue = (record, now = Date.now()) => !record || record.due <= now;
export const isNew = (record) => !record || record.seen === 0;

// Aufgabentyp je Box. occ = wievielte Aufgabe zu diesem Wort in dieser Jagd.
// Neue Wörter: Kennenlernen, dann Wahl. Danach gewürfelt aus der Menge der Box.
export function typeFor(box, occ, rng = Math.random, { blitz = true } = {}) {
  if (box <= 0) return occ === 0 ? 'kennenlernen' : 'wahl';
  const sets = {
    1: ['wahl', 'hoeren-wahl', 'silben'],
    2: ['silben', 'buchstaben', 'luecke-wahl'],
    3: ['buchstaben', 'luecke-bauen', 'hoeren-bauen'],
    4: ['luecke-bauen', 'hoeren-bauen', 'blitz'],
    5: ['luecke-bauen', 'hoeren-bauen', 'blitz'],
  };
  const set = sets[Math.min(5, box)].filter((t) => blitz || t !== 'blitz');
  // Zweite Aufgabe zum selben Wort: immer eine andere als die erste, deshalb Versatz.
  return set[(Math.floor(rng() * set.length) + occ) % set.length];
}

// Richtung der Wahl-Aufgabe: neue und schwache Wörter DE→EN, sonst abwechselnd.
export function dirFor(box, occ) {
  if (box <= 1) return occ % 2 === 0 ? 'de→en' : 'en→de';
  return occ % 2 === 0 ? 'en→de' : 'de→en';
}

// Nach einem Fehler kommt das Wort in derselben Jagd noch einmal, eine Stufe leichter.
export function retryType(box) {
  return box >= 3 ? 'silben' : 'wahl';
}

const sortByDue = (rec) => (a, b) => (rec(a)?.due ?? 0) - (rec(b)?.due ?? 0);

// Wählt die Wörter einer Jagd und baut Spezifikationen.
//   cur:    Wörter der aktiven Liste [{ id, list, en, de, icon, s }]
//   older:  Wörter aller anderen Listen
//   rec:    (word) => Datensatz oder null
//   target: Anzahl regulärer Aufgaben (12/16/20)
// Gibt { specs, words } zurück; specs = [{ wordId, word, box, type, dir, occ }].
export function pickHunt({ cur, older = [], rec, target = 16, now = Date.now(), rng = Math.random, settings = {} }) {
  if (!cur.length) return { specs: [], words: [] };
  const box = (w) => rec(w)?.box ?? 0;

  // Ältere Wörter: nur schon gesehene; fällige zuerst, sonst die schwächsten. Etwa 30 % der Jagd.
  const oldDue = older.filter((w) => rec(w) && !isNew(rec(w)) && isDue(rec(w), now)).sort(sortByDue(rec));
  const oldRest = older.filter((w) => rec(w) && !isNew(rec(w)) && !oldDue.includes(w)).sort((a, b) => box(a) - box(b) || rng() - 0.5);
  const nOld = target >= 8 ? Math.min(Math.round(target * 0.3), oldDue.length + oldRest.length) : 0;
  const oldPicked = [...oldDue, ...oldRest].slice(0, nOld);
  const nCur = target - nOld;

  const dueCur = cur.filter((w) => rec(w) && !isNew(rec(w)) && isDue(rec(w), now)).sort(sortByDue(rec));
  const newCur = cur.filter((w) => isNew(rec(w)));
  const laterCur = cur.filter((w) => rec(w) && !isNew(rec(w)) && !isDue(rec(w), now)).sort(sortByDue(rec));

  // Neue Wörter brauchen zwei Aufgaben (Kennenlernen + Wahl), höchstens 4 je Jagd.
  const nNew = Math.min(4, newCur.length, Math.floor(nCur / 3));
  const newSel = newCur.slice(0, nNew);
  const slotsForDue = nCur - nNew * 2;

  // Fällige bekommen zwei Aufgaben, wenn Platz ist, sonst eine.
  const chosen = [];
  for (const w of dueCur) { if (chosen.length >= slotsForDue) break; chosen.push(w); }
  // Auffüllen mit noch nicht fälligen Wörtern der Liste (sicherste zuletzt).
  for (const w of laterCur) { if (chosen.length >= Math.min(slotsForDue, cur.length - nNew)) break; if (!chosen.includes(w)) chosen.push(w); }

  const specsCur = [];
  const occ = {};
  const push = (w, type, overrideBox) => {
    const n = occ[w.id] || 0;
    occ[w.id] = n + 1;
    const b = overrideBox ?? box(w);
    specsCur.push({ wordId: w.id, word: w, box: b, type: type || typeFor(b, n, rng, settings), dir: dirFor(b, n), occ: n });
  };
  newSel.forEach((w) => { push(w, 'kennenlernen', 0); push(w, 'wahl', 0); });
  // Zweite Runde über die gewählten Wörter, bis nCur erreicht ist (jedes Wort höchstens zweimal).
  let guard = 0;
  while (specsCur.length < nCur && chosen.length && guard++ < 3) {
    for (const w of chosen) {
      if (specsCur.length >= nCur) break;
      if ((occ[w.id] || 0) >= 2) continue;
      push(w);
    }
  }

  // Kennenlernen direkt vor der Wahl lassen, den Rest mischen.
  const pairs = [];
  for (let i = 0; i < specsCur.length; i++) {
    if (specsCur[i].type === 'kennenlernen') { pairs.push([specsCur[i], specsCur[i + 1]]); i++; } else pairs.push([specsCur[i]]);
  }
  shuffle(pairs, rng);
  // Gleiches Wort nie direkt hintereinander (soweit möglich).
  const ordered = spread(pairs, (p) => p[0].wordId).flat();

  // Ältere Wörter gleichmäßig einstreuen, nicht als erste und nicht als letzte Aufgabe.
  const specs = [...ordered];
  oldPicked.forEach((w, i) => {
    let pos = Math.min(specs.length - 1, Math.max(1, Math.floor(((i + 1) * specs.length) / (oldPicked.length + 1))));
    if (specs[pos - 1]?.type === 'kennenlernen') pos++;   // Kennenlernen und seine Wahl nicht trennen
    specs.splice(pos, 0, { wordId: w.id, word: w, box: box(w), type: typeFor(box(w), 0, rng, settings), dir: dirFor(box(w), 0), occ: 0 });
  });

  const words = [...new Map(specs.map((s) => [s.wordId, s.word])).values()];
  return { specs, words };
}

// Boss: die drei Wörter mit den meisten Fehlern in dieser Jagd, sonst die schwächsten.
export function pickBoss(words, { results = {}, rec, rng = Math.random, settings = {} }) {
  const scored = words.map((w) => ({ w, fails: results[w.id]?.first === false ? 1 : 0, box: rec(w)?.box ?? 0 }));
  scored.sort((a, b) => b.fails - a.fails || a.box - b.box || rng() - 0.5);
  return scored.slice(0, 3).map(({ w, box }) => {
    const b = Math.max(1, box);
    const type = typeFor(b, 0, rng, { ...settings, blitz: false });
    return { wordId: w.id, word: w, box: b, type: type === 'kennenlernen' ? 'wahl' : type, dir: dirFor(b, 0), occ: 9 };
  });
}

// Fälligkeitsüberblick für den Startbildschirm.
export function overview(cur, older, rec, now = Date.now()) {
  const due = (ws) => ws.filter((w) => rec(w) && !isNew(rec(w)) && isDue(rec(w), now)).length;
  const neu = cur.filter((w) => isNew(rec(w))).length;
  const next = [...cur, ...older].map((w) => rec(w)?.due).filter((d) => d && d > now).sort((a, b) => a - b)[0] || null;
  return { faellig: due(cur) + due(older), neu, naechste: next };
}

export function shuffle(arr, rng = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Ordnet eine Liste so um, dass gleiche Schlüssel möglichst nicht benachbart sind.
export function spread(items, keyOf) {
  const out = [];
  const rest = [...items];
  while (rest.length) {
    let idx = rest.findIndex((it) => !out.length || keyOf(out[out.length - 1]) !== keyOf(it));
    if (idx < 0) idx = 0;
    out.push(rest.splice(idx, 1)[0]);
  }
  return out;
}
