// Rudel-Album.
//
// Präzisierungen:
// 1. Kacheln sind Standbilder über biestCanvas, die Karte läuft über animateBiest.
//    Beide kommen aus render/biest.js. ctx hat nur drawBiest; fällt die Schleife
//    aus, zeichnen wir einmal damit.
// 2. Jedes Wort ist eine Kachel. Ohne Eintrag in biester: Stufe 0, Name „?“,
//    auf der Karte nur „Noch nicht gefangen“. Der Zähler zählt alle Wörter plus
//    Zierbiester. „zahm“ kommt aus listStats (Box ab 4). Zier zählen nicht als zahm.
// 3. Hungrig wie biestFor: Datensatz vorhanden und fällig. Die Sprechblase malt
//    der Renderer bei Stimmung hungrig. Eier lässt er aus, deshalb gibt es nur
//    für Stufe 1 eine Textblase „hungrig“.
// 4. setBegleiter ersetzt die Liste (höchstens 3, nur gefangene). Ist kein Platz
//    mehr, bleibt die Liste und die Karte nennt begleiter[0].
// 5. Anziehen liest ANGEBOT (hut:* und skin:*). Reviere sind nicht anziehbar.
//    Zierbiester haben kein Wort, also auch keinen Begleiter und keinen Look.
// 6. Sechs Punkte stehen für die Boxen 0 bis 5. Der aktuelle Punkt zählt mit,
//    Stufe 5 füllt alle sechs.
// 7. Zierbiester nutzen Figur-Stufe 4, die Beschriftung sagt „Zier“, die Farbe
//    ist Beere. Ein leerer Abschnitt entfällt.

import { animateBiest, biestCanvas } from '../render/biest.js';
import { ANGEBOT } from './laden.js';
import { el, knopf, modal, setzeRevier } from './teile.js';

const ZIER_FARBE = '#c47cff';

let rootEl = null;
let ctx = null;
let stops = [];
let karteZu = null;
let nurHungrig = false;

export function unmount() {
  schliesseKarte();
  stoppe();
  nurHungrig = false;
  rootEl = null;
  ctx = null;
}

export function mount(root, neuerCtx) {
  rootEl = root;
  ctx = neuerCtx;
  setzeRevier(ctx.store.activeList()?.color);
  zeichne();
}

function zeichne() {
  schliesseKarte();
  stoppe();
  if (!rootEl || !ctx) return;
  const stand = ctx.store.state();
  const filter = knopf('nur hungrige', {
    className: nurHungrig ? 'ist-aktiv' : '',
    onClick: () => { nurHungrig = !nurHungrig; zeichne(); },
  });
  filter.setAttribute('aria-pressed', String(nurHungrig));
  const liste = el('div', { class: 'rudel-liste' });
  const gezeigt = fuelleRudel(liste, stand);
  if (!gezeigt) {
    const leer = zaehlerZahlen(stand).tiere === 0;
    liste.append(el('p', {
      class: 'hinweis',
      text: leer
        ? 'Noch keine Wörter. Die Eltern können eine Liste anlegen.'
        : 'Gerade ist niemand hungrig.',
    }));
  }
  rootEl.replaceChildren(el('section', { class: 'bildschirm rudel' }, [
    kopf(zaehlerText(stand)),
    el('p', { text: 'Übe Wörter auf Jagden, damit ihre Biester wachsen. Tippe ein Biest an, um es anzusehen.' }),
    el('p', { text: 'Bis zu drei gefangene Wortbiester können dich begleiten. Zahme Begleiter helfen dir auf der Jagd.' }),
    el('div', { class: 'filter-zeile' }, [filter]),
    liste,
  ]));
}

