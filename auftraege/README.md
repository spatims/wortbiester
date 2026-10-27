# Aufträge (Stand 27.10.2026)

Vier abgegrenzte Pakete. A, B und C1 sind unabhängig voneinander und können parallel laufen; C2 kommt
danach (braucht B für die Biest-Bilder, geht zur Not auch vorher nach Vertrag).

| Paket | Datei | Erzeugt | Stand |
|---|---|---|---|
| A | `A-aufgaben.md` | `js/core/tasks.js`, `tests/tasks.test.mjs` | offen |
| B | `B-biester.md` | `js/core/biester.js`, `js/render/biest.js`, `tests/biester.test.mjs`, `dev/biester.html` | offen |
| C1 | `C1-jagd-oberflaeche.md` | `js/ui/teile.js`, `js/ui/heute.js`, `js/ui/jagd.js`, `js/audio.js`, Erweiterung `styles.css` | offen |
| C2 | `C2-rudel-laden-eltern.md` | `js/ui/rudel.js`, `js/ui/laden.js`, `js/ui/eltern.js`, Erweiterung `styles.css` | offen |

## So laufen lassen

**Mit cursor-agent (Grok) im Projektordner** — dann liest das Modell die Verträge selbst und schreibt
die Dateien direkt:

    cd ~/Projects/wortbiester
    cursor-agent --model grok   # Prompt: „Lies auftraege/A-aufgaben.md und führe den Auftrag aus.“

**In der Grok-App/Web:** Inhalt der Auftragsdatei einfügen, dazu `docs/ARCHITEKTUR.md`,
`docs/KONZEPT.md` und `docs/DESIGN.md` anhängen (bei C1/C2 zusätzlich `styles.css`, `js/app.js`,
`js/store.js`). Die gelieferten Dateien genau an die genannten Pfade speichern.

Danach: `npm test` muss grün sein. Claude macht die Abnahme und die Verdrahtung.

## Regeln für alle Pakete

- Nur die genannten Dateien anlegen oder ändern. Verträge in `docs/ARCHITEKTUR.md` gelten wörtlich;
  wer etwas am Vertrag ändern muss, schreibt es als Kommentar oben in die Datei, statt still abzuweichen.
- Reines JavaScript, ES-Module, kein Build, keine Abhängigkeiten, kein Framework, kein TypeScript.
- Deutsch in der Oberfläche (du-Form, Kindersprache, keine Fachwörter, keine Großbuchstaben-Zeilen),
  Deutsch in Kommentaren. Code-Namen englisch oder deutsch, aber einheitlich innerhalb einer Datei.
- Touch zuerst: Antippflächen mindestens 56×56 px, 12 px Abstand, keine Hover-Information.
- Zufall immer über einen übergebenen `rng()`-Parameter (Standard `Math.random`), damit Tests
  deterministisch sind.
- Kein `innerHTML` mit Nutzertext ohne Escaping (Vokabeln kommen aus Dateien).
