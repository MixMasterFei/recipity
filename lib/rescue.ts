import { ingredientName } from "@/data/ingredients";
import { daysUntil } from "@/lib/expiry";
import type { IngredientId, MatchResult, PantryItem } from "@/lib/types";

/**
 * Food rescue — the app's sharpest question.
 *
 * "What can I cook from my twenty ingredients?" needs an enormous recipe
 * corpus to answer well, and with a curated library it fails often. "What uses
 * up this spinach before Thursday?" needs only a handful of spinach recipes to
 * succeed. Narrowing the question narrows how much library it takes to answer
 * it, which is why this is worth putting first rather than treating expiry as
 * a bonus on a card.
 *
 * Everything here is pure and derives from `MatchResult.rescues`, which the
 * engine already computes.
 */

/** Anything at or inside this many days is "about to turn". */
export const TURNING_DAYS = 3;

export interface TurningItem {
  item: PantryItem;
  /** Whole days until the use-by date; negative once past. */
  days: number;
  name: string;
}

/** What's about to turn, most urgent first. */
export function turningItems(
  pantry: PantryItem[],
  now: Date,
  withinDays: number = TURNING_DAYS,
): TurningItem[] {
  return pantry
    .filter((p) => p.expiresAt)
    .map((item) => ({
      item,
      days: daysUntil(item.expiresAt!, now),
      name: ingredientName(item.ingredientId),
    }))
    .filter((entry) => entry.days <= withinDays)
    .sort(
      (a, b) => a.days - b.days || a.name.localeCompare(b.name),
    );
}

/**
 * Recipes worth cooking tonight to save something.
 *
 * Ranked by how many turning items each one uses, then by whatever the engine
 * already decided. Deliberately restricted to recipes you can actually make
 * now or nearly — being told to rescue your spinach with a dish needing five
 * things you haven't got is not rescue, it's a shopping list.
 *
 * Then filled one turning item at a time, most urgent first, rather than by
 * taking the top of that ranking. Straight ranking lets whatever you own the
 * most recipes for take the whole board: spinach going off tonight would lose
 * all three slots to eggs that are fine until tomorrow, which is exactly the
 * food the board exists to save.
 *
 * Three by default: this is a recommendation, and the full tiers are directly
 * below it. A longer board would mostly repeat them.
 */
export function rescueResults(
  results: MatchResult[],
  turning: TurningItem[],
  limit = 3,
): MatchResult[] {
  if (turning.length === 0) return [];
  const urgent = new Set(turning.map((t) => t.item.ingredientId));
  const saves = (r: MatchResult) =>
    r.rescues.filter((id) => urgent.has(id)).length;

  const eligible = results
    .filter((r) => r.status !== "stretch" && saves(r) > 0)
    .sort((a, b) => saves(b) - saves(a) || b.score - a.score);

  const picked: MatchResult[] = [];
  const taken = new Set<string>();
  const take = (r: MatchResult | undefined) => {
    if (!r || taken.has(r.recipe.id) || picked.length >= limit) return;
    picked.push(r);
    taken.add(r.recipe.id);
  };

  // One good answer for each thing that's turning, soonest-to-go first...
  for (const t of turning) {
    take(
      eligible.find(
        (r) =>
          !taken.has(r.recipe.id) && r.rescues.includes(t.item.ingredientId),
      ),
    );
  }
  // ...then fill any remaining slots by rank.
  for (const r of eligible) take(r);

  return picked;
}

/**
 * Turning items that nothing in the library can save.
 *
 * Surfaced honestly rather than hidden. It tells the user the truth, and it's
 * the clearest signal available of where the recipe corpus is thin.
 */
export function orphanedItems(
  results: MatchResult[],
  turning: TurningItem[],
): TurningItem[] {
  const rescuable = new Set<IngredientId>();
  for (const result of results) {
    if (result.status === "stretch") continue;
    for (const id of result.rescues) rescuable.add(id);
  }
  return turning.filter((t) => !rescuable.has(t.item.ingredientId));
}

/** "3 things are about to turn" / "the spinach is about to turn". */
export function turningHeadline(turning: TurningItem[]): string {
  if (turning.length === 1) {
    return `the ${turning[0]!.name.toLowerCase()} is about to turn`;
  }
  return `${turning.length} things are about to turn`;
}

/** How urgent, in words: "2 gone off · 1 today". */
export function turningSummary(turning: TurningItem[]): string {
  const expired = turning.filter((t) => t.days < 0).length;
  const today = turning.filter((t) => t.days === 0).length;
  const soon = turning.length - expired - today;

  const parts: string[] = [];
  if (expired > 0) parts.push(`${expired} already gone`);
  if (today > 0) parts.push(`${today} today`);
  if (soon > 0) parts.push(`${soon} within ${TURNING_DAYS} days`);
  return parts.join(" · ");
}
