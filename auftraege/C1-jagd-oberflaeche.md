# Paket C1 — Oberfläche: Heute, Jagd, Töne

Projekt: Wortbiester, Vokabel-Spiel für ein Kind (10–12) am Android-Tablet (Querformat, Touch), auch
am Rechner. Lies zuerst `docs/KONZEPT.md` (Abschnitte 3, 5, 6), `docs/DESIGN.md` (vollständig),
`docs/ARCHITEKTUR.md` (Abschnitte „Konkrete Aufgabe“, „Jagd-Automat“, „Bildschirme“), dann
`js/app.js`, `js/store.js`, `js/core/hunt.js`, `styles.css`. Regeln: `auftraege/README.md`.

## Auftrag

Erzeuge:
- `js/ui/teile.js` — gemeinsame Bausteine (Kopfzeile, Knöpfe, Block, Münzflug, Schilde, Route, Modal,
  `el(tag, attrs, children)`-Helfer, `escape(text)`)
- `js/ui/heute.js` — Startbildschirm
- `js/ui/jagd.js` — Aufgabe, Nachbau, Lagerfeuer, Boss, Ergebnis (ein Modul, intern mehrere Ansichten)
- `js/audio.js` — Töne und Sprachausgabe
- `styles.css` — **erweitern** (unter der vorhandenen Grundlage), nicht ersetzen

Keine anderen Dateien ändern. Die Module `js/core/tasks.js`, `js/core/biester.js`, `js/render/biest.js`
entstehen parallel; nutze nur die in ARCHITEKTUR genannten Schnittstellen. Zum Testen darfst du dir
lokale Stummel anlegen, aber nicht einchecken (lege sie unter `dev/stubs/` ab und schreibe dazu, wie man
sie einhängt).

## Bildschirm-Vertrag

Jedes Modul: `export function mount(root, ctx, params)` und `export function unmount()`. `ctx` siehe
ARCHITEKTUR „Bildschirme“. `root` ist `<main id="app">`, leer. Alles mit DOM bauen (kein Framework),
Nutzertext (Vokabeln, Listennamen) nur über `textContent` oder `escape()`.

## `heute.js`

- Großer Primärknopf **„Jagd starten“** mit Unterzeile aus `ctx.store.overview()`:
  „14 Biester sind hungrig · 3 neue“ (0 fällig und 0 neu → „Alle satt. Nächste Jagd {relative Zeit}“ und
  der Knopf heißt „Trotzdem jagen“ und ist sekundär).
- Keine Liste vorhanden → stattdessen Karte „Zuerst braucht ihr eine Wortliste“ mit Knopf zu `eltern`.
- Darunter: Tagesfackel (`fackel.reihe`, „3 Tage am Stück“), aktive Liste mit Revierfarbe und
  „7 von 12 zahm“, die bis zu drei Begleiter als animierte Biester (`ctx.drawBiest`, `animateBiest`),
  Knöpfe „Rudel“, „Laden“, „Eltern“ (sekundär, unten).
- Revierfarbe der aktiven Liste auf `document.documentElement.style.setProperty('--revier', color)`.

## `jagd.js`

Verdrahtung: `const hunt = ctx.hunt; handle(hunt.start())`. Jedes Ereignis-Array des Automaten geht
durch `handle(events)`, das die Ansicht nacheinander fortschreibt (Ereignisse können Wartezeiten
auslösen; nutze eine kleine Warteschlange mit `await`, damit z. B. „falsch“ → Lösung → Nachbau sauber
nacheinander laufen; Antippen überspringt Wartezeiten).

Kopfzeile (immer): Schilde (`state.shields`/`maxShields`), Route (`state.route`), Kombo-Flamme
(`combo`, `mult`), Beutel (`bag.coins`, Anzahl Eier), Knopf „Pause“ (Modal: „Weiter“, „Jagd
beenden“ → `hunt.summary()` an `ctx.finishHunt`, Ergebnis zeigen, als Abbruch ohne Verlust der
gesicherten Beute).

Aufgaben (nach `task.type`):
- **kennenlernen:** Karte mit Wort groß, Lautsprecher (spielt automatisch einmal), Bedeutung, Satz;
  Knopf „Verstanden“ → `hunt.skipKennenlernen()`.
- **wahl / hoeren-wahl / luecke-wahl:** Prompt oben (Wort groß oder Satz mit Lücke, Lautsprecher bei
  `audio`-Prompt, automatisch einmal spielen), Antwortblöcke als Raster (2×2 bzw. 3 untereinander),
  Tasten 1–4 am Rechner. Tipp → sofort Rückmeldung: richtig: Block grün, Sprung, Münzflug, Begleiter
  jubeln; falsch: Block rot wackelt, richtiger Block grün, dann Fehlerablauf.
- **silben / buchstaben / luecke-bauen / hoeren-bauen / nachbau:** Zielzeile mit Slots (so viele wie
  `target`), darunter die Blöcke. Tipp auf einen Block: passt er zum nächsten Slot → rutscht hinein
  (Animation 120 ms); passt er nicht → wackelt, bleibt, `hunt.wrongBlock()`; gibt das `true` zurück →
  Fehlerablauf (`hunt.answer({ correct:false })`). Letzter Slot gefüllt → `hunt.answer({ correct:true,
  usedHint })`. Knopf „Zeig mir den nächsten Block“ (setzt den nächsten richtigen Block, merkt
  `usedHint = true`). Knopf „Zurück“ nimmt den letzten gesetzten Block heraus. Am Rechner (`ctx.hasKeyboard`,
  ab Box 2): Tippen füllt die Slots buchstabenweise; wird das ganze Wort korrekt getippt, gilt
  `keyboard: true`. Bei `hoeren-bauen` die Bedeutung erst nach Lösung einblenden.
