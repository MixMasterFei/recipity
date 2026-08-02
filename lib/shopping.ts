import { AISLE_ORDER, AISLE_LABEL, getIngredient } from "@/data/ingredients";
import type {
  Aisle,
  IngredientId,
  MatchResult,
  RecipeId,
  ShoppingItem,
} from "@/lib/types";

/**
 * Shopping list assembly.
 *
 * The list is deduped across recipes and grouped by aisle, so adding three
 * recipes that all want onions gives you "Onion — for 3 recipes", once, in
 * Produce, rather than three separate lines scattered through the list.
 */

/** Merge a recipe's missing ingredients into an existing list. */
export function addMissingToList(
  list: ShoppingItem[],
  result: MatchResult,
  now: Date = new Date(),
): ShoppingItem[] {
  const next = list.map((i) => ({ ...i, forRecipes: [...i.forRecipes] }));
  const byId = new Map(next.map((i) => [i.ingredientId, i]));

  for (const id of result.missing) {
    const existing = byId.get(id);
    if (existing) {
      if (!existing.forRecipes.includes(result.recipe.id)) {
        existing.forRecipes.push(result.recipe.id);
      }
      // Re-adding a crossed-off item should put it back on the list.
      existing.checked = false;
    } else {
      const item: ShoppingItem = {
        ingredientId: id,
        forRecipes: [result.recipe.id],
        checked: false,
        addedAt: now.toISOString(),
      };
      next.push(item);
      byId.set(id, item);
    }
  }

  return next;
}

/** Drop a recipe's claim on list items, removing any left unclaimed. */
export function removeRecipeFromList(
  list: ShoppingItem[],
  recipeId: RecipeId,
): ShoppingItem[] {
  return list
    .map((item) => ({
      ...item,
      forRecipes: item.forRecipes.filter((r) => r !== recipeId),
    }))
    .filter((item) => item.forRecipes.length > 0);
}

export interface AisleGroup {
  aisle: Aisle;
  label: string;
  items: ShoppingItem[];
}

/** Group a list by supermarket aisle, in walking order, skipping empties. */
export function groupByAisle(list: ShoppingItem[]): AisleGroup[] {
  const buckets = new Map<Aisle, ShoppingItem[]>();

  for (const item of list) {
    const aisle = getIngredient(item.ingredientId)?.aisle ?? "pantry";
    const bucket = buckets.get(aisle);
    if (bucket) bucket.push(item);
    else buckets.set(aisle, [item]);
  }

  return AISLE_ORDER.filter((a) => buckets.has(a)).map((aisle) => ({
    aisle,
    label: AISLE_LABEL[aisle],
    items: (buckets.get(aisle) ?? []).sort((a, b) =>
      nameOf(a.ingredientId).localeCompare(nameOf(b.ingredientId)),
    ),
  }));
}

function nameOf(id: IngredientId): string {
  return getIngredient(id)?.name ?? id;
}

/**
 * The single most useful thing to buy: the ingredient that, once bought,
 * unlocks the most recipes currently sitting in the "almost" tier.
 */
export function highestLeverageBuy(
  results: MatchResult[],
): { ingredientId: IngredientId; unlocks: number } | undefined {
  const counts = new Map<IngredientId, number>();

  for (const r of results) {
    // Only single-item gaps unlock a recipe outright.
    if (r.missing.length !== 1) continue;
    const id = r.missing[0];
    if (!id) continue;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }

  let best: { ingredientId: IngredientId; unlocks: number } | undefined;
  for (const [ingredientId, unlocks] of counts) {
    if (!best || unlocks > best.unlocks) best = { ingredientId, unlocks };
  }
  return best;
}
