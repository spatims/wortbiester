// Aufgaben bauen: Ablenker, Silben, Buchstaben, Lücken. Reine Logik, kein DOM.
//
// Vertragsstellen, die hier präzisiert sind (ARCHITEKTUR.md gilt sonst wörtlich):
// 1. Silben unter 2 Buchstaben: ARCHITEKTUR sagt „außer am Wortende“, der Auftrag
//    mit Beispielen a·bout / e·vent gilt — Ausnahme nur am Wortanfang. Einbuchstaben-
//    Silben danach werden mit der vorigen Silbe zusammengelegt.
// 2. Spezifikation: ARCHITEKTUR listet kein dir; srs und Auftrag liefern dir.
//    Fehlt dir, gilt 'de→en'.
// 3. scrambleLetters steht im Auftrag, nicht in der ARCHITEKTUR-Exportliste.
//    Rückgabe: { blocks, target }. rng hat wie überall Math.random als Standard.
// 4. Fallback-Wörter (Auftrag, englische Liste) bekommen feste deutsche Bedeutungen,
//    damit en→de, hoeren-wahl und blitz bei kleinem Pool gültige Optionen haben.
// 5. Wörter ≤ 4 Buchstaben: gezählt werden a–z, Apostroph und Bindestrich nicht
//    („don't“ bleibt eine Silbe). Bindestrich wird wie Leerzeichen behandelt und
//    gehört zum Anfang des folgenden Blocks.
// 6. hoeren-wahl: vier deutsche Bedeutungen (Klarstellung in ARCHITEKTUR).

import { gapSentence } from './parser.js';

const FALLBACK_EN = [
  'house', 'water', 'friend', 'school', 'happy', 'green', 'small', 'window',
  'garden', 'animal', 'music', 'river', 'mother', 'father', 'table', 'light',
  'night', 'morning', 'people', 'money',
];

const FALLBACK_DE = {
  house: 'das Haus', water: 'das Wasser', friend: 'der Freund', school: 'die Schule',
  happy: 'fröhlich', green: 'grün', small: 'klein', window: 'das Fenster',
  garden: 'der Garten', animal: 'das Tier', music: 'die Musik', river: 'der Fluss',
  mother: 'die Mutter', father: 'der Vater', table: 'der Tisch', light: 'das Licht',
  night: 'die Nacht', morning: 'der Morgen', people: 'die Leute', money: 'das Geld',
};

function fallbackWord(en) {
  return {
    id: `fallback|${en}`,
    list: 'fallback',
    en,
    de: FALLBACK_DE[en] || en,
    icon: null,
    s: `I like the ${en}.`,
  };
}

const FALLBACK_WORDS = FALLBACK_EN.map(fallbackWord);

// Mindestens 40 häufige Schulwörter. Trennung wie im Auftrag, danach Regel 3 (keine
// Einbuchstaben-Silbe außer am Wortanfang — mergeShort räumt Reste weg).
const EXCEPTIONS = {
  people: ['peo', 'ple'],
  every: ['ev', 'ery'],
  little: ['lit', 'tle'],
  favourite: ['fa', 'vour', 'ite'],
  interesting: ['in', 'ter', 'est', 'ing'],
  beautiful: ['beau', 'ti', 'ful'],
  because: ['be', 'cause'],
  through: ['through'],
  knowledge: ['knowl', 'edge'],
  orange: ['or', 'ange'],
  about: ['a', 'bout'],
  event: ['e', 'vent'],
  table: ['ta', 'ble'],
  explore: ['ex', 'plore'],
  window: ['win', 'dow'],
  sister: ['sis', 'ter'],
  tiger: ['ti', 'ger'],
  paper: ['pa', 'per'],
  animal: ['an', 'i', 'mal'],
  family: ['fam', 'i', 'ly'],
  different: ['dif', 'fer', 'ent'],
  together: ['to', 'geth', 'er'],
  important: ['im', 'por', 'tant'],
  yesterday: ['yes', 'ter', 'day'],
  tomorrow: ['to', 'mor', 'row'],
  something: ['some', 'thing'],
  nothing: ['noth', 'ing'],
  another: ['an', 'oth', 'er'],
  between: ['be', 'tween'],
  without: ['with', 'out'],
  children: ['chil', 'dren'],
  friend: ['friend'],
  school: ['school'],
  house: ['house'],
  water: ['wa', 'ter'],
  happy: ['hap', 'py'],
  garden: ['gar', 'den'],
  mother: ['moth', 'er'],
  father: ['fa', 'ther'],
  brother: ['broth', 'er'],
  morning: ['morn', 'ing'],
  money: ['mon', 'ey'],
  music: ['mu', 'sic'],
  river: ['riv', 'er'],
  light: ['light'],
  night: ['night'],
  apple: ['ap', 'ple'],
  banana: ['ba', 'na', 'na'],
  elephant: ['el', 'e', 'phant'],
  chocolate: ['choc', 'o', 'late'],
  island: ['is', 'land'],
  honest: ['hon', 'est'],
  listen: ['lis', 'ten'],
  often: ['of', 'ten'],
  answer: ['an', 'swer'],
  question: ['ques', 'tion'],
  picture: ['pic', 'ture'],
  colour: ['col', 'our'],
  neighbour: ['neigh', 'bour'],
  enough: ['e', 'nough'],
  though: ['though'],
  thought: ['thought'],
  careful: ['care', 'ful'],
  create: ['cre', 'ate'],
  their: ['their'],
  there: ['there'],
  where: ['where'],
  which: ['which'],
  could: ['could'],
  would: ['would'],
  should: ['should'],
  cover: ['cov', 'er'],
};

