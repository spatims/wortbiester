// Laden.
//
// Präzisierungen:
// 1. ANGEBOT ist die einzige Preisliste. Ei 100, sechs Hüte zwischen 50 und 120,
//    vier Muster (die Skins) zwischen 150 und 200, vier Reviere je 300.
// 2. Der Auftrag nennt drei Reihen und danach die Reviere. Gezeigt werden alle
//    vier Gruppen. Reviere liegen als revier:* in shop.owned und bleiben Dekor.
// 3. Zu wenig Münzen: der Knopf heißt „Noch N Münzen“ und ist gesperrt.
//    Gekauft (alles außer dem Ei): „Im Rudel anziehen“ wechselt ins Album.
// 4. Das Ei würfelt rollRarity, Kandidaten sind alle Wörter mit Box mindestens 1,
//    die Art kommt von randomSpecies. Die Karte sagt dasselbe wie der
//    Ergebnisbildschirm: „Neues Biest“, „glänzt jetzt“, „Ein Zierbiest!“.
// 5. In der Oberfläche heißen Skins „Muster“.

import { animateBiest } from '../render/biest.js';
import { el, knopf, setzeRevier } from './teile.js';

export const ANGEBOT = Object.freeze([
  { id: 'ei', art: 'ei', name: 'Ei', preis: 100 },
  { id: 'hut:muetze', art: 'hut', name: 'Mütze', preis: 50, look: 'muetze' },
  { id: 'hut:schleife', art: 'hut', name: 'Schleife', preis: 70, look: 'schleife' },
  { id: 'hut:brille', art: 'hut', name: 'Brille', preis: 80, look: 'brille' },
  { id: 'hut:hut', art: 'hut', name: 'Hut', preis: 90, look: 'hut' },
  { id: 'hut:helm', art: 'hut', name: 'Helm', preis: 110, look: 'helm' },
  { id: 'hut:krone', art: 'hut', name: 'Krone', preis: 120, look: 'krone' },
  { id: 'skin:punkte', art: 'skin', name: 'Punkte', preis: 150, look: 'punkte' },
  { id: 'skin:streifen', art: 'skin', name: 'Streifen', preis: 170, look: 'streifen' },
  { id: 'skin:flecken', art: 'skin', name: 'Flecken', preis: 180, look: 'flecken' },
  { id: 'skin:nacht', art: 'skin', name: 'Nacht', preis: 200, look: 'nacht' },
  { id: 'revier:nachtwald', art: 'revier', name: 'Nachtwald', preis: 300, text: 'Dunkle Bäume.' },
  { id: 'revier:mooslicht', art: 'revier', name: 'Mooslicht', preis: 300, text: 'Grünes Licht.' },
  { id: 'revier:glutlicht', art: 'revier', name: 'Glutlicht', preis: 300, text: 'Warmes Feuerlicht.' },
  { id: 'revier:tiefsee', art: 'revier', name: 'Tiefsee', preis: 300, text: 'Dunkles Blau.' },
].map((eintrag) => Object.freeze(eintrag)));

const GRUPPEN = [
  ['ei', 'Eier', 'Schlüpft sofort.'],
  ['hut', 'Hüte', ''],
  ['skin', 'Muster', 'Farben und Flecken für ein Biest.'],
  ['revier', 'Reviere', 'Nur zum Anschauen auf der Jagd. Die Aufgaben bleiben gleich.'],
];

let rootEl = null;
let ctx = null;
let stops = [];
let zuletzt = null;

export function unmount() {
  stoppe();
  zuletzt = null;
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
  stoppe();
  if (!rootEl || !ctx) return;
  const muenzen = ctx.store.state().coins || 0;
  rootEl.replaceChildren(el('section', { class: 'bildschirm laden' }, [
    kopf('Zurück', 'Laden', () => ctx.go('heute'), el('p', { class: 'zahl muenzstand', text: muenzWort(muenzen) })),
    zuletzt ? schlupfKarte(zuletzt) : null,
    ...GRUPPEN.map(([art, titel, text]) => reihe(titel, text, ANGEBOT.filter((a) => a.art === art))),
  ]));
}

function reihe(titel, text, artikel) {
  return el('section', { class: 'angebot-block' }, [
    el('h2', { text: titel }),
    text ? el('p', { class: 'leise', text }) : null,
    el('div', { class: 'artikel-raster' }, artikel.map(artikelKarte)),
  ]);
}

