// Elternbereich.
//
// Präzisierungen:
// 1. Das Tor ist bei jedem Besuch eine neue Malaufgabe. Drei gleiche Knöpfe,
//    kein Passwort, die Lösung steht nicht in der Seite. Falsch heißt „Noch einmal.“
// 2. „Aus Datei laden“ schreibt nur ins Textfeld (readListFile). „Mitgelieferte
//    Listen“ holt die drei Orbit-Dateien relativ zum Modul. Name aus der Kopfzeile,
//    Wortzahl aus parseList, Übernehmen ruft addList. Gibt es den Namen schon,
//    heißt der Knopf „Schon da“.
// 3. Einspielen: Vorschau über backupStats, dann zwei Bestätigungen. Beide zeigen
//    „Der jetzige Stand wird vollständig ersetzt.“ Erst die zweite ruft restoreState.
//    Fehlertexte sind die geworfenen Meldungen.
// 4. Fortschritt ohne Rot und ohne Wertung. Fällig als Datum, sonst „jetzt“ oder „—“.
// 5. setSetting und danach applySettings, falls die Funktion da ist. Textfelder
//    ohne Browser-Rechtschreibung, beim Fokus nach oben gescrollt.
// 6. Sicherungsdatei: wortbiester-sicherung-JJJJ-MM-TT.json, Datum am Gerät.
// 7. „Kopiert“ nur nach clipboard.writeText. Sonst liegt der Prompt im Feld.

import { DEMO_TEXT, GEMINI_PROMPT, parseList } from '../core/parser.js';
import {
  backupFile, backupStats, fileName, listFile, listLines, readBackup, readListFile,
} from '../sicherung.js';
import { el, knopf, setzeRevier } from './teile.js';

const DATEIEN = [
  new URL('../../listen/orbit-1-smaragd-nebel.txt', import.meta.url),
  new URL('../../listen/orbit-2-magma-guertel.txt', import.meta.url),
  new URL('../../listen/orbit-3-tiefen-vakuum.txt', import.meta.url),
];

const REITER = [
  ['listen', 'Listen'],
  ['fortschritt', 'Fortschritt'],
  ['sichern', 'Sichern'],
  ['einstellungen', 'Einstellungen'],
];

const SCHALTER = [
  ['ton', 'Ton'],
  ['blitz', 'Blitz-Aufgaben'],
  ['ruhe', 'Ruhe-Modus'],
  ['lesehilfe', 'Lesehilfe'],
];

let rootEl = null;
let ctx = null;
let durch = false;
let reiter = 'listen';
let holgang = 0;
let editId = null;
let editName = '';
let editText = '';
let loeschId = null;
let entwurfId = null;
let entwurfName = '';
let entwurfText = '';

export function unmount() {
  holgang += 1;
  durch = false;
  reiter = 'listen';
  editId = null;
  editName = '';
  editText = '';
  loeschId = null;
  entwurfId = null;
  entwurfName = '';
  entwurfText = '';
  rootEl = null;
  ctx = null;
}

export function mount(root, neuerCtx) {
  rootEl = root;
  ctx = neuerCtx;
  setzeRevier(ctx.store.activeList()?.color);
  if (!durch) zeichneTor(false);
  else zeichne();
}

function zeichneTor(nochmal) {
  if (!rootEl || !ctx) return;
  const auf = aufgabe();
  const raster = el('div', { class: 'wahl-raster drei tor-wahl' });
  for (const wert of auf.wahlen) {
    const k = knopf(String(wert), {
      onClick: () => {
        if (wert === auf.richtig) {
          durch = true;
          zeichne();
        } else zeichneTor(true);
      },
    });
    k.classList.add('zahl');
    raster.append(k);
  }
  rootEl.replaceChildren(el('section', { class: 'bildschirm eltern' }, [
    kopfZurueck(),
    el('div', { class: 'karte tor' }, [
      el('h2', { text: 'Kurze Rechnung' }),
      el('p', { text: nochmal ? 'Noch einmal.' : 'Wie viel ist das?' }),
      el('p', { class: 'tor-frage zahl', text: auf.text }),
      raster,
    ]),
  ]));
}

