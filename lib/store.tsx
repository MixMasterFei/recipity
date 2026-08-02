"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_STAPLES } from "@/data/ingredients";
import { useAuth } from "@/lib/auth";
import { EMPTY_DIET } from "@/lib/diet";
import { isEmptyState, mergeState } from "@/lib/merge";
import { addMissingToList, removeRecipeFromList } from "@/lib/shopping";
import { getSupabase } from "@/lib/supabase";
import { pullRemote, pushRemote } from "@/lib/sync";
import type {
  DietPrefs,
  IngredientId,
  MatchResult,
  PantryItem,
  Recipe,
  RecipeId,
  RecipityState,
  ShoppingItem,
  Unit,
} from "@/lib/types";

/**
 * All persistent user state.
 *
 * localStorage is the source of truth and always works. When someone is signed
 * in, a second leg mirrors the same state to Supabase — pulled and merged on
 * sign-in, pushed on a slower debounce thereafter. Signed out, or with accounts
 * unconfigured, none of that code runs and this behaves exactly as it did
 * before accounts existed.
 *
 * The one genuinely tricky part is hydration. Reading localStorage during
 * render makes the server and client produce different HTML, and React tears
 * the tree down. So state starts empty, loads in an effect, and `hydrated`
 * tells the UI when it's safe to render real content. Every consumer gets that
 * flag from here rather than reimplementing the dance.
 */

// Deliberately still `recipity.*` after the rebrand — renaming would orphan
// the data of anyone already using the app.
const STORAGE_KEY = "recipity.state.v1";
const SCHEMA_VERSION = 2;

/** localStorage write debounce. */
const LOCAL_SAVE_MS = 250;
/** Remote write debounce — slower, because it's a network round trip. */
const REMOTE_SAVE_MS = 1200;

function initialState(): RecipityState {
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    pantry: [],
    staples: [...DEFAULT_STAPLES],
    favorites: [],
    history: [],
    shoppingList: [],
    diet: EMPTY_DIET,
    invented: [],
  };
}

/**
 * Bring a persisted blob up to the current schema.
 *
 * Written defensively: users have real data in here, and a thrown error would
 * mean silently wiping someone's pantry.
 */
function migrate(raw: unknown): RecipityState {
  const base = initialState();
  if (!raw || typeof raw !== "object") return base;

  const data = raw as Partial<RecipityState>;
  return {
    schemaVersion: SCHEMA_VERSION,
    // v1 blobs predate sync and have no timestamp. Treating them as ancient
    // rather than "now" is the safe default: on a first sign-in the server's
    // preferences win, instead of a stale device clobbering them.
    updatedAt:
      typeof data.updatedAt === "string"
        ? data.updatedAt
        : new Date(0).toISOString(),
    pantry: Array.isArray(data.pantry) ? data.pantry : base.pantry,
    staples: Array.isArray(data.staples) ? data.staples : base.staples,
    favorites: Array.isArray(data.favorites) ? data.favorites : base.favorites,
    history: Array.isArray(data.history) ? data.history : base.history,
    shoppingList: Array.isArray(data.shoppingList)
      ? data.shoppingList
      : base.shoppingList,
    diet:
      data.diet && Array.isArray(data.diet.restrictions)
        ? { restrictions: data.diet.restrictions, avoid: data.diet.avoid ?? [] }
        : base.diet,
    invented: Array.isArray(data.invented) ? data.invented : base.invented,
  };
}

export interface StoreActions {
  addPantryItem(
    ingredientId: IngredientId,
    opts?: { quantity?: number; unit?: Unit; expiresAt?: string },
  ): void;
  removePantryItem(ingredientId: IngredientId): void;
  updatePantryItem(ingredientId: IngredientId, patch: Partial<PantryItem>): void;
  clearPantry(): void;

  toggleStaple(ingredientId: IngredientId): void;
  resetStaples(): void;

  toggleFavorite(recipeId: RecipeId): void;
  /** Records a cook, and optionally removes what it used from the pantry. */
  markCooked(result: MatchResult, deductFromPantry: boolean): void;

  addMissing(result: MatchResult): void;
  toggleShoppingItem(ingredientId: IngredientId): void;
  removeShoppingItem(ingredientId: IngredientId): void;
  /** Moves everything ticked off into the pantry — you just bought it. */
  checkedToPantry(): void;
  clearShoppingList(): void;
  dropRecipeFromList(recipeId: RecipeId): void;

