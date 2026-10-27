# Wortbiester — Konzept (27.10.2026)

Vokabel-Spiel für ein Kind von 10–12 Jahren, Android-Tablet (Touch, Querformat), zweitrangig
Rechner mit Tastatur. Nachfolger von „Tiefenwort: Orbit“ (Sichtung: ~/Claude/tiefenwort/SICHTUNG-2026-10-27.md)
und „Wortbau“. Installierbare Web-App (PWA), offline, ohne Konto.

## 1. Die Idee in drei Sätzen

Jedes englische Wort ist ein wildes **Biest**. Auf einer **Jagd** (eine Runde, 6–8 Minuten) fängt man
neue Biester und macht gefangene stärker; was man wirklich kann, wird zum zahmen Biest im eigenen
**Rudel**. Die Jagd hat Einsatz: drei Schilde, eine Kombo, und an jedem Lagerfeuer die Wahl,
die Beute zu sichern oder weiterzuziehen und mehr zu riskieren.

Warum das zieht, wo Orbit nicht zog:

| Was fehlte | Was Wortbiester tut |
|---|---|
| Nichts kann schiefgehen | Fehler kostet einen Schild und die Kombo; ohne Schild endet die Jagd und die *ungesicherte* Beute ist weg |
| Kein nahes Ziel | Jagd mit sichtbarer Route, Lagerfeuer alle 4 Aufgaben, Boss am Ende, Ergebnisbildschirm |
| Jede Antwort gleich | Kombo-Multiplikator, Eier mit Zufallsseltenheit, Boss-Ei garantiert selten |
| Nichts gehört einem | Rudel-Album: jedes gekonnte Wort ist ein Biest mit Gesicht, Art, Seltenheit und Entwicklungsstufe |
| Fortschritt ohne Können | Spielfortschritt entsteht *nur* durch richtige Antworten; Biester wachsen nur über Abstandswiederholung |
| Quiz mit Deko | Aufgaben sind Hand-Arbeit: Blöcke setzen, Silben bauen, Buchstaben ordnen, Lücke füllen |

Lernfortschritt ist nie verlierbar. Verlierbar ist nur Beute (Münzen, ungeöffnete Eier) innerhalb einer Jagd.
Das ist der Einsatz, der Spannung macht, ohne Lernen zu bestrafen.

## 2. Didaktik

### Wortstand (Boxen) und Biest-Stufe

Jedes Wort hat eine Box 0–5 mit Wiederholungsabstand (aus Wortbau übernommen):

| Box | Abstand bis zur nächsten Fälligkeit | Biest |
|---|---|---|
| 0 | neu / 5 min | wild (nur Umriss) |
| 1 | 1 Stunde | Ei |
| 2 | 1 Tag | geschlüpft |
| 3 | 3 Tage | gewachsen |
| 4 | 7 Tage | **zahm** (zählt als gekonnt) |
| 5 | 21 Tage | zahm mit Glanz |

Richtig beim **ersten Versuch** → Box +1. Falsch → Box −1 (mindestens 0), fällig in 5 Minuten,
und das Wort kommt **in derselben Jagd** nach 3–5 Aufgaben noch einmal, eine Stufe leichter.
Nur der erste Versuch je Jagd verschiebt die Box. Kein Hinweis und kein Nachbau verschiebt sie.

### Aufgabentypen je Box (Touch zuerst)

Reihenfolge: Erkennen → Abrufen mit Hilfe → freies Abrufen → Anwenden. Beide Richtungen, Hören dabei.

| Box | Aufgaben (Zufall aus der Menge) | Eingabe |
|---|---|---|
| 0 (neu) | **Kennenlernen** (Karte: Wort, Bedeutung, Satz, Ton; kein Fehler möglich), dann **Wahl 4** DE→EN | Antippen |
| 1 | **Wahl 4** EN→DE · **Hören → Wahl 4** · **Silben bauen** (echte Silben + 2 Ablenker) | Antippen |
| 2 | **Silben bauen** · **Buchstaben ordnen** (alle Buchstaben gemischt, ab 6 Buchstaben +2 Ablenker) · **Lücke 3** (Satz mit Lücke, 3 ähnliche Wörter) | Antippen |
| 3 | **Buchstaben ordnen** · **Lücke bauen** (Satz mit Lücke, Wort aus Buchstaben) · **Hören → bauen** | Antippen |
| 4–5 | **Lücke bauen** · **Hören → bauen** · **Blitz 3** (drei Wahl-Aufgaben am Stück) | Antippen |

Am Rechner mit Tastatur: ab Box 2 darf statt Blöcken getippt werden (Tastatur-Eingabe erkannt), gibt
×1,5 Münzen. Am Tablet nie Pflicht.