function fuelleRudel(host, stand) {
  let gezeigt = 0;
  const begleiter = stand.begleiter || [];
  for (const liste of stand.lists || []) {
    const woerter = ctx.store.listWords(liste.id);
    const kacheln = [];
    for (const wort of woerter) {
      const biest = figur(wort, hex(liste.color));
      if (nurHungrig && !biest.hungrig) continue;
      kacheln.push(kachelWort(wort, biest, liste, begleiter.includes(wort.id)));
    }
    if (!kacheln.length) continue;
    gezeigt += kacheln.length;
    host.append(el('section', { class: 'revier-block' }, [
      el('h2', { class: 'revier-titel', text: liste.name, style: { color: hex(liste.color) } }),
      el('div', { class: 'kachel-raster' }, kacheln),
    ]));
  }
  const zier = stand.zier || [];
  if (!nurHungrig && zier.length) {
    gezeigt += zier.length;
    host.append(el('section', { class: 'revier-block' }, [
      el('h2', { class: 'revier-titel', text: 'Zierbiester', style: { color: ZIER_FARBE } }),
      el('div', { class: 'kachel-raster' }, zier.map((z) => kachelZier(z))),
    ]));
  }
  return gezeigt;
}

function kachelWort(wort, biest, liste, dabei) {
  const name = biest.gefangen ? wort.en : '?';
  const stufe = biest.gefangen ? stufenName(biest.stage) : 'wild';
  const stimmung = biest.hungrig && biest.stage !== 1 ? 'hungrig' : 'ruhig';
  const button = el('button', {
    type: 'button',
    class: biest.gefangen ? 'kachel' : 'kachel wild',
    onClick: () => oeffneWort({ wort, liste, biest }),
  }, [
    biest.hungrig && biest.stage === 1 ? el('span', { class: 'sprechblase', text: 'hungrig' }) : null,
    bildStill(biest, 96, stimmung),
    el('span', { class: 'kachel-name', text: name }),
    el('span', { class: 'kachel-stufe', text: stufe }),
    dabei ? el('span', { class: 'kachel-dabei', text: 'dabei' }) : null,
  ]);
  const hungrig = biest.hungrig ? ', hungrig' : '';
  button.setAttribute('aria-label', biest.gefangen ? `${wort.en}, ${stufe}${hungrig}${dabei ? ', als Begleiter dabei' : ''}` : `Noch nicht gefangen${hungrig}`);
  const bild = button.querySelector('canvas');
  if (bild) bild.setAttribute('aria-hidden', 'true');
  return button;
}

function kachelZier(z) {
  const biest = zierBiest(z);
  const name = artName(z.species);
  const button = el('button', {
    type: 'button',
    class: 'kachel',
    onClick: () => oeffneZier(z),
  }, [
    bildStill(biest, 96, 'ruhig'),
    el('span', { class: 'kachel-name', text: name }),
    el('span', { class: 'kachel-stufe', text: 'Zier' }),
  ]);
  button.setAttribute('aria-label', `${name}, Zier`);
  const bild = button.querySelector('canvas');
  if (bild) bild.setAttribute('aria-hidden', 'true');
  return button;
}

function oeffneWort(info, { anziehen = false } = {}) {
  schliesseKarte();
  const wort = info.wort;
  const biest = info.biest;
  const dlg = modal(rootEl, {
    titel: biest.gefangen ? wort.en : 'Noch nicht gefangen',
    knoepfe: [{ label: 'Schließen', onClick: () => zu() }],
  });
  const kasten = dlg.overlay.querySelector('.modal-karte');
  const aktionen = kasten.querySelector('.modal-aktionen');
  const koerper = el('div', { class: 'karte-koerper' });
  kasten.classList.add('biest-karte');
  dlg.overlay.classList.add('kann-scrollen');
  kasten.insertBefore(koerper, aktionen);
  const stimmung = biest.hungrig ? 'hungrig' : 'ruhig';
  koerper.append(bildAnimiert(biest, 200, stimmung, biest.gefangen ? wort.en : 'Noch nicht gefangen'));
  if (biest.gefangen) fuelleGefangen(koerper, wort, biest, anziehen);
  const beiTaste = (e) => { if (e.key === 'Escape') zu(); };
  document.addEventListener('keydown', beiTaste);
  dlg.overlay.addEventListener('click', (e) => { if (e.target === dlg.overlay) zu(); });
  let fertig = false;
  function zu() {
    if (fertig) return;
    fertig = true;
    document.removeEventListener('keydown', beiTaste);
    dlg.schliessen();
    stoppe();
    if (karteZu === zu) karteZu = null;
  }
  karteZu = zu;
}

