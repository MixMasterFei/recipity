import type { Unit } from "@/lib/types";

/**
 * Comparing "how much you have" against "how much a recipe wants".
 *
 * The competitors that tried this mostly failed the same way: they demanded
 * accuracy. Plan to Eat removed their pantry feature outright, reasoning that a
 * digital inventory and a real kitchen can never stay in sync. Cooklist tracks
 * quantities on paper and users report it doesn't work. SuperCook ducked the
 * problem entirely and stayed binary — and gets criticised for exactly that,
 * because portions are never sized to you.
 *
 * So the rule here is: be useful when we can be, and silent when we can't.
 *
 *   - Amounts are optional. No amount means today's behaviour, unchanged.
 *   - We only compare within a unit family. "400 g" versus "1 can" is not a
 *     comparison we can make honestly, so we return null and say nothing.
 *     Cross-family conversion (a cup of flour weighs 120g, a cup of sugar 200g)
 *     is ingredient-specific and guessing it produces confident nonsense.
 *   - Vague amounts — a pinch, a handful, to taste — are never compared.
 *     Nobody measures a pinch, and pretending otherwise is how you end up
 *     telling someone they can't cook.
 */

export type UnitFamily = "mass" | "volume" | "count" | "vague";

/**
 * Conversion factors to a family's base unit: grams, millilitres, or "one of
 * them". Spoon and cup measures use US convention (1 tbsp = 3 tsp,
 * 1 cup = 16 tbsp).
 */
const UNITS: Record<Unit, { family: UnitFamily; perBase: number }> = {
  g: { family: "mass", perBase: 1 },
  kg: { family: "mass", perBase: 1000 },

  ml: { family: "volume", perBase: 1 },
  l: { family: "volume", perBase: 1000 },
  tsp: { family: "volume", perBase: 4.92892 },
  tbsp: { family: "volume", perBase: 14.7868 },
  cup: { family: "volume", perBase: 236.588 },

  // Counted things. A clove, slice, can or bunch is only ever comparable with
  // itself — half a bunch of parsley is not half a can of tomatoes — so each
  // gets its own family below via `countKey`.
  piece: { family: "count", perBase: 1 },
  clove: { family: "count", perBase: 1 },
  slice: { family: "count", perBase: 1 },
  can: { family: "count", perBase: 1 },
  bunch: { family: "count", perBase: 1 },

  pinch: { family: "vague", perBase: 1 },
  handful: { family: "vague", perBase: 1 },
  "to taste": { family: "vague", perBase: 1 },
};

export function unitFamily(unit: Unit): UnitFamily {
  return UNITS[unit].family;
}

/**
 * Counted units are each their own comparison bucket. Mass and volume share
 * one bucket per family because conversion within them is exact.
 */
function comparisonKey(unit: Unit): string | null {
  const { family } = UNITS[unit];
  if (family === "vague") return null;
  if (family === "count") return `count:${unit}`;
  return family;
}

export interface Amount {
  quantity: number;
  unit: Unit;
}

/** Normalise to the family's base unit. */
function toBase(amount: Amount): number {
  return amount.quantity * UNITS[amount.unit].perBase;
}

/**
 * How much of `need` the `have` covers, as a ratio. 1 means exactly enough,
 * 0.5 means half, 2 means twice as much as required.
 *
 * Returns null — meaning "no opinion" — whenever the two aren't honestly
 * comparable. Callers must treat null as "assume it's fine", never as a
 * shortfall.
 */
export function coverageRatio(
  have: Amount | null,
  need: Amount | null,
): number | null {
  if (!have || !need) return null;
  if (have.quantity <= 0 || need.quantity <= 0) return null;

  const haveKey = comparisonKey(have.unit);
  const needKey = comparisonKey(need.unit);
  if (!haveKey || !needKey || haveKey !== needKey) return null;

  return toBase(have) / toBase(need);
}

/** Build an Amount from the loose optional fields carried on the domain types. */
export function toAmount(
  quantity: number | undefined,
  unit: Unit | undefined,
): Amount | null {
  if (typeof quantity !== "number" || !Number.isFinite(quantity)) return null;
  if (quantity <= 0) return null;
  // A bare number with no unit means "one of these", which only compares
  // against another countable.
  return { quantity, unit: unit ?? "piece" };
}

/**
 * Ratios this close to 1 are treated as enough.
 *
 * Someone who typed "500 g" of mince for a recipe wanting 520 g should not be
 * told they're short. Kitchen amounts are approximate and so is the input.
 */
const CLOSE_ENOUGH = 0.95;

export function isEnough(ratio: number | null): boolean {
  return ratio === null || ratio >= CLOSE_ENOUGH;
}

/** The units offered in the fridge editor, grouped for a sensible dropdown. */
export const UNIT_CHOICES: { label: string; units: Unit[] }[] = [
  { label: "weight", units: ["g", "kg"] },
  { label: "volume", units: ["ml", "l", "tsp", "tbsp", "cup"] },
  { label: "count", units: ["piece", "clove", "slice", "can", "bunch"] },
];

/** Short human form for a chip: "400g", "2 cans", "1 bunch". */
export function formatAmount(
  quantity: number | undefined,
  unit: Unit | undefined,
): string {
  const amount = toAmount(quantity, unit);
  if (!amount) return "";

  const rounded =
    amount.quantity >= 10
      ? Math.round(amount.quantity)
      : Math.round(amount.quantity * 100) / 100;

  // Weights and volumes read better closed up; counted things need the space
  // and a plural.
  if (unitFamily(amount.unit) === "mass" || unitFamily(amount.unit) === "volume") {
    return `${rounded}${amount.unit}`;
  }
  const plural = rounded === 1 ? amount.unit : `${amount.unit}s`;
  return `${rounded} ${plural}`;
}