function zeichne() {
  holgang += 1;
  if (!rootEl || !ctx) return;
  window.scrollTo(0, 0);
  const inhalt = el('div', { class: 'reiter-inhalt' });
  rootEl.replaceChildren(el('section', { class: 'bildschirm eltern' }, [
    kopfZurueck(),
    reiterLeiste(),
    inhalt,
  ]));
  if (reiter === 'listen') zeichneListen(inhalt);
  else if (reiter === 'fortschritt') zeichneFortschritt(inhalt);
  else if (reiter === 'sichern') zeichneSichern(inhalt);
  else zeichneEinstellungen(inhalt);
}

function reiterLeiste() {
  const leiste = el('div', { class: 'reiter-leiste', role: 'tablist' });
  for (const [id, label] of REITER) {
    const k = knopf(label, {
      className: reiter === id ? 'ist-aktiv' : '',
      onClick: () => {
        if (reiter === id) return;
        if (id !== 'listen') loeschId = null;
        reiter = id;
        zeichne();
      },
    });
    k.setAttribute('aria-pressed', String(reiter === id));
    leiste.append(k);
  }
  return leiste;
}

function zeichneListen(host) {
  const status = el('div', { class: 'leise' });
  status.hidden = true;
  const listenStand = el('div', { class: 'listen-stand' });
  function sage(text, fehler = false) {
    status.hidden = !text;
    status.textContent = text || '';
    status.className = fehler ? 'meldungs-fehler' : 'leise';
  }
  function karten() {
    if (editId && !(ctx.store.state().lists || []).some((l) => l.id === editId)) editId = null;
    const listen = ctx.store.state().lists || [];
    listenStand.replaceChildren(...(listen.length
      ? listen.map(listenKarte)
      : [el('p', { class: 'hinweis', text: 'Noch keine Liste.' })]));
  }
  function listenKarte(liste) {
    let unten;
    if (loeschId === liste.id) unten = loeschFrage(liste);
    else if (editId === liste.id) unten = editor();
    else unten = aktionen(liste);
    return el('article', {
      class: 'karte eltern-liste',
      style: { borderLeftColor: hex(liste.color) },
    }, [
      el('h2', { text: liste.name, style: { color: hex(liste.color) } }),
      el('p', { class: 'liste-meta', text: metaText(liste) }),
      unten,
    ]);
  }
  function aktionen(liste) {
    const knoepfe = [];
    if (ctx.store.state().activeList !== liste.id) {
      knoepfe.push(knopf('Aktiv setzen', { onClick: () => {
        ctx.store.setActiveList(liste.id);
        setzeRevier(liste.color);
        sage('Diese Liste ist für die Jagd.');
        karten();
      } }));
    }
    knoepfe.push(knopf('Bearbeiten', { onClick: () => {
      editId = liste.id;
      editName = liste.name;
      editText = listLines(liste.words);
      loeschId = null;
      karten();
    } }));
    knoepfe.push(knopf('Als Datei weitergeben', { onClick: () => {
      try {
        speichereDatei(`${fileName(liste.name)}.txt`, listFile(liste.name, liste.words), 'text/plain;charset=utf-8');
      } catch (err) {
        sage(err.message || 'Die Datei lässt sich nicht speichern.', true);
      }
    } }));
    knoepfe.push(knopf('Löschen', { onClick: () => {
      loeschId = liste.id;
      if (editId === liste.id) editId = null;
      karten();
    } }));
    return el('div', { class: 'aktionen' }, knoepfe);
  }
  function loeschFrage(liste) {
    return el('div', { class: 'formular' }, [
      el('p', { text: 'Wirklich? Die Biester dieser Liste verschwinden.' }),
      knopf('Ja, löschen', { onClick: () => {
        ctx.store.deleteList(liste.id);
        if (editId === liste.id) editId = null;
        if (entwurfId === liste.id) entwurfId = null;
        loeschId = null;
        setzeRevier(ctx.store.activeList()?.color);
        sage('Die Liste ist weg.');
        karten();
      } }),
      knopf('Behalten', { onClick: () => { loeschId = null; karten(); } }),
    ]);
  }
  function editor() {
    const nameFeld = el('input', {
      type: 'text', class: 'feld', value: editName, autocomplete: 'off', aria: { label: 'Name der Liste' },
    });
    const textFeld = el('textarea', {
      class: 'feld', spellcheck: 'false', autocapitalize: 'off', aria: { label: 'Vokabeln' }, text: editText,
    });
    const vorschau = el('div', { class: 'vorschau' });
    beimTippen(nameFeld);
    beimTippen(textFeld);
    nameFeld.addEventListener('input', () => { editName = nameFeld.value; });
    textFeld.addEventListener('input', () => {
      editText = textFeld.value;
      maleVorschau(vorschau, textFeld.value);
    });
    maleVorschau(vorschau, editText);
    return el('div', { class: 'formular' }, [
      nameFeld,
      textFeld,
      vorschau,
      knopf('Speichern', { onClick: () => {
        editName = nameFeld.value;
        editText = textFeld.value;
        const erg = ctx.store.updateList(editId, editName, editText);
        if (!erg.ok) {
          sage(erg.errors?.[0] || 'Keine Vokabeln erkannt.', true);
          return;
        }
        if (erg.errors?.length) sage('Gespeichert. Die roten Zeilen sind nicht mitgekommen.');
        else {
          editId = null;
          sage('Gespeichert.');
        }
        karten();
      } }),
      knopf('Abbrechen', { onClick: () => { editId = null; karten(); } }),
    ]);
  }

  const vorschau = el('div', { class: 'vorschau' });
  const nameFeld = el('input', {
    type: 'text', class: 'feld', value: entwurfName, autocomplete: 'off',
    placeholder: 'Name', aria: { label: 'Name der Liste' },
  });
  const textFeld = el('textarea', {
    class: 'feld', spellcheck: 'false', autocapitalize: 'off',
    placeholder: 'englisch - deutsch | Satz mit ______',
    aria: { label: 'Vokabeln' }, text: entwurfText,
  });
  const datei = el('input', { type: 'file', accept: '.txt,text/plain', class: 'datei-versteckt' });
  const promptFeld = el('textarea', {
    class: 'feld', readonly: true, spellcheck: 'false', aria: { label: 'Gemini-Prompt' }, text: GEMINI_PROMPT,
  });
  promptFeld.hidden = true;
  const panel = el('div', { class: 'mitgeliefert' });
  beimTippen(nameFeld);
  beimTippen(textFeld);
  beimTippen(promptFeld);
  nameFeld.addEventListener('input', () => { entwurfName = nameFeld.value; });
  textFeld.addEventListener('input', () => {
    entwurfText = textFeld.value;
    maleVorschau(vorschau, textFeld.value);
  });
  datei.addEventListener('change', async () => {
    const file = datei.files && datei.files[0];
    datei.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const gelesen = readListFile(text, file.name, file.size);
      nameFeld.value = gelesen.name;
      textFeld.value = gelesen.text;
      entwurfName = gelesen.name;
      entwurfText = gelesen.text;
      entwurfId = null;
      maleVorschau(vorschau, gelesen.text);
      textFeld.focus();
    } catch (err) {
      sage(err.message || 'Die Datei lässt sich nicht lesen.', true);
    }
  });
  function beispiel() {
    if (!nameFeld.value.trim()) {
      nameFeld.value = 'Beispiel';
      entwurfName = 'Beispiel';
    }
    textFeld.value = DEMO_TEXT;
    entwurfText = DEMO_TEXT;
    entwurfId = null;
    maleVorschau(vorschau, DEMO_TEXT);
    textFeld.focus();
  }
  function speichereNeu() {
    if (entwurfId && !(ctx.store.state().lists || []).some((l) => l.id === entwurfId)) entwurfId = null;
    const name = nameFeld.value;
    const text = textFeld.value;
    entwurfName = name;
    entwurfText = text;
    const erg = entwurfId
      ? ctx.store.updateList(entwurfId, name, text)
      : ctx.store.addList(name, text);
    if (!erg.ok) {
      sage(erg.errors?.[0] || 'Keine Vokabeln erkannt.', true);
      return;
    }
    if (erg.errors?.length) {
      entwurfId = erg.id;
      sage('Gespeichert. Die roten Zeilen sind nicht mitgekommen.');
    } else {
      entwurfId = null;
      entwurfName = '';
      entwurfText = '';
      nameFeld.value = '';
      textFeld.value = '';
      maleVorschau(vorschau, '');
      sage('Gespeichert.');
    }
    setzeRevier(ctx.store.activeList()?.color);
    karten();
  }
  const holKnopf = knopf('Mitgelieferte Listen', { onClick: () => holeMitgeliefert(panel, holKnopf, sage, karten) });

  host.append(
    status,
    listenStand,
    el('div', { class: 'karte formular' }, [
      el('h2', { text: 'Neue Liste' }),
      nameFeld,
      textFeld,
      vorschau,
      el('div', { class: 'aktionen' }, [
        knopf('Aus Datei laden', { onClick: () => datei.click() }),
        knopf('Beispiel einfügen', { onClick: beispiel }),
        holKnopf,
        knopf('Gemini-Prompt kopieren', { onClick: () => kopiere(promptFeld, sage) }),
      ]),
      el('p', { class: 'leise', text: 'Mach ein Foto von der Vokabelseite und zeige es Gemini. Kopiere den Prompt dazu und setze die Antwort hier ins Feld.' }),
      datei,
      promptFeld,
      panel,
      knopf('Speichern', { art: 'primaer', onClick: speichereNeu }),
    ]),
  );
  maleVorschau(vorschau, entwurfText);
  karten();
}

