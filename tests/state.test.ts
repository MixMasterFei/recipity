import { describe, expect, it } from "vitest";
import { DEFAULT_STAPLES } from "@/data/ingredients";
import { isPristine } from "@/lib/merge";
import { SCHEMA_VERSION, initialState, migrate, stampChanges } from "@/lib/state";
import { EPOCH, timeOf } from "@/lib/stamps";
import type { RecipityState } from "@/lib/types";

/**
 * `stampChanges` is what turns "the spinach is gone" into "the spinach was
 * removed at 10:04", and `migrate` is the only thing standing between a
 * malformed blob and a wiped fridge. Both are pure, so both are tested here
 * without a browser.
 */

const T1 = "2026-08-01T10:00:00.000Z";
const T2 = "2026-08-02T10:00:00.000Z";
const T3 = "2026-08-03T10:00:00.000Z";

/** Apply a change the way the store does. */
function act(
  state: RecipityState,
  now: string,
  change: (s: RecipityState) => RecipityState,
): RecipityState {
  return stampChanges(state, change(state), now);
}

const addToPantry = (id: string) => (s: RecipityState) => ({
  ...s,
  // Actions read their own clock; `stampChanges` is expected to overrule it.
  pantry: [...s.pantry, { ingredientId: id, addedAt: "1999-01-01T00:00:00.000Z" }],
});

const removeFromPantry = (id: string) => (s: RecipityState) => ({
  ...s,
  pantry: s.pantry.filter((p) => p.ingredientId !== id),
});

describe("initialState", () => {
  it("is pristine, with the default staples and nothing stamped", () => {
    const state = initialState();
    expect(isPristine(state)).toBe(true);
    expect(state.staples).toEqual(DEFAULT_STAPLES);
    expect(state.schemaVersion).toBe(SCHEMA_VERSION);
    // Not "now": a blank device must not look like the freshest copy.
    expect(state.updatedAt).toBe(EPOCH);
  });

  it("hands out a fresh object each time", () => {
    const a = initialState();
    a.staples.push("ghee");
    a.sync.removed.pantry.egg = T1;
    expect(initialState().staples).toEqual(DEFAULT_STAPLES);
    expect(initialState().sync.removed.pantry).toEqual({});
  });
});

