# Wortbiester

Vokabel-Spiel für ein Kind von 10–12 Jahren: jedes englische Wort ist ein Biest, das man auf Jagden
fängt und durch Abstandswiederholung zähmt. Installierbare Web-App für ein Android-Tablet, offline,
ohne Konto. Nachfolger von Tiefenwort: Orbit und Wortbau.

- Konzept: `docs/KONZEPT.md` · Gestaltung: `docs/DESIGN.md` · Verträge: `docs/ARCHITEKTUR.md`
- Aufträge für Grok/Codex: `auftraege/` (Reihenfolge und Stand in `auftraege/README.md`)

## Starten

Kein Build. Im Projektordner:

    npm test                      # Kernlogik (node:test)
    npm start                     # http://localhost:8766  (im Heimnetz: http://<IP>:8766)

Installation als App auf dem Tablet braucht HTTPS: statische Seite auf GitHub Pages veröffentlichen,
dort in Chrome öffnen, „Zum Startbildschirm hinzufügen“.

## Vokabellisten

Unter **Eltern** → **Neue Liste**. Eine Zeile pro Wort, Sätze mit `______` als Lücke oder mit dem Wort:

    explore - erforschen | We want to ______ the old castle.
    treasure - der Schatz
    fox - Fuchs - 🦊 | The fox runs fast.

Der Gemini-Prompt (Knopf „Prompt kopieren“) erzeugt genau dieses Format aus einem Schulbuchfoto.
Wortbau-Listen lassen sich unverändert laden.