function fuelleGefangen(koerper, wort, biest, anziehen) {
  if (wort.de) koerper.append(el('p', { class: 'bedeutung', text: wort.de }));
  if (wort.s) koerper.append(el('p', { class: 'satz', text: wort.s }));
  koerper.append(knopf('Anhören', {
    onClick: () => { try { ctx.audio?.speak?.(wort.en); } catch { /* ohne Ton */ } },
  }));
  koerper.append(el('div', { class: 'stufen-zeile' }, [
    el('span', { text: stufenName(biest.stage) }),
    punkte(biest.stage),
  ]));
  koerper.append(el('p', { text: `Es ist ${seltenheit(biest.rarity)}.` }));
  koerper.append(el('p', { text: schlafSatz(ctx.store.record(wort)) }));
  const vorteil = ctx.biester.describePerk?.(ctx.biester.perkFor?.(biest)) || '';
  if (vorteil) koerper.append(el('p', { text: vorteil }));
  else koerper.append(el('p', { text: 'Wenn dieses Biest zahm ist und dich begleitet, hilft es dir auf der Jagd.' }));
  const getragen = getragenText(biest);
  if (getragen) koerper.append(el('p', { text: getragen }));
  const ids = ctx.store.state().begleiter || [];
  const dabei = ids.includes(wort.id);
  const voll = !dabei && ids.length >= 3;
  if (voll) {
    koerper.append(el('p', { text: `Drei sind schon mit. Zuerst müsste ${wortName(ids[0])} zu Hause bleiben.` }));
  }
  const mit = knopf(dabei ? 'Zu Hause lassen' : 'Als Begleiter mitnehmen', {
    className: voll ? 'gedaempft' : '',
    onClick: () => setzeDabei(wort.id, !dabei),
  });
  if (voll) mit.disabled = true;
  koerper.append(mit);
  koerper.append(knopf('Anziehen', {
    className: anziehen ? 'ist-aktiv' : '',
    onClick: () => {
      const neu = findeWort(wort.id);
      if (neu) oeffneWort(neu, { anziehen: !anziehen });
    },
  }));
  if (anziehen) {
    const box = el('div', { class: 'anziehen-kasten' });
    fuelleAnziehen(box, biest, wort.id);
    koerper.append(box);
  }
}

function fuelleAnziehen(box, biest, wortId) {
  const owned = ctx.store.state().shop?.owned || [];
  const teile = ANGEBOT.filter((a) => (a.art === 'hut' || a.art === 'skin') && owned.includes(a.id));
  if (!teile.length) {
    box.append(el('p', { text: 'Du hast noch nichts zum Anziehen. Im Laden gibt es Hüte und Muster.' }));
    return;
  }
  const gruppen = [['hut', 'Hüte'], ['skin', 'Muster']];
  for (const [art, titel] of gruppen) {
    const liste = teile.filter((a) => a.art === art);
    if (!liste.length) continue;
    box.append(el('p', { class: 'leise', text: titel }));
    for (const artikel of liste) box.append(lookKnopf(artikel, biest, wortId));
  }
}

function lookKnopf(artikel, biest, wortId) {
  const an = artikel.art === 'hut' ? biest.hat === artikel.look : biest.skin === artikel.look;
  return knopf(an ? `${artikel.name} ausziehen` : `${artikel.name} anziehen`, {
    className: an ? 'ist-aktiv' : '',
    onClick: () => {
      const patch = artikel.art === 'hut'
        ? { hat: an ? null : artikel.look }
        : { skin: an ? null : artikel.look };
      ctx.store.setBiestLook(wortId, patch);
      zeichne();
      const neu = findeWort(wortId);
      if (neu) oeffneWort(neu, { anziehen: true });
    },
  });
}

