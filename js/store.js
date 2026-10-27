// Spielstand: Listen, Wortstände, Rudel, Münzen, Einstellungen. Lokal im Gerät (localStorage).
// Dateien verlassen das Gerät nur, wenn jemand sie selbst speichert (sicherung.js).
import { parseList } from './core/parser.js';
import * as srs from './core/srs.js';
import { uniqueListName } from './sicherung.js';

export const KEY = 'wortbiester.v1';
export const PREVIOUS_KEY = 'wortbiester.v1.vorher';
export const LIST_COLORS = ['#6fcf6a', '#ff7a59', '#6dd3ff', '#c47cff', '#f2c879', '#4fa3ff'];

let storage = typeof localStorage !== 'undefined' ? localStorage : null;
export function useStorage(s) { storage = s; st = load(); }

export function fresh() {
  return {
    v: 1,
    lists: [],
    activeList: null,
    words: {},
    biester: {},
    zier: [],
    begleiter: [],
    coins: 0,
    shop: { owned: [] },
    fackel: { lastDay: null, reihe: 0 },
    stats: { jagden: 0, minuten: 0, komboRekord: 0 },
    settings: { laenge: 16, ton: true, blitz: true, ruhe: false, lesehilfe: false },
  };
}

export function normalizeState(d) {
  const base = fresh();
  return {
    ...base, ...d,
    shop: { ...base.shop, ...(d.shop || {}) },
    fackel: { ...base.fackel, ...(d.fackel || {}) },
    stats: { ...base.stats, ...(d.stats || {}) },
    settings: { ...base.settings, ...(d.settings || {}) },
    words: d.words || {}, biester: d.biester || {}, zier: d.zier || [], begleiter: d.begleiter || [],
  };
}

function load() {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return fresh();
    return normalizeState(JSON.parse(raw));
  } catch { return fresh(); }
}

let st = load();

export function state() { return st; }
export function save() { try { storage?.setItem(KEY, JSON.stringify(st)); } catch { /* voll oder gesperrt: still weiter */ } }

export function hasPreviousState() { try { return !!storage?.getItem(PREVIOUS_KEY); } catch { return false; } }

// Vollständiger Austausch (Sicherung einspielen). Der bisherige Stand bleibt als „vorher“ zurückholbar.
export function restoreState(next) {
  try { storage?.setItem(PREVIOUS_KEY, JSON.stringify(st)); } catch { /* ignorieren */ }
  st = normalizeState(next);
  save();
}

export function recoverPreviousState() {
  const raw = storage?.getItem(PREVIOUS_KEY);
  if (!raw) return false;
  const prev = normalizeState(JSON.parse(raw));
  try { storage?.setItem(PREVIOUS_KEY, JSON.stringify(st)); } catch { /* ignorieren */ }
  st = prev;
  save();
  return true;
}

export function reset() { st = fresh(); save(); }

// ---------- Listen und Wörter ----------

const withIds = (l) => l.words.map((w) => ({ ...w, id: srs.wordId(l.id, w.en), list: l.id }));

export function allWords() { return st.lists.flatMap(withIds); }
export function listWords(listId) { const l = st.lists.find((x) => x.id === listId); return l ? withIds(l) : []; }
export function activeList() { return st.lists.find((l) => l.id === st.activeList) || null; }
export function currentWords() { return st.activeList ? listWords(st.activeList) : []; }
export function olderWords() { return allWords().filter((w) => w.list !== st.activeList); }
export function record(w) { return st.words[typeof w === 'string' ? w : w.id] || null; }

export function addList(name, text) {
  const { words, errors } = parseList(text);
  if (!words.length) return { ok: false, errors: errors.length ? errors : ['Keine Vokabeln erkannt.'] };
  const id = 'l' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const color = LIST_COLORS[st.lists.length % LIST_COLORS.length];
  st.lists.push({ id, name: uniqueListName(name, st.lists), color, words });
  if (!st.activeList) st.activeList = id;
  save();
  return { ok: true, id, errors };
}

export function updateList(id, name, text) {
  const l = st.lists.find((x) => x.id === id);
  if (!l) return { ok: false, errors: ['Liste nicht gefunden.'] };
  const { words, errors } = parseList(text);
  if (!words.length) return { ok: false, errors: errors.length ? errors : ['Keine Vokabeln erkannt.'] };
  l.name = name.trim() || l.name;
  l.words = words;
  save();
  return { ok: true, id, errors };
}