async function holeMitgeliefert(panel, knopfEl, sage, karten) {
  const meine = ++holgang;
  knopfEl.disabled = true;
  panel.replaceChildren(el('p', { class: 'leise', text: 'Einen Moment.' }));
  const kartenDaten = await Promise.all(DATEIEN.map(ladeEine));
  if (meine !== holgang || !panel.isConnected) return;
  knopfEl.disabled = false;
  panel.replaceChildren(...kartenDaten.map((eintrag) => karteMit(eintrag, sage, karten)));
}

async function ladeEine(url) {
  try {
    const antwort = await fetch(url);
    if (!antwort.ok) throw new Error('Die Liste lädt gerade nicht.');
    const text = await antwort.text();
    const gelesen = readListFile(text, dateiName(url), new TextEncoder().encode(text).length);
    const erkannt = parseList(gelesen.text);
    return {
      name: gelesen.name,
      text: gelesen.text,
      worte: erkannt.words.length,
      unklar: erkannt.errors.length,
    };
  } catch (err) {
    return { fehler: err.message || 'Die Liste lädt gerade nicht.' };
  }
}

function karteMit(eintrag, sage, karten) {
  if (eintrag.fehler) {
    return el('article', { class: 'karte mit-karte' }, [
      el('p', { class: 'vorschau-fehler', text: eintrag.fehler }),
    ]);
  }
  const schon = (ctx.store.state().lists || []).some((l) => l.name === eintrag.name);
  const button = knopf(schon ? 'Schon da' : 'Übernehmen', {
    onClick: () => uebernehmen(eintrag, button, sage, karten),
  });
  if (schon || !eintrag.worte) button.disabled = true;
  return el('article', { class: 'karte mit-karte' }, [
    el('h3', { text: eintrag.name }),
    el('p', { text: eintrag.worte === 1 ? '1 Wort' : `${eintrag.worte} Wörter` }),
    eintrag.unklar
      ? el('p', {
        class: 'vorschau-fehler',
        text: eintrag.unklar === 1 ? '1 Zeile unklar' : `${eintrag.unklar} Zeilen unklar`,
      })
      : null,
    eintrag.worte ? button : el('p', { class: 'vorschau-fehler', text: 'Keine Vokabeln erkannt.' }),
  ]);
}