const SUFFIXES = ['tion', 'ment', 'ness', 'less', 'ful', 'ing', 'est', 'er', 'ed', 'ly'];
const VDIGRAPH = ['ea', 'ee', 'oo', 'ou', 'ai', 'ay', 'oa', 'oi', 'ie', 'ey'];
const C_DIGRAPH = ['ch', 'sh', 'th', 'ph', 'wh', 'ck', 'qu'];
const ONSET2 = new Set([
  'bl', 'br', 'cl', 'cr', 'dr', 'fl', 'fr', 'gl', 'gr', 'pl', 'pr',
  'sc', 'sk', 'sl', 'sm', 'sn', 'sp', 'st', 'sw', 'tr', 'tw', 'dw',
  'th', 'ch', 'sh', 'wh', 'qu',
]);
const ONSET3 = new Set(['str', 'spr', 'spl', 'scr', 'thr', 'chr', 'sch', 'squ']);
const HAEUFIG = 'etaoinshrdlcumwfgypbvkjxqz';
const FUELL_SILBEN = ['ing', 'er', 'ly', 'tion', 'ment', 'ness', 'ful', 'est', 'ous', 'ish', 'blor', 'snup', 'trell', 'miv'];

const norm = (s) => String(s || '').trim().toLowerCase();
const lettersOf = (s) => (String(s).match(/[a-z]/gi) || []).length;

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function endingClass(en) {
  for (const s of ['tion', 'ing', 'ed', 'ly']) {
    if (en.endsWith(s)) return s;
  }
  return '';
}

export function poolFor(word, allWords) {
  const own = allWords.filter((w) => w.list === word.list);
  if (own.length >= 6) return own;
  const others = allWords.filter((w) => w.list !== word.list);
  return [...own, ...others];
}

export function similarWords(word, pool, n, rng = Math.random) {
  const seenEn = new Set([norm(word.en)]);
  const seenDe = new Set([norm(word.de)]);
  const candidates = [];
  const consider = (w) => {
    const en = norm(w.en);
    const de = norm(w.de);
    if (!en || seenEn.has(en) || (de && seenDe.has(de))) return;
    seenEn.add(en);
    if (de) seenDe.add(de);
    candidates.push(w);
  };
  for (const w of pool || []) consider(w);
  for (const w of FALLBACK_WORDS) consider(w);

  const groups = [[], [], [], []];
  const target = norm(word.en);
  for (const w of candidates) {
    const en = norm(w.en);
    const sameStart = en[0] === target[0];
    const similarLen = Math.abs(en.length - target.length) <= 2;
    let rank = 3;
    if (sameStart && similarLen) rank = 0;
    else if (levenshtein(en, target) <= 3) rank = 1;
    else if (endingClass(en) && endingClass(en) === endingClass(target)) rank = 2;
    groups[rank].push(w);
  }
  const ordered = [];
  for (const g of groups) ordered.push(...shuffle(g, rng));
  return ordered.slice(0, n);
}

function isVowelAt(word, i) {
  const ch = word[i];
  if ('aeiou'.includes(ch)) return true;
  if (ch === 'y' && i > 0) return true;
  return false;
}

function findNuclei(word) {
  const nuclei = [];
  let i = 0;
  while (i < word.length) {
    const ch = word[i];
    if (ch === "'" || ch === '-') { i++; continue; }
    if (!isVowelAt(word, i)) { i++; continue; }
    const two = word.slice(i, i + 2);
    if (VDIGRAPH.includes(two)) {
      nuclei.push({ start: i, end: i + 1 });
      i += 2;
      continue;
    }
    nuclei.push({ start: i, end: i });
    i++;
  }
  return nuclei;
}

function dropSilentE(word, nuclei) {
  if (!word.endsWith('e') || word.endsWith('le') || nuclei.length < 2) return nuclei;
  const last = nuclei[nuclei.length - 1];
  if (last.start === word.length - 1 && last.end === word.length - 1) nuclei.pop();
  return nuclei;
}

