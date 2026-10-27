# Wortbiester — Architektur und Verträge

Statische Web-App, ES-Module ohne Build. Kernlogik ohne DOM, getestet mit `node:test` (`npm test`).
Start zum Entwickeln: `python3 -m http.server 8766 --bind 0.0.0.0` im Projektordner, dann am Tablet
`http://<ThinkPad-IP>:8766/`. Installation als App braucht HTTPS → GitHub Pages.

## Ordner

```
index.html            Hülle: <div id="app">, lädt js/app.js
styles.css            Gestaltung (Paket C1), Basis-Variablen stehen schon drin
manifest.webmanifest  PWA
sw.js                 Service Worker (Cache aller Dateien, Netz zuerst für index/sw)
fonts/                Nunito, Fredoka (lokal)
icons/                App-Symbole
js/app.js             Start, Router zwischen Bildschirmen, verbindet Kern und UI
js/store.js           Spielstand (localStorage), Listen, Rudel, Münzen, Einstellungen
js/sicherung.js       Listendateien, Sicherungsdateien, Prüfung
js/core/parser.js     Listenformat lesen (Wortbau-kompatibel)
js/core/srs.js        Boxen, Fälligkeit, Auswahl einer Jagd, Aufgabentyp je Box
js/core/hunt.js       Jagd-Automat: Schilde, Kombo, Beutel, Lagerfeuer, Boss, Ergebnis
js/core/tasks.js      Aufgaben bauen: Ablenker, Silben, Buchstaben, Lücken     ← Paket A
js/core/biester.js    Art, Stufe, Seltenheit, Begleiter-Vorteile              ← Paket B
js/render/biest.js    Canvas-Zeichnung der Biester                            ← Paket B
js/audio.js           Töne (WebAudio) und Sprachausgabe                        ← Paket C2
js/ui/*.js            Bildschirme                                              ← Paket C1/C2
tests/*.test.mjs      node:test
docs/                 KONZEPT, DESIGN, ARCHITEKTUR
auftraege/            Aufträge für Grok/Codex
```

## Datenmodell (Spielstand `wortbiester.v1`)

```js
{
  v: 1,
  lists: [{ id, name, color, words: [{ en, de, icon, s }] }],   // s = Beispielsatz mit dem Wort
  activeList: id | null,
  words: { [wordId]: { box, due, seen, ok, fails } },           // wordId = `${listId}|${en}`
  biester: { [wordId]: { rarity: 'gewoehnlich'|'selten'|'episch', hat: null|string, skin: null|string } },
  zier: [{ id, species, rarity }],                              // Zierbiester ohne Wort (aus Extra-Eiern)
  begleiter: [wordId, wordId, wordId],                          // bis zu 3
  coins: 0,
  shop: { owned: [itemId] },
  fackel: { lastDay: 'Mon Oct 27 2026' | null, reihe: 0 },
  stats: { jagden: 0, minuten: 0, komboRekord: 0 },
  settings: { laenge: 16, ton: true, blitz: true, ruhe: false, lesehilfe: false }
}
```

## Wortobjekt und Pool

Überall, wo ein Wort gebraucht wird: `{ id, list, en, de, icon, s }` (`store.allWords()`,
`store.listWords(listId)`). `pool` ist die Wortmenge, aus der Ablenker kommen: die eigene Liste des
Wortes, bei weniger als 6 Wörtern ergänzt um alle anderen Listen.

## Aufgaben-Spezifikation (srs → tasks)

`srs.pickHunt(...)` liefert **Spezifikationen**, `tasks.buildTask(spec, pool, rng)` macht daraus
konkrete Aufgaben. So bleibt die Auswahl testbar ohne Paket A.