describe("migrate", () => {
  it("returns a blank state for anything that isn't an object", () => {
    for (const raw of [null, undefined, "pantry", 7, [], true]) {
      expect(isPristine(migrate(raw))).toBe(true);
    }
  });

  it("keeps the valid parts of a damaged blob and drops the rest", () => {
    const state = migrate({
      pantry: [
        { ingredientId: "egg", addedAt: T1 },
        null,
        "rice",
        { ingredientId: 5, addedAt: T1 },
        { ingredientId: "milk" },
      ],
      favorites: ["dal", 3, null],
      history: [{ recipeId: "dal", cookedAt: T1 }, { recipeId: "x" }],
      shoppingList: "onion",
      invented: [{ id: "x" }],
      diet: { restrictions: ["vegan", "keto", 4], avoid: ["peanuts", {}] },
      staples: ["salt", 1],
      sync: { added: "nonsense", removed: { pantry: { rice: T2, egg: 12 } } },
    });
    expect(state.pantry).toEqual([{ ingredientId: "egg", addedAt: T1 }]);
    expect(state.favorites).toEqual(["dal"]);
    expect(state.history).toEqual([{ recipeId: "dal", cookedAt: T1 }]);
    expect(state.shoppingList).toEqual([]);
    expect(state.invented).toEqual([]);
    expect(state.diet).toEqual({ restrictions: ["vegan"], avoid: ["peanuts"] });
    expect(state.staples).toEqual(["salt"]);
    expect(state.sync.removed.pantry).toEqual({ rice: T2 });
    expect(state.sync.added.favorites).toEqual({});
  });

  it("round-trips a current state unchanged", () => {
    const state = act(act(initialState(), T1, addToPantry("egg")), T2, (s) => ({
      ...s,
      favorites: ["dal"],
      diet: { restrictions: ["nutFree"], avoid: [] },
    }));
    expect(migrate(JSON.parse(JSON.stringify(state)))).toEqual(state);
  });

  describe("a copy saved before stamps existed", () => {
    const legacy = {
      schemaVersion: 2,
      updatedAt: T2,
      pantry: [{ ingredientId: "egg", addedAt: T1 }],
      // Rice and spaghetti were unticked at some point.
      staples: DEFAULT_STAPLES.filter((id) => id !== "rice" && id !== "spaghetti"),
      favorites: ["zebra-cake", "apple-pie"],
      history: [],
      shoppingList: [],
      diet: { restrictions: ["vegetarian"], avoid: [] },
      invented: [],
    };

    it("records an absent default staple as a removal", () => {
      // Without this the first merge with any other device would tick rice
      // straight back on.
      const state = migrate(legacy);
      expect(Object.keys(state.sync.removed.staples).sort()).toEqual([
        "rice",
        "spaghetti",
      ]);
    });

    it("dates that removal after 'never' and before anything real", () => {
      const stamp = migrate(legacy).sync.removed.staples.rice;
      expect(timeOf(stamp)).toBeGreaterThan(0);
      expect(timeOf(stamp)).toBeLessThan(timeOf("2000-01-01T00:00:00.000Z"));
    });

    it("keeps favourites in the order they were saved", () => {
      const added = migrate(legacy).sync.added.favorites;
      expect(timeOf(added["zebra-cake"])).toBeLessThan(timeOf(added["apple-pie"]));
    });

    it("keeps everything else as it was", () => {
      const state = migrate(legacy);
      expect(state.schemaVersion).toBe(SCHEMA_VERSION);
      expect(state.updatedAt).toBe(T2);
      expect(state.pantry).toEqual(legacy.pantry);
      expect(state.diet).toEqual(legacy.diet);
    });
  });
});

describe("stampChanges — keyed items", () => {
  it("returns the same object when nothing changed", () => {
    const state = initialState();
    expect(stampChanges(state, state, T1)).toBe(state);
  });

  it("stamps a new item as arriving now, on both clocks", () => {
    const state = act(initialState(), T1, addToPantry("egg"));
    expect(state.pantry).toEqual([
      { ingredientId: "egg", addedAt: T1, updatedAt: T1 },
    ]);
    expect(state.updatedAt).toBe(T1);
  });

  it("stamps an edit without touching when the item was added", () => {
    const added = act(initialState(), T1, addToPantry("egg"));
    const edited = act(added, T2, (s) => ({
      ...s,
      pantry: s.pantry.map((p) => ({ ...p, quantity: 6 })),
    }));
    expect(edited.pantry[0]).toEqual({
      ingredientId: "egg",
      addedAt: T1,
      updatedAt: T2,
      quantity: 6,
    });
  });

  it("leaves a marker when an item is removed", () => {
    const added = act(initialState(), T1, addToPantry("egg"));
    const removed = act(added, T2, removeFromPantry("egg"));
    expect(removed.pantry).toEqual([]);
    expect(removed.sync.removed.pantry).toEqual({ egg: T2 });
  });

  it("clears the marker when the item comes back", () => {
    let state = act(initialState(), T1, addToPantry("egg"));
    state = act(state, T2, removeFromPantry("egg"));
    state = act(state, T3, addToPantry("egg"));
    expect(state.sync.removed.pantry).toEqual({});
    expect(state.pantry[0]?.addedAt).toBe(T3);
  });

  it("leaves a marker for every item when the fridge is emptied", () => {
    let state = act(initialState(), T1, addToPantry("egg"));
    state = act(state, T1, addToPantry("rice"));
    state = act(state, T2, (s) => ({ ...s, pantry: [] }));
    expect(state.sync.removed.pantry).toEqual({ egg: T2, rice: T2 });
  });

  it("does not restamp items an action rebuilt without changing", () => {
    // `addMissingToList` copies every item on the list. Treating those copies
    // as edits would let a stale device's old tick-box state win a merge.
    let state = act(initialState(), T1, (s) => ({
      ...s,
      shoppingList: [
        { ingredientId: "onion", forRecipes: ["stew"], checked: false, addedAt: T1 },
      ],
    }));
    state = act(state, T2, (s) => ({
      ...s,
      shoppingList: [
        ...s.shoppingList.map((item) => ({
          ...item,
          forRecipes: [...item.forRecipes],
        })),
        { ingredientId: "leek", forRecipes: ["soup"], checked: false, addedAt: T2 },
      ],
    }));
    expect(state.shoppingList.map((i) => i.updatedAt)).toEqual([T1, T2]);
  });

  it("does not mutate the states it is given", () => {
    const before = act(initialState(), T1, addToPantry("egg"));
    const snapshot = JSON.stringify(before);
    const changed = removeFromPantry("egg")(before);
    stampChanges(before, changed, T2);
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(changed.sync).toBe(before.sync);
  });
});