function consonantUnits(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    const two = s.slice(i, i + 2);
    if (C_DIGRAPH.includes(two)) { out.push(two); i += 2; }
    else { out.push(s[i]); i++; }
  }
  return out;
}

function cutInCluster(cluster) {
  const units = consonantUnits(cluster);
  if (units.length <= 1) return 0;
  const maxKeep = Math.min(3, units.length - 1);
  for (let keep = maxKeep; keep >= 1; keep--) {
    const onset = units.slice(units.length - keep).join('');
    const ok = keep === 1 || (keep === 2 && ONSET2.has(onset)) || (keep === 3 && ONSET3.has(onset));
    if (ok) return units.slice(0, units.length - keep).join('').length;
  }
  return units[0].length;
}

function mergeShort(syls) {
  const out = [];
  for (let i = 0; i < syls.length; i++) {
    const s = syls[i];
    if (i > 0 && lettersOf(s) < 2) out[out.length - 1] += s;
    else out.push(s);
  }
  return out.filter((s) => s.length);
}

function splitStem(word) {
  const nuclei = dropSilentE(word, findNuclei(word));
  if (nuclei.length <= 1) return [word];
  const cuts = [0];
  for (let k = 0; k < nuclei.length - 1; k++) {
    const cluster = word.slice(nuclei[k].end + 1, nuclei[k + 1].start);
    cuts.push(nuclei[k].end + 1 + cutInCluster(cluster));
  }
  const syls = [];
  for (let i = 0; i < cuts.length; i++) {
    syls.push(word.slice(cuts[i], i + 1 < cuts.length ? cuts[i + 1] : word.length));
  }
  return syls;
}

function syllabifyWord(word) {
  const w = String(word).toLowerCase();
  if (!w) return [];
  if (lettersOf(w) <= 4) return [w];
  if (EXCEPTIONS[w]) return mergeShort([...EXCEPTIONS[w]]);
  for (const suf of SUFFIXES) {
    if (!w.endsWith(suf)) continue;
    const stem = w.slice(0, -suf.length);
    if (lettersOf(stem) >= 2 && /[aeiouy]/i.test(stem)) {
      return mergeShort([...syllabifyWord(stem), suf]);
    }
  }
  if (/[^aeiouy]le$/.test(w) && lettersOf(w) > 4) {
    const stem = w.slice(0, -3);
    const last = w.slice(-3);
    if (stem) return mergeShort([...syllabifyWord(stem), last]);
  }
  return mergeShort(splitStem(w));
}

export function syllabify(en) {
  const raw = String(en);
  const tokens = [];
  let buf = '';
  let sep = '';
  for (const ch of raw) {
    if (ch === ' ' || ch === '-') {
      if (buf) { tokens.push({ sep, word: buf }); buf = ''; }
      sep += ch;
    } else buf += ch;
  }
  if (buf) tokens.push({ sep, word: buf });
  if (!tokens.length) return [];
  if (tokens.length === 1 && !tokens[0].sep) return syllabifyWord(tokens[0].word);
  const out = [];
  for (const t of tokens) {
    const syls = syllabifyWord(t.word);
    if (t.sep && syls.length) syls[0] = t.sep + syls[0];
    out.push(...syls);
  }
  return out;
}

function letterUnits(en) {
  const units = [];
  let pending = '';
  for (const ch of String(en)) {
    if (ch === ' ' || ch === '-') { pending += ch; continue; }
    units.push(pending + ch);
    pending = '';
  }
  if (pending && units.length) units[units.length - 1] += pending;
  return units;
}

function extraLetters(en, extra, rng) {
  if (extra <= 0) return [];
  const have = new Set(norm(en).replace(/[^a-z]/g, '').split(''));
  const bag = shuffle([...HAEUFIG].filter((ch) => !have.has(ch)), rng);
  return bag.slice(0, extra);
}

export function scrambleLetters(en, rng = Math.random, extra = 0) {
  const target = letterUnits(en);
  const more = extraLetters(en, extra, rng);
  const mixed = shuffle([...target, ...more], rng);
  const blocks = mixed.map((text, i) => ({ id: String(i), text }));
  return { blocks, target };
}

function pickSyllableDistractors(word, pool, n, rng) {
  const banned = new Set(syllabify(word.en).map((s) => s.trim()));
  const seen = new Set();
  const cands = [];
  const add = (syl) => {
    const key = String(syl).trim();
    if (!key || banned.has(key) || seen.has(key)) return;
    seen.add(key);
    cands.push(key);
  };
  for (const w of pool || []) {
    if (norm(w.en) === norm(word.en)) continue;
    syllabify(w.en).forEach(add);
  }
  for (const w of FALLBACK_WORDS) {
    if (norm(w.en) === norm(word.en)) continue;
    syllabify(w.en).forEach(add);
  }
  const picked = shuffle(cands, rng);
  const out = picked.slice(0, n);
  for (const f of FUELL_SILBEN) {
    if (out.length >= n) break;
    if (!banned.has(f) && !out.includes(f)) out.push(f);
  }
  return out.slice(0, n);
}