function oeffneZier(z) {
  schliesseKarte();
  const biest = zierBiest(z);
  const name = artName(z.species);
  const dlg = modal(rootEl, {
    titel: name,
    knoepfe: [{ label: 'Schließen', onClick: () => zu() }],
  });
  const kasten = dlg.overlay.querySelector('.modal-karte');
  const aktionen = kasten.querySelector('.modal-aktionen');
  const koerper = el('div', { class: 'karte-koerper' });
  kasten.classList.add('biest-karte');
  dlg.overlay.classList.add('kann-scrollen');
  kasten.insertBefore(koerper, aktionen);
  koerper.append(bildAnimiert(biest, 200, 'ruhig', name));
  koerper.append(el('p', { text: 'Ein Zierbiest.' }));
  koerper.append(el('p', { text: `Es ist ${seltenheit(biest.rarity)}.` }));
  const beiTaste = (e) => { if (e.key === 'Escape') zu(); };
  document.addEventListener('keydown', beiTaste);
  dlg.overlay.addEventListener('click', (e) => { if (e.target === dlg.overlay) zu(); });
  let fertig = false;
  function zu() {
    if (fertig) return;
    fertig = true;
    document.removeEventListener('keydown', beiTaste);
    dlg.schliessen();
    stoppe();
    if (karteZu === zu) karteZu = null;
  }
  karteZu = zu;
}

function setzeDabei(id, sollMit) {
  const ohne = (ctx.store.state().begleiter || []).filter((eintrag) => eintrag !== id);
  if (sollMit && ohne.length >= 3) return;
  ctx.store.setBegleiter(sollMit ? [...ohne, id] : ohne);
  zeichne();
  const neu = findeWort(id);
  if (neu) oeffneWort(neu);
}

function figur(wort, farbe) {
  const rec = ctx.store.record(wort);
  const zustand = ctx.store.state().biester?.[wort.id];
  // Gefangen ist ein Wort, sobald es die erste Box erreicht hat (so zeigt es auch das Ergebnis).
  // Der Biest-Zustand (Seltenheit, Hut, Muster) kommt mit dem ersten Ei dazu.
  if ((zustand || (rec?.box ?? 0) >= 1) && typeof ctx.biester?.biestFor === 'function') {
    try {
      return { ...ctx.biester.biestFor(wort, rec, zustand, farbe), gefangen: true };
    } catch { /* Silhouette */ }
  }
  const art = typeof ctx.biester?.speciesFor === 'function' ? ctx.biester.speciesFor(wort.en) : 0;
  return {
    species: art,
    stage: 0,
    rarity: 'gewoehnlich',
    color: farbe,
    hat: null,
    skin: null,
    name: wort.en,
    wordId: wort.id,
    hungrig: !!(rec && rec.due <= Date.now()),
    gefangen: false,
  };
}

function zierBiest(z) {
  return {
    species: z.species || 0,
    stage: 4,
    rarity: z.rarity || 'gewoehnlich',
    color: ZIER_FARBE,
    hat: null,
    skin: null,
    name: artName(z.species),
  };
}

function findeWort(id) {
  for (const liste of ctx.store.state().lists || []) {
    const wort = ctx.store.listWords(liste.id).find((w) => w.id === id);
    if (wort) return { wort, liste, biest: figur(wort, hex(liste.color)) };
  }
  return null;
}

function bildStill(biest, groesse, stimmung) {
  try {
    const canvas = biestCanvas(biest, { size: groesse, mood: stimmung, t: 0 });
    canvas.classList.add('biest-bild');
    return canvas;
  } catch {
    const canvas = el('canvas', { class: 'biest-bild', width: String(groesse), height: String(groesse) });
    canvas.style.width = groesse + 'px';
    canvas.style.height = groesse + 'px';
    try { ctx.drawBiest?.(canvas.getContext('2d'), biest, { mood: stimmung, t: 0, size: groesse }); }
    catch { /* ohne Figur */ }
    return canvas;
  }
}

function bildAnimiert(biest, groesse, stimmung, beschriftung) {
  const canvas = el('canvas', { class: 'biest-bild', width: String(groesse), height: String(groesse) });
  canvas.style.width = groesse + 'px';
  canvas.style.height = groesse + 'px';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', beschriftung || 'Biest');
  try {
    const stop = animateBiest(canvas, biest, () => stimmung);
    if (typeof stop === 'function') stops.push(stop);
  } catch {
    try { ctx.drawBiest?.(canvas.getContext('2d'), biest, { mood: stimmung, t: 0, size: groesse }); }
    catch { /* ohne Figur */ }
  }
  return canvas;
}

