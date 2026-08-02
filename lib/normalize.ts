import { INGREDIENTS, INGREDIENT_BY_ID } from "@/data/ingredients";
import type { Ingredient, IngredientId } from "@/lib/types";

/**
 * Free text -> canonical ingredient id.
 *
 * Used in two places that must agree: the pantry typeahead (what the user
 * types) and the AI invent route (what Claude returns). If these ever diverged,
 * generated recipes would silently stop matching the pantry.
 */

const IRREGULAR_PLURALS: Record<string, string> = {
  leaves: "leaf",
  loaves: "loaf",
  knives: "knife",
  potatoes: "potato",
  tomatoes: "tomato",
  anchovies: "anchovy",
  berries: "berry",
  cherries: "cherry",
  chilies: "chili",
  chillies: "chili",
  peaches: "peach",
  radishes: "radish",
  dishes: "dish",
  sprouts: "sprout",
  geese: "goose",
};

/** Words that carry no identifying information; stripped before matching. */
const NOISE_WORDS = new Set([
  "fresh",
  "freshly",
  "dried",
  "ground",
  "chopped",
  "finely",
  "roughly",
  "thinly",
  "sliced",
  "diced",
  "minced",
  "crushed",
  "grated",
  "shredded",
  "peeled",
  "large",
  "small",
  "medium",
  "ripe",
  "raw",
  "cooked",
  "whole",
  "half",
  "good",
  "quality",
  "free",
  "range",
  "organic",
  "unsalted",
  "salted",
  "plain",
  "of",
  "a",
  "an",
  "the",
  "or",
  "and",
  "some",
  "to",
  "taste",
  "for",
  "serving",
  "serve",
  "garnish",
  "optional",
  "extra",
  "few",
  "handful",
  "pinch",
  "splash",
  "drizzle",
  "knob",
  "piece",
  "pieces",
]);

function singularize(word: string): string {
  const irregular = IRREGULAR_PLURALS[word];
  if (irregular) return irregular;
  if (word.length <= 3) return word;
  if (word.endsWith("ies")) return `${word.slice(0, -3)}y`;
  if (word.endsWith("ses") || word.endsWith("xes") || word.endsWith("zes")) {
    return word.slice(0, -2);
  }
  if (word.endsWith("s") && !word.endsWith("ss") && !word.endsWith("us")) {
    return word.slice(0, -1);
  }
  return word;
}

/**
 * Lowercase, strip accents, drop parentheticals and quantities, singularize.
 * "2 large Free-Range Eggs (beaten)" -> "egg"
 */
export function normalizeText(input: string): string {
  const base = input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\([^)]*\)/g, " ")
    // Hyphens become spaces so compound words tokenize: "free-range" has to
    // split into "free" and "range" for noise-stripping to reach them. Doing
    // it here keeps the index and the query consistent, since ingredient ids
    // ("sun-dried-tomato") go through the same function.
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b\d+([./]\d+)?\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const words = base
    .split(" ")
    .map((w) => singularize(w))
    .filter((w) => w.length > 0);

  const meaningful = words.filter((w) => !NOISE_WORDS.has(w));
  // Fall back to the unfiltered words when noise-stripping ate everything,
  // e.g. "to taste" or a lone "handful".
  return (meaningful.length > 0 ? meaningful : words).join(" ");
}

/** Every search key that should resolve to a given ingredient. */
function keysFor(ing: Ingredient): string[] {
  return [ing.name, ...ing.aliases, ing.id.replace(/-/g, " ")].map(
    normalizeText,
  );
}

const EXACT_INDEX: Map<string, IngredientId> = (() => {
  const map = new Map<string, IngredientId>();
  for (const ing of INGREDIENTS) {
    for (const key of keysFor(ing)) {
      // First writer wins: an ingredient's own name beats another's alias.
      if (!map.has(key)) map.set(key, ing.id);
    }
  }
  return map;
})();

const SEARCH_INDEX: { id: IngredientId; keys: string[]; name: string }[] =
  INGREDIENTS.map((ing) => ({
    id: ing.id,
    keys: keysFor(ing),
    name: ing.name,
  }));

/**
 * Resolve free text to a canonical id.
 *
 * Tries exact match, then containment in either direction ("chicken breast
 * fillet" -> `chicken-breast`), preferring the longest key so "sweet potato"
 * doesn't collapse to "potato".
 */
export function resolveIngredient(input: string): IngredientId | undefined {
  const q = normalizeText(input);
  if (!q) return undefined;

  const exact = EXACT_INDEX.get(q);
  if (exact) return exact;

  let best: { id: IngredientId; len: number } | undefined;
  for (const entry of SEARCH_INDEX) {
    for (const key of entry.keys) {
      if (!key) continue;
      const hit = q === key || q.includes(key) || key.includes(q);
      if (!hit) continue;
      if (!best || key.length > best.len) best = { id: entry.id, len: key.length };
    }
  }
  return best?.id;
}

export interface SearchHit {
  id: IngredientId;
  name: string;
  /** Lower is better. */
  rank: number;
}

/**
 * Typeahead search over the catalogue.
 *
 * An exact hit on *any* key outranks everything, including a prefix match on a
 * display name. That matters because the canonical id is often shorter than the
 * name it's stored under: typing "rice" must surface `rice` ("White rice")
 * rather than `rice-paper`, whose display name happens to start with the query.
 */
export function searchIngredients(query: string, limit = 8): SearchHit[] {
  const q = normalizeText(query);
  if (!q) return [];

  const hits: SearchHit[] = [];
  for (const entry of SEARCH_INDEX) {
    let rank = Infinity;
    const primary = entry.keys[0] ?? "";

    if (entry.keys.some((k) => k === q)) rank = 0;
    else if (primary.startsWith(q)) rank = 1;
    else if (entry.keys.some((k) => k.startsWith(q))) rank = 2;
    else if (primary.includes(q)) rank = 3;
    else if (entry.keys.some((k) => k.includes(q))) rank = 4;

    if (rank < Infinity) {
      // Nudge shorter names up so "onion" beats "onion powder" for "on".
      hits.push({
        id: entry.id,
        name: entry.name,
        rank: rank + primary.length / 500,
      });
    }
  }

  return hits
    .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
    .slice(0, limit);
}

/** True when the id is a real catalogue entry (not a group ref or typo). */
export function isKnownIngredient(id: string): boolean {
  return INGREDIENT_BY_ID.has(id);
}
