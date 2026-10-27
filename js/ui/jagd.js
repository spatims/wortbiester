// Jagd: Aufgabe, Nachbau, Lagerfeuer, Boss, Ergebnis.
//
// Präzisierungen gegenüber ARCHITEKTUR (dort sonst wörtlich):
// 1. animateBiest wird aus ../render/biest.js geholt. ctx hat nur drawBiest.
//    Fehlt die Schleife, zeichnen wir einmal mit ctx.drawBiest.
// 2. Blitz-Bonus ist die Anzeige „Blitz!“. hunt.answer kennt kein Blitz-Feld;
//    Münzen kommen unverändert vom Automaten. Läuft die Sanduhr (20 s) ab,
//    bleibt die Runde spielbar, das Banner entfällt.
// 3. Pause → „Jagd beenden“: es gibt kein hunt.abort(). Einmal
//    finishHunt({ ...summary(), abgebrochen: true }). summary enthält nur
//    gesicherte Münzen und Eier; der Beutel fällt weg.
// 4. Nachbau wertet nicht. wrongBlock() wird gerufen, true aber ignoriert:
//    answer() ist in der Phase nachbau ein No-Op (hunt.js). Danach finishNachbau().
// 5. answer({ keyboard: true }) wenn das ganze Wort getippt wurde (hunt.js wertet
//    das, die ARCHITEKTUR listet das Feld nicht). Nur ab Box 2 und nur mit Tastatur.
// 6. Ereignis falsch: word ist das Wortobjekt (en, de), nicht nur eine Zeichenkette.
// 7. Kennenlernen liefert prompt.de (tasks.js). hoeren-bauen legt die Bedeutung
//    in prompt.de; sie bleibt zu, bis das Wort steht. prompt.text ist dort das
//    englische Wort und wird nicht gezeigt.
// 8. Stufennamen: biester.STAGE_NAMES, sonst die Liste aus Paket B.
//    Schilde: so viele Symbole wie maxShields (mit Vorteil auch 4).
// 9. finishHunt genau einmal. „Noch eine Jagd“ nur bei faellig + neu > 0.
//    Ist „Zum Lager“ der einzige Knopf, ist er der Primärknopf.
// 10. Boss-Figur: stage wird auf 0 gesetzt und beim Sieg auf 1 (Stimmung ei).
//     animateBiest soll das Objekt je Frame lesen. Zusätzlich ein Ei-Symbol,
//     falls die Zeichnung die Stufe puffert.
import { animateBiest } from '../render/biest.js';
import {
  el, knopf, kopfzeile, modal, muenzflug, muenzenWeg, block, setzeRevier,
} from './teile.js';

const STUFEN = ['wild', 'Ei', 'geschlüpft', 'gewachsen', 'zahm', 'zahm · glänzend'];
const BAU = new Set(['silben', 'buchstaben', 'luecke-bauen', 'hoeren-bauen', 'nachbau']);
const WAHL = new Set(['wahl', 'hoeren-wahl', 'luecke-wahl']);

let lauf = 0;
let aufraeumen = () => {};

export function unmount() {
  lauf += 1;
  const fn = aufraeumen;
  aufraeumen = () => {};
  fn();
}

export function mount(root, ctx) {
  if (!ctx.hunt) { ctx.go('heute'); return; }
  const mein = ++lauf;
  const lebendig = () => mein === lauf;
  const session = baue(root, ctx, lebendig);
  aufraeumen = session.aufraeumen;
  session.starte();
}

