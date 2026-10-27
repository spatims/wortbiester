// Startbildschirm. animateBiest kommt aus der Zeichnung (Paket B), nicht aus ctx:
// ARCHITEKTUR reicht nur drawBiest durch. Fehlt die Funktion, bleibt ein Standbild.
import { animateBiest } from '../render/biest.js';
import { el, knopf, setzeRevier } from './teile.js';

let stops = [];

export function unmount() {
  for (const stop of stops) { try { stop(); } catch { /* Zeichnung schon weg */ } }
  stops = [];
}

export function mount(root, ctx) {
  unmount();
  const liste = ctx.store.activeList();
  if (!liste) {
    root.append(el('section', { class: 'bildschirm heute' }, [
      el('div', { class: 'karte leer-karte' }, [
        el('h1', { text: 'Zuerst braucht ihr eine Wortliste' }),
        el('p', { class: 'hinweis', text: 'Eure eigene Liste legen die Eltern an. Zum Ausprobieren gibt es drei fertige Listen.' }),
        knopf('Mit Beispiel-Listen starten', {
          art: 'primaer', className: 'start-knopf',
          onClick: async (ev) => {
            const k = ev.currentTarget; if (k.disabled) return; k.disabled = true;
            const n = await ctx.store.importBundledLists();
            if (n > 0) ctx.go('heute'); else { k.disabled = false; k.querySelector('.knopf-text').textContent = 'Listen nicht gefunden'; }
          },
        }),
        knopf('Zu den Eltern', { art: 'sekundaer', onClick: () => ctx.go('eltern') }),
      ]),
    ]));
    return;
  }

  setzeRevier(liste.color);
  const stand = ctx.store.state();
  const ueber = ctx.store.overview();
  const zahlen = ctx.store.listStats(liste.id);
  const satt = ueber.faellig === 0 && ueber.neu === 0;
  const begleiter = el('div', { class: 'begleiter-reihe' });
  const anzahl = zeichneBegleiter(begleiter, ctx, stand);

  root.append(el('section', { class: 'bildschirm heute' }, [
    el('h1', { text: 'Wortbiester' }),
    knopf(satt ? 'Trotzdem jagen' : 'Jagd starten', {
      art: satt ? 'sekundaer' : 'primaer',
      className: 'start-knopf',
      unterzeile: unterzeile(ueber),
      onClick: () => {
        try { ctx.audio?.unlock?.(); } catch { /* Ton erst beim nächsten Tipp */ }
        ctx.startHunt();
      },
    }),
    el('div', { class: 'heute-raster' }, [
      el('div', { class: 'karte fackel-karte' }, [
        el('span', { class: 'flamme-form', aria: { hidden: 'true' } }),
        el('div', {}, [
          el('h2', { text: 'Tagesfackel' }),
          el('p', { text: fackelText(stand.fackel?.reihe || 0) }),
        ]),
      ]),
      el('div', { class: 'karte listen-karte' }, [
        el('h2', { text: liste.name }),
        el('p', { text: `${zahlen.zahm} von ${zahlen.total} zahm` }),
      ]),
    ]),
    el('div', { class: 'karte' }, [
      el('h2', { text: 'Begleiter' }),
      anzahl ? begleiter : el('p', { text: 'Noch keine Begleiter.' }),
    ]),
    el('nav', { class: 'heute-nav' }, [
      knopf('Rudel', { onClick: () => ctx.go('rudel') }),
      knopf('Laden', { onClick: () => ctx.go('laden') }),
      knopf('Eltern', { onClick: () => ctx.go('eltern') }),
    ]),
  ]));
}

function unterzeile(ueber, jetzt = Date.now()) {
  if (ueber.faellig === 0 && ueber.neu === 0) {
    const wann = ueber.naechste ? relativ(ueber.naechste, jetzt) : 'bald';
    return `Alle satt. Nächste Jagd ${wann}`;
  }
  const teile = [];
  if (ueber.faellig > 0) teile.push(ueber.faellig === 1 ? '1 Biest ist hungrig' : `${ueber.faellig} Biester sind hungrig`);
  if (ueber.neu > 0) teile.push(ueber.neu === 1 ? '1 neues' : `${ueber.neu} neue`);
  return teile.join(' · ');
}

function relativ(bis, jetzt) {
  const minuten = Math.max(0, Math.round((bis - jetzt) / 60000));
  if (minuten <= 1) return 'gleich';
  if (minuten < 60) return minuten === 1 ? 'in einer Minute' : `in ${minuten} Minuten`;
  const stunden = Math.round(minuten / 60);
  if (stunden < 24) return stunden === 1 ? 'in einer Stunde' : `in ${stunden} Stunden`;
  const tage = Math.round(stunden / 24);
  return tage === 1 ? 'morgen' : `in ${tage} Tagen`;
}

function fackelText(reihe) {
  if (!reihe) return 'Die Fackel wartet';
  if (reihe === 1) return '1 Tag am Stück';
  return `${reihe} Tage am Stück`;
}

function zeichneBegleiter(parent, ctx, stand) {
  const alle = ctx.store.allWords();
  let n = 0;
  for (const id of (stand.begleiter || []).slice(0, 3)) {
    const wort = alle.find((w) => w.id === id);
    if (!wort || typeof ctx.biester?.biestFor !== 'function') continue;
    let biest;
    try { biest = ctx.biester.biestFor(wort, ctx.store.record(id), stand.biester?.[id], farbeDerListe(ctx, wort)); }
    catch { continue; }
    haengeBiest(parent, biest, 96, () => (biest.hungrig ? 'hungrig' : 'ruhig'), ctx);
    n++;
  }
  return n;
}

function farbeDerListe(ctx, wort) {
  const id = wort.list || String(wort.id || '').split('|')[0];
  return ctx.store.state().lists.find((l) => l.id === id)?.color || '#6fcf6a';
}

function haengeBiest(parent, biest, size, getMood, ctx) {
  const canvas = el('canvas', { class: 'biest-bild', width: String(size), height: String(size) });
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
  canvas.dataset.size = String(size);
  if (biest?.name) canvas.setAttribute('aria-label', biest.name);
  parent.append(canvas);
  try {
    const stop = animateBiest(canvas, biest, getMood);
    if (typeof stop === 'function') stops.push(stop);
  } catch {
    try { ctx.drawBiest?.(canvas.getContext('2d'), biest, { mood: getMood(), t: 0, size }); } catch { /* ohne Figur */ }
  }
}
