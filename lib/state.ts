import { DEFAULT_STAPLES } from "@/data/ingredients";
import { EMPTY_DIET } from "@/lib/diet";
import {
  EPOCH,
  capMarkers,
  cloneSync,
  emptySync,
  timeOf,
} from "@/lib/stamps";
import type {
  CookEvent,
  PantryItem,
  Recipe,
  RecipityState,
  ShoppingItem,
  StampMap,
  SyncMeta,
} from "@/lib/types";

/**
 * The shape of saved state: creating it, upgrading old copies of it, and
 * stamping changes to it.
 *
 * Pure and React-free on purpose. `lib/store.tsx` owns *when* state changes;
 * this file owns what a valid state looks like, so it can be tested without a
 * browser.
 */

export const SCHEMA_VERSION = 3;

/**
 * Stamp given to a removal inferred from a pre-v3 copy, where nothing was
 * dated. One millisecond after the epoch: later than "no stamp at all", so
 * the removal sticks against an undated copy, and earlier than anything a
 * person has done since, so a real re-add always beats it.
 */
const LEGACY_REMOVAL = new Date(1).toISOString();

export function initialState(): RecipityState {
  return {
    schemaVersion: SCHEMA_VERSION,
    // Nothing has been changed yet. A real time here would make a blank
    // device look like the freshest copy of the account.
    updatedAt: EPOCH,
    pantry: [],
    staples: [...DEFAULT_STAPLES],
    favorites: [],
    history: [],
    shoppingList: [],
    diet: EMPTY_DIET,
    invented: [],
    sync: emptySync(),
  };
}

/* ------------------------------------------------------------------ */
/* Reading saved copies                                                */
/* ------------------------------------------------------------------ */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];
}

function list<T>(value: unknown, valid: (entry: unknown) => entry is T): T[] {
  return Array.isArray(value) ? value.filter(valid) : [];
}

const isPantryItem = (entry: unknown): entry is PantryItem =>
  isRecord(entry) &&
  typeof entry.ingredientId === "string" &&
  typeof entry.addedAt === "string";

const isShoppingItem = (entry: unknown): entry is ShoppingItem =>
  isRecord(entry) &&
  typeof entry.ingredientId === "string" &&
  typeof entry.addedAt === "string" &&
  typeof entry.checked === "boolean" &&
  Array.isArray(entry.forRecipes);

const isCookEvent = (entry: unknown): entry is CookEvent =>
  isRecord(entry) &&
  typeof entry.recipeId === "string" &&
  typeof entry.cookedAt === "string";

const isRecipe = (entry: unknown): entry is Recipe =>
  isRecord(entry) &&
  typeof entry.id === "string" &&
  typeof entry.slug === "string" &&
  typeof entry.title === "string" &&
  Array.isArray(entry.ingredients) &&
  Array.isArray(entry.steps);

function stampMap(value: unknown): StampMap {
  if (!isRecord(value)) return {};
  const out: StampMap = {};
  for (const [key, stamp] of Object.entries(value)) {
    if (typeof stamp === "string") out[key] = stamp;
  }
  return out;
}

function readSync(value: unknown): SyncMeta {
  const sync = emptySync();
  if (!isRecord(value)) return sync;
  const added = isRecord(value.added) ? value.added : {};
  const removed = isRecord(value.removed) ? value.removed : {};
  for (const name of Object.keys(sync.added) as (keyof SyncMeta["added"])[]) {
    sync.added[name] = stampMap(added[name]);
  }
  for (const name of Object.keys(
    sync.removed,
  ) as (keyof SyncMeta["removed"])[]) {
    sync.removed[name] = stampMap(removed[name]);
  }
  return sync;
}

/**
 * Stamps for a copy saved before stamps existed.
 *
 * Such a copy can't say when anything happened, but it does carry one piece
 * of intent worth rescuing: a default staple that is *absent* was unticked on
 * purpose. Recording that as a removal is what stops the first merge with
 * another device from ticking it straight back on.
 *
 * Favourites get tiny ascending stamps purely to keep their order, which is
 * otherwise the order they were saved in.
 */
function legacySync(staples: string[], favorites: string[]): SyncMeta {
  const sync = emptySync();
  const kept = new Set(staples);
  for (const id of DEFAULT_STAPLES) {
    if (!kept.has(id)) sync.removed.staples[id] = LEGACY_REMOVAL;
  }
  favorites.forEach((id, index) => {
    sync.added.favorites[id] = new Date(2 + index).toISOString();
  });
  return sync;
}

/**
 * Bring a saved blob — from localStorage or from the server — up to the
 * current schema.
 *
 * Written defensively: this is real user data from an untyped source, and a
 * thrown error here would mean silently wiping someone's pantry. Anything
 * malformed is dropped piece by piece rather than taking the rest with it.
 */
