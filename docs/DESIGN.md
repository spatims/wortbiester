# Wortbiester — Gestaltung

Zielgerät: Android-Tablet 10", Querformat, Chrome als installierte Web-App (Vollbild). Muss auch im
Hochformat und am Rechner (1366×768 bis 1920×1080) funktionieren. Alles ist Touch zuerst: keine
Hover-Zustände als Informationsträger, nichts kleiner als 56×56 px antippbar, 12 px Abstand zwischen
Zielen, nichts Wichtiges am äußersten Rand (Android-Gesten).

## Stimmung

Nachtwald-Expedition: dunkler, warmer Grund, Lagerfeuer-Licht, kräftige Revierfarben als Akzent.
Wirkt wie ein Spiel, nicht wie eine Lern-App und nicht wie ein Sci-Fi-Cockpit. Freundlich-frech, nicht
niedlich-babyhaft. Vorbilder für Haptik: Duolingo (Blöcke, Druck-Gefühl), Alto's Odyssey (Ruhe),
Pokémon (Sammeln). Keine Partikelorgien, Effekte kurz und gezielt.

## Farben (CSS-Variablen in `styles.css`)

```
--grund:        #141a26   (Seitenhintergrund)
--grund-2:      #1c2433   (Karten)
--grund-3:      #263044   (Blöcke, erhöht)
--linie:        #34405a
--text:         #f3f5f9
--text-2:       #aeb8cc
--glut:         #ff9f43   (Lagerfeuer, Kombo, Primärknopf)
--glut-dunkel:  #d97a1f
--muenze:       #ffd166
--schild:       #5dd6ff
--fehler:       #ff5e7a
--richtig:      #5de0a1
```

Revierfarben (je Liste eine, rotierend): Moos `#6fcf6a`, Glut `#ff7a59`, Eis `#6dd3ff`, Beere `#c47cff`,
Sand `#f2c879`, Tiefsee `#4fa3ff`. Sie färben Routen, Biester-Grundfarbe und die Karte der Liste.

Kontrast: Text auf Grund mindestens 7:1, Text auf Blöcken mindestens 4,5:1. Farbe ist nie der einzige
Träger (richtig = grün **und** Haken **und** Sprung).

## Schrift

- Lesen: **Nunito** (variabel, lokal `fonts/nunito-latin-wght.woff2`), 18 px Grundgröße am Tablet,
  Aufgabenwort 40–56 px, Blöcke 24–28 px fett.
- Titel und Zahlen: **Fredoka** (lokal `fonts/fredoka-latin-wght.woff2`).
- Keine dritte Schrift, keine Großbuchstaben-Zeilen, keine Mono-Schrift.
- Lesehilfe-Einstellung: +15 % Schrift, Zeilenabstand 1,6, Buchstabenabstand 0,02 em.

## Bausteine

- **Block** (Antwort, Silbe, Buchstabe): `--grund-3`, Radius 14 px, 4 px Schatten unten in dunklerer
  Farbe (`box-shadow: 0 4px 0 #0f1420`), beim Drücken `transform: translateY(4px)` und Schatten 0.
  Gewählt: Rand in Revierfarbe. Richtig: Füllung `--richtig`, kurzer Sprung (120 ms). Falsch: Füllung
  `--fehler`, kurzes Wackeln (160 ms), dann zurück.
- **Primärknopf** (Jagd starten, Sichern, Weiter): `--glut`, Text dunkel, Höhe 64 px, Radius 18 px,
  gleicher Druck-Schatten. Es gibt pro Bildschirm höchstens einen.
- **Karte:** `--grund-2`, Radius 20 px, Innenabstand 20 px, keine Rahmen-in-Rahmen.
- **Schilde:** drei Schild-Symbole oben links, voll `--schild`, leer nur Umriss. Zerspringen: Symbol
  bricht in zwei Hälften (CSS-Animation 300 ms).
- **Kombo-Flamme:** kleine Flamme neben der Zahl; wächst in drei Größen (×1, ×2, ×3). Bei 0 nur Glut.
- **Beutel:** Symbol oben rechts mit Zähler, Münzen fliegen beim Treffer dorthin (ein Partikelpfad,
  400 ms, maximal 6 Münzen).
- **Route:** schmale Leiste unter dem Kopf: 16 Punkte in 4 Gruppen, Lagerfeuer-Symbole dazwischen,
  Boss-Symbol am Ende, Position als leuchtender Punkt.

## Bildschirm-Raster (Querformat)

```
┌──────────────────────────────────────────────────────────────┐
│ 🛡🛡🛡   ●●●●🔥●●●●🔥●●●●🔥●●●●👹         🔥×2   👜 7 │  Kopf, 64 px
├──────────────────────────────────────────────────────────────┤
│                                                              │
│        [Aufgabe: Wort groß / Satz mit Lücke / Lautsprecher]  │  Mitte, flexibel
│                                                              │
│              [Zielzeile: Slots für Silben/Buchstaben]        │
├──────────────────────────────────────────────────────────────┤
│   [Block] [Block] [Block] [Block] [Block] [Block]            │  Antwortbereich,
│   [Block] [Block] [Block]            Hilfe · Anhören         │  unten, 40 % Höhe
└──────────────────────────────────────────────────────────────┘
       Begleiter (3 kleine Biester) sitzen links unten am Rand, 72 px
```

Hochformat: gleiche Reihenfolge, Antwortbereich darf 50 % Höhe nehmen. Rechner: maximale
Inhaltsbreite 1100 px, zentriert.

## Bewegung

- Jede Rückmeldung beginnt unter 150 ms nach dem Tippen.
- Richtig: Block springt, Haken, Münzflug, Begleiter jubeln (Canvas-Zustand „jubel“ 600 ms).
- Falsch: Block wackelt, Schild zerspringt, Begleiter ducken sich, dann großes Lösungswort (1,2 s, wird
  gesprochen), dann Nachbau.
- Lagerfeuer: Flackern, Eier öffnen sich beim „Sichern“ nacheinander (je 500 ms, antippbar zum
  Überspringen).
- Ruhe-Modus: alle Animationen aus (`prefers-reduced-motion` respektieren und Einstellung), Ton
  gedämpft.

## Ton

Kurze, weiche Synth-Töne (WebAudio, keine Dateien): Tipp (Klick), richtig (aufsteigende Terz), falsch
(dumpfer Ton, nicht schrill), Münze, Schild bricht, Ei knackt, Boss-Treffer, Lagerfeuer-Knistern leise.
Sprachausgabe Englisch über `speechSynthesis` (en-GB bevorzugt, sonst en-US), Rate 0,9.

## Sprache in der Oberfläche

Kurz, du-Form, Kindersprache, keine Fachwörter, keine Ausrufezeichen-Ketten. Beispiele:
„Jagd starten“, „14 Biester sind hungrig“, „Beute sichern“, „Weiter mit Einsatz“, „Fast. Bau es einmal
nach.“, „Das Biest gehört dir.“, „Für heute fertig. Morgen früh ist wieder was los.“
