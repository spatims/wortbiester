// Liest Vokabellisten im Wortbau-Format. Reine Logik, kein DOM.
// Zeile: englisch - deutsch [- Symbol] [| Beispielsatz]   ·   #-Zeilen werden ignoriert.

export const GAP = '______';

// Beispiel für die Eingabe und für den Gemini-Prompt.
export const DEMO_TEXT = `# Beispiel: Unit 3
explore - erforschen | We want to ______ the old castle.
treasure - der Schatz | There is a ______ in the cave.
dangerous - gefährlich | The bridge is old and ______.
torch - die Fackel | Light a ______, it is dark here.
ancient - uralt | We found an ______ map.
protect - beschützen | The dog will ______ the house.
bridge - die Brücke | The ______ goes over the river.
whisper - flüstern | Please ______, the baby is sleeping.`;

export const GEMINI_PROMPT = `Lies bitte alle Vokabeln auf diesem Schulbuch-Foto aus und gib sie mir als reine Textliste zurück (ohne Einleitung, eine Vokabel pro Zeile) genau in diesem Format:
englisch - deutsch | kurzer einfacher englischer Beispielsatz mit ______ als Lücke für das Wort

Beispiel:
explore - erforschen | We want to ______ the old castle.
treasure - der Schatz | There is a ______ in the cave.`;

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Satz so speichern, dass das Wort darin steht. Lücke „______“ wird durch das Wort ersetzt.
export function normalizeSentence(sentence, en) {
  if (!sentence) return null;
  let s = sentence.trim().replace(/_{3,}/g, GAP);
  if (s.includes(GAP)) s = s.replace(GAP, en);
  const re = new RegExp(`\\b${escapeRe(en)}\\b`, 'i');
  return re.test(s) ? s : null;
}

// Satz mit Lücke für die Aufgabe. Behält Groß-/Kleinschreibung des Restsatzes.
export function gapSentence(sentence, en) {
  const re = new RegExp(`\\b${escapeRe(en)}\\b`, 'i');
  return sentence.replace(re, GAP);
}

// Gibt { words, errors } zurück. Doppelte und unklare Zeilen werden gemeldet, nicht stillschweigend verworfen.
export function parseList(text) {
  const words = [];
  const errors = [];
  const seen = new Set();
  text.replace(/^﻿/, '').split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith('#')) return;
    const [main, sentence] = line.split('|').map((s) => s.trim());
    const m = main.match(/^(.+?)\s*[-–:=]\s*(.+)$/);
    if (!m) { errors.push(`Zeile ${i + 1}: Bitte so schreiben: englisch - deutsch`); return; }
    const en = m[1].trim().toLowerCase().replace(/\s+/g, ' ');
    let de = m[2].trim();
    let icon = null;
    const ic = de.match(/\s*(\p{Extended_Pictographic}️?)$/u);
    if (ic) { icon = ic[1]; de = de.slice(0, ic.index).replace(/\s*[-–]\s*$/, '').trim(); }
    if (!/^[a-z' -]+$/i.test(en)) { errors.push(`Zeile ${i + 1}: „${en}“ enthält unerwartete Zeichen`); return; }
    if (!de) { errors.push(`Zeile ${i + 1}: deutsche Bedeutung fehlt`); return; }
    if (seen.has(en)) { errors.push(`Zeile ${i + 1}: „${en}“ kommt doppelt vor`); return; }
    seen.add(en);
    const s = normalizeSentence(sentence, en) || `Look at the ${en}.`;
    words.push({ en, de, icon, s });
  });
  return { words, errors };
}