Hilfe in Bau-Aufgaben: „Zeig mir den nächsten Block“ kostet nichts, aber die Aufgabe zählt dann als
*nicht erster Versuch* (Box bleibt). Das ist ehrlich und ohne Strafe.

Ablenker sind nie zufällig: ähnliche Wörter aus allen Listen (gleicher Anfang, gleiche Länge, geringe
Editierdistanz), Silben-Ablenker aus anderen Wörtern der Liste. Silbentrennung regelbasiert fürs
Englische mit Ausnahmeliste (Paket A).

### Auswahl einer Jagd (16 Aufgaben Standard, einstellbar 12/16/20)

1. Fällige Wörter der aktuellen Liste, älteste Fälligkeit zuerst.
2. Bis zu 4 neue Wörter (je zwei Aufgaben: Kennenlernen + Wahl).
3. Etwa 30 % fällige oder schwache Wörter aus älteren Listen, gleichmäßig eingestreut.
4. Der Boss am Ende nimmt die 3 Wörter mit den meisten Fehlern dieser Jagd, sonst die schwächsten.

Reicht das nicht für 16, werden sichere Wörter der aktuellen Liste aufgefüllt. Ein Wort kommt in einer
Jagd höchstens dreimal vor (Neu: zweimal, Fehler: einmal mehr).

## 3. Die Jagd (Kernschleife)

```
Start ─ Route: 4 Abschnitte à 4 Aufgaben, dazwischen Lagerfeuer, am Ende der Boss
       ┌───────┐ 🔥 ┌───────┐ 🔥 ┌───────┐ 🔥 ┌───────┐ 👹
       │ 1 2 3 4│   │ 5 6 7 8│   │ 9 … 12│   │13 … 16│  Boss (3 Fragen)
```

- **Schilde:** 3 zu Beginn. Fehler = −1 Schild (Schild zerspringt sichtbar). Drei Richtige in Folge geben
  einen Schild zurück (max. 3). Bei 0 Schilden: **Jagd bricht ab**. Gesicherte Beute bleibt, ungesicherte
  ist weg, Lernfortschritt bleibt vollständig. Ergebnisbildschirm trotzdem (was gelernt wurde).
- **Kombo:** Zähler richtiger Antworten in Folge. Münz-Multiplikator ×1 (0–2), ×2 (3–5), ×3 (ab 6).
  Fehler setzt die Kombo auf 0. Die Kombo ist als Flamme sichtbar, die wächst.
- **Beute je richtige Antwort:** 10 Münzen × Multiplikator × Stufenfaktor (Box 0–1: 1, Box 2–3: 1,5,
  Box 4–5: 2). Mit 15 % Wahrscheinlichkeit zusätzlich ein Ei (Zufallsseltenheit: 70 % gewöhnlich,
  25 % selten, 5 % episch). Eier liegen bis zum Lagerfeuer ungeöffnet im Beutel.
- **Lagerfeuer** (nach Aufgabe 4, 8, 12): Beutel wird gezeigt. Wahl: **„Sichern“** (Beute ins Lager,
  Eier schlüpfen jetzt) oder **„Weiter mit Einsatz“** (Beute bleibt im Beutel, ab jetzt ×1,5 auf alles
  Neue, Schilde werden *nicht* aufgefüllt). Kinder lieben diese Wahl; sie ist ohne Zeitdruck.
- **Boss:** 3 Fragen zu den schwächsten Wörtern der Jagd, Aufgabentyp je Box wie üblich. Jede richtige
  Antwort nimmt dem Boss ein Drittel. Fehler kostet einen Schild wie sonst auch. Boss besiegt →
  garantiert ein seltenes oder episches Ei + 50 Münzen. Boss nicht besiegt (Schilde aus) → kein Boss-Ei,
  Rest wie Abbruch.
- **Ergebnis:** gelernte Wörter (Box-Aufstiege), neue Biester, Münzen, Eier, Kombo-Rekord, „Heute
  erledigt“-Haken. Knopf „Noch eine Jagd“ nur, wenn noch Fälliges oder Neues da ist, sonst „Für heute
  fertig“ mit Hinweis, wann das nächste Wort fällig wird.

**Fehlerablauf** (wichtig): Falsche Antwort → Schild zerspringt, richtiges Wort wird kurz groß gezeigt
und gesprochen, dann **Nachbau**: das Wort einmal aus Silben zusammensetzen (keine Wertung). Danach
geht es weiter. So ist die Korrektur eine Handlung, kein Banner.

**Zeit:** Es gibt keinen Zeitdruck. „Blitz 3“ hat eine sichtbare Sanduhr von 20 s für drei Aufgaben,
ohne Folgen beim Ablauf außer dem fehlenden Blitz-Bonus. In den Einstellungen abschaltbar.

## 4. Rudel, Biester, Wirtschaft