export function deleteList(id) {
  st.lists = st.lists.filter((l) => l.id !== id);
  for (const k of Object.keys(st.words)) if (k.startsWith(id + '|')) delete st.words[k];
  for (const k of Object.keys(st.biester)) if (k.startsWith(id + '|')) delete st.biester[k];
  st.begleiter = st.begleiter.filter((k) => !k.startsWith(id + '|'));
  if (st.activeList === id) st.activeList = st.lists[0]?.id || null;
  save();
}

export function setActiveList(id) { if (st.lists.some((l) => l.id === id)) { st.activeList = id; save(); } }

export function listStats(listId) {
  const ws = listWords(listId);
  const box = (w) => st.words[w.id]?.box ?? 0;
  return { total: ws.length, zahm: ws.filter((w) => box(w) >= srs.ZAHM_BOX).length, begonnen: ws.filter((w) => st.words[w.id]).length };
}

export function overview(now = Date.now()) { return srs.overview(currentWords(), olderWords(), record, now); }

// ---------- Jagd ----------

export function planHunt({ now = Date.now(), rng = Math.random } = {}) {
  return srs.pickHunt({ cur: currentWords(), older: olderWords(), rec: record, target: st.settings.laenge, now, rng, settings: st.settings });
}

// Ergebnis eines Wortes aus einer Jagd. first === null (nur Kennenlernen oder nur mit Hilfe) ändert nichts.
export function applyResult(id, first, now = Date.now()) {
  if (first === null || first === undefined) return;
  st.words[id] = srs.applyResult(st.words[id], first, now);
  save();
}

// Ein Ei schlüpft: zu einem Wort ohne Biest (Fang), sonst wertet es ein vorhandenes Biest auf, sonst Zierbiest.
export function hatch(rarity, candidateWordIds, speciesForZier, rng = Math.random) {
  const rank = { gewoehnlich: 0, selten: 1, episch: 2 };
  const free = candidateWordIds.filter((id) => !st.biester[id]);
  if (free.length) {
    const id = free[Math.floor(rng() * free.length)];
    st.biester[id] = { rarity, hat: null, skin: null };
    save();
    return { kind: 'fang', wordId: id, rarity };
  }
  const upgradable = candidateWordIds.filter((id) => st.biester[id] && rank[st.biester[id].rarity] < rank[rarity]);
  if (upgradable.length) {
    const id = upgradable[Math.floor(rng() * upgradable.length)];
    st.biester[id].rarity = rarity;
    save();
    return { kind: 'aufwertung', wordId: id, rarity };
  }
  const z = { id: 'z' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), species: speciesForZier ? speciesForZier(rng) : 0, rarity };
  st.zier.push(z);
  save();
  return { kind: 'zier', zier: z, rarity };
}

export function addCoins(n) { st.coins += n; save(); }
export function spend(n) { if (st.coins < n) return false; st.coins -= n; save(); return true; }
export function own(itemId) { if (!st.shop.owned.includes(itemId)) st.shop.owned.push(itemId); save(); }
export function setBegleiter(ids) { st.begleiter = ids.slice(0, 3).filter((id) => st.biester[id]); save(); }
export function setBiestLook(id, { hat, skin }) { if (st.biester[id]) { if (hat !== undefined) st.biester[id].hat = hat; if (skin !== undefined) st.biester[id].skin = skin; save(); } }

const day = (d = new Date()) => d.toDateString();

// Jede Jagd zündet die Tagesfackel. Ein verpasster Tag setzt die Reihe zurück, kostet sonst nichts.
export function finishHunt(summary, minutes, now = new Date()) {
  const today = day(now);
  if (st.fackel.lastDay !== today) {
    const yesterday = day(new Date(now.getTime() - 86400000));
    st.fackel.reihe = st.fackel.lastDay === yesterday ? st.fackel.reihe + 1 : 1;
    st.fackel.lastDay = today;
  }
  st.stats.jagden++;
  st.stats.minuten += Math.round(minutes || 0);
  st.stats.komboRekord = Math.max(st.stats.komboRekord, summary?.komboRekord || 0);
  save();
}

export function setSetting(key, value) { st.settings[key] = value; save(); }