function uebernehmen(eintrag, button, sage, karten) {
  if ((ctx.store.state().lists || []).some((l) => l.name === eintrag.name)) {
    button.disabled = true;
    const label = button.querySelector('.knopf-text');
    if (label) label.textContent = 'Schon da';
    return;
  }
  const erg = ctx.store.addList(eintrag.name, eintrag.text);
  if (!erg.ok) {
    sage(erg.errors?.[0] || 'Keine Vokabeln erkannt.', true);
    return;
  }
  button.disabled = true;
  const label = button.querySelector('.knopf-text');
  if (label) label.textContent = 'Schon da';
  sage(erg.errors?.length ? 'Die Liste ist da. Ein paar Zeilen waren unklar.' : 'Die Liste ist da.');
  setzeRevier(ctx.store.activeList()?.color);
  karten();
}

async function kopiere(promptFeld, sage) {
  try {
    if (!navigator.clipboard?.writeText) throw new Error('kein Clipboard');
    await navigator.clipboard.writeText(GEMINI_PROMPT);
    promptFeld.hidden = true;
    sage('Kopiert');
  } catch {
    promptFeld.hidden = false;
    sage('Markiere den Text und kopiere ihn selbst.');
    promptFeld.focus();
    try { promptFeld.select(); } catch { /* ohne Auswahl */ }
  }
}

