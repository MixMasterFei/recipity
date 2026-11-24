"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DEFAULT_STAPLES } from "@/data/ingredients";
import { useAuth } from "@/lib/auth";
import { mergeState, sameState } from "@/lib/merge";
import { addMissingToList, removeRecipeFromList } from "@/lib/shopping";
import { initialState, migrate, stampChanges } from "@/lib/state";
import { getSupabase } from "@/lib/supabase";
import { syncOnce } from "@/lib/sync";
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
 * in, a second leg keeps the same state on Supabase: every round pulls the
 * account's copy, merges it with this device's, and pushes the result. Signed
 * out, or with accounts unconfigured, none of that code runs and this behaves
 * exactly as it did before accounts existed.
 *
 * The one genuinely tricky part is hydration. Reading localStorage during
 * render makes the server and client produce different HTML, and React tears
 * the tree down. So state starts empty, loads in an effect, and `hydrated`
 * tells the UI when it's safe to render real content. Every consumer gets that
 * flag from here rather than reimplementing the dance.
 *
 * What a valid state looks like — its initial value, upgrading old copies,
 * stamping changes — lives in `lib/state.ts`, where it can be tested.
 */

// Deliberately still `recipity.*` after the rebrand — renaming would orphan
// the data of anyone already using the app.
const STORAGE_KEY = "recipity.state.v1";

/** localStorage write debounce. */
const LOCAL_SAVE_MS = 250;
/** How long after an edit to talk to the server — it's a network round trip. */
const REMOTE_SAVE_MS = 1200;
/** Don't re-check the server on every tab switch. */
const RECHECK_MIN_MS = 15_000;
/** Waits between retries after a failed round, then the last one repeats. */
const RETRY_MS = [5_000, 15_000, 60_000];

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

  // The latest state, for code that runs outside a render (the sync round).
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  /**
   * Sync bookkeeping. One mutable record rather than a handful of refs, so
   * the pieces that must change together visibly do.
   */
  const sync = useRef({
    /** Bumped whenever the signed-in user changes; stale rounds check it. */
    session: 0,
    running: false,
    /** A round was asked for while one was already in flight. */
    again: false,
    timer: null as ReturnType<typeof setTimeout> | null,
    /** Consecutive failed rounds, for the retry backoff. */
    failures: 0,
    /** Local edits made, and how many of them the server has seen. */
    edits: 0,
    syncedEdits: 0,
    /** Whether this session has completed a round yet. */
    settled: false,
    lastOkAt: 0,
  });

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

  // Timers outlive the render that set them, so they call through a ref to
  // reach the current `runSync` rather than the one they were created with.
  const runSyncRef = useRef<() => void>(() => {});

  /** Ask for a round after `delay`, replacing any round already waiting. */
  const requestSync = useCallback((delay: number) => {
    const s = sync.current;
    if (s.timer) clearTimeout(s.timer);
    s.timer = setTimeout(() => runSyncRef.current(), delay);
  }, []);

  /**
   * Run one round with the server, or note that another is wanted if one is
   * already running.
   *
   * Every round is pull, merge, push — see `syncOnce`. The merged result
   * replaces local state, which is how another device's changes arrive here.
   */
  const runSync = useCallback(() => {
    const client = getSupabase();
    if (!client || !userId) return;

    const s = sync.current;
    if (s.running) {
      s.again = true;
      return;
    }
    s.running = true;
    s.again = false;
    const session = s.session;

    if (!s.settled) setSyncStatus("merging");
    else if (s.edits !== s.syncedEdits) setSyncStatus("saving");

    // How many edits the snapshot handed to the merge contains. Anything
    // made after it isn't on the server yet and needs another round.
    let editsSeen = s.edits;

    void syncOnce(client, userId, () => {
      editsSeen = s.edits;
      return stateRef.current;
    }).then((outcome) => {
      // Signed out or switched account while the request was in flight: this
      // result belongs to someone else's session.
      if (sync.current.session !== session) return;
      s.running = false;

      if (outcome.merged) {
        const { merged, basis } = outcome;
        setState((current) => {
          // Untouched since the merge was worked out: take the result as is.
          // Otherwise fold it into what the user has done in the meantime.
          const next = current === basis ? merged : mergeState(current, merged);
          return sameState(next, current) ? current : next;
        });
      }

      if (outcome.error) {
        setSyncStatus("error");
        const wait =
          RETRY_MS[Math.min(s.failures, RETRY_MS.length - 1)] ?? 60_000;
        s.failures += 1;
        requestSync(wait);
        return;
      }

      s.failures = 0;
      s.settled = true;
      s.syncedEdits = editsSeen;
      s.lastOkAt = Date.now();
      setSyncStatus("synced");
      setLastSyncedAt(new Date().toISOString());

      if (s.again || s.edits !== editsSeen) requestSync(REMOTE_SAVE_MS);
    });
  }, [userId, requestSync]);

  useEffect(() => {
    runSyncRef.current = runSync;
  }, [runSync]);

  /**
   * Start and stop syncing as people sign in and out.
   *
   * Signing in runs a round straight away — the "your fridge came with you"
   * moment. Signing out deliberately leaves local data alone: wiping it would
   * be a nasty surprise for anyone who signs straight back in.
   */
  useEffect(() => {
    const s = sync.current;
    s.session += 1;
    s.running = false;
    s.again = false;
    s.failures = 0;
    s.settled = false;
    s.lastOkAt = 0;
    // Nothing on this device is known to be on the new account yet.
    s.syncedEdits = -1;
    if (s.timer) clearTimeout(s.timer);
    s.timer = null;

    if (!hydrated || !userId || !getSupabase()) {
      setSyncStatus("off");
      return;
    }

    requestSync(0);

    // Pick up what other devices did when this one comes back into view.
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - sync.current.lastOkAt < RECHECK_MIN_MS) return;
      requestSync(0);
    };
    document.addEventListener("visibilitychange", recheck);
    window.addEventListener("focus", recheck);
    window.addEventListener("online", recheck);

    return () => {
      document.removeEventListener("visibilitychange", recheck);
      window.removeEventListener("focus", recheck);
      window.removeEventListener("online", recheck);
      const current = sync.current;
      current.session += 1;
      if (current.timer) clearTimeout(current.timer);
      current.timer = null;
    };
  }, [userId, hydrated, requestSync]);

  // `actions` is created once, so it reaches the latest of these through refs.
  const userIdRef = useRef(userId);
  const requestSyncRef = useRef(requestSync);
  useEffect(() => {
    userIdRef.current = userId;
    requestSyncRef.current = requestSync;
  }, [userId, requestSync]);

  const actions = useMemo<StoreActions>(() => {
    // Every mutation goes through here. `stampChanges` compares before and
    // after and records what was added, edited and removed, which is what
    // lets another device tell a deletion from something it simply never
    // had. Doing it here, once, means no action can forget to.
    const update = (fn: (s: RecipityState) => RecipityState) => {
      setState((s) => stampChanges(s, fn(s), new Date().toISOString()));
      sync.current.edits += 1;
      // A no-op while signed out: there is nobody to sync with.
      if (userIdRef.current) requestSyncRef.current(REMOTE_SAVE_MS);
    };

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
