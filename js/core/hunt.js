// Der Jagd-Automat: Schilde, Kombo, Beutel, Lagerfeuer, Boss, Ergebnis. Reine Logik, kein DOM.
// Schreibt keinen Spielstand; app.js wertet die Ereignisse und das Ergebnis aus.

import { retryType } from './srs.js';

export const MAX_SHIELDS = 3;
export const MAX_FALSCHE_BLOECKE = 3;     // so viele falsche Blöcke darf eine Bau-Aufgabe haben, bevor sie als Fehler zählt
export const FEUER_ALLE = 4;              // Lagerfeuer nach 4, 8, 12 Aufgaben
export const EI_CHANCE = 0.15;
export const RETRY_ABSTAND = 3;           // Fehler-Wort kommt nach so vielen Aufgaben wieder
export const BOSS_FRAGEN = 3;

export function rollRarity(rng = Math.random, min = 'gewoehnlich') {
  const x = rng();
  let r = x < 0.05 ? 'episch' : x < 0.30 ? 'selten' : 'gewoehnlich';
  const rank = { gewoehnlich: 0, selten: 1, episch: 2 };
  if (rank[r] < rank[min]) r = min;
  return r;
}

export function multFor(combo) {
  return combo >= 6 ? 3 : combo >= 3 ? 2 : 1;
}

export function coinsFor(box, mult, { stake = false, keyboard = false, perkMuenzen = false } = {}) {
  const stufe = box >= 4 ? 2 : box >= 2 ? 1.5 : 1;
  let c = 10 * mult * stufe;
  if (stake) c *= 1.5;
  if (keyboard) c *= 1.5;
  if (perkMuenzen) c *= 1.1;
  return Math.round(c);
}