function zeichneFortschritt(host) {
  const stand = ctx.store.state();
  const stats = stand.stats || {};
  host.append(el('div', { class: 'karte kennzahlen' }, [
    el('p', { text: zahlWort(stats.jagden || 0, 'Jagd', 'Jagden') }),
    el('p', { text: zahlWort(stats.minuten || 0, 'Minute', 'Minuten') }),
    el('p', { text: `Fackel-Reihe ${stand.fackel?.reihe || 0}` }),
  ]));
  const listen = stand.lists || [];
  if (!listen.length) {
    host.append(el('p', { class: 'hinweis', text: 'Noch keine Liste.' }));
    return;
  }
  for (const liste of listen) {
    const woerter = ctx.store.listWords(liste.id);
    host.append(el('section', { class: 'revier-block' }, [
      el('h2', { class: 'revier-titel', text: liste.name, style: { color: hex(liste.color) } }),
      woerter.length
        ? tabelle(['Wort', 'Stufe', 'Fällig am', 'Versuche'], woerter.map((wort) => {
          const rec = ctx.store.record(wort);
          return [
            wort.en,
            rec ? stufenName(rec.box) : '—',
            faelligAm(rec),
            rec ? `${rec.ok} richtig · ${rec.fails} falsch` : '—',
          ];
        }))
        : el('p', { class: 'leise', text: 'Keine Wörter.' }),
    ]));
  }
}

function zeichneSichern(host) {
  const kasten = el('div', { class: 'karte formular' });
  const meldung = el('p', { class: 'leise' });
  const datei = el('input', { type: 'file', accept: '.json,application/json', class: 'datei-versteckt' });
  host.append(kasten, meldung);
  function sage(text, fehler = false) {
    meldung.textContent = text || '';
    meldung.className = fehler ? 'meldungs-fehler' : 'leise';
  }
  function sichernJetzt() {
    try {
      speichereDatei(sicherungsName(), backupFile(ctx.store.state()), 'application/json');
    } catch (err) {
      sage(err.message || 'Die Datei lässt sich nicht speichern.', true);
    }
  }
  function zurueckholen() {
    try {
      if (!ctx.store.recoverPreviousState()) {
        sage('Es gibt keinen früheren Stand.', true);
        male(0, null);
        return;
      }
      wendeAn();
      setzeRevier(ctx.store.activeList()?.color);
      male(0, null);
      sage('Der vorige Stand ist wieder da.');
    } catch (err) {
      sage(err.message || 'Der frühere Stand lässt sich nicht lesen.', true);
    }
  }
  function ersetzen(daten) {
    try {
      ctx.store.restoreState(daten.stand);
      wendeAn();
      setzeRevier(ctx.store.activeList()?.color);
      male(0, null);
      sage('Der Stand ist wieder da.');
    } catch (err) {
      sage(err.message || 'Das Einspielen hat nicht geklappt.', true);
    }
  }
  datei.addEventListener('change', async () => {
    const file = datei.files && datei.files[0];
    datei.value = '';
    if (!file) return;
    try {
      const daten = readBackup(await file.text(), file.size);
      sage('');
      male(1, daten);
    } catch (err) {
      sage(err.message || 'Die Datei lässt sich nicht lesen.', true);
    }
  });
  function male(schritt, daten) {
    const kinder = [
      knopf('Spielstand als Datei sichern', { art: 'primaer', onClick: sichernJetzt }),
      el('p', { class: 'leise', text: 'Die Datei bleibt auf dem Gerät.' }),
    ];
    if (schritt === 0) {
      kinder.push(knopf('Sicherung einspielen', { onClick: () => datei.click() }));
      kinder.push(datei);
      if (ctx.store.hasPreviousState()) kinder.push(knopf('Vorherigen Stand zurückholen', { onClick: zurueckholen }));
    } else {
      kinder.push(el('p', { text: vorschauSicherung(daten) }));
      const wann = uhrzeit(daten.gesichert);
      if (wann) kinder.push(el('p', { class: 'leise', text: `Aus der Datei vom ${wann}.` }));
      kinder.push(el('p', { text: 'Der jetzige Stand wird vollständig ersetzt.' }));
      if (schritt === 1) kinder.push(knopf('Ja, ersetzen', { onClick: () => male(2, daten) }));
      else {
        kinder.push(el('p', { text: 'Noch einmal: der jetzige Stand ist dann weg.' }));
        kinder.push(knopf('Jetzt ersetzen', { onClick: () => ersetzen(daten) }));
      }
      kinder.push(knopf('Abbrechen', { onClick: () => { sage(''); male(0, null); } }));
    }
    kasten.replaceChildren(...kinder);
  }
  male(0, null);
}