describe("stampChanges — sets and invented recipes", () => {
  it("dates a favourite when saved and marks it when un-saved", () => {
    const saved = act(initialState(), T1, (s) => ({ ...s, favorites: ["dal"] }));
    expect(saved.sync.added.favorites).toEqual({ dal: T1 });

    const unsaved = act(saved, T2, (s) => ({ ...s, favorites: [] }));
    expect(unsaved.sync.added.favorites).toEqual({});
    expect(unsaved.sync.removed.favorites).toEqual({ dal: T2 });
  });

  it("marks an unticked staple and dates a ticked one", () => {
    let state = act(initialState(), T1, (s) => ({
      ...s,
      staples: s.staples.filter((id) => id !== "rice"),
    }));
    expect(state.sync.removed.staples).toEqual({ rice: T1 });

    state = act(state, T2, (s) => ({ ...s, staples: [...s.staples, "ghee"] }));
    expect(state.sync.added.staples).toEqual({ ghee: T2 });

    // Resetting to the defaults is a tick for rice and an untick for ghee.
    state = act(state, T3, (s) => ({ ...s, staples: [...DEFAULT_STAPLES] }));
    expect(state.sync.removed.staples).toEqual({ ghee: T3 });
    expect(state.sync.added.staples).toEqual({ rice: T3 });
  });

  it("stamps each diet rule on its own", () => {
    let state = act(initialState(), T1, (s) => ({
      ...s,
      diet: { restrictions: ["nutFree"], avoid: ["peanuts"] },
    }));
    state = act(state, T2, (s) => ({
      ...s,
      diet: { restrictions: ["nutFree", "vegetarian"], avoid: [] },
    }));
    expect(state.sync.added.restrictions).toEqual({
      nutFree: T1,
      vegetarian: T2,
    });
    expect(state.sync.removed.avoid).toEqual({ peanuts: T2 });
  });

  it("leaves diet stamps alone when something unrelated changes", () => {
    const dieted = act(initialState(), T1, (s) => ({
      ...s,
      diet: { restrictions: ["nutFree"], avoid: [] },
    }));
    const later = act(dieted, T3, addToPantry("egg"));
    expect(later.sync.added.restrictions).toEqual({ nutFree: T1 });
    expect(later.sync.removed.restrictions).toEqual({});
  });

  it("marks an invented recipe that is deleted or pushed out by the cap", () => {
    const recipe = (id: string) => ({
      id,
      slug: id,
      title: id,
      description: "",
      cuisine: "Test",
      tags: [],
      servings: 2,
      prepMin: 1,
      cookMin: 1,
      difficulty: "easy" as const,
      ingredients: [],
      steps: [],
    });
    const two = act(initialState(), T1, (s) => ({
      ...s,
      invented: [recipe("a"), recipe("b")],
    }));
    const one = act(two, T2, (s) => ({ ...s, invented: [recipe("b")] }));
    expect(one.sync.removed.invented).toEqual({ a: T2 });
  });
});