- **blitz:** drei Wahl-Aufgaben nacheinander mit Sanduhr 20 s (nur Anzeige; Ablauf = kein Bonus); jede
  einzelne wie `wahl`; am Ende eine `hunt.answer` mit `correct = alle drei richtig`. Ist
  `settings.blitz` aus, kommt der Typ gar nicht erst (srs). Blitz-Bonus: UI zeigt „Blitz!“, Münzen
  kommen vom Automaten wie sonst.
- **nachbau:** wie silben, ohne Wertung; danach `hunt.finishNachbau()`. Überschrift: „Fast. Bau es
  einmal nach.“ Das Wort steht sichtbar darüber (Abschreiben ist hier gewollt).

Fehlerablauf (Ereignis `falsch`): Schild zerspringt, Begleiter ducken sich, Lösungswort groß 1,2 s,
wird gesprochen, dann Nachbau (Ereignis `nachbau-start`).

- **Lagerfeuer** (`lagerfeuer`): Feuer-Animation, Beutel-Inhalt (Münzen, Eier als Eier-Symbole nach
  Seltenheit), zwei Knöpfe: „Beute sichern“ (primär) / „Weiter mit Einsatz“ (sekundär, Unterzeile
  „×1,5 Beute, aber kein Schild zurück“). `hunt.campfire(...)`. Nach `gesichert`: Eier öffnen sich
  nacheinander (hier nur Symbolik: „Ei gesichert“, das Schlüpfen passiert im Ergebnis).
- **Boss** (`boss-start`): anderer Rahmen (dunkelrot), Boss-Figur = großes wildes Biest
  (`drawBiest` mit `stage 0`, Art aus dem ersten Boss-Wort) mit drei Segmenten; `boss-treffer` nimmt ein
  Segment; `boss-besiegt`: Figur schrumpft zu einem Ei (Boss-Ei), Jubel.
- **Ergebnis** (`ergebnis`): `const hatched = ctx.finishHunt(summary)` **genau einmal**. Zeigen: Titel
  („Jagd geschafft“ / „Boss besiegt!“ / „Die Jagd ist vorbei“ bei Abbruch), gelernte Wörter als Liste mit
  Pfeil der Box (z. B. „explore  Ei → geschlüpft“, aus `summary.results` und `ctx.store.record`), neue
  Biester (aus `hatched`, Art `fang`: „Neues Biest: treasure“ mit Figur; `aufwertung`: „treasure glänzt
  jetzt selten“; `zier`: „Ein Zierbiest!“), Münzen, Kombo-Rekord, Fackel. Knöpfe: „Noch eine Jagd“
  (nur wenn `overview().faellig + neu > 0`, ruft `ctx.startHunt()`), „Zum Lager“ (`ctx.go('heute')`).

Begleiter: die bis zu drei Biester aus `store.state().begleiter` sitzen links unten (72 px), Stimmung
aus dem Spielverlauf (`ruhig`, `jubel` nach richtig 600 ms, `ducken` nach falsch 800 ms).

## `audio.js`

```js
export function setEnabled(on)
export function unlock()          // beim ersten Tipp (pointerdown) AudioContext erzeugen/fortsetzen
export function play(name)        // 'tipp' | 'richtig' | 'falsch' | 'muenze' | 'schild' | 'ei' | 'boss' | 'feuer' | 'blitz' | 'fanfare'
export function speak(en)         // speechSynthesis, en-GB bevorzugt, sonst en-US, Rate 0.9, bricht laufende Ausgabe ab
```
Töne per WebAudio-Oszillatoren, kurz (≤ 250 ms außer `fanfare` ≤ 900 ms), weich (Hüllkurve), nie
schrill; `falsch` dumpf und leise. Ohne `enabled` keine Töne, `speak` bleibt an (Sprachausgabe gehört
zum Lernen; eigener Schalter nicht nötig).

## `styles.css`

Alles aus `docs/DESIGN.md`: Block, Primärknopf, Karte, Schilde, Flamme, Beutel, Route, Raster für
Quer- und Hochformat, Lesehilfe, Ruhe-Modus (keine Animationen), Boss-Rahmen, Lagerfeuer. Breakpoints:
≥ 900 px Querformat-Raster, darunter gestapelt. Keine Farben außerhalb der Variablen, keine
Großbuchstaben, keine dritte Schrift.

## Abnahme

- `python3 -m http.server 8766` → `index.html` läuft mit Stummeln ohne Konsolenfehler; Heute → Jagd →
  Lagerfeuer → Boss → Ergebnis → Heute durchspielbar mit Maus und mit Touch-Emulation (390×844 Hochformat,
  1180×820 Querformat).
- Alle Antippflächen ≥ 56 px; Rückmeldung < 150 ms; kein Text in Großbuchstaben; kein Fachjargon.
- Nur die genannten Dateien geändert; Stummel unter `dev/stubs/` mit Anleitung.