function punkte(stage) {
  const stufe = Number.isFinite(stage) ? Math.max(0, Math.min(5, Math.floor(stage))) : 0;
  const an = stufe + 1;
  const row = el('div', { class: 'punkte', aria: { label: `${stufenName(stufe)}, ${an} von 6` } });
  for (let i = 0; i < 6; i++) row.append(el('span', { class: i < an ? 'punkt an' : 'punkt' }));
  return row;
}

function getragenText(biest) {
  const namen = [];
  for (const art of ['hut', 'skin']) {
    const wert = art === 'hut' ? biest.hat : biest.skin;
    const fund = ANGEBOT.find((a) => a.art === art && a.look === wert);
    if (fund) namen.push(fund.name);
  }
  return namen.length ? `Angezogen: ${namen.join(' und ')}` : '';
}

function wortName(id) {
  return ctx.store.allWords().find((w) => w.id === id)?.en || 'ein Biest';
}

function artName(nr) {
  return ctx.biester?.SPECIES?.[nr]?.name || 'Zierbiest';
}

function stufenName(stage) {
  const stufe = typeof ctx.biester?.stageFor === 'function'
    ? ctx.biester.stageFor(stage)
    : Math.max(0, Math.min(5, Math.floor(Number(stage) || 0)));
  const namen = ctx.biester?.STAGE_NAMES || ['wild', 'Ei', 'geschlüpft', 'gewachsen', 'zahm', 'zahm · glänzend'];
  return namen[stufe] || 'wild';
}

function schlafSatz(record, jetzt = Date.now()) {
  if (!record || record.due <= jetzt) return 'ist hungrig';
  const minuten = Math.max(0, Math.round((record.due - jetzt) / 60000));
  if (minuten <= 1) return 'schläft noch eine Minute';
  if (minuten < 60) return `schläft noch ${minuten} Minuten`;
  if (minuten < 90) return 'schläft noch eine Stunde';
  const ziel = new Date(record.due);
  const heute = new Date(jetzt);
  const morgen = new Date(jetzt);
  morgen.setDate(morgen.getDate() + 1);
  const tag = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (tag(ziel, morgen) && ziel.getHours() < 12) return 'schläft bis morgen früh';
  if (minuten < 480) {
    const stunden = Math.round(minuten / 60);
    return `schläft noch ${stunden} Stunden`;
  }
  if (tag(ziel, heute)) {
    if (ziel.getHours() < 12) return 'schläft bis heute Vormittag';
    if (ziel.getHours() < 18) return 'schläft bis heute Nachmittag';
    return 'schläft bis heute Abend';
  }
  if (tag(ziel, morgen)) return 'schläft bis morgen';
  const start = new Date(jetzt);
  start.setHours(0, 0, 0, 0);
  const ende = new Date(record.due);
  ende.setHours(0, 0, 0, 0);
  const tage = Math.max(2, Math.round((ende - start) / 86400000));
  return `schläft noch ${tage} Tage`;
}

function zaehlerZahlen(stand) {
  let tiere = (stand.zier || []).length;
  let zahm = 0;
  for (const liste of stand.lists || []) {
    const stats = ctx.store.listStats(liste.id);
    tiere += stats.total;
    zahm += stats.zahm;
  }
  return { tiere, zahm };
}

function zaehlerText(stand) {
  const { tiere, zahm } = zaehlerZahlen(stand);
  const tierWort = tiere === 1 ? '1 Biest' : `${tiere} Biester`;
  return `${tierWort} · ${zahm} zahm`;
}

function kopf(zaehler) {
  return el('header', { class: 'schirm-kopf' }, [
    knopf('Zurück', { onClick: () => ctx.go('heute') }),
    el('div', { class: 'schirm-titel' }, [
      el('h1', { text: 'Dein Rudel' }),
      el('p', { class: 'zahl', text: zaehler }),
    ]),
  ]);
}

function schliesseKarte() {
  const fn = karteZu;
  karteZu = null;
  fn?.();
}

function stoppe() {
  for (const stop of stops.splice(0)) {
    try { stop(); } catch { /* Zeichnung schon weg */ }
  }
}

function hex(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : '#6fcf6a';
}

function seltenheit(r) {
  if (r === 'episch') return 'besonders';
  if (r === 'selten') return 'selten';
  return 'gewöhnlich';
}
