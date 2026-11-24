import {
  GROUP_MEMBERS,
  INGREDIENTS,
  INGREDIENT_BY_ID,
} from "@/data/ingredients";
import { dietFlagsFor } from "@/lib/diet";
import type { DietKey, Ingredient, IngredientId } from "@/lib/types";

/**
 * Free text -> canonical ingredient id.
 *
 * Two entry points share one normaliser so they agree on spelling, plurals
 * and noise words: `searchIngredients` behind the pantry typeahead (what the
 * user types) and `resolveIngredient` behind the AI invent route (what Claude
 * returns). If they diverged, generated recipes would silently stop matching
 * the pantry.
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

/** Lowercase, strip accents, drop parentheticals and quantities, singularize. */
function tokenize(input: string): string[] {
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

  return base
    .split(" ")
    .map((w) => singularize(w))
    .filter((w) => w.length > 0);
}

/**
 * The loose form, with preparation words stripped, used by the typeahead:
 * "2 large Free-Range Eggs (beaten)" -> "egg".
 */
export function normalizeText(input: string): string {
  const words = tokenize(input);
  const meaningful = words.filter((w) => !NOISE_WORDS.has(w));
  // Fall back to the unfiltered words when noise-stripping ate everything,
  // e.g. "to taste" or a lone "handful".
  return (meaningful.length > 0 ? meaningful : words).join(" ");
}

/**
 * The strict form, keeping every word, used to resolve a name to an id.
 *
 * Words like "ground", "dried" and "whole" are noise in "finely chopped
 * parsley" but identity in "ground coriander", "dried cranberries" and "whole
 * chicken". Stripping them made each of those collide with its neighbour, so
 * resolution keeps them and tolerates surplus words by matching phrases
 * inside the text instead.
 */
function phraseOf(input: string): string {
  return tokenize(input).join(" ");
}

/** Every search key that should resolve to a given ingredient. */
function keysFor(ing: Ingredient): string[] {
  return [ing.name, ...ing.aliases, ing.id.replace(/-/g, " ")].map(
    normalizeText,
  );
}

const SEARCH_INDEX: { id: IngredientId; keys: string[]; name: string }[] =
  INGREDIENTS.map((ing) => ({
    id: ing.id,
    keys: keysFor(ing),
    name: ing.name,
  }));

/**
 * Generic words that mean "any member of this group" but aren't the group's
 * own name. Kept short on purpose: this is vocabulary, not guesswork.
 */
const GROUP_SPOKEN_AS: Record<string, string[]> = {
  "cooking-oil": ["oil"],
  "fresh-herb": ["herbs"],
  "ground-meat": ["mince", "minced meat"],
  "leafy-green": ["greens"],
  "winter-squash": ["squash"],
};

/**
 * Every phrase free text can resolve to, and what it resolves to.
 *
 * Filled in three passes, earlier passes winning, so that precedence is by
 * kind rather than by catalogue order:
 *
 *   1. An ingredient's own name and id. "rice" is white rice.
 *   2. Group names. "nuts" is `group:nut`, "cheese" is `group:any-cheese`.
 *      A generic word is best answered with a group, because that is what it
 *      means: a recipe calling for "nuts" is happy with whichever nut you
 *      own, and is not nut-free whichever one that turns out to be.
 *   3. Aliases. "courgette" is zucchini.
 *
 * Groups outrank aliases so that a loose alias ("chicken" for a whole
 * chicken) doesn't shadow the more honest reading (any chicken).
 */
const PHRASE_INDEX: Map<string, IngredientId> = (() => {
  const map = new Map<string, IngredientId>();
  const claim = (text: string, id: IngredientId) => {
    const phrase = phraseOf(text);
    if (phrase && !map.has(phrase)) map.set(phrase, id);
  };

  for (const ing of INGREDIENTS) {
    claim(ing.name, ing.id);
    claim(ing.id.replace(/-/g, " "), ing.id);
  }

  for (const group of GROUP_MEMBERS.keys()) {
    claim(group.replace(/-/g, " ").replace(/^any /, ""), `group:${group}`);
    for (const alias of GROUP_SPOKEN_AS[group] ?? []) {
      claim(alias, `group:${group}`);
    }
  }

  for (const ing of INGREDIENTS) {
    for (const alias of ing.aliases) claim(alias, ing.id);
  }

  return map;
})();

