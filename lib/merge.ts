import { capMarkers, isUnstamped, later, timeOf } from "@/lib/stamps";
import type {
  CookEvent,
  PantryItem,
  Recipe,
  RecipityState,
  ShoppingItem,
  StampMap,
} from "@/lib/types";

/**
 * Merging two copies of a user's state.
 *
 * This runs every time a signed-in device talks to the server, and the
 * governing rule is that nothing the user did should be undone by a copy that
 * simply hadn't heard about it yet. That cuts both ways:
 *
 *   Something added on one device must not vanish because another device
 *   never had it.
 *
 *   Something *removed* on one device must not come back because another
 *   device still has it.
 *
 * A plain union gets the first right and the second wrong — the missing
 * entry is indistinguishable from one that was never there. So removals are
 * recorded (`state.sync.removed`), additions and edits are dated, and for
 * every key the most recent event wins: an item survives unless it was
 * removed *after* it was last added or edited. Re-adding something you
 * deleted works, because the add is newer than the removal.
 *
 * The same rule covers every collection, including staples and the diet.
 * Those are curated by removal — untick salt and it must stay unticked — which
 * is exactly what a removal marker expresses, per item rather than for the
 * field as a whole. Ticking "vegetarian" on a laptop therefore cannot cost
 * you the "nut-free" you set on your phone.
 *
 * `mergeState` is pure and its result does not depend on which copy is
 * `mine`: both the contents and their order come out the same either way.
 * That matters because every device pushes what it merged — if two devices
 * disagreed about the result they would overwrite each other forever.
 */

/** Matches the cap in `markCooked`. */
const HISTORY_LIMIT = 200;
/** Matches the cap in `addInvented`. */
const INVENTED_LIMIT = 50;

/** Per key, the later stamp from either side. */
function mergeStamps(a: StampMap, b: StampMap): StampMap {
  const out: StampMap = { ...a };
  for (const [key, stamp] of Object.entries(b)) {
    out[key] = later(out[key], stamp) ?? stamp;
  }
  return out;
}

/** When an item was last touched. Items from before stamps use `addedAt`. */
function stampOf(item: { addedAt: string; updatedAt?: string }): number {
  return timeOf(item.updatedAt ?? item.addedAt);
}

/**
 * Merge two keyed collections of dated items.
 *
 * `removed` is updated in place: a marker that loses to a live item is
 * dropped, since the item has outlived it.
 */
function mergeItems<T extends { addedAt: string; updatedAt?: string }>(
  mine: T[],
  theirs: T[],
  key: (item: T) => string,
  removed: StampMap,
  pick: (a: T, b: T) => T,
): T[] {
  // A copy removed after its last edit is dead, and a dead copy must not
  // contribute anything — not even a field — to the survivor.
  const alive = (item: T) => {
    const gone = removed[key(item)];
    return gone === undefined || timeOf(gone) <= stampOf(item);
  };

  const live = new Map<string, T>();
  for (const item of [...mine, ...theirs]) {
    if (!alive(item)) continue;
    const k = key(item);
    const have = live.get(k);
    live.set(k, have ? pick(have, item) : item);
  }

  for (const k of live.keys()) delete removed[k];

  // A fixed order, so both devices arrive at the same list.
  return [...live.values()].sort(
    (a, b) =>
      timeOf(a.addedAt) - timeOf(b.addedAt) || key(a).localeCompare(key(b)),
  );
}

/**
 * Order two copies of the same item, most recently touched first.
 *
 * A tie is broken by content rather than by which argument came first, so
 * that both devices settle on the same copy.
 */
function newestFirst<T extends { addedAt: string; updatedAt?: string }>(
  a: T,
  b: T,
): [T, T] {
  const diff = stampOf(a) - stampOf(b);
  if (diff > 0) return [a, b];
  if (diff < 0) return [b, a];
  return JSON.stringify(a) <= JSON.stringify(b) ? [a, b] : [b, a];
}

function mergePantryItem(a: PantryItem, b: PantryItem): PantryItem {
  const [newer, older] = newestFirst(a, b);

  // An edit is a decision, and wins outright — including a use-by date that
  // was deliberately cleared.
  const edited =
    newer.updatedAt !== undefined &&
    timeOf(newer.updatedAt) > timeOf(newer.addedAt);
  if (edited) return newer;

  // A bare add knows nothing the older record didn't. Dropping a use-by date
  // just because the item was typed in again elsewhere would silently switch
  // off the rescue ranking.
  return { ...newer, expiresAt: newer.expiresAt ?? older.expiresAt };
}

function mergeShoppingItem(a: ShoppingItem, b: ShoppingItem): ShoppingItem {
  const [newer] = newestFirst(a, b);
  return {
    ...newer,
    // Both sides' reasons for wanting it are valid.
    forRecipes: [...new Set([...a.forRecipes, ...b.forRecipes])].sort(),
  };
}

/**
 * Merge two id-sets whose add and removal stamps live beside them.
 *
 * `added` and `removed` are updated in place to describe the result.
 */
function mergeSet(
  mine: string[],
  theirs: string[],
  added: StampMap,
  removed: StampMap,
): string[] {
  const ids: string[] = [];
  for (const id of new Set([...mine, ...theirs])) {
    const gone = removed[id];
    if (gone !== undefined && timeOf(gone) > timeOf(added[id])) continue;
    delete removed[id];
    ids.push(id);
  }

  const kept = new Set(ids);
  for (const id of Object.keys(added)) {
    if (!kept.has(id)) delete added[id];
  }
  return ids;
}

