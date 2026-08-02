import type {
  CookEvent,
  PantryItem,
  RecipityState,
  Recipe,
  ShoppingItem,
} from "@/lib/types";

/**
 * Merging two copies of a user's state.
 *
 * This runs when you sign in on a device that already has a fridge on it. The
 * governing rule is that nothing the user did should silently vanish — but
 * "union everything" is wrong, because two kinds of field live in this state
 * and they need opposite treatment:
 *
 *   Collections (pantry, favourites, list, history, invented) are accumulated
 *   work. Losing an entry loses something real, so these union by key.
 *
 *   Preferences (staples, diet) are curated by *removal*. Untick salt on your
 *   laptop and a union would put it straight back, forever, with no way to get
 *   rid of it. These take the newer side wholesale instead.
 *
 * Consequence worth knowing: a device that's been offline a long time loses its
 * staple/diet edits to the newer side. That's the correct trade for not
 * resurrecting deleted staples.
 *
 * `mergeState` is pure, and must be idempotent — sync pushes the merged result
 * straight back, so `merge(merge(a,b), b)` running away would duplicate history
 * on every round trip.
 */

/** Matches the cap in `markCooked`. */
const HISTORY_LIMIT = 200;
/** Matches the cap in `addInvented`. */
const INVENTED_LIMIT = 50;

function laterOf(a: string | undefined, b: string | undefined): boolean {
  // True when `a` is at least as recent as `b`. Unparseable dates sort oldest
  // so a corrupt timestamp can never win against a good one.
  const ta = Date.parse(a ?? "");
  const tb = Date.parse(b ?? "");
  if (Number.isNaN(ta)) return false;
  if (Number.isNaN(tb)) return true;
  return ta >= tb;
}

/**
 * Union two keyed collections. `pick` resolves a collision; the result is
 * ordered by first appearance in `mine`, then anything new from `theirs`.
 */
function unionBy<T>(
  mine: T[],
  theirs: T[],
  key: (item: T) => string,
  pick: (a: T, b: T) => T,
): T[] {
  const out = new Map<string, T>();
  for (const item of mine) out.set(key(item), item);
  for (const item of theirs) {
    const k = key(item);
    const existing = out.get(k);
    out.set(k, existing ? pick(existing, item) : item);
  }
  return [...out.values()];
}

function mergePantryItem(a: PantryItem, b: PantryItem): PantryItem {
  const newer = laterOf(a.addedAt, b.addedAt) ? a : b;
  const older = newer === a ? b : a;
  return {
    ...newer,
    // An expiry date is information; never drop one just because the newer
    // record happens not to carry it.
    expiresAt: newer.expiresAt ?? older.expiresAt,
  };
}

function mergeShoppingItem(a: ShoppingItem, b: ShoppingItem): ShoppingItem {
  const newer = laterOf(a.addedAt, b.addedAt) ? a : b;
  return {
    ...newer,
    // Both sides' reasons for wanting it are valid.
    forRecipes: [...new Set([...a.forRecipes, ...b.forRecipes])],
  };
}

function historyKey(event: CookEvent): string {
  return `${event.recipeId}@${event.cookedAt}`;
}

function recipeKey(recipe: Recipe): string {
  return recipe.id;
}

/**
 * Merge `theirs` (usually the server copy) into `mine` (this device).
 *
 * Order matters only for the preference fields, and there it's decided by
 * `updatedAt`, not by argument position — so this is effectively commutative.
 */
export function mergeState(
  mine: RecipityState,
  theirs: RecipityState,
): RecipityState {
  const minePreferred = laterOf(mine.updatedAt, theirs.updatedAt);
  const preferred = minePreferred ? mine : theirs;

  const history = unionBy(
    mine.history,
    theirs.history,
    historyKey,
    (a) => a,
  ).sort((a, b) => Date.parse(b.cookedAt) - Date.parse(a.cookedAt));

  const invented = unionBy(
    mine.invented,
    theirs.invented,
    recipeKey,
    (a) => a,
  );

  return {
    schemaVersion: Math.max(mine.schemaVersion, theirs.schemaVersion),
    updatedAt: preferred.updatedAt,

    // Collections: union.
    pantry: unionBy(
      mine.pantry,
      theirs.pantry,
      (p) => p.ingredientId,
      mergePantryItem,
    ),
    favorites: [...new Set([...mine.favorites, ...theirs.favorites])],
    shoppingList: unionBy(
      mine.shoppingList,
      theirs.shoppingList,
      (i) => i.ingredientId,
      mergeShoppingItem,
    ),
    history: history.slice(0, HISTORY_LIMIT),
    invented: invented.slice(0, INVENTED_LIMIT),

    // Preferences: whole-field last-write-wins.
    staples: [...preferred.staples],
    diet: {
      restrictions: [...preferred.diet.restrictions],
      avoid: [...preferred.diet.avoid],
    },
  };
}

/** True when a state carries nothing the user would miss. */
export function isEmptyState(state: RecipityState): boolean {
  return (
    state.pantry.length === 0 &&
    state.favorites.length === 0 &&
    state.shoppingList.length === 0 &&
    state.history.length === 0 &&
    state.invented.length === 0
  );
}

/** How much of `mine` was new to `theirs` — used for the sign-in message. */
export function mergeGain(
  mine: RecipityState,
  theirs: RecipityState,
): { pantry: number; favorites: number; list: number } {
  const theirPantry = new Set(theirs.pantry.map((p) => p.ingredientId));
  const theirFavorites = new Set(theirs.favorites);
  const theirList = new Set(theirs.shoppingList.map((i) => i.ingredientId));

  return {
    pantry: mine.pantry.filter((p) => !theirPantry.has(p.ingredientId)).length,
    favorites: mine.favorites.filter((f) => !theirFavorites.has(f)).length,
    list: mine.shoppingList.filter((i) => !theirList.has(i.ingredientId)).length,
  };
}
