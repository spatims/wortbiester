# Paket B — Biester: Arten, Stufen, Seltenheit, Zeichnung

Projekt: Wortbiester (siehe `docs/KONZEPT.md` Abschnitt 4, `docs/DESIGN.md`, Vertrag in
`docs/ARCHITEKTUR.md` Abschnitt „Biester“). Regeln: `auftraege/README.md`.

## Auftrag

Erzeuge:
- `js/core/biester.js` — reine Logik (kein DOM)
- `js/render/biest.js` — Canvas-2D-Zeichnung, kein Bildmaterial, alles prozedural
- `tests/biester.test.mjs` — `node:test` für die Logik
- `dev/biester.html` — Schauseite: alle 12 Arten × 6 Stufen × 3 Seltenheiten, Stimmungen umschaltbar,
  animiert; lädt die Module relativ (`../js/...`). Nur zum Ansehen, nicht Teil der App.

Keine anderen Dateien ändern.

## Logik (`js/core/biester.js`)

```js
export const SPECIES = [ { id, name, perk } × 12 ]   // name deutsch, frech-freundlich, z. B. Krabbler, Flatterer, Schleimer, Hornkopf, Schnapper, Glotzer, Stachler, Puschel, Knirscher, Funkler, Brummer, Schlitzohr
export function speciesFor(en)            // stabiler Hash des Wortes → 0–11 (gleiches Wort, gleiche Art, überall)
export function randomSpecies(rng)        // 0–11
export function stageFor(box)             // 0 wild, 1 ei, 2 geschluepft, 3 gewachsen, 4 zahm, 5 glanz
export function rollRarity(rng, min='gewoehnlich')  // 70/25/5 %, min hebt an — identisch zu hunt.js, hier nur für Shop/Zier
export function biestFor(word, record, biestState, listColor)
  // → { species, speciesName, stage, rarity, color, hat, skin, name: word.en, wordId: word.id, hungrig: bool }
  // rarity aus biestState (sonst 'gewoehnlich'); hungrig = record vorhanden und record.due <= Date.now()
export function perkFor(biest)            // nur stage >= 4: Vorteil der Art: 'schild' | 'kombo-schutz' | 'muenzen' | null
export function perksFor(biester)         // eindeutige Liste (jede Art bringt genau einen Vorteil, 4 Arten je Vorteil, 0 Arten ohne → Verteilung: 4×schild, 4×kombo-schutz, 4×muenzen)
export function describePerk(perk)        // deutscher Satz für die Karte, z. B. „Bringt dir einen Schild mehr auf die Jagd.“
```

Stufenbeschreibung für die UI: `export const STAGE_NAMES = ['wild', 'Ei', 'geschlüpft', 'gewachsen', 'zahm', 'zahm · glänzend']`.

## Zeichnung (`js/render/biest.js`)

```js
export function drawBiest(ctx, biest, { mood = 'ruhig', t = 0, size = 96, x = 0, y = 0 } = {})
// mood: 'ruhig' | 'jubel' | 'ducken' | 'hungrig' | 'ei'
// t: Zeit in Sekunden für Atmen/Wippen/Blinzeln, size: Kantenlänge in px, zeichnet in das Quadrat (x, y, size, size)
export function biestCanvas(biest, opts)  // Hilfe: erzeugt ein <canvas> mit devicePixelRatio-Skalierung und zeichnet einmal
export function animateBiest(canvas, biest, getMood)  // startet requestAnimationFrame-Schleife, gibt stop() zurück; respektiert html.ruhe (dann ein Standbild)
```

Anforderungen an die Figuren:
- **Stil:** flächig, kräftige Umrisse (3 px bei 96 px), große Augen mit Glanzpunkt, 2–3 Farbtöne je
  Figur (Grundfarbe = `biest.color` aus dem Revier, abgedunkelt/aufgehellt berechnet), keine Verläufe-
  Orgien. Erkennbar auf 48 px, schön auf 160 px.
- **12 Arten** mit klar verschiedener Silhouette (Körperform, Gliedmaßen, Ohren/Hörner/Flügel/Stacheln).
  Eine Art muss man auch als Umriss erkennen.
- **Stufen:** 0 wild = dunkle Silhouette mit leuchtenden Augen; 1 Ei = gesprenkeltes Ei in Grundfarbe
  (Muster je Art); 2 geschlüpft = klein, Eierschale auf dem Kopf; 3 gewachsen = voll; 4 zahm =
  Halsband/Schal in `--glut`; 5 glanz = zusätzlich Funkelsterne um die Figur (animiert).
- **Seltenheit:** gewöhnlich: nichts; selten: silberner Schimmerrand; episch: goldener Rand + Aura.
- **Stimmungen:** ruhig (Atmen, gelegentliches Blinzeln alle 3–5 s), jubel (Hüpfen 2×, Augen zu
  Halbmonden, Mund offen), ducken (zusammengezogen, Augen klein, leicht zitternd), hungrig (Sprechblase
  mit „…“ oder Besteck-Symbol, leichtes Wippen), ei (nur Ei, leichtes Wackeln).
- **Hüte/Skins** (`biest.hat`, `biest.skin`): mindestens 6 Hüte (`muetze`, `krone`, `hut`, `brille`,
  `schleife`, `helm`) und 4 Skins (`streifen`, `punkte`, `flecken`, `nacht`) vorbereitet; Skins ändern
  das Muster, Hüte sitzen oben.
- Zeichnung ist deterministisch für gleiche Eingaben (bis auf `t`).

## Tests

- `speciesFor` ist stabil und gleichverteilt genug (über 2000 Zufallswörter keine Art unter 3 %).
- `stageFor` für Boxen 0–5 und außerhalb (−1 → 0, 9 → 5).
- `perksFor` liefert nur für zahme Biester, ohne Dubletten; Verteilung 4/4/4.
- `biestFor` setzt `hungrig` richtig.

## Abnahme

`npm test` grün; `dev/biester.html` zeigt alle Figuren ohne Fehler in der Konsole; keine Datei außer den
vier genannten geändert.
