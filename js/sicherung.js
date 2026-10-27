// Listendateien und Sicherungsdateien: schreiben, lesen, prüfen. Reine Logik, kein DOM.
export const LIST_LIMIT = 200_000;
export const BACKUP_LIMIT = 2_000_000;

// Genau dieselben Zeilen im Bearbeiten-Feld und in der weitergegebenen Datei.
export function listLines(words) {
  return words.map((w) => `${w.en} - ${w.de}${w.icon ? ' - ' + w.icon : ''}${w.s && !w.s.startsWith('Look at the') ? ' | ' + w.s : ''}`).join('\n');
}

export function listFile(name, words) {
  return `# Wortbiester-Liste: ${name.replace(/[\r\n]+/g, ' ')}\n${listLines(words)}\n`;
}

export function fileName(name) {
  return name.normalize('NFKC').replace(/[^a-zA-Z0-9äöüÄÖÜß_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'Wortbiester-Liste';
}

// Liest auch Wortbau-Listen (gleiches Format, anderer Kopf).
export function readListFile(text, name, size = new TextEncoder().encode(text).length) {
  if (size > LIST_LIMIT) throw new Error('Die Datei ist zu groß. Höchstens 200 kB.');
  if (!/\.txt$/i.test(name)) throw new Error('Bitte wähle eine Textdatei mit .txt.');
  if (!text.trim()) throw new Error('Die Datei ist leer.');
  const clean = text.replace(/^﻿/, '');
  const header = clean.split(/\r?\n/, 1)[0].match(/^# (?:Wortbiester|Wortbau)-Liste:\s*(.*)$/);
  return { name: header?.[1].trim() || name.replace(/\.txt$/i, ''), text: clean };
}

export function uniqueListName(name, lists) {
  const base = name.trim() || 'Neue Liste';
  const names = new Set(lists.map((l) => l.name));
  let result = base;
  for (let n = 2; names.has(result); n++) result = `${base} (${n})`;
  return result;
}

export function backupFile(stand, date = new Date()) {
  return JSON.stringify({ app: 'wortbiester', format: 1, gesichert: date.toISOString(), stand }, null, 2);
}

const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function readBackup(text, size = new TextEncoder().encode(text).length) {
  if (size > BACKUP_LIMIT) throw new Error('Die Datei ist zu groß. Höchstens 2 MB.');
  if (!text.trim()) throw new Error('Die Datei ist leer.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Diese Datei lässt sich nicht lesen.'); }
  if (data?.app !== 'wortbiester' || data?.format !== 1) throw new Error('Das ist keine passende Wortbiester-Sicherung.');
  const s = data.stand;
  if (!object(s) || s.v !== 1 || !Array.isArray(s.lists)
    || !s.lists.every((l) => object(l) && typeof l.id === 'string' && l.id && typeof l.name === 'string'
      && Array.isArray(l.words) && l.words.every((w) => object(w) && typeof w.en === 'string' && typeof w.de === 'string'
        && (w.icon == null || typeof w.icon === 'string') && (w.s == null || typeof w.s === 'string')))
    || ['words', 'biester', 'shop', 'fackel', 'stats', 'settings'].some((key) => s[key] !== undefined && !object(s[key]))
    || ['zier', 'begleiter'].some((key) => s[key] !== undefined && !Array.isArray(s[key]))) {
    throw new Error('Der Spielstand in dieser Datei ist unvollständig oder kaputt.');
  }
  return data;
}

export function backupStats(s) {
  const words = s.lists.flatMap((l) => l.words.map((w) => `${l.id}|${w.en}`));
  return {
    lists: s.lists.length,
    words: words.length,
    zahm: words.filter((id) => (s.words?.[id]?.box ?? 0) >= 4).length,
    biester: Object.keys(s.biester || {}).length,
    coins: s.coins || 0,
  };
}
