# Paket C2 — Oberfläche: Rudel, Laden, Eltern

Projekt: Wortbiester (siehe `docs/KONZEPT.md` Abschnitte 4, 5; `docs/DESIGN.md`; `docs/ARCHITEKTUR.md`
„Bildschirme“, „Biester“, „Datenmodell“; `js/store.js`, `js/sicherung.js`, `js/core/parser.js`,
`js/ui/teile.js` aus Paket C1). Regeln: `auftraege/README.md`.

## Auftrag

Erzeuge `js/ui/rudel.js`, `js/ui/laden.js`, `js/ui/eltern.js`; erweitere `styles.css` (nur anhängen).
Bausteine aus `js/ui/teile.js` wiederverwenden, nicht duplizieren. Keine anderen Dateien ändern.

## `rudel.js` — Album

- Kopf: Zurück-Knopf zu `heute`, Titel „Dein Rudel“, Zähler „23 Biester · 9 zahm“.
- Raster nach Listen (Revier) gruppiert, Listenname als Überschrift in Revierfarbe. Jede Kachel: Biest
  (`ctx.drawBiest`, Standbild per `biestCanvas`, 96 px), Name (englisches Wort), Stufenname. Wörter ohne
  Biest erscheinen als wilde Silhouette (Stufe 0) mit „?“ statt Name, antippbar: Karte zeigt nur „Noch
  nicht gefangen“. Hungrige Biester (fällig) bekommen Sprechblase; oben ein Filter „nur hungrige“.
- Biest-Karte (Modal): großes animiertes Biest, Wort, Bedeutung, Satz, Lautsprecher, Stufe mit
  Fortschrittspunkten (6), Seltenheit, nächste Fälligkeit in Kindersprache („schläft bis morgen früh“,
  „ist hungrig“), Vorteil (`describePerk`) wenn zahm, Knopf „Als Begleiter mitnehmen“ / „Zu Hause lassen“
  (`store.setBegleiter`, höchstens 3; bei vollem Platz kurze Meldung, welches Biest zuerst weg müsste),
  Knopf „Anziehen“ → Auswahl aus gekauften Hüten/Skins (`store.state().shop.owned`, `setBiestLook`).
- Zierbiester als eigener Abschnitt „Zierbiester“.

## `laden.js`

- Münzstand oben. Angebot in drei Reihen: **Eier** (100 Münzen; schlüpfen sofort über `store.hatch`
  mit allen Wörtern mit Box ≥ 1 als Kandidaten; Ergebnis wie im Ergebnisbildschirm zeigen), **Hüte**
  (6, je 50–120), **Skins** (4, je 150–200), **Reviere** (Hintergrund-Stimmungen für die Jagd, 300;
  rein dekorativ, `shop.owned` mit `revier:*`, die Jagd-UI darf sie ignorieren, bis C1 sie nutzt).
- Nicht genug Münzen: Knopf gedämpft mit „Noch 40 Münzen“. Gekauft: „Im Rudel anziehen“.
- Artikel-Liste als `export const ANGEBOT = [...]` oben im Modul, damit Preise an einer Stelle stehen.

## `eltern.js`

Zugang: kleine Rechenaufgabe (z. B. „7 × 8 = ?“, drei Antwortknöpfe), kein Passwort. Danach Reiter:

1. **Listen:** alle Listen mit Name, Anzahl, zahm/gesamt, Revierfarbe, „aktiv“-Markierung. Knöpfe:
   „Aktiv setzen“, „Bearbeiten“ (Name + Textfeld mit `listLines`, Vorschau der Fehler aus `parseList`
   vor dem Speichern, `store.updateList`), „Als Datei weitergeben“ (`listFile`, Download), „Löschen“
   (zweistufig: „Wirklich? Die Biester dieser Liste verschwinden.“). „Neue Liste“: Name, Textfeld,
   „Aus Datei laden“ (`readListFile`, nur in das Textfeld), „Beispiel einfügen“ (`DEMO_TEXT`),
   **„Gemini-Prompt kopieren“** (`GEMINI_PROMPT`, `navigator.clipboard`, Rückmeldung „Kopiert“) mit
   Anleitung in zwei Sätzen: Foto der Buchseite in Gemini, Prompt dazu, Antwort hier einfügen.
   Live-Vorschau: erkannte Wörter als Tabelle, Fehlerzeilen rot mit Hinweis.
2. **Fortschritt:** je Liste Tabelle Wort · Stufe · fällig am · Versuche richtig/falsch. Nüchtern, ohne
   Wertung, keine roten Flächen. Oben Kennzahlen: Jagden, Minuten gesamt, Fackel-Reihe.
3. **Sichern:** „Spielstand als Datei sichern“ (`backupFile`, Dateiname `wortbiester-sicherung-JJJJ-MM-TT.json`),
   „Sicherung einspielen“: Datei wählen → `readBackup` → Vorschau (`backupStats`) → zweifache
   Bestätigung („Der jetzige Stand wird vollständig ersetzt“) → `store.restoreState`. „Vorherigen Stand
   zurückholen“ (nur wenn `hasPreviousState()`). Fehlertexte aus den geworfenen Fehlern anzeigen.
4. **Einstellungen:** Länge der Jagd (12/16/20), Ton, Blitz-Aufgaben, Ruhe-Modus, Lesehilfe
   (`store.setSetting`, danach `ctx.applySettings()`). Knopf „Alles zurücksetzen“ zweistufig.

Jeder Reiter hat oben „Zurück zum Lager“. Textfelder dürfen die Bildschirmtastatur öffnen (im Eltern-
Bereich ist Tippen in Ordnung); beim Öffnen nach oben scrollen.

## Abnahme

- Rudel zeigt Biester aller Stufen, Karte funktioniert, Begleiterwahl begrenzt auf 3.
- Laden kauft und verweigert korrekt; Münzstand live.
- Eltern: Liste anlegen aus Gemini-Text mit `______`, Fehlerzeile wird angezeigt, Datei-Export lässt
  sich wieder laden; Sicherung hin und zurück; Einstellungen wirken sofort.
- Keine Konsolenfehler, nur die genannten Dateien geändert.