```js
// Spezifikation
{ wordId, word, box, type, occ }   // occ = wievielte Aufgabe zu diesem Wort in dieser Jagd (0,1,2)

// type ∈
'kennenlernen'   // Karte, keine Wertung, immer gefolgt von 'wahl' zum selben Wort
'wahl'           // 4 Antworten; Richtung aus spec.dir: 'de→en' (Standard) oder 'en→de'
'hoeren-wahl'    // Ton abspielen, 4 englische Antworten? Nein: 4 deutsche Bedeutungen
'silben'         // Zielzeile aus Silben-Slots, Blöcke = Silben + 2 Ablenker-Silben
'buchstaben'     // Buchstaben gemischt, ab 6 Buchstaben +2 Ablenker-Buchstaben
'luecke-wahl'    // Satz mit Lücke, 3 Antworten (ähnliche Wörter)
'luecke-bauen'   // Satz mit Lücke, Wort aus Buchstaben bauen
'hoeren-bauen'   // Ton, Wort aus Buchstaben bauen, Bedeutung erst nach Lösung sichtbar
'blitz'          // drei 'wahl'-Aufgaben am Stück (aus drei Spezifikationen gebaut)
'nachbau'        // nach einem Fehler: Silben bauen ohne Wertung
```

## Konkrete Aufgabe (tasks → UI)

```js
{
  id, type, wordId, word, box, dir,
  prompt: { kind: 'de'|'en'|'audio'|'satz'|'karte', text, sentence },   // sentence mit '______' als Lücke
  options:  [{ text, correct }],          // wahl, hoeren-wahl (4), luecke-wahl (3); schon gemischt
  blocks:   [{ id, text }],               // silben, buchstaben, luecke-bauen, hoeren-bauen, nachbau; gemischt
  target:   ['ex', 'plore'],              // Reihenfolge der richtigen Block-Texte
  items:    [task, task, task],           // nur blitz
  answer:   'explore'
}
```

Prüfung der Antwort macht die UI selbst (Text vergleichen bzw. Reihenfolge der gesetzten Blöcke mit
`target`), dann `hunt.answer({ correct, usedHint })`. Bei Bau-Aufgaben: ein falscher Block wackelt und
geht zurück, das zählt noch nicht als Fehler; erst der dritte falsche Block in einer Aufgabe ist ein
Fehler (`correct: false`). Das steht so in `hunt.js` als `MAX_FALSCHE_BLOECKE = 3` und die UI liest es.

## Jagd-Automat (`js/core/hunt.js`)

```js
import { createHunt } from './core/hunt.js';
const hunt = createHunt({ specs, taskFactory, settings, rng, hasKeyboard });
// specs: Spezifikationen aus srs.pickHunt; taskFactory(spec) → Aufgabe (tasks.buildTask gebunden an pool)

hunt.state()  →
{
  phase: 'aufgabe'|'nachbau'|'lagerfeuer'|'boss'|'ergebnis'|'abbruch',
  index, total,            // 0-basiert, total = Anzahl regulärer Aufgaben (ohne Boss)
  route: [{ kind: 'aufgabe'|'feuer'|'boss', done: bool, current: bool }],
  shields, maxShields: 3, combo, mult,            // mult ∈ 1|2|3
  stake: bool,             // „Weiter mit Einsatz“ aktiv (×1,5)
  bag:  { coins, eggs: ['gewoehnlich'|'selten'|'episch'] },   // ungesichert
  safe: { coins, eggs },                                        // gesichert
  task,                    // aktuelle Aufgabe (auch im Nachbau), null am Lagerfeuer/Ergebnis
  boss: null | { total: 3, hit: 0, left: 3 },
  results: { [wordId]: { first: bool, attempts, hinted } },     // für den Ergebnisbildschirm
}

hunt.answer({ correct, usedHint })  → Ereignisse (Array), Zustand geht weiter
hunt.finishNachbau()                → Ereignisse
hunt.campfire('sichern'|'weiter')   → Ereignisse
hunt.skipKennenlernen()             → Ereignisse (Kennenlernen-Karte weggetippt)

Ereignisse:
{ type:'richtig', coins, egg|null, combo, mult }
{ type:'falsch', shields, word }           // UI: Schild zerspringt, Lösung groß, dann Nachbau
{ type:'schild-zurueck', shields }
{ type:'nachbau-start', task }
{ type:'lagerfeuer', bag }
{ type:'gesichert', eggs, coins }          // Eier schlüpfen jetzt
{ type:'einsatz' }
{ type:'boss-start', boss }
{ type:'boss-treffer', boss }
{ type:'boss-besiegt', egg, coins }
{ type:'abbruch', lost: { coins, eggs } }
{ type:'ergebnis', summary }               // summary siehe unten
{ type:'aufgabe', task }                   // die nächste Aufgabe liegt an
```