export function migrate(raw: unknown): RecipityState {
  const base = initialState();
  if (!isRecord(raw)) return base;

  const staples = Array.isArray(raw.staples) ? strings(raw.staples) : base.staples;
  const favorites = strings(raw.favorites);
  const diet = isRecord(raw.diet)
    ? {
        restrictions: strings(raw.diet.restrictions).filter(
          (key): key is RecipityState["diet"]["restrictions"][number] =>
            key in VALID_RESTRICTIONS,
        ),
        avoid: strings(raw.diet.avoid),
      }
    : base.diet;

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt:
      typeof raw.updatedAt === "string" && timeOf(raw.updatedAt) > 0
        ? raw.updatedAt
        : EPOCH,
    pantry: list(raw.pantry, isPantryItem),
    staples,
    favorites,
    history: list(raw.history, isCookEvent),
    shoppingList: list(raw.shoppingList, isShoppingItem),
    diet,
    invented: list(raw.invented, isRecipe),
    sync:
      raw.sync === undefined
        ? legacySync(staples, favorites)
        : readSync(raw.sync),
  };
}

const VALID_RESTRICTIONS = {
  vegan: true,
  vegetarian: true,
  glutenFree: true,
  dairyFree: true,
  nutFree: true,
} as const;

/* ------------------------------------------------------------------ */
/* Stamping changes                                                    */
/* ------------------------------------------------------------------ */

/** Same content, whatever object it lives in. */
function sameItem(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Stamp a keyed collection after a change: anything new or edited gets
 * `updatedAt`, anything that disappeared leaves a removal marker.
 */
function stampItems<T extends { addedAt: string; updatedAt?: string }>(
  before: T[],
  after: T[],
  key: (item: T) => string,
  removed: StampMap,
  now: string,
): T[] {
  if (before === after) return after;

  const was = new Map(before.map((item) => [key(item), item]));
  const kept = new Set<string>();

  const out = after.map((item) => {
    const k = key(item);
    kept.add(k);
    const old = was.get(k);
    // Compared by content: an action that rebuilds every object without
    // changing it must not make the whole list look freshly edited.
    if (old && sameItem(old, item)) return item;
    delete removed[k];
    // New here: it arrived now, whatever clock the action read a moment ago.
    // Keeping the two stamps identical is how a bare add stays
    // distinguishable from a later edit.
    if (!old) return { ...item, addedAt: now, updatedAt: now };
    return { ...item, updatedAt: now };
  });

  for (const k of was.keys()) {
    if (!kept.has(k)) removed[k] = now;
  }
  return out;
}

/** The same for a plain set of ids, whose stamps live alongside it. */
function stampSet(
  before: string[],
  after: string[],
  added: StampMap,
  removed: StampMap,
  now: string,
): void {
  if (before === after) return;
  const was = new Set(before);
  const is = new Set(after);
  for (const id of is) {
    if (was.has(id)) continue;
    added[id] = now;
    delete removed[id];
  }
  for (const id of was) {
    if (is.has(id)) continue;
    removed[id] = now;
    delete added[id];
  }
}

/**
 * Record what changed between two states.
 *
 * Every mutation in the store passes through here, and it works by comparing
 * before and after rather than by each action declaring what it did. That is
 * deliberate: a removal that forgot to leave a marker would come back from
 * the dead on the next sync, and "remember to add a marker" is exactly the
 * kind of rule a future action would forget. Diffing can't.
 */
export function stampChanges(
  prev: RecipityState,
  next: RecipityState,
  now: string,
): RecipityState {
  if (next === prev) return prev;

  const sync = cloneSync(next.sync);

  const pantry = stampItems(
    prev.pantry,
    next.pantry,
    (item) => item.ingredientId,
    sync.removed.pantry,
    now,
  );
  const shoppingList = stampItems(
    prev.shoppingList,
    next.shoppingList,
    (item) => item.ingredientId,
    sync.removed.shoppingList,
    now,
  );

  stampSet(
    prev.favorites,
    next.favorites,
    sync.added.favorites,
    sync.removed.favorites,
    now,
  );
  stampSet(
    prev.staples,
    next.staples,
    sync.added.staples,
    sync.removed.staples,
    now,
  );
  stampSet(
    prev.diet.restrictions,
    next.diet.restrictions,
    sync.added.restrictions,
    sync.removed.restrictions,
    now,
  );
  stampSet(
    prev.diet.avoid,
    next.diet.avoid,
    sync.added.avoid,
    sync.removed.avoid,
    now,
  );

  // Invented recipes are never edited and their ids never recur, so only
  // their disappearance needs recording.
  if (prev.invented !== next.invented) {
    const still = new Set(next.invented.map((recipe) => recipe.id));
    for (const recipe of prev.invented) {
      if (!still.has(recipe.id)) sync.removed.invented[recipe.id] = now;
    }
    capMarkers(sync.removed.invented);
  }

  return { ...next, pantry, shoppingList, sync, updatedAt: now };
}