function artikelKarte(artikel) {
  const stand = ctx.store.state();
  const muenzen = stand.coins || 0;
  const gekauft = artikel.art !== 'ei' && (stand.shop?.owned || []).includes(artikel.id);
  const fehlt = artikel.preis - muenzen;
  const knapp = !gekauft && fehlt > 0;
  const label = gekauft
    ? 'Im Rudel anziehen'
    : knapp
      ? nochText(fehlt)
      : (artikel.art === 'ei' ? 'Ei öffnen' : 'Kaufen');
  const button = knopf(label, {
    className: knapp ? 'gedaempft' : '',
    onClick: () => kauf(artikel),
  });
  if (knapp) button.disabled = true;
  return el('article', { class: 'karte artikel' }, [
    el('h3', { text: artikel.name }),
    el('p', { class: 'zahl', text: muenzWort(artikel.preis) }),
    artikel.text ? el('p', { class: 'leise', text: artikel.text }) : null,
    button,
  ]);
}

function kauf(artikel) {
  const stand = ctx.store.state();
  const besitz = stand.shop?.owned || [];
  if (artikel.art !== 'ei' && besitz.includes(artikel.id)) {
    ctx.go('rudel');
    return;
  }
  if ((stand.coins || 0) < artikel.preis) return;
  if (!ctx.store.spend(artikel.preis)) return;
  if (artikel.art === 'ei') {
    const rng = Math.random;
    const rarity = ctx.biester.rollRarity(rng);
    const kandidaten = ctx.store.allWords()
      .filter((w) => (ctx.store.record(w)?.box ?? 0) >= 1)
      .map((w) => w.id);
    zuletzt = ctx.store.hatch(rarity, kandidaten, ctx.biester.randomSpecies, rng);
  } else {
    ctx.store.own(artikel.id);
  }
  zeichne();
}

function schlupfKarte(ergebnis) {
  const zeile = el('div', { class: 'neu-biest' });
  if (ergebnis?.kind === 'zier') {
    const z = ergebnis.zier || {};
    zeile.append(bildAnimiert(zierFigur(z, ergebnis.rarity), 96, 'ruhig', 'Zierbiest'));
    zeile.append(el('p', { text: 'Ein Zierbiest!' }));
  } else {
    const wort = ctx.store.allWords().find((w) => w.id === ergebnis?.wordId) || null;
    const name = wort?.en || 'Biest';
    const text = ergebnis?.kind === 'aufwertung'
      ? `${name} glänzt jetzt ${seltenheit(ergebnis.rarity)}`
      : `Neues Biest: ${name}`;
    zeile.append(bildAnimiert(figurZu(wort, ergebnis), 96, 'jubel', name));
    zeile.append(el('p', { text }));
  }
  return el('div', { class: 'karte geschluepft' }, [
    el('h2', { text: 'Geschlüpft' }),
    el('div', { class: 'neue-biester' }, [zeile]),
    knopf('Weiter', { onClick: () => { zuletzt = null; zeichne(); } }),
  ]);
}

function figurZu(wort, ergebnis) {
  const farbe = hex(wort ? farbeVon(wort) : '#6fcf6a');
  if (wort && typeof ctx.biester?.biestFor === 'function') {
    try {
      return ctx.biester.biestFor(wort, ctx.store.record(wort), ctx.store.state().biester?.[wort.id], farbe);
    } catch { /* Ersatzfigur */ }
  }
  return {
    species: 0, stage: 2, rarity: ergebnis?.rarity || 'gewoehnlich', color: farbe,
    hat: null, skin: null, name: wort?.en || 'Biest',
  };
}

function zierFigur(z, rarity) {
  return {
    species: z.species || 0,
    stage: 4,
    rarity: rarity || z.rarity || 'gewoehnlich',
    color: hex(ctx.store.activeList()?.color || '#c47cff'),
    hat: null,
    skin: null,
    name: 'Zierbiest',
  };
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

function farbeVon(wort) {
  const id = wort.list || String(wort.id || '').split('|')[0];
  return ctx.store.state().lists.find((l) => l.id === id)?.color || '#6fcf6a';
}

function kopf(zurueck, titel, onClick, extra) {
  return el('header', { class: 'schirm-kopf' }, [
    knopf(zurueck, { onClick }),
    el('div', { class: 'schirm-titel' }, [
      el('h1', { text: titel }),
      extra || null,
    ]),
  ]);
}

function stoppe() {
  for (const stop of stops.splice(0)) {
    try { stop(); } catch { /* Zeichnung schon weg */ }
  }
}

function hex(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : '#6fcf6a';
}

function muenzWort(n) {
  const wert = Math.max(0, n | 0);
  return wert === 1 ? '1 Münze' : `${wert} Münzen`;
}

function nochText(n) {
  const wert = Math.max(0, n | 0);
  return wert === 1 ? 'Noch 1 Münze' : `Noch ${wert} Münzen`;
}

function seltenheit(r) {
  if (r === 'episch') return 'besonders';
  if (r === 'selten') return 'selten';
  return 'gewöhnlich';
}