// specs: reguläre Aufgaben-Spezifikationen; bossSpecs: () => Spezifikationen (wird am Boss gerufen,
// damit die schwächsten Wörter der Jagd genommen werden können); taskFactory(spec) → Aufgabe.
export function createHunt({ specs, bossSpecs, taskFactory, rng = Math.random, perks = [], settings = {} }) {
  const total = specs.length;
  const queue = specs.map((s) => ({ spec: s, retry: false }));
  const st = {
    phase: 'aufgabe',
    index: 0,
    total,
    shields: MAX_SHIELDS + (perks.includes('schild') ? 1 : 0),
    maxShields: MAX_SHIELDS + (perks.includes('schild') ? 1 : 0),
    combo: 0,
    mult: 1,
    stake: false,
    bag: { coins: 0, eggs: [] },
    safe: { coins: 0, eggs: [] },
    task: null,
    boss: null,
    results: {},
    komboRekord: 0,
    aufgaben: 0,
    richtig: 0,
    fehler: 0,
    bossBesiegt: false,
    abgebrochen: false,
    komboSchutzFrei: perks.includes('kombo-schutz'),
  };
  let current = null;          // { spec, retry }
  let blockFehler = 0;
  let done = 0;                // erledigte reguläre Aufgaben (für Lagerfeuer und Route)
  let bossQueue = [];
  const feuerBei = new Set();
  const feuerErledigt = new Set();
  for (let n = FEUER_ALLE; n < total; n += FEUER_ALLE) feuerBei.add(n);

  const result = (id) => (st.results[id] ||= { first: null, attempts: 0, hinted: false });

  function route() {
    const r = [];
    const pos = Math.min(done, total);   // Wiederholungen nach Fehlern verlängern die Route nicht
    const inTasks = st.phase === 'aufgabe' || st.phase === 'nachbau';
    for (let i = 0; i < total; i++) {
      r.push({ kind: 'aufgabe', done: i < pos, current: inTasks && i === pos });
      if (feuerBei.has(i + 1)) r.push({ kind: 'feuer', done: feuerErledigt.has(i + 1), current: i + 1 === pos && st.phase === 'lagerfeuer' });
    }
    r.push({ kind: 'boss', done: st.bossBesiegt, current: st.phase === 'boss' });
    return r;
  }

  function state() {
    return { ...st, index: done, route: route(), bag: { ...st.bag, eggs: [...st.bag.eggs] }, safe: { ...st.safe, eggs: [...st.safe.eggs] }, results: { ...st.results } };
  }

  function nextTask(events) {
    blockFehler = 0;
    if (st.phase === 'boss') {
      current = bossQueue.shift() || null;
      if (!current) return finish(events);
      st.task = taskFactory(current.spec);
      events.push({ type: 'aufgabe', task: st.task });
      return events;
    }
    if (feuerBei.has(done) && !feuerErledigt.has(done)) {
      feuerErledigt.add(done);  // jedes Lagerfeuer nur einmal
      st.phase = 'lagerfeuer';
      st.task = null;
      current = null;
      events.push({ type: 'lagerfeuer', bag: { ...st.bag, eggs: [...st.bag.eggs] } });
      return events;
    }
    current = queue.shift() || null;
    if (!current) return startBoss(events);
    st.phase = 'aufgabe';
    st.task = taskFactory(current.spec);
    events.push({ type: 'aufgabe', task: st.task });
    return events;
  }

  function startBoss(events) {
    const specs = (bossSpecs ? bossSpecs(st.results) : []).slice(0, BOSS_FRAGEN);
    if (!specs.length) return finish(events);
    st.phase = 'boss';
    st.boss = { total: specs.length, hit: 0, left: specs.length };
    bossQueue = specs.map((s) => ({ spec: s, retry: false, boss: true }));
    events.push({ type: 'boss-start', boss: { ...st.boss } });
    return nextTask(events);
  }

  function finish(events, abgebrochen = false) {
    st.phase = abgebrochen ? 'abbruch' : 'ergebnis';
    st.task = null;
    current = null;
    if (abgebrochen) {
      st.abgebrochen = true;
      events.push({ type: 'abbruch', lost: { coins: st.bag.coins, eggs: [...st.bag.eggs] } });
      st.bag = { coins: 0, eggs: [] };
    } else if (st.bag.coins || st.bag.eggs.length) {
      sichern(events);
    }
    events.push({ type: 'ergebnis', summary: summary() });
    return events;
  }

  function summary() {
    return {
      results: { ...st.results },
      coins: st.safe.coins,
      eggs: [...st.safe.eggs],
      komboRekord: st.komboRekord,
      aufgaben: st.aufgaben,
      richtig: st.richtig,
      fehler: st.fehler,
      abgebrochen: st.abgebrochen,
      bossBesiegt: st.bossBesiegt,
    };
  }

  function sichern(events) {
    const eggs = [...st.bag.eggs];
    const coins = st.bag.coins;
    st.safe.coins += coins;
    st.safe.eggs.push(...eggs);
    st.bag = { coins: 0, eggs: [] };
    events.push({ type: 'gesichert', eggs, coins });
  }

  function markFirst(spec, ok) {
    const r = result(spec.wordId);
    r.attempts++;
    if (r.first === null && spec.type !== 'kennenlernen') r.first = ok;
  }

  // ---- öffentliche Übergänge ----

  function answer({ correct, usedHint = false, keyboard = false } = {}) {
    const events = [];
    if (!current || (st.phase !== 'aufgabe' && st.phase !== 'boss')) return events;
    if (st.task?.type === 'kennenlernen') return skipKennenlernen();
    const spec = current.spec;
    const r = result(spec.wordId);
    if (usedHint) r.hinted = true;
    const countsFirst = !current.retry && !usedHint && !current.boss;
    st.aufgaben++;

    if (correct) {
      st.richtig++;
      if (countsFirst) markFirst(spec, true); else r.attempts++;
      st.combo++;
      st.komboRekord = Math.max(st.komboRekord, st.combo);
      st.mult = multFor(st.combo);
      const coins = coinsFor(spec.box, st.mult, { stake: st.stake, keyboard, perkMuenzen: perks.includes('muenzen') });
      const egg = !current.boss && rng() < EI_CHANCE ? rollRarity(rng) : null;
      st.bag.coins += coins;
      if (egg) st.bag.eggs.push(egg);
      events.push({ type: 'richtig', coins, egg, combo: st.combo, mult: st.mult });
      if (st.combo % 3 === 0 && st.shields < st.maxShields) {
        st.shields++;
        events.push({ type: 'schild-zurueck', shields: st.shields });
      }
      if (current.boss) {
        st.boss.hit++;
        st.boss.left--;
        events.push({ type: 'boss-treffer', boss: { ...st.boss } });
        if (st.boss.left <= 0) {
          st.bossBesiegt = true;
          const bossEgg = rollRarity(rng, 'selten');
          st.bag.eggs.push(bossEgg);
          st.bag.coins += 50;
          events.push({ type: 'boss-besiegt', egg: bossEgg, coins: 50 });
          return finish(events);
        }
      } else {
        done++;
      }
      return nextTask(events);
    }

    // Fehler
    st.fehler++;
    if (countsFirst) markFirst(spec, false); else r.attempts++;
    if (st.komboSchutzFrei && st.combo > 0) { st.komboSchutzFrei = false; } else { st.combo = 0; st.mult = 1; }
    st.shields--;
    events.push({ type: 'falsch', shields: st.shields, word: spec.word });
    if (st.shields <= 0) return finish(events, true);

    // Das Wort kommt in dieser Jagd noch einmal, eine Stufe leichter (nicht beim Boss).
    if (!current.boss && !current.retry) {
      const retrySpec = { ...spec, type: retryType(spec.box), occ: spec.occ + 1 };
      queue.splice(Math.min(RETRY_ABSTAND, queue.length), 0, { spec: retrySpec, retry: true });
    }
    if (!current.boss) done++;
    else { bossQueue.push(current); }  // Boss-Frage bleibt offen, kommt hinten wieder

    // Nachbau: dasselbe Wort einmal aus Silben zusammensetzen, ohne Wertung.
    st.phase = 'nachbau';
    st.task = taskFactory({ ...spec, type: 'nachbau' });
    const wasBoss = !!current.boss;
    current = { ...current, nachbauBoss: wasBoss };
    events.push({ type: 'nachbau-start', task: st.task });
    return events;
  }

  function finishNachbau() {
    const events = [];
    if (st.phase !== 'nachbau') return events;
    st.phase = current?.nachbauBoss ? 'boss' : 'aufgabe';
    return nextTask(events);
  }

  function campfire(choice) {
    const events = [];
    if (st.phase !== 'lagerfeuer') return events;
    if (choice === 'sichern') sichern(events);
    else { st.stake = true; events.push({ type: 'einsatz' }); }
    st.phase = 'aufgabe';
    return nextTask(events);
  }

  function skipKennenlernen() {
    const events = [];
    if (!current || st.task?.type !== 'kennenlernen') return events;
    result(current.spec.wordId);
    done++;
    return nextTask(events);
  }

  // Bau-Aufgaben: falscher Block. Gibt true zurück, wenn die Aufgabe damit als Fehler zählt.
  function wrongBlock() {
    blockFehler++;
    return blockFehler >= MAX_FALSCHE_BLOECKE;
  }

  function start() {
    return nextTask([]);
  }

  return { start, state, answer, finishNachbau, campfire, skipKennenlernen, wrongBlock, summary };
}