function baue(root, ctx, lebendig) {
  const hunt = ctx.hunt;
  const liste = ctx.store.activeList();
  if (liste) setzeRevier(liste.color);

  const timeoutIds = new Set();
  const rafs = new Set();
  const stops = [];
  const queue = [];
  const gesprochen = new Set();
  let controller = new AbortController();
  let warteListe = [];
  let pumpt = false;
  let beendet = false;
  let gesperrt = false;
  let modalZu = null;
  let skipBis = 0;
  let stimmung = 'ruhig';
  let stimmTimer = 0;
  let sandTimer = 0;
  let muenzQuelle = null;
  let onTaste = null;
  let onBuchstabe = null;
  let lueckeEl = null;
  let bedeutungsEl = null;
  let eiHinweis = null;
  let eiOffen = [];
  let verloren = null;
  let kopf = null;
  let bossEcke = null;
  let bossBiest = null;
  let bossStimmung = 'ruhig';
  let segmentLeiste = null;
  let jagd = null;
  let buehne = null;
  let antwort = null;

  function ton(name) { try { ctx.audio?.play?.(name); } catch { /* ohne Ton */ } }
  function spreche(text) { try { if (text) ctx.audio?.speak?.(String(text)); } catch { /* ohne Stimme */ } }
  function ruhe() { return document.documentElement.classList.contains('ruhe'); }
  function klickErlaubt() { return performance.now() >= skipBis; }

  function knopfMitTon(label, opts) {
    return knopf(label, {
      ...opts,
      onClick: (e) => {
        if (!klickErlaubt()) return;
        ton('tipp');
        opts.onClick?.(e);
      },
    });
  }

  function merkeTimeout(id) { timeoutIds.add(id); return id; }
  function markiereFalsch(ziel) {
    if (!ziel) return;
    ziel.classList.remove('falsch');
    void ziel.offsetWidth;
    ziel.classList.add('falsch');
    merkeTimeout(setTimeout(() => ziel.classList.remove('falsch'), 170));
  }
  function warte(ms) {
    return new Promise((resolve) => {
      const id = merkeTimeout(setTimeout(fertig, ms));
      function fertig() {
        clearTimeout(id);
        timeoutIds.delete(id);
        warteListe = warteListe.filter((fn) => fn !== fertig);
        resolve();
      }
      warteListe.push(fertig);
    });
  }
  function ueberspringe() {
    const alle = warteListe.splice(0);
    for (const fn of alle) fn();
  }
  function rahmen() {
    return new Promise((resolve) => {
      const id = requestAnimationFrame(() => { rafs.delete(id); resolve(); });
      rafs.add(id);
    });
  }
  function setzeStimmung(name, ms) {
    stimmung = name;
    clearTimeout(stimmTimer);
    timeoutIds.delete(stimmTimer);
    if (!ms) return;
    stimmTimer = merkeTimeout(setTimeout(() => {
      timeoutIds.delete(stimmTimer);
      if (lebendig()) stimmung = 'ruhig';
    }, ms));
  }
  function sandAus() {
    clearInterval(sandTimer);
    sandTimer = 0;
  }

  function routeLabel(st) {
    if (st.phase === 'boss') return 'Boss';
    if (st.phase === 'lagerfeuer') return 'Lagerfeuer';
    if (st.phase === 'nachbau') return 'Noch einmal bauen';
    const von = st.total || 0;
    const n = Math.min(von, (st.index || 0) + 1);
    return von ? `Aufgabe ${n} von ${von}` : 'Jagd';
  }

  function aktualisiereKopf(opts = {}) {
    const st = hunt.state();
    const neu = kopfzeile({
      shields: st.shields,
      maxShields: st.maxShields,
      route: st.route,
      combo: st.combo,
      mult: st.mult,
      coins: st.bag?.coins || 0,
      eggs: st.bag?.eggs?.length || 0,
      onPause: oeffnePause,
      bricht: opts.bricht ?? -1,
      neuesSchild: opts.neuesSchild ?? -1,
      routeLabel: routeLabel(st),
    });
    if (kopf?.isConnected) kopf.replaceWith(neu);
    kopf = neu;
  }

  function oeffnePause() {
    if (modalZu || beendet || !lebendig()) return;
    ton('tipp');
    modalZu = modal(root, {
      titel: 'Pause',
      knoepfe: [
        { label: 'Weiter', art: 'primaer', onClick: () => { ton('tipp'); schliesseModal(); } },
        { label: 'Jagd beenden', art: 'sekundaer', onClick: () => { ton('tipp'); schliesseModal(); jagdBeenden(); } },
      ],
    });
  }
  function schliesseModal() {
    modalZu?.schliessen();
    modalZu = null;
  }

  function jagdBeenden() {
    if (beendet || !lebendig()) return;
    const beutel = hunt.state().bag || { coins: 0, eggs: [] };
    verloren = { coins: beutel.coins || 0, eggs: [...(beutel.eggs || [])] };
    const summary = { ...hunt.summary(), abgebrochen: true };
    const vorher = kaestenVorher(summary);
    beendet = true;
    ueberspringe();
    const geschluepft = ctx.finishHunt(summary) || [];
    zeigeErgebnis(summary, geschluepft, verloren, vorher);
  }

  function handle(events) {
    if (!lebendig() || beendet) return;
    queue.push(...(events || []));
    if (!pumpt) pumpe();
  }

  async function pumpe() {
    if (pumpt) return;
    pumpt = true;
    try {
      while (queue.length && lebendig() && !beendet) {
        const ereignis = queue.shift();
        try { await wende(ereignis); }
        catch { if (lebendig() && !beendet) zeigeStocken(); break; }
      }
    } finally { pumpt = false; }
  }

  async function wende(ev) {
    if (!lebendig() || beendet || !ev) return;
    if (ev.type === 'richtig') {
      aktualisiereKopf();
      if (ev.coins) {
        muenzflug(muenzQuelle || buehne, kopf?.querySelector('[data-beutel]'), Math.min(6, Math.max(1, Math.round(ev.coins / 10))));
        ton('muenze');
      }
      if (ev.egg) ton('ei');
      setzeStimmung('jubel', 600);
      await warte(ruhe() ? 160 : 420);
      return;
    }
    if (ev.type === 'schild-zurueck') {
      aktualisiereKopf({ neuesSchild: (ev.shields || 1) - 1 });
      return;
    }
    if (ev.type === 'falsch') {
      onTaste = null;
      onBuchstabe = null;
      aktualisiereKopf({ bricht: ev.shields });
      ton('schild');
      setzeStimmung('ducken', 800);
      await warte(300);
      if (!lebendig() || beendet) return;
      zeigeLoesung(ev.word);
      spreche(enVon(ev.word));
      await warte(1200);
      loesungWeg();
      return;
    }
    if (ev.type === 'nachbau-start' || ev.type === 'aufgabe') {
      aktualisiereKopf();
      zeigeAufgabe(ev.task);
      return;
    }
    if (ev.type === 'lagerfeuer') {
      aktualisiereKopf();
      ton('feuer');
      zeigeLagerfeuer(ev.bag || hunt.state().bag);
      return;
    }
    if (ev.type === 'gesichert') {
      aktualisiereKopf();
      const eier = ev.eggs || [];
      if (!eier.length) {
        if (eiHinweis) eiHinweis.textContent = 'Beute ist sicher.';
        await warte(400);
        return;
      }
      for (let i = 0; i < eier.length; i++) {
        if (!lebendig() || beendet) return;
        ton('ei');
        eiOffen[i]?.classList.add('offen');
        if (eiHinweis) eiHinweis.textContent = 'Ei gesichert';
        await warte(500);
      }
      return;
    }
    if (ev.type === 'einsatz') {
      aktualisiereKopf();
      if (eiHinweis) eiHinweis.textContent = 'Du jagst mit Einsatz.';
      await warte(500);
      return;
    }
    if (ev.type === 'boss-start') {
      richteBoss(hunt.state().task?.word, ev.boss);
      aktualisiereKopf();
      return;
    }
    if (ev.type === 'boss-treffer') {
      zeichneSegmente(ev.boss);
      ton('boss');
      bossStimmung = 'ducken';
      await warte(280);
      if (lebendig() && !beendet) bossStimmung = 'ruhig';
      return;
    }
    if (ev.type === 'boss-besiegt') {
      bossZuEi();
      ton('ei');
      await warte(ruhe() ? 200 : 800);
      return;
    }
    if (ev.type === 'abbruch') {
      verloren = ev.lost || verloren;
      return;
    }
    if (ev.type === 'ergebnis') {
      if (beendet) return;
      const vorher = kaestenVorher(ev.summary);
      beendet = true;
      const geschluepft = ctx.finishHunt(ev.summary) || [];
      zeigeErgebnis(ev.summary, geschluepft, verloren, vorher);
    }
  }

  function zeigeStocken() {
    beendet = true;
    ueberspringe();
    root.replaceChildren(el('section', { class: 'bildschirm' }, [
      el('h1', { text: 'Die Jagd stockt.' }),
      knopf('Zum Lager', { art: 'primaer', onClick: () => ctx.go('heute') }),
    ]));
  }

  function automatisch(task) {
    const art = task?.prompt?.kind;
    if (art !== 'audio' && art !== 'karte' && task?.type !== 'kennenlernen') return;
    const en = task.word?.en || task.prompt?.text;
    if (!en || gesprochen.has(task.id)) return;
    gesprochen.add(task.id);
    spreche(en);
  }

  function zeigeAufgabe(task) {
    if (!task || !lebendig()) return;
    gesperrt = false;
    onTaste = null;
    onBuchstabe = null;
    lueckeEl = null;
    bedeutungsEl = null;
    sandAus();
    muenzQuelle = buehne;
    if (task.type === 'blitz' && task.items?.length) { zeigeBlitz(task); return; }
    if (task.type === 'kennenlernen') {
      malePrompt(buehne, task);
      antwort.replaceChildren(knopfMitTon('Verstanden', {
        art: 'primaer',
        onClick: () => {
          if (gesperrt) return;
          gesperrt = true;
          handle(hunt.skipKennenlernen());
        },
      }));
      automatisch(task);
      return;
    }
    if (WAHL.has(task.type) && task.options?.length) {
      maleWahl(task, buehne, (ok) => handle(hunt.answer({ correct: ok })));
      automatisch(task);
      return;
    }
    if (BAU.has(task.type) && task.target?.length && task.blocks?.length) {
      zeigeBau(task);
      automatisch(task);
      return;
    }
    malePrompt(buehne, task);
    antwort.replaceChildren(knopfMitTon('Weiter', {
      art: 'primaer',
      onClick: () => {
        if (gesperrt) return;
        gesperrt = true;
        if (task.type === 'nachbau') handle(hunt.finishNachbau());
        else handle(hunt.answer({ correct: true }));
      },
    }));
  }

  function malePrompt(ziel, task) {
    const p = task.prompt || {};
    const teile = [];
    if (task.type === 'nachbau') {
      teile.push(el('h2', { text: 'Fast. Bau es einmal nach.' }));
      teile.push(el('p', { class: 'wort-gross', text: task.word?.en || '' }));
      if (task.word?.de) teile.push(el('p', { class: 'bedeutung', text: task.word.de }));
    } else if (p.kind === 'karte') {
      teile.push(el('p', { class: 'wort-gross', text: p.text || task.word?.en || '' }));
      const de = p.de || task.word?.de;
      if (de) teile.push(el('p', { class: 'bedeutung', text: de }));
      if (p.sentence) teile.push(el('p', { class: 'satz', text: p.sentence }));
      teile.push(knopfMitTon('Anhören', { art: 'sekundaer', className: 'hoeren', onClick: () => spreche(task.word?.en || p.text) }));
    } else if (p.kind === 'audio') {
      teile.push(knopfMitTon('Anhören', { art: 'sekundaer', className: 'hoeren', onClick: () => spreche(task.word?.en || p.text) }));
      if (task.type !== 'hoeren-bauen' && p.de) teile.push(el('p', { class: 'bedeutung', text: p.de }));
    } else if (p.kind === 'satz') {
      if (p.sentence) teile.push(satzMitLuecke(p.sentence));
      if (p.text) teile.push(el('p', { class: 'bedeutung', text: p.text }));
    } else {
      if (p.text) teile.push(el('p', { class: 'wort-gross', text: p.text }));
      if (p.sentence) teile.push(satzMitLuecke(p.sentence));
      if (p.kind === 'en') teile.push(knopfMitTon('Anhören', { art: 'sekundaer', className: 'hoeren', onClick: () => spreche(p.text || task.word?.en) }));
    }
    const box = el('div', { class: 'prompt' }, teile);
    ziel.replaceChildren(box);
    return box;
  }

  function satzMitLuecke(sentence) {
    const wrap = el('p', { class: 'satz' });
    const teile = String(sentence || '').split('______');
    teile.forEach((teil, i) => {
      if (teil) wrap.append(document.createTextNode(teil));
      if (i < teile.length - 1) {
        lueckeEl = el('span', { class: 'luecke' });
        wrap.append(lueckeEl);
      }
    });
    return wrap;
  }

  function maleWahl(task, promptZiel, onChoice) {
    malePrompt(promptZiel, task);
    const raster = el('div', { class: `wahl-raster ${task.options.length >= 4 ? 'vier' : 'drei'}` });
    const knoepfe = task.options.map((opt, index) => {
      const button = block(opt.text, { onClick: () => waehle(index) });
      raster.append(button);
      return button;
    });
    antwort.replaceChildren(raster);
    function waehle(index) {
      if (gesperrt || !klickErlaubt() || !knoepfe[index]) return;
      gesperrt = true;
      onTaste = null;
      const opt = task.options[index];
      if (opt.correct) {
        knoepfe[index].classList.add('richtig');
        ton('richtig');
        setzeStimmung('jubel', 600);
        muenzQuelle = knoepfe[index];
        onChoice(true);
      } else {
        markiereFalsch(knoepfe[index]);
        const richtig = task.options.findIndex((o) => o.correct);
        if (richtig >= 0) knoepfe[richtig].classList.add('richtig');
        ton('falsch');
        setzeStimmung('ducken', 800);
        onChoice(false);
      }
    }
    onTaste = waehle;
  }

  function zeigeBlitz(task) {
    const start = Date.now();
    const balken = el('span', { class: 'sand-balken' });
    const stand = el('p', { class: 'blitz-stand', text: '1 von 3' });
    const promptHalt = el('div', { class: 'blitz-prompt' });
    buehne.replaceChildren(
      el('div', { class: 'blitz-kopf' }, [
        el('h2', { text: 'Blitz' }),
        stand,
        el('div', { class: 'sanduhr-block' }, [
          el('span', { class: 'sanduhr-name', text: 'Sanduhr' }),
          el('div', { class: 'sanduhr', aria: { label: 'Sanduhr, 20 Sekunden' } }, [balken]),
        ]),
      ]),
      promptHalt,
    );
    sandTimer = setInterval(() => {
      const rest = Math.max(0, 1 - (Date.now() - start) / 20000);
      balken.style.transform = `scaleX(${rest})`;
      if (rest <= 0) sandAus();
    }, 200);
    const treffer = [];
    const naechstes = (i) => {
      if (!lebendig() || beendet) return;
      gesperrt = false;
      stand.textContent = `${i + 1} von 3`;
      maleWahl(task.items[i], promptHalt, (ok) => {
        treffer[i] = ok;
        if (i < task.items.length - 1) warte(400).then(() => naechstes(i + 1));
        else {
          sandAus();
          const alle = treffer.every(Boolean);
          if (alle && Date.now() - start <= 20000) {
            buehne.append(el('p', { class: 'blitz-ruf', text: 'Blitz!' }));
            ton('blitz');
          }
          handle(hunt.answer({ correct: alle }));
        }
      });
    };
    naechstes(0);
  }

  function zeigeBau(task) {
    const istNachbau = task.type === 'nachbau';
    malePrompt(buehne, task);
    if (task.type === 'hoeren-bauen') {
      bedeutungsEl = el('p', { class: 'bedeutung' });
      buehne.querySelector('.prompt')?.append(bedeutungsEl);
    }
    const slotEls = task.target.map(() => el('span', { class: 'slot' }));
    const slots = el('div', { class: 'slots', aria: { label: 'Zielzeile' } }, slotEls);
    const bank = el('div', { class: 'bank' });
    const byId = new Map();
    const reihenfolge = [];
    for (const eintrag of task.blocks) {
      const button = block(eintrag.text, { onClick: () => klickBlock(eintrag.id) });
      button.dataset.id = eintrag.id;
      button.dataset.text = eintrag.text;
      byId.set(eintrag.id, button);
      reihenfolge.push(eintrag.id);
      bank.append(button);
    }
    antwort.replaceChildren(slots, bank, el('div', { class: 'bau-aktionen' }, [
      knopfMitTon('Zeig mir den nächsten Block', { art: 'sekundaer', onClick: () => hinweis() }),
      knopfMitTon('Zurück', { art: 'sekundaer', onClick: () => zurueck() }),
    ]));

    const gelegt = [];
    const herkunft = [];
    let puffer = '';
    let rutscht = false;
    let hinweisBenutzt = false;

    function norm(s) { return String(s ?? '').toLowerCase(); }
    function textVon(id) { return byId.get(id)?.dataset.text || ''; }
    function zielText() { return task.target[gelegt.length] || ''; }
    function markiereDran() {
      slotEls.forEach((slot, i) => slot.classList.toggle('dran', i === gelegt.length));
    }
    function finde(text) {
      const want = norm(text);
      for (const id of reihenfolge) {
        if (gelegt.includes(id)) continue;
        if (norm(byId.get(id)?.dataset.text) === want) return id;
      }
      return null;
    }
    function schreibeLuecke() {
      if (lueckeEl) lueckeEl.textContent = gelegt.map(textVon).join('');
    }
    function zeigePuffer() {
      const slot = slotEls[gelegt.length];
      if (!slot || slot.classList.contains('voll')) return;
      slot.textContent = puffer;
      slot.classList.toggle('tippt', !!puffer);
    }
    markiereDran();

    async function rutsche(blockEl, slotEl) {
      const von = blockEl.getBoundingClientRect();
      slotEl.replaceChildren(blockEl);
      if (ruhe()) return;
      const nach = blockEl.getBoundingClientRect();
      const dx = von.left - nach.left;
      const dy = von.top - nach.top;
      if (!dx && !dy) return;
      blockEl.style.transition = 'none';
      blockEl.style.transform = `translate(${dx}px, ${dy}px)`;
      await rahmen();
      if (!lebendig()) return;
      blockEl.style.transition = 'transform 120ms ease';
      blockEl.style.transform = '';
      await warte(120);
      blockEl.style.transition = '';
      blockEl.style.transform = '';
    }

    async function platzieren(id, art) {
      if (gesperrt || rutscht || !lebendig()) return;
      const button = byId.get(id);
      const slot = slotEls[gelegt.length];
      if (!button || !slot) return;
      rutscht = true;
      puffer = '';
      gelegt.push(id);
      herkunft.push(art);
      button.disabled = true;
      button.classList.add('gewaehlt');
      button.classList.remove('falsch');
      await rutsche(button, slot);
      if (!lebendig()) return;
      slot.classList.add('voll');
      slot.classList.remove('tippt', 'falsch');
      rutscht = false;
      markiereDran();
      schreibeLuecke();
      if (gelegt.length === task.target.length) await fertig();
    }

    function falschBlock(ziel) {
      markiereFalsch(ziel);
      ton('falsch');
      if (istNachbau) { hunt.wrongBlock(); return; }
      if (hunt.wrongBlock()) {
        gesperrt = true;
        onBuchstabe = null;
        onTaste = null;
        handle(hunt.answer({ correct: false, usedHint: hinweisBenutzt }));
      }
    }

    function klickBlock(id) {
      if (gesperrt || rutscht || !klickErlaubt()) return;
      puffer = '';
      zeigePuffer();
      const button = byId.get(id);
      if (norm(button?.dataset.text) === norm(zielText())) {
        ton('tipp');
        platzieren(id, 'tipp');
      } else falschBlock(button);
    }

    function hinweis() {
      if (gesperrt || rutscht || !klickErlaubt()) return;
      const id = finde(zielText());
      if (!id) return;
      hinweisBenutzt = true;
      puffer = '';
      platzieren(id, 'hinweis');
    }

    function zurueck() {
      if (gesperrt || rutscht || !gelegt.length || !klickErlaubt()) return;
      const id = gelegt.pop();
      herkunft.pop();
      puffer = '';
      const button = byId.get(id);
      const slot = slotEls[gelegt.length];
      if (slot) {
        slot.classList.remove('voll', 'tippt', 'falsch');
        slot.textContent = '';
      }
      if (button) {
        button.disabled = false;
        button.classList.remove('gewaehlt', 'falsch');
        button.style.transform = '';
        button.style.transition = '';
        const idx = reihenfolge.indexOf(id);
        const davor = [...bank.children].find((kind) => reihenfolge.indexOf(kind.dataset.id) > idx);
        bank.insertBefore(button, davor || null);
      }
      markiereDran();
      schreibeLuecke();
      zeigePuffer();
    }

    async function fertig() {
      if (gesperrt) return;
      gesperrt = true;
      onBuchstabe = null;
      onTaste = null;
      if (task.type === 'hoeren-bauen' && bedeutungsEl) {
        const de = task.prompt?.de || task.word?.de || '';
        if (de) bedeutungsEl.textContent = de;
        await warte(700);
        if (!lebendig() || beendet) return;
      }
      if (istNachbau) { handle(hunt.finishNachbau()); return; }
      const keyboard = herkunft.length === task.target.length
        && herkunft.every((art) => art === 'taste')
        && (task.box ?? 0) >= 2
        && !!ctx.hasKeyboard;
      handle(hunt.answer({ correct: true, usedHint: hinweisBenutzt, keyboard }));
    }

    function taste(zeichen) {
      if (gesperrt || rutscht) return;
      if (zeichen === 'loeschen') { zurueck(); return; }
      if ((task.box ?? 0) < 2 || !ctx.hasKeyboard) return;
      const ziel = zielText();
      if (!ziel) return;
      const versuch = puffer + zeichen;
      if (norm(ziel).startsWith(norm(versuch))) {
        puffer = versuch;
        zeigePuffer();
        if (norm(puffer) === norm(ziel)) {
          const id = finde(ziel);
          puffer = '';
          if (id) platzieren(id, 'taste');
        }
        return;
      }
      puffer = '';
      zeigePuffer();
      falschBlock(slotEls[gelegt.length]);
    }

    onBuchstabe = taste;
  }

  function zeigeLagerfeuer(bag) {
    gesperrt = false;
    onTaste = null;
    onBuchstabe = null;
    window.scrollTo(0, 0);
    const coins = bag?.coins || 0;
    const eggs = bag?.eggs || [];
    eiOffen = eggs.map((r) => eiSymbol(r));
    eiHinweis = el('p', {
      class: 'hinweis',
      text: eggs.length ? 'Eier warten im Beutel.' : (coins ? 'Die Münzen warten im Beutel.' : 'Der Beutel ist leer.'),
    });
    buehne.replaceChildren(el('div', { class: 'lager' }, [
      el('div', { class: 'feuer-bild', aria: { hidden: 'true' } }),
      el('h2', { text: 'Lagerfeuer' }),
      el('p', { class: 'zahl', text: `${coins} Münzen` }),
      eggs.length ? el('div', { class: 'ei-reihe' }, eiOffen) : null,
      eiHinweis,
    ]));
    antwort.replaceChildren(
      knopfMitTon('Beute sichern', { art: 'primaer', onClick: () => feuerWahl('sichern') }),
      knopf('Weiter mit Einsatz', {
        art: 'sekundaer',
        unterzeile: '×1,5 Beute, aber kein Schild zurück',
        onClick: () => { if (!klickErlaubt() || gesperrt) return; ton('tipp'); feuerWahl('weiter'); },
      }),
    );
  }

  function feuerWahl(choice) {
    if (gesperrt || !lebendig()) return;
    gesperrt = true;
    handle(hunt.campfire(choice));
  }

  function eiSymbol(rarity) {
    const klasse = rarity === 'episch' ? 'episch' : rarity === 'selten' ? 'selten' : 'gewoehnlich';
    return el('span', { class: `ei ${klasse}` }, [
      el('span', { class: 'ei-name', text: seltenheit(rarity) }),
    ]);
  }

  function richteBoss(word, boss) {
    jagd.classList.add('ist-boss');
    bossEcke.hidden = false;
    bossBiest = wildesBiest(word);
    bossStimmung = 'ruhig';
    const figur = el('div', { class: 'boss-figur' });
    segmentLeiste = null;
    const leiste = zeichneSegmente(boss);
    bossEcke.replaceChildren(figur, leiste);
    haengeBiest(figur, bossBiest, 160, () => bossStimmung);
    figur.append(el('span', { class: 'boss-ei', text: 'Ei' }));
  }

  function zeichneSegmente(boss) {
    const total = boss?.total || 3;
    const hit = boss?.hit || 0;
    const row = el('div', { class: 'segmente', aria: { label: `${Math.max(0, total - hit)} von ${total}` } });
    for (let i = 0; i < total; i++) row.append(el('span', { class: `segment ${i < hit ? 'weg' : 'da'}` }));
    if (segmentLeiste?.isConnected) segmentLeiste.replaceWith(row);
    segmentLeiste = row;
    return row;
  }

  function bossZuEi() {
    bossStimmung = 'ei';
    if (bossBiest) bossBiest.stage = 1;
    bossEcke.querySelector('.boss-figur')?.classList.add('wird-ei');
  }

  function wildesBiest(word) {
    let biest = null;
    if (word && typeof ctx.biester?.biestFor === 'function') {
      try {
        biest = ctx.biester.biestFor(
          word,
          { box: 0, due: Date.now() + 86400000, seen: 1 },
          { rarity: 'gewoehnlich', hat: null, skin: null },
          listenFarbe(word),
        );
      } catch { biest = null; }
    }
    const basis = biest || {
      species: ctx.biester?.speciesFor?.(word?.en || '') || 0,
      color: listenFarbe(word),
      name: word?.en || '',
      rarity: 'gewoehnlich',
    };
    return { ...basis, stage: 0, hat: null, skin: null };
  }

  function zeigeLoesung(word) {
    loesungWeg();
    const en = enVon(word);
    const de = deVon(word);
    const overlay = el('div', { class: 'loesung', role: 'dialog' }, [
      el('div', { class: 'karte loesung-karte' }, [
        en ? el('p', { class: 'wort-gross', text: en }) : null,
        de ? el('p', { class: 'bedeutung', text: de }) : null,
      ]),
    ]);
    if (en) overlay.setAttribute('aria-label', en);
    root.append(overlay);
  }
  function loesungWeg() { root.querySelector('.loesung')?.remove(); }

  function kaestenVorher(summary) {
    const map = new Map();
    for (const id of Object.keys(summary?.results || {})) map.set(id, ctx.store.record(id)?.box ?? 0);
    return map;
  }

  function zeigeErgebnis(summary, geschluepft, verlorenStand, vorher) {
    sandAus();
    schliesseModal();
    loesungWeg();
    stoppeBilder();
    window.scrollTo(0, 0);
    if (!summary?.abgebrochen) ton('fanfare');
    const stand = ctx.store.state();
    const noch = (() => {
      const ueber = ctx.store.overview();
      return (ueber.faellig || 0) + (ueber.neu || 0) > 0;
    })();
    const listeWorte = el('ul', { class: 'wort-liste' });
    const ids = Object.keys(summary?.results || {});
    if (!ids.length) listeWorte.append(el('li', { text: 'Du hast noch nichts geübt.' }));
    for (const id of ids) listeWorte.append(zeileWort(id, vorher));
    const neues = el('div', { class: 'neue-biester' });
    for (const eintrag of geschluepft || []) {
      const knoten = zeileBiest(eintrag);
      if (knoten) neues.append(knoten);
    }
    const aktionen = el('div', { class: 'ergebnis-aktionen' });
    if (noch) aktionen.append(knopfMitTon('Noch eine Jagd', { art: 'primaer', onClick: () => ctx.startHunt() }));
    aktionen.append(knopfMitTon('Zum Lager', { art: noch ? 'sekundaer' : 'primaer', onClick: () => ctx.go('heute') }));
    const verlorenText = summary?.abgebrochen && ((verlorenStand?.coins || 0) > 0 || verlorenStand?.eggs?.length)
      ? 'Was noch im Beutel war, ist weg. Gesichertes bleibt.'
      : '';
    root.replaceChildren(el('section', { class: 'bildschirm ergebnis' }, [
      el('h1', { text: titel(summary) }),
      verlorenText ? el('p', { text: verlorenText }) : null,
      listeWorte,
      neues,
      el('p', { class: 'zahl', text: `${summary?.coins || 0} Münzen` }),
      el('p', { text: `Kombo-Rekord ${summary?.komboRekord || 0}` }),
      el('p', { text: fackelZeile(stand.fackel?.reihe || 0) }),
      aktionen,
    ]));
  }

  function titel(summary) {
    if (summary?.bossBesiegt) return 'Boss besiegt!';
    if (summary?.abgebrochen) return 'Die Jagd ist vorbei';
    return 'Jagd geschafft';
  }

  function fackelZeile(reihe) {
    if (!reihe) return 'Die Fackel wartet';
    if (reihe === 1) return 'Fackel: 1 Tag am Stück';
    return `Fackel: ${reihe} Tage am Stück`;
  }

  function zeileWort(id, vorher) {
    const name = wortZu(id)?.en || id.split('|').slice(1).join('|') || 'Wort';
    const alt = vorher?.get(id) ?? 0;
    const neu = ctx.store.record(id)?.box ?? alt;
    const zeile = el('li', { class: 'wort-zeile' }, [
      el('span', { class: 'wort-name', text: name }),
    ]);
    if (alt !== neu) zeile.append(el('span', { class: 'pfeil', text: `${stufenName(alt)} → ${stufenName(neu)}` }));
    else zeile.append(el('span', { class: 'pfeil', text: stufenName(neu) }));
    return zeile;
  }

  function zeileBiest(eintrag) {
    if (!eintrag) return null;
    if (eintrag.kind === 'fang' || eintrag.kind === 'aufwertung') {
      const wort = wortZu(eintrag.wordId);
      const name = wort?.en || 'Biest';
      const text = eintrag.kind === 'fang'
        ? `Neues Biest: ${name}`
        : `${name} glänzt jetzt ${seltenheit(eintrag.rarity)}`;
      const row = el('div', { class: 'neu-biest' });
      haengeBiest(row, biestZu(wort), 96, () => 'jubel');
      row.append(el('p', { text }));
      return row;
    }
    if (eintrag.kind === 'zier') {
      const z = eintrag.zier || {};
      const row = el('div', { class: 'neu-biest' });
      haengeBiest(row, {
        species: z.species || 0,
        stage: 4,
        rarity: eintrag.rarity || z.rarity || 'gewoehnlich',
        color: revierFarbe(),
        hat: null,
        skin: null,
        name: 'Zierbiest',
      }, 96, () => 'ruhig');
      row.append(el('p', { text: 'Ein Zierbiest!' }));
      return row;
    }
    return null;
  }

  function biestZu(wort) {
    if (wort && typeof ctx.biester?.biestFor === 'function') {
      try {
        return ctx.biester.biestFor(wort, ctx.store.record(wort.id), ctx.store.state().biester?.[wort.id], listenFarbe(wort));
      } catch { /* Ersatzfigur */ }
    }
    return { species: 0, stage: 2, rarity: 'gewoehnlich', color: revierFarbe(), name: wort?.en || '', hat: null, skin: null };
  }

  function stufenName(box) {
    const namen = ctx.biester?.STAGE_NAMES || STUFEN;
    const stufe = typeof ctx.biester?.stageFor === 'function'
      ? ctx.biester.stageFor(box)
      : Math.max(0, Math.min(5, Number(box) || 0));
    return namen[stufe] || namen[0] || 'wild';
  }

  function wortZu(id) { return ctx.store.allWords().find((w) => w.id === id) || null; }
  function listenFarbe(word) {
    const id = word?.list || String(word?.id || '').split('|')[0];
    return ctx.store.state().lists.find((l) => l.id === id)?.color || revierFarbe();
  }
  function revierFarbe() {
    const wert = getComputedStyle(document.documentElement).getPropertyValue('--revier').trim();
    return /^#[0-9a-fA-F]{6}$/.test(wert) ? wert : '#6fcf6a';
  }

  function haengeBiest(parent, biest, size, getMood) {
    const canvas = el('canvas', { class: 'biest-bild', width: String(size), height: String(size) });
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    canvas.dataset.size = String(size);
    if (biest?.name) canvas.setAttribute('aria-label', biest.name);
    parent.append(canvas);
    try {
      const stop = animateBiest(canvas, biest, getMood || (() => 'ruhig'));
      if (typeof stop === 'function') stops.push(stop);
    } catch {
      try { ctx.drawBiest?.(canvas.getContext('2d'), biest, { mood: getMood?.() || 'ruhig', t: 0, size }); } catch { /* leer */ }
    }
    return canvas;
  }

  function stoppeBilder() {
    for (const stop of stops) { try { stop(); } catch { /* */ } }
    stops.length = 0;
  }

  function onKey(e) {
    if (!lebendig() || beendet || modalZu) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key >= '1' && e.key <= '4') {
      if (onTaste) { e.preventDefault(); onTaste(Number(e.key) - 1); }
      return;
    }
    if (!onBuchstabe) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      onBuchstabe('loeschen');
      return;
    }
    if (e.repeat) return;
    if (e.key.length === 1) {
      e.preventDefault();
      onBuchstabe(e.key);
    }
  }

  function onDown(e) {
    try { ctx.audio?.unlock?.(); } catch { /* */ }
    if (!warteListe.length) return;
    if (e.target?.closest?.('.pause')) { ueberspringe(); return; }
    ueberspringe();
    skipBis = performance.now() + 280;
  }

  window.addEventListener('keydown', onKey, { signal: controller.signal });
  window.addEventListener('pointerdown', onDown, { signal: controller.signal, capture: true });

  buehne = el('div', { class: 'buehne' });
  antwort = el('div', { class: 'antworten' });
  bossEcke = el('div', { class: 'boss-ecke' });
  bossEcke.hidden = true;
  const begleiter = el('div', { class: 'begleiter-ecke' });
  baueBegleiter(begleiter);
  aktualisiereKopf();
  jagd = el('div', { class: 'jagd' }, [
    kopf,
    bossEcke,
    el('div', { class: 'jagd-kern' }, [buehne, antwort]),
    begleiter,
  ]);
  root.append(jagd);

  function baueBegleiter(parent) {
    const stand = ctx.store.state();
    const alle = ctx.store.allWords();
    for (const id of (stand.begleiter || []).slice(0, 3)) {
      const wort = alle.find((w) => w.id === id);
      if (!wort || typeof ctx.biester?.biestFor !== 'function') continue;
      let biest;
      try { biest = ctx.biester.biestFor(wort, ctx.store.record(id), stand.biester?.[id], listenFarbe(wort)); }
      catch { continue; }
      haengeBiest(parent, biest, 72, () => stimmung);
    }
  }

  function aufraeumenSession() {
    beendet = true;
    ueberspringe();
    sandAus();
    clearTimeout(stimmTimer);
    for (const id of timeoutIds) clearTimeout(id);
    timeoutIds.clear();
    for (const id of rafs) cancelAnimationFrame(id);
    rafs.clear();
    controller.abort();
    controller = new AbortController();
    stoppeBilder();
    muenzenWeg();
    schliesseModal();
    try { speechSynthesis?.cancel(); } catch { /* */ }
  }

  return {
    aufraeumen: aufraeumenSession,
    starte() {
      try { handle(hunt.start()); }
      catch { zeigeStocken(); }
    },
  };
}

function enVon(word) {
  if (!word) return '';
  return typeof word === 'string' ? word : (word.en || '');
}
function deVon(word) {
  if (!word || typeof word === 'string') return '';
  return word.de || '';
}
function seltenheit(r) {
  if (r === 'episch') return 'besonders';
  if (r === 'selten') return 'selten';
  return 'gewöhnlich';
}