function makeBlocks(target, extras, rng, idPrefix) {
  const texts = shuffle([...target, ...extras], rng);
  const blocks = texts.map((text, i) => ({ id: `${idPrefix}:${i}`, text }));
  return { blocks, target };
}

function mixOptions(correct, distractors, rng) {
  const seen = new Set([correct]);
  const opts = [{ text: correct, correct: true }];
  for (const t of distractors) {
    if (!t || seen.has(t)) continue;
    seen.add(t);
    opts.push({ text: t, correct: false });
  }
  return shuffle(opts, rng);
}

function gapped(word) {
  return gapSentence(word.s || `Look at the ${word.en}.`, word.en);
}

function buildWahl(spec, pool, rng, word, dir, occ) {
  const distractors = similarWords(word, pool, 3, rng);
  const correct = dir === 'en→de' ? word.de : word.en;
  const texts = distractors.map((w) => (dir === 'en→de' ? w.de : w.en));
  const id = `${word.id}#wahl#${occ}`;
  return {
    id,
    type: 'wahl',
    wordId: word.id,
    word,
    box: spec.box,
    dir,
    prompt: dir === 'en→de'
      ? { kind: 'en', text: word.en }
      : { kind: 'de', text: word.de },
    options: mixOptions(correct, texts, rng),
    answer: word.en,
  };
}

function letterExtra(en) {
  return lettersOf(en) >= 6 ? 2 : 0;
}

export function buildTask(spec, pool, rng = Math.random) {
  const word = spec.word;
  const dir = spec.dir || 'de→en';
  const occ = spec.occ ?? 0;
  const id = `${spec.wordId}#${spec.type}#${occ}`;
  const base = {
    id,
    type: spec.type,
    wordId: spec.wordId,
    word,
    box: spec.box,
    dir,
    answer: word.en,
  };

  if (spec.type === 'kennenlernen') {
    return {
      ...base,
      prompt: { kind: 'karte', text: word.en, sentence: word.s, de: word.de },
    };
  }

  if (spec.type === 'wahl') {
    return buildWahl(spec, pool, rng, word, dir, occ);
  }

  if (spec.type === 'hoeren-wahl') {
    const distractors = similarWords(word, pool, 3, rng);
    return {
      ...base,
      prompt: { kind: 'audio', text: word.en },
      options: mixOptions(word.de, distractors.map((w) => w.de), rng),
    };
  }

  if (spec.type === 'luecke-wahl') {
    const distractors = similarWords(word, pool, 2, rng);
    return {
      ...base,
      prompt: { kind: 'satz', text: word.de, sentence: gapped(word) },
      options: mixOptions(word.en, distractors.map((w) => w.en), rng),
    };
  }

  if (spec.type === 'silben' || spec.type === 'nachbau') {
    const target = syllabify(word.en);
    const n = spec.type === 'nachbau' ? 1 : 2;
    const extras = pickSyllableDistractors(word, pool, n, rng);
    return {
      ...base,
      prompt: { kind: 'de', text: word.de, sentence: gapped(word) },
      ...makeBlocks(target, extras, rng, id),
    };
  }

  if (spec.type === 'buchstaben' || spec.type === 'luecke-bauen' || spec.type === 'hoeren-bauen') {
    const { target, blocks } = scrambleLetters(word.en, rng, letterExtra(word.en));
    const tagged = blocks.map((b, i) => ({ id: `${id}:${i}`, text: b.text }));
    const prompt = spec.type === 'hoeren-bauen'
      ? { kind: 'audio', text: word.en, de: word.de }
      : spec.type === 'luecke-bauen'
        ? { kind: 'satz', text: word.de, sentence: gapped(word) }
        : { kind: 'de', text: word.de, sentence: gapped(word) };
    return { ...base, prompt, blocks: tagged, target };
  }

  if (spec.type === 'blitz') {
    const others = similarWords(word, pool, 2, rng);
    while (others.length < 2) others.push(fallbackWord(FALLBACK_EN[others.length] || 'house'));
    const words = [word, others[0], others[1]];
    const startEnDe = dir === 'en→de';
    const items = words.map((w, i) => {
      const d = (startEnDe ? i % 2 === 0 : i % 2 === 1) ? 'en→de' : 'de→en';
      return buildWahl(spec, pool, rng, w, d, i);
    });
    return {
      ...base,
      prompt: { kind: 'blitz' },
      items,
    };
  }

  return base;
}