function zeichneEinstellungen(host) {
  const oben = el('div', { class: 'karte formular' });
  const gefahr = el('div', { class: 'karte formular' });
  const meldung = el('p', { class: 'leise' });
  host.append(oben, gefahr, meldung);
  function maleOben() {
    const ein = ctx.store.state().settings || {};
    const laengen = el('div', { class: 'laengen' });
    for (const n of [12, 16, 20]) {
      const k = knopf(String(n), {
        className: ein.laenge === n ? 'ist-aktiv' : '',
        onClick: () => {
          ctx.store.setSetting('laenge', n);
          wendeAn();
          maleOben();
        },
      });
      k.setAttribute('aria-pressed', String(ein.laenge === n));
      k.setAttribute('aria-label', `Jagd mit ${n} Aufgaben`);
      laengen.append(k);
    }
    oben.replaceChildren(
      el('h2', { text: 'Einstellungen' }),
      el('p', { class: 'leise', text: 'Wirkt sofort.' }),
      el('p', { text: 'Länge der Jagd' }),
      el('p', { class: 'leise', text: '12, 16 oder 20 Aufgaben.' }),
      laengen,
      ...SCHALTER.map(([key, label]) => {
        const an = !!ein[key];
        const k = knopf(an ? 'an' : 'aus', {
          className: an ? 'ist-aktiv' : '',
          onClick: () => {
            ctx.store.setSetting(key, !ein[key]);
            wendeAn();
            maleOben();
          },
        });
        k.setAttribute('aria-pressed', String(an));
        k.setAttribute('aria-label', `${label} ${an ? 'an' : 'aus'}`);
        return el('div', { class: 'schalter-zeile' }, [el('span', { text: label }), k]);
      }),
    );
  }
  function maleGefahr(fragen) {
    if (!fragen) {
      gefahr.replaceChildren(knopf('Alles zurücksetzen', { onClick: () => maleGefahr(true) }));
      return;
    }
    gefahr.replaceChildren(
      el('p', { text: 'Wirklich? Listen, Biester und Münzen sind dann weg.' }),
      el('div', { class: 'aktionen' }, [
        knopf('Ja, alles löschen', { onClick: () => {
          ctx.store.reset();
          wendeAn();
          setzeRevier(null);
          editId = null;
          entwurfId = null;
          loeschId = null;
          maleOben();
          maleGefahr(false);
          meldung.textContent = 'Alles ist leer.';
        } }),
        knopf('Behalten', { onClick: () => maleGefahr(false) }),
      ]),
    );
  }
  maleOben();
  maleGefahr(false);
}

function metaText(liste) {
  const stats = ctx.store.listStats(liste.id);
  const basis = `${stats.total === 1 ? '1 Wort' : `${stats.total} Wörter`} · ${stats.zahm} von ${stats.total} zahm`;
  return ctx.store.state().activeList === liste.id ? `${basis} · aktiv` : basis;
}

function maleVorschau(ziel, text) {
  const roh = String(text || '');
  const { words, errors } = parseList(roh);
  if (!roh.trim() && !errors.length) {
    ziel.replaceChildren();
    return;
  }
  const kinder = [];
  if (words.length) {
    kinder.push(tabelle(['Wort', 'Bedeutung', 'Satz'], words.map((w) => [w.en, w.de, w.s || ''])));
  } else if (!errors.length) kinder.push(el('p', { class: 'leise', text: 'Noch nichts erkannt.' }));
  for (const fehler of errors) kinder.push(el('p', { class: 'vorschau-fehler', text: fehler }));
  ziel.replaceChildren(...kinder);
}

