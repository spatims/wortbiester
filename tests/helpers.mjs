// Fester Zufall für Tests (mulberry32).
export function seeded(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class MemoryStorage {
  data = new Map();
  getItem(key) { return this.data.get(key) ?? null; }
  setItem(key, value) { this.data.set(key, String(value)); }
  removeItem(key) { this.data.delete(key); }
}

export const words = (listId, ens) => ens.map((en) => ({ id: `${listId}|${en}`, list: listId, en, de: 'de-' + en, icon: null, s: `I like the ${en}.` }));

// Aufgaben-Fabrik ohne Paket A: baut nur eine Hülle.
export const stubFactory = (spec) => ({ id: spec.wordId + ':' + spec.type, type: spec.type, wordId: spec.wordId, word: spec.word, box: spec.box, answer: spec.word.en });