`summary`: `{ results, coins, eggs, komboRekord, aufgaben, richtig, fehler, abgebrochen, bossBesiegt }`.
Was mit `results` passiert (Box verschieben) macht `app.js` über `store.applyResult(wordId, first)`,
mit Eiern über `store.hatch(...)`. Der Automat selbst schreibt nichts.

## Bildschirme (`js/ui/*.js`)

Jeder Bildschirm ist ein Modul mit `export function mount(root, ctx)` und optional `export function
unmount()`. `root` ist das leere `<main>`; `ctx`:

```js
{
  store,                        // js/store.js (Namespace-Import)
  go(name, params),             // Bildschirm wechseln: 'heute'|'jagd'|'rudel'|'laden'|'eltern'
  audio,                        // js/audio.js
  biester,                      // js/core/biester.js
  drawBiest,                    // js/render/biest.js: drawBiest(ctx2d, biest, { mood, t, size })
  startHunt(),                  // baut Spezifikationen + Aufgaben und wechselt nach 'jagd'
  hunt,                         // laufende Jagd (nur in 'jagd')
  hasKeyboard                   // true am Rechner (Tastatur benutzt), false am Tablet
}
```

Die Jagd-Bildschirme (`ui/jagd.js`) umfassen Aufgabe, Nachbau, Lagerfeuer, Boss und Ergebnis; sie
reagieren auf die Ereignisse des Automaten. Kein Bildschirm hält eigenen Lernstand.

## Biester (`js/core/biester.js`, `js/render/biest.js`)

```js
speciesFor(en)           → eine von 12 Arten (stabiler Hash)
stageFor(box)            → 0 wild, 1 ei, 2 geschluepft, 3 gewachsen, 4 zahm, 5 glanz
rollRarity(rng, { min }) → 'gewoehnlich'|'selten'|'episch' (70/25/5), min hebt an (Boss-Ei: 'selten')
biestFor(word, record, biestState, listColor) → { species, stage, rarity, color, hat, skin, name: en }
perkFor(biest)           → null | 'schild' | 'kombo-schutz' | 'muenzen'  (nur zahme, je Art fest)
perksFor(biester[])      → eindeutige Liste der Vorteile der Begleiter (für createHunt({ perks }))
randomSpecies(rng)       → Artnummer 0–11 (für Zierbiester)
drawBiest(ctx2d, biest, { mood: 'ruhig'|'jubel'|'ducken'|'hungrig'|'ei', t, size })
```

## Aufgaben (`js/core/tasks.js`)

```js
poolFor(word, allWords)              → Ablenker-Pool: eigene Liste, unter 6 Wörtern ergänzt um alle anderen
buildTask(spec, pool, rng)           → konkrete Aufgabe (siehe oben)
syllabify(en)                        → ['ex', 'plore']  (regelbasiert, Ausnahmeliste; nie Silben unter 2 Buchstaben außer am Wortende)
similarWords(word, pool, n, rng)     → n Ablenker-Wörter, ähnlichste zuerst (Anfang, Länge, Editierdistanz)
```

## Parser (`js/core/parser.js`)

Wortbau-Format: `englisch - deutsch [- Symbol] [| Beispielsatz]`, `#`-Zeilen ignoriert. Gibt
`{ words: [{ en, de, icon, s }], errors: ['Zeile 3: …'] }`. Der Gemini-Prompt erzeugt genau dieses
Format mit `______` im Satz; der Parser akzeptiert Sätze mit dem Wort **oder** mit `______` und speichert
den Satz immer mit dem Wort (die Lücke setzt `tasks.js` zur Laufzeit).

## Zufall

Alles, was zufällig ist, nimmt `rng()` (0 ≤ x < 1) als Parameter, Standard `Math.random`. Tests nutzen
einen festen Generator (`tests/helpers.mjs: seeded(n)`).