function tabelle(kopf, zeilen) {
  const table = el('table', { class: 'wort-tabelle' });
  table.append(el('thead', {}, [el('tr', {}, kopf.map((h) => el('th', { scope: 'col', text: h })))]));
  const body = el('tbody');
  for (const zeile of zeilen) body.append(el('tr', {}, zeile.map((zelle) => el('td', { text: String(zelle) }))));
  table.append(body);
  return el('div', { class: 'tabelle-scroll' }, [table]);
}

function vorschauSicherung(daten) {
  const z = backupStats(daten.stand);
  const teile = [
    z.lists === 1 ? '1 Liste' : `${z.lists} Listen`,
    z.words === 1 ? '1 Wort' : `${z.words} Wörter`,
    `${z.zahm} zahm`,
    z.biester === 1 ? '1 Biest' : `${z.biester} Biester`,
    z.coins === 1 ? '1 Münze' : `${z.coins} Münzen`,
  ];
  const zier = Array.isArray(daten.stand.zier) ? daten.stand.zier.length : 0;
  if (zier) teile.push(zier === 1 ? '1 Zierbiest' : `${zier} Zierbiester`);
  return teile.join(' · ');
}

function aufgabe(rng = Math.random) {
  const a = 2 + Math.floor(rng() * 8);
  const b = 2 + Math.floor(rng() * 8);
  const richtig = a * b;
  const falsch = [];
  let schutz = 0;
  while (falsch.length < 2 && schutz < 30) {
    schutz += 1;
    const schritt = 1 + Math.floor(rng() * 4);
    const wert = rng() < 0.5 ? richtig + schritt : richtig - schritt;
    if (wert > 0 && wert !== richtig && !falsch.includes(wert)) falsch.push(wert);
  }
  while (falsch.length < 2) falsch.push(richtig + falsch.length + 1);
  return { text: `${a} × ${b} = ?`, richtig, wahlen: mischen([richtig, ...falsch], rng) };
}

function mischen(liste, rng) {
  const a = [...liste];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function stufenName(box) {
  const stufe = typeof ctx.biester?.stageFor === 'function'
    ? ctx.biester.stageFor(box)
    : Math.max(0, Math.min(5, Math.floor(Number(box) || 0)));
  const namen = ctx.biester?.STAGE_NAMES || ['wild', 'Ei', 'geschlüpft', 'gewachsen', 'zahm', 'zahm · glänzend'];
  return namen[stufe] || 'wild';
}

function faelligAm(record, jetzt = Date.now()) {
  if (!record) return '—';
  if (record.due <= jetzt) return 'jetzt';
  const d = new Date(record.due);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('de-DE', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function uhrzeit(iso) {
  const d = new Date(iso || '');
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function sicherungsName(datum = new Date()) {
  const monat = String(datum.getMonth() + 1).padStart(2, '0');
  const tag = String(datum.getDate()).padStart(2, '0');
  return `wortbiester-sicherung-${datum.getFullYear()}-${monat}-${tag}.json`;
}

function speichereDatei(name, inhalt, typ) {
  const blob = new Blob([inhalt], { type: typ });
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: name, class: 'datei-versteckt' });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function beimTippen(feld) {
  feld.addEventListener('focus', () => {
    setTimeout(() => feld.scrollIntoView({ block: 'start' }), 50);
  });
}

function wendeAn() {
  if (typeof ctx?.applySettings === 'function') ctx.applySettings();
}

function kopfZurueck() {
  return el('header', { class: 'schirm-kopf' }, [
    knopf('Zurück zum Lager', { onClick: () => ctx.go('heute') }),
    el('h1', { text: 'Für Eltern' }),
  ]);
}

function dateiName(url) {
  const pfad = url.pathname || String(url);
  return decodeURIComponent(pfad.slice(pfad.lastIndexOf('/') + 1));
}

function zahlWort(n, eins, viele) {
  const wert = n | 0;
  return `${wert} ${wert === 1 ? eins : viele}`;
}

function hex(color) {
  return /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? color : '#6fcf6a';
}
