# Paket A — Aufgaben bauen (`js/core/tasks.js`)

Projekt: Wortbiester, ein Vokabel-Spiel für ein Kind (10–12) am Android-Tablet. Verträge:
`docs/ARCHITEKTUR.md` (Abschnitte „Aufgaben-Spezifikation“, „Konkrete Aufgabe“, „Aufgaben“), Didaktik:
`docs/KONZEPT.md` Abschnitt 2. Lies beides zuerst. Regeln: `auftraege/README.md`.

## Auftrag

Erzeuge `js/core/tasks.js` (reine Logik, kein DOM, ES-Modul) und `tests/tasks.test.mjs` (`node:test`,
Hilfen in `tests/helpers.mjs`: `seeded(n)`, `words(listId, [...])`). Ändere keine anderen Dateien.

### Exporte

```js
export function poolFor(word, allWords)
export function buildTask(spec, pool, rng = Math.random)
export function syllabify(en)
export function similarWords(word, pool, n, rng = Math.random)
export function scrambleLetters(en, rng, extra = 0)
```

### Eingaben

Wort: `{ id, list, en, de, icon, s }` — `s` ist ein englischer Satz, der das Wort enthält (Lücke setzt
du zur Laufzeit mit `gapSentence(s, en)` aus `js/core/parser.js`). `en` kann Leerzeichen oder einen
Apostroph enthalten (`ice cream`, `don't`); Blöcke dürfen dann nie Leerzeichen allein enthalten.

Spezifikation: `{ wordId, word, box, type, dir, occ }` mit `type` aus
`kennenlernen | wahl | hoeren-wahl | silben | buchstaben | luecke-wahl | luecke-bauen | hoeren-bauen | blitz | nachbau`
und `dir` aus `'de→en' | 'en→de'`.

### Ausgabe je Typ (Form siehe ARCHITEKTUR „Konkrete Aufgabe“; `id` eindeutig, z. B. `${wordId}#${type}#${occ}`)

| type | prompt | Antwortfeld |
|---|---|---|
| kennenlernen | `{ kind:'karte', text: en, sentence: s, de }` | keins |
| wahl | dir `de→en`: `{ kind:'de', text: de }`, Optionen englische Wörter; dir `en→de`: `{ kind:'en', text: en }`, Optionen deutsche Bedeutungen | `options` (4, gemischt, genau eine `correct`) |
| hoeren-wahl | `{ kind:'audio', text: en }` (UI spielt `en`), Optionen **deutsche** Bedeutungen | `options` (4) |
| silben | `{ kind:'de', text: de, sentence: gapSentence }` | `blocks` = Silben des Wortes + 2 Ablenker-Silben (aus anderen Pool-Wörtern, nicht im Zielwort enthalten), gemischt; `target` = Silben in Reihenfolge |
| buchstaben | wie silben | `blocks` = alle Buchstaben einzeln, ab 6 Buchstaben +2 Ablenker-Buchstaben (häufige Buchstaben, nicht im Wort), gemischt; `target` = Buchstaben in Reihenfolge |
| luecke-wahl | `{ kind:'satz', text: de, sentence: gapSentence }` | `options` (3: Wort + 2 ähnliche englische Wörter) |
| luecke-bauen | `{ kind:'satz', text: de, sentence: gapSentence }` | `blocks`/`target` wie buchstaben |
| hoeren-bauen | `{ kind:'audio', text: en, de }` — UI zeigt `de` erst nach Lösung | `blocks`/`target` wie buchstaben |
| blitz | `{ kind:'blitz' }` | `items` = drei `wahl`-Aufgaben: das Wort selbst + zwei andere Pool-Wörter, Richtung abwechselnd |
| nachbau | wie silben, aber nur **1** Ablenker-Silbe | `blocks`/`target` |

Jede Aufgabe hat `answer: en`, `wordId`, `word`, `box`, `dir`, `type`.

Bei Mehrfach-Blöcken mit gleichem Text (z. B. zwei `e`) bekommt jeder Block eine eigene `id`; die UI
vergleicht die Texte der gesetzten Blöcke mit `target`.

### Ablenker (`similarWords`)

Nie zufällig. Rangfolge: gleicher Anfangsbuchstabe und ähnliche Länge (±2) → geringe Editierdistanz
(Levenshtein ≤ 3) → gleiche Wortart-Heuristik (Endung -ing/-ed/-ly/-tion) → Rest. Niemals das Wort
selbst, niemals ein Wort mit gleicher deutscher Bedeutung. Reicht der Pool nicht, aus dieser Liste
auffüllen: `['house','water','friend','school','happy','green','small','window','garden','animal','music','river','mother','father','table','light','night','morning','people','money']`
(ohne Dubletten zum Pool). Deutsche Ablenker bei `en→de`/`hoeren-wahl`: die `de`-Werte der gewählten
Ablenker-Wörter.

### Silben (`syllabify`)

Regelbasiert für Englisch, Ziel: plausible Sprechsilben, nicht Perfektion.
1. Ausnahmeliste zuerst (mindestens 40 häufige Schulwörter: `people → peo·ple`, `every → ev·ery`,
   `little → lit·tle`, `favourite → fa·vour·ite`, `interesting → in·ter·est·ing`, `beautiful → beau·ti·ful`,
   `because → be·cause`, `through → through`, `knowledge → knowl·edge`, `orange → or·ange`, …).
2. Sonst: Vokalgruppen (a e i o u y, Digraphe ea ee oo ou ai ay oa oi ie ey) als Kern; Trennung zwischen
   zwei Konsonanten (`win·dow`, `sis·ter`), vor einem einzelnen Konsonanten zwischen Vokalen (`ti·ger`,
   `pa·per`), Konsonanten-Digraphe `ch sh th ph wh ck` nie trennen, stummes End-`e` zur letzten Silbe
   (`ta·ble`, `ex·plore`), Suffixe `-ing -ed -er -est -ly -tion -ness -ment -ful -less` abtrennen.
3. Nie eine Silbe mit nur einem Buchstaben außer am Wortanfang (`a·bout`, `e·vent`); Silben
   zusammenlegen, bis jede ≥ 2 Buchstaben hat. Wörter ≤ 4 Buchstaben bleiben eine Silbe.
4. Mehrwortausdrücke: je Wort trennen, Leerzeichen gehört zum Anfang des folgenden Blocks (`ice`, ` cream`).

Teste mindestens 30 Wörter mit erwarteter Trennung (eigene Liste, Regel 1–4 abdecken).

### Tests (`tests/tasks.test.mjs`)

- Jede Typ-Variante baut eine gültige Aufgabe: genau eine richtige Option; `target` zusammengesetzt
  ergibt `en`; Blöcke enthalten alle `target`-Texte (mit Mehrfachen); Ablenker-Blöcke nie so, dass eine
  zweite korrekte Lösung entsteht (prüfe: keine Ablenker-Silbe gleich einer Zielsilbe).
- `similarWords` liefert nie das Wort selbst, nie doppelt, bevorzugt ähnliche.
- `syllabify`-Tabelle.
- Deterministisch mit `seeded`.
- `blitz` hat drei Items mit drei verschiedenen Wörtern; bei Pool < 3 trotzdem drei Items (Fallback-Liste).

### Abnahme

`npm test` grün. Keine Datei außer den zwei genannten geändert. Kurze Notiz oben in `tasks.js`, welche
Vertragsstellen ggf. präzisiert wurden.
