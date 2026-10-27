// Vertragspräzisierung: rollRarity akzeptiert min als Text (Paket/Hunt) und als
// { min } (Architektur). Identische Grenzen wie hunt.js, keine Neugewichtung.
// Arten sind dauerhaft numerische IDs; Hash über die unveränderten UTF-16-Zeichen.
export const SPECIES = [
  ['Krabbler', 'schild'], ['Flatterer', 'kombo-schutz'], ['Schleimer', 'muenzen'],
  ['Hornkopf', 'schild'], ['Schnapper', 'kombo-schutz'], ['Glotzer', 'muenzen'],
  ['Stachler', 'schild'], ['Puschel', 'kombo-schutz'], ['Knirscher', 'muenzen'],
  ['Funkler', 'schild'], ['Brummer', 'kombo-schutz'], ['Schlitzohr', 'muenzen'],
].map(([name, perk], id) => Object.freeze({ id, name, perk }));
Object.freeze(SPECIES);
export const STAGE_NAMES = Object.freeze(['wild', 'Ei', 'geschlüpft', 'gewachsen', 'zahm', 'zahm · glänzend']);

export function speciesFor(en) {
  let hash = 2166136261;
  for (let i = 0; i < en.length; i++) hash = Math.imul(hash ^ en.charCodeAt(i), 16777619);
  return (hash >>> 0) % SPECIES.length;
}
export function randomSpecies(rng = Math.random) { return Math.floor(rng() * SPECIES.length); }
// Boxen sind ganzzahlig; fehlende/ungültige Werte gelten als wild.
export function stageFor(box) { return Number.isFinite(box) ? Math.max(0, Math.min(5, Math.floor(box))) : 0; }
export function rollRarity(rng = Math.random, min = 'gewoehnlich') {
  if (min && typeof min === 'object') min = min.min;
  const rarities = ['gewoehnlich', 'selten', 'episch'];
  const x = rng();
  const rank = x < 0.05 ? 2 : x < 0.30 ? 1 : 0;
  return rarities[Math.max(rank, rarities.indexOf(min))];
}
export function biestFor(word, record, biestState, listColor) {
  const species = speciesFor(word.en);
  return {
    species, speciesName: SPECIES[species].name, stage: stageFor(record?.box),
    rarity: biestState?.rarity ?? 'gewoehnlich', color: listColor ?? '#6fcf6a',
    hat: biestState?.hat ?? null, skin: biestState?.skin ?? null,
    name: word.en, wordId: word.id, hungrig: !!record && record.due <= Date.now(),
  };
}
export function perkFor(biest) { return biest.stage >= 4 ? SPECIES[biest.species]?.perk ?? null : null; }
export function perksFor(biester) { return [...new Set(biester.map(perkFor).filter(Boolean))]; }
export function describePerk(perk) {
  return {
    schild: 'Bringt dir einen Schild mehr auf die Jagd.',
    'kombo-schutz': 'Beim ersten Fehler bleibt deine Kombo erhalten.',
    muenzen: 'Bringt dir zehn Prozent mehr Münzen auf der Jagd.',
  }[perk] ?? '';
}