  setDiet(diet: DietPrefs): void;
  addInvented(recipe: Recipe): void;
  removeInvented(recipeId: RecipeId): void;
}

export type SyncStatus = "off" | "merging" | "synced" | "saving" | "error";

interface StoreValue {
  state: RecipityState;
  /** False until localStorage has been read; render skeletons while false. */
  hydrated: boolean;
  actions: StoreActions;
  /** "off" whenever accounts are unconfigured or nobody is signed in. */
  syncStatus: SyncStatus;
  /** ISO time of the last successful push, for the account menu. */
  lastSyncedAt: string | null;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<RecipityState>(initialState);
  const [hydrated, setHydrated] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("off");
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const remoteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Which user id we've already pulled+merged for. Guards against the merge
  // re-running on every token refresh, which would be wasted round trips.
  const mergedFor = useRef<string | null>(null);

  // Load once, after mount, so server and client agree on the first render.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setState(migrate(JSON.parse(stored)));
    } catch {
      // Corrupt or unavailable storage: carry on with defaults rather than
      // showing the user a broken app.
    }
    setHydrated(true);
  }, []);

  // Debounced persist. Skipped until hydrated, or the empty initial state
  // would immediately overwrite real saved data.
  useEffect(() => {
    if (!hydrated) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Quota exceeded or private mode. Nothing useful to do.
      }
    }, LOCAL_SAVE_MS);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated]);

  /**
   * Sign-in: pull the account's copy, merge this device into it, adopt the
   * result. This is the "your fridge came with you" moment — see lib/merge.ts
   * for why collections union but preferences don't.
   */
  useEffect(() => {
    if (!hydrated) return;

    if (!userId) {
      // Signing out deliberately leaves local data alone. Wiping it would be a
      // nasty surprise for anyone who signs straight back in.
      mergedFor.current = null;
      setSyncStatus("off");
      return;
    }

    if (mergedFor.current === userId) return;
    mergedFor.current = userId;

    const client = getSupabase();
    if (!client) return;

    let cancelled = false;
    setSyncStatus("merging");

    (async () => {
      const { state: remote, error } = await pullRemote(client, userId);
      if (cancelled) return;

      if (error) {
        setSyncStatus("error");
        return;
      }

      // Merge against the freshest local state rather than the value captured
      // when this effect started, in case the user kept typing during the pull.
      setState((local) => {
        const merged = remote ? mergeState(local, migrate(remote)) : local;
        void pushRemote(client, userId, merged).then((res) => {
          if (cancelled) return;
          if (res.error) {
            setSyncStatus("error");
          } else {
            setSyncStatus("synced");
            setLastSyncedAt(new Date().toISOString());
          }
        });
        return merged;
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, hydrated]);

  /** Ongoing pushes while signed in, on a slower debounce than localStorage. */
  useEffect(() => {
    if (!hydrated || !userId) return;
    // Don't race the initial merge, and don't bother writing an empty fridge.
    if (syncStatus === "merging") return;
    if (isEmptyState(state)) return;

    const client = getSupabase();
    if (!client) return;

    if (remoteTimer.current) clearTimeout(remoteTimer.current);
    remoteTimer.current = setTimeout(() => {
      setSyncStatus("saving");
      void pushRemote(client, userId, state).then((res) => {
        if (res.error) {
          setSyncStatus("error");
        } else {
          setSyncStatus("synced");
          setLastSyncedAt(new Date().toISOString());
        }
      });
    }, REMOTE_SAVE_MS);

    return () => {
      if (remoteTimer.current) clearTimeout(remoteTimer.current);
    };
    // `syncStatus` is deliberately absent from the deps: including it would
    // retrigger this effect from inside its own setState calls and loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, userId, hydrated]);

  const actions = useMemo<StoreActions>(() => {
    // Every mutation goes through here, so stamping the clock once covers all
    // of them. `updatedAt` is what decides which side's staples and diet win
    // during a merge, so a missed stamp would silently lose a preference edit.
    const update = (fn: (s: RecipityState) => RecipityState) =>
      setState((s) => ({ ...fn(s), updatedAt: new Date().toISOString() }));

    return {
      addPantryItem(ingredientId, opts) {
        update((s) => {
          const existing = s.pantry.find((p) => p.ingredientId === ingredientId);
          if (existing) {
            // Re-adding something you already have updates it rather than
            // creating a duplicate shelf entry.
            return {
              ...s,
              pantry: s.pantry.map((p) =>
                p.ingredientId === ingredientId ? { ...p, ...opts } : p,
              ),
            };
          }
          return {
            ...s,
            pantry: [
              ...s.pantry,
              {
                ingredientId,
                addedAt: new Date().toISOString(),
                ...opts,
              },
            ],
          };
        });
      },

      removePantryItem(ingredientId) {
        update((s) => ({
          ...s,
          pantry: s.pantry.filter((p) => p.ingredientId !== ingredientId),
        }));
      },

      updatePantryItem(ingredientId, patch) {
        update((s) => ({
          ...s,
          pantry: s.pantry.map((p) =>
            p.ingredientId === ingredientId ? { ...p, ...patch } : p,
          ),
        }));
      },

      clearPantry() {
        update((s) => ({ ...s, pantry: [] }));
      },

      toggleStaple(ingredientId) {
        update((s) => ({
          ...s,
          staples: s.staples.includes(ingredientId)
            ? s.staples.filter((x) => x !== ingredientId)
            : [...s.staples, ingredientId],
        }));
      },

      resetStaples() {
        update((s) => ({ ...s, staples: [...DEFAULT_STAPLES] }));
      },

      toggleFavorite(recipeId) {
        update((s) => ({
          ...s,
          favorites: s.favorites.includes(recipeId)
            ? s.favorites.filter((x) => x !== recipeId)
            : [...s.favorites, recipeId],
        }));
      },

      markCooked(result, deductFromPantry) {
        update((s) => {
          const used = new Set(result.uses);
          return {
            ...s,
            history: [
              { recipeId: result.recipe.id, cookedAt: new Date().toISOString() },
              ...s.history,
            ].slice(0, 200),
            pantry: deductFromPantry
              ? s.pantry.filter((p) => !used.has(p.ingredientId))
              : s.pantry,
            // Cooking it means you no longer need to shop for it.
            shoppingList: removeRecipeFromList(s.shoppingList, result.recipe.id),
          };
        });
      },

      addMissing(result) {
        update((s) => ({
          ...s,
          shoppingList: addMissingToList(s.shoppingList, result),
        }));
      },

      toggleShoppingItem(ingredientId) {
        update((s) => ({
          ...s,
          shoppingList: s.shoppingList.map((item) =>
            item.ingredientId === ingredientId
              ? { ...item, checked: !item.checked }
              : item,
          ),
        }));
      },

      removeShoppingItem(ingredientId) {
        update((s) => ({
          ...s,
          shoppingList: s.shoppingList.filter(
            (item) => item.ingredientId !== ingredientId,
          ),
        }));
      },

      checkedToPantry() {
        update((s) => {
          const bought = s.shoppingList.filter((item) => item.checked);
          const owned = new Set(s.pantry.map((p) => p.ingredientId));
          const now = new Date().toISOString();
          const additions: PantryItem[] = bought
            .filter((item) => !owned.has(item.ingredientId))
            .map((item) => ({ ingredientId: item.ingredientId, addedAt: now }));

          return {
            ...s,
            pantry: [...s.pantry, ...additions],
            shoppingList: s.shoppingList.filter((item) => !item.checked),
          };
        });
      },

      clearShoppingList() {
        update((s) => ({ ...s, shoppingList: [] }));
      },

      dropRecipeFromList(recipeId) {
        update((s) => ({
          ...s,
          shoppingList: removeRecipeFromList(s.shoppingList, recipeId),
        }));
      },

      setDiet(diet) {
        update((s) => ({ ...s, diet }));
      },

      addInvented(recipe) {
        update((s) => ({
          ...s,
          invented: [recipe, ...s.invented.filter((r) => r.id !== recipe.id)].slice(
            0,
            50,
          ),
        }));
      },

      removeInvented(recipeId) {
        update((s) => ({
          ...s,
          invented: s.invented.filter((r) => r.id !== recipeId),
          favorites: s.favorites.filter((f) => f !== recipeId),
        }));
      },
    };
  }, []);

  const value = useMemo(
    () => ({ state, hydrated, actions, syncStatus, lastSyncedAt }),
    [state, hydrated, actions, syncStatus, lastSyncedAt],
  );

  return (
    <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Convenience: is this recipe saved? */
export function useIsFavorite(recipeId: RecipeId): boolean {
  const { state } = useStore();
  return state.favorites.includes(recipeId);
}

/** Stable "today" for expiry maths, so a re-render doesn't reshuffle results. */
export function useToday(): Date {
  const [today] = useState(() => new Date());
  return today;
}

export type { ShoppingItem };