function historyKey(event: CookEvent): string {
  return `${event.recipeId}@${event.cookedAt}`;
}

/**
 * When an invented recipe was made, read from the base-36 time its slug ends
 * in. Only used to order them, so a slug that doesn't parse just sorts last.
 */
function inventedAt(recipe: Recipe): number {
  const tail = recipe.slug.slice(recipe.slug.lastIndexOf("-") + 1);
  const ms = Number.parseInt(tail, 36);
  return Number.isFinite(ms) ? ms : 0;
}

/** Merge two copies of the state. Symmetric: `mine` and `theirs` may swap. */
export function mergeState(
  mine: RecipityState,
  theirs: RecipityState,
): RecipityState {
  const added = {
    favorites: mergeStamps(mine.sync.added.favorites, theirs.sync.added.favorites),
    staples: mergeStamps(mine.sync.added.staples, theirs.sync.added.staples),
    restrictions: mergeStamps(
      mine.sync.added.restrictions,
      theirs.sync.added.restrictions,
    ),
    avoid: mergeStamps(mine.sync.added.avoid, theirs.sync.added.avoid),
  };
  const removed = {
    pantry: mergeStamps(mine.sync.removed.pantry, theirs.sync.removed.pantry),
    shoppingList: mergeStamps(
      mine.sync.removed.shoppingList,
      theirs.sync.removed.shoppingList,
    ),
    invented: mergeStamps(mine.sync.removed.invented, theirs.sync.removed.invented),
    favorites: mergeStamps(
      mine.sync.removed.favorites,
      theirs.sync.removed.favorites,
    ),
    staples: mergeStamps(mine.sync.removed.staples, theirs.sync.removed.staples),
    restrictions: mergeStamps(
      mine.sync.removed.restrictions,
      theirs.sync.removed.restrictions,
    ),
    avoid: mergeStamps(mine.sync.removed.avoid, theirs.sync.removed.avoid),
  };

  const pantry = mergeItems(
    mine.pantry,
    theirs.pantry,
    (item) => item.ingredientId,
    removed.pantry,
    mergePantryItem,
  );
  const shoppingList = mergeItems(
    mine.shoppingList,
    theirs.shoppingList,
    (item) => item.ingredientId,
    removed.shoppingList,
    mergeShoppingItem,
  );

  const favorites = mergeSet(
    mine.favorites,
    theirs.favorites,
    added.favorites,
    removed.favorites,
  ).sort(
    // Oldest first, as they were saved.
    (a, b) =>
      timeOf(added.favorites[a]) - timeOf(added.favorites[b]) ||
      a.localeCompare(b),
  );
  const staples = mergeSet(
    mine.staples,
    theirs.staples,
    added.staples,
    removed.staples,
  ).sort();
  const restrictions = mergeSet(
    mine.diet.restrictions,
    theirs.diet.restrictions,
    added.restrictions,
    removed.restrictions,
  ).sort() as RecipityState["diet"]["restrictions"];
  const avoid = mergeSet(
    mine.diet.avoid,
    theirs.diet.avoid,
    added.avoid,
    removed.avoid,
  ).sort();

  // Cook history is only ever appended to, so a union is the whole story.
  const history = new Map<string, CookEvent>();
  for (const event of [...mine.history, ...theirs.history]) {
    history.set(historyKey(event), event);
  }

  // Invented recipes are never edited and their ids never recur, so a
  // removal marker is final.
  const invented = new Map<string, Recipe>();
  for (const recipe of [...mine.invented, ...theirs.invented]) {
    if (removed.invented[recipe.id] !== undefined) continue;
    if (!invented.has(recipe.id)) invented.set(recipe.id, recipe);
  }

  for (const map of Object.values(removed)) capMarkers(map);

  return {
    schemaVersion: Math.max(mine.schemaVersion, theirs.schemaVersion),
    updatedAt: later(mine.updatedAt, theirs.updatedAt) ?? mine.updatedAt,
    pantry,
    staples,
    favorites,
    history: [...history.values()]
      .sort(
        (a, b) =>
          timeOf(b.cookedAt) - timeOf(a.cookedAt) ||
          a.recipeId.localeCompare(b.recipeId),
      )
      .slice(0, HISTORY_LIMIT),
    shoppingList,
    diet: { restrictions, avoid },
    invented: [...invented.values()]
      .sort((a, b) => inventedAt(b) - inventedAt(a) || a.id.localeCompare(b.id))
      .slice(0, INVENTED_LIMIT),
    sync: { added, removed },
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

/**
 * True when a state has never been touched: nothing in it, and no record of
 * anything having been added or removed.
 *
 * Stricter than `isEmptyState` on purpose. A fridge the user just emptied is
 * empty but not pristine — it carries removals that other devices need to
 * hear about, so it must still be synced.
 */
export function isPristine(state: RecipityState): boolean {
  return isEmptyState(state) && isUnstamped(state.sync);
}

/** JSON with object keys in a fixed order, for comparing by value. */
function canonical(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (inner === null || typeof inner !== "object" || Array.isArray(inner)) {
      return inner;
    }
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(inner).sort()) {
      sorted[key] = (inner as Record<string, unknown>)[key];
    }
    return sorted;
  });
}

/**
 * Do two states say the same thing?
 *
 * Compared by value with keys sorted, because a copy that has been through
 * the server comes back with its keys reordered and would never be `===` or
 * even string-equal to the one that was sent.
 */
export function sameState(a: RecipityState, b: RecipityState): boolean {
  return a === b || canonical(a) === canonical(b);
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