/** The same phrases, pre-split into words for whole-word matching. */
const PHRASES: { id: IngredientId; text: string; words: string[] }[] = [
  ...PHRASE_INDEX,
].map(([text, id]) => ({ id, text, words: text.split(" ") }));

/** Where `needle` occurs in `haystack` as a run of whole words, or -1. */
function indexOfWords(haystack: string[], needle: string[]): number {
  for (let at = 0; at + needle.length <= haystack.length; at += 1) {
    let hit = true;
    for (let k = 0; k < needle.length; k += 1) {
      if (haystack[at + k] !== needle[k]) {
        hit = false;
        break;
      }
    }
    if (hit) return at;
  }
  return -1;
}

const DIET_FLAG_KEYS: DietKey[] = [
  "vegan",
  "vegetarian",
  "glutenFree",
  "dairyFree",
  "nutFree",
];

/** True when `a` claims no diet flag that `b` denies. */
function noLooserThan(a: IngredientId, b: IngredientId): boolean {
  const fa = dietFlagsFor(a);
  const fb = dietFlagsFor(b);
  return DIET_FLAG_KEYS.every((key) => !fa[key] || fb[key]);
}

interface Candidate {
  id: IngredientId;
  /** Word position in the query; later is closer to the head noun. */
  at: number;
}

/**
 * Choose between several readings of the same text.
 *
 * The rule is safety before cleverness. A reading is only acceptable if it
 * claims no diet flag that another reading denies — "garlic bread" may be
 * read as bread (which admits to gluten) but never as garlic (which doesn't).
 * When no reading is that safe — "cashew cream" is nuts one way and dairy the
 * other — we decline to guess and the caller keeps the raw text, which
 * matches nothing and is treated as failing every diet.
 */
function settle(candidates: Candidate[]): IngredientId | undefined {
  const byId = new Map<IngredientId, Candidate>();
  for (const c of candidates) {
    const seen = byId.get(c.id);
    if (!seen || c.at > seen.at) byId.set(c.id, c);
  }
  const unique = [...byId.values()];
  if (unique.length <= 1) return unique[0]?.id;

  const safe = unique.filter((c) =>
    unique.every((other) => noLooserThan(c.id, other.id)),
  );
  // Among equally safe readings the last word wins: in English it's the noun.
  safe.sort((a, b) => b.at - a.at || a.id.localeCompare(b.id));
  return safe[0]?.id;
}

/**
 * Resolve free text to a canonical id, or to a `group:` ref for a generic
 * word.
 *
 * Matching is on whole words throughout. Comparing raw substrings is how
 * "nuts" once resolved to squash seeds (butter*nut*) and "béchamel" to ham
 * (bec*ham*el) — the first of which would have labelled a dish nut-free.
 *
 * Two steps:
 *   1. The whole text is a phrase we know: "courgette" -> `zucchini`,
 *      "nuts" -> `group:nut`.
 *   2. The text contains phrases we know, plus more: "2 large free-range
 *      eggs, beaten" -> `egg`, "chicken breast fillet" -> `chicken-breast`.
 *      Only the longest ones compete, so "sweet potato mash" doesn't collapse
 *      to "potato", and `settle` decides between them.
 *
 * There is deliberately no third step that guesses from a fragment ("juice"
 * -> some juice or other). Text that names nothing we know returns undefined,
 * and the caller keeps it verbatim: an honest "missing" beats a confident
 * wrong ingredient.
 */
export function resolveIngredient(input: string): IngredientId | undefined {
  const q = phraseOf(input);
  if (!q) return undefined;

  const exact = PHRASE_INDEX.get(q);
  if (exact) return exact;

  const words = q.split(" ");
  let longest = 0;
  let inside: Candidate[] = [];
  for (const phrase of PHRASES) {
    if (phrase.words.length >= words.length) continue;
    if (phrase.words.length < longest) continue;
    const at = indexOfWords(words, phrase.words);
    if (at < 0) continue;
    if (phrase.words.length > longest) {
      longest = phrase.words.length;
      inside = [];
    }
    inside.push({ id: phrase.id, at });
  }
  return settle(inside);
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