- **Biest je Wort:** Art aus einem Hash des Wortes (12 Arten: z. B. Krabbler, Flatterer, Schleimer,
  Hornkopf, Schnapper, Glotzer …), Farbfamilie aus der Liste (Revier), Stufe aus der Box. Name =
  das englische Wort. Seltenheit stammt vom Ei, das beim ersten Fang (Box 1) „zugeordnet“ wird; später
  gefundene Eier schlüpfen zu Biestern bereits bekannter Wörter in höherer Seltenheit (Tausch nach oben)
  oder zu Zierbiestern aus einem Bonus-Pool (keine Wörter) — damit Eier nie wertlos sind.
- **Rudel-Album:** Raster aller Biester, nach Revier (Liste) gruppiert. Antippen: Karte mit Wort,
  Bedeutung, Satz, Ton, Stufe, nächste Fälligkeit („schläft bis morgen“). Fällige Biester sind
  sichtbar hungrig (Sprechblase). Das ist der stille Anreiz, die Jagd zu starten.
- **Begleiter:** bis zu 3 Biester aus dem Rudel als Begleiter wählen. Sie laufen in der Jagd mit und
  jubeln oder ducken sich. Jedes zahme Begleiter-Biest bringt einen kleinen Vorteil (eines: +1 Schild
  beim Start; eines: erster Fehler kostet keine Kombo; eines: +10 % Münzen). Höchstens ein Vorteil
  je Art, so bleibt es klein.
- **Münzen:** kaufen im **Laden** Eier (100), Hüte und Farben für Biester (50–200), neue Revier-
  Hintergründe (300). Nichts im Laden macht Aufgaben leichter. Keine Schadenszahlen, keine Waffen.
- **Tagesfackel:** Jeder Tag mit mindestens einer Jagd zündet die Fackel. Die Reihe wird gezählt und
  gezeigt, ein verpasster Tag kostet nichts außer der Zahl. Kein Verlust, keine Mahnung.

## 5. Bildschirme

1. **Heute** (Start): großer Knopf „Jagd starten“ mit „14 fällig · 3 neu“, darunter Fackel, Begleiter,
   Zugang zu Rudel, Laden, Eltern. Ein Tipp startet.
2. **Jagd:** oben schmale Route mit Position, Schilde (3 Symbole), Kombo-Flamme, Beutel. Mitte: die
   Aufgabe, groß. Unten: Antwortblöcke, Höhe mindestens 56 px, Abstand 12 px. Begleiter klein am Rand.
3. **Lagerfeuer:** Beutel-Inhalt, zwei große Knöpfe.
4. **Boss:** gleiche Aufgabe, anderer Rahmen, Boss-Figur mit drei Segmenten.
5. **Ergebnis.**
6. **Rudel** (Album) mit Biest-Karte.
7. **Laden.**
8. **Eltern** (hinter einer kleinen Rechenaufgabe, kein Passwort): Listen anlegen/bearbeiten/aus Datei,
   aktive Liste wählen, Gemini-Prompt kopieren, Fortschritt je Wort (nüchtern, ohne Schuld), Sicherung
   speichern/wiederherstellen, Einstellungen (Länge der Jagd, Ton, Blitz an/aus, Ruhe-Modus ohne
   Animationen, Lesehilfe: größere Schrift und Abstand).

## 6. Gestaltung (Kurz; Details in DESIGN.md)

Dunkler Grund (Nachtwald), kräftige Revierfarben, eine Lese-Schrift (Nunito) und eine Titel-Schrift
(Fredoka), beide lokal. Keine Großbuchstaben-Wände, kein Jargon, kurze Sätze in Kindersprache, keine
Zahlen außer Münzen und „3 von 16“. Blöcke sind physisch: abgerundet, Schatten unten, drücken sich beim
Antippen ein. Biester sind parametrische Canvas-Figuren mit großen Augen und drei Zuständen (ruhig,
Jubel, Ducken). Rückmeldung unter 150 ms, richtige Antwort: Block springt, Münzen fliegen in den Beutel.

## 7. Technik (Kurz; Details in ARCHITEKTUR.md)

Statische Web-App, ES-Module ohne Build, Canvas nur für Biester und Effekte, Rest DOM. PWA mit
Manifest und Service Worker (offline). Spielstand in `localStorage` (`wortbiester.v1`), Listen und
Spielstand als Datei übertragbar (Wortbau-Format kompatibel). Kernlogik (Auswahl, Jagd-Automat, Aufgaben,
Parser) ist reine Logik ohne DOM und mit `node:test` getestet. Bereitstellung über GitHub Pages
(HTTPS für die Installation), Entwicklung über `python3 -m http.server`.

## 8. Was bewusst nicht drin ist

Ranglisten, Konto, Werbung, Push-Nachrichten, Zeitstrafen, Schadenszahlen, Waffen, Kaufbares, das
Aufgaben leichter macht, Zusammenführen zweier Spielstände.
