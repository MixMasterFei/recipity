import { describe, expect, it } from "vitest";
import { isEmptyState, mergeGain, mergeState } from "@/lib/merge";
import type { RecipityState } from "@/lib/types";

/**
 * The merge runs when someone signs in on a device that already has a fridge.
 * Getting it wrong either loses the user's work or resurrects things they
 * deliberately deleted, and neither failure is visible until it bites — hence
 * the coverage.
 */

const T1 = "2026-08-01T10:00:00.000Z"; // older
const T2 = "2026-08-02T10:00:00.000Z"; // newer

function state(patch: Partial<RecipityState> = {}): RecipityState {
  return {
    schemaVersion: 2,
    updatedAt: T1,
    pantry: [],
    staples: [],
    favorites: [],
    history: [],
    shoppingList: [],
    diet: { restrictions: [], avoid: [] },
    invented: [],
    ...patch,
  };
}

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

describe("collections union", () => {
  it("keeps pantry items from both sides", () => {
    const merged = mergeState(
      state({ pantry: [{ ingredientId: "egg", addedAt: T1 }] }),
      state({ pantry: [{ ingredientId: "rice", addedAt: T1 }] }),
    );
    expect(merged.pantry.map((p) => p.ingredientId).sort()).toEqual([
      "egg",
      "rice",
    ]);
  });

  it("keeps an expiry date even when the newer record lacks one", () => {
    // Losing a use-by date would silently switch off the rescue ranking.
    const merged = mergeState(
      state({ pantry: [{ ingredientId: "milk", addedAt: T2 }] }),
      state({
        pantry: [{ ingredientId: "milk", addedAt: T1, expiresAt: T2 }],
      }),
    );
    expect(merged.pantry).toHaveLength(1);
    expect(merged.pantry[0]?.expiresAt).toBe(T2);
  });

  it("prefers the later-added pantry record on a collision", () => {
    const merged = mergeState(
      state({ pantry: [{ ingredientId: "egg", addedAt: T2, quantity: 6 }] }),
      state({ pantry: [{ ingredientId: "egg", addedAt: T1, quantity: 2 }] }),
    );
    expect(merged.pantry[0]?.quantity).toBe(6);
  });

  it("unions favourites without duplicating", () => {
    const merged = mergeState(
      state({ favorites: ["a", "b"] }),
      state({ favorites: ["b", "c"] }),
    );
    expect(merged.favorites.sort()).toEqual(["a", "b", "c"]);
  });

  it("unions the reasons an item is on the shopping list", () => {
    const merged = mergeState(
      state({
        shoppingList: [
          { ingredientId: "onion", forRecipes: ["stew"], checked: false, addedAt: T1 },
        ],
      }),
      state({
        shoppingList: [
          { ingredientId: "onion", forRecipes: ["soup"], checked: false, addedAt: T2 },
        ],
      }),
    );
    expect(merged.shoppingList).toHaveLength(1);
    expect(merged.shoppingList[0]?.forRecipes.sort()).toEqual(["soup", "stew"]);
  });

  it("dedupes cook history by recipe and time, newest first", () => {
    const merged = mergeState(
      state({
        history: [
          { recipeId: "x", cookedAt: T1 },
          { recipeId: "y", cookedAt: T2 },
        ],
      }),
      state({ history: [{ recipeId: "x", cookedAt: T1 }] }),
    );
    expect(merged.history).toHaveLength(2);
    expect(merged.history[0]?.cookedAt).toBe(T2);
  });

  it("keeps the same recipe cooked at two different times", () => {
    const merged = mergeState(
      state({ history: [{ recipeId: "x", cookedAt: T1 }] }),
      state({ history: [{ recipeId: "x", cookedAt: T2 }] }),
    );
    expect(merged.history).toHaveLength(2);
  });

  it("unions invented recipes by id", () => {
    const merged = mergeState(
      state({ invented: [recipe("a")] }),
      state({ invented: [recipe("a"), recipe("b")] }),
    );
    expect(merged.invented.map((r) => r.id).sort()).toEqual(["a", "b"]);
  });
});

describe("caps", () => {
  it("caps history at 200, matching markCooked", () => {
    const many = (offset: number) =>
      Array.from({ length: 150 }, (_, i) => ({
        recipeId: `r${offset + i}`,
        cookedAt: new Date(Date.parse(T1) + (offset + i) * 1000).toISOString(),
      }));
    const merged = mergeState(
      state({ history: many(0) }),
      state({ history: many(1000) }),
    );
    expect(merged.history).toHaveLength(200);
  });

  it("caps invented recipes at 50, matching addInvented", () => {
    const many = (p: string) =>
      Array.from({ length: 40 }, (_, i) => recipe(`${p}${i}`));
    const merged = mergeState(
      state({ invented: many("a") }),
      state({ invented: many("b") }),
    );
    expect(merged.invented).toHaveLength(50);
  });
});

describe("preferences use last-write-wins, not union", () => {
  it("does not resurrect a staple removed on the newer side", () => {
    // The whole reason staples aren't unioned: unticking must stick.
    const merged = mergeState(
      state({ updatedAt: T2, staples: ["salt"] }),
      state({ updatedAt: T1, staples: ["salt", "pepper"] }),
    );
    expect(merged.staples).toEqual(["salt"]);
  });

  it("takes the newer side even when it is the argument on the right", () => {
    const merged = mergeState(
      state({ updatedAt: T1, staples: ["salt", "pepper"] }),
      state({ updatedAt: T2, staples: ["salt"] }),
    );
    expect(merged.staples).toEqual(["salt"]);
  });

  it("takes diet from the newer side wholesale", () => {
    const merged = mergeState(
      state({ updatedAt: T1, diet: { restrictions: ["vegan"], avoid: ["egg"] } }),
      state({ updatedAt: T2, diet: { restrictions: ["glutenFree"], avoid: [] } }),
    );
    expect(merged.diet).toEqual({ restrictions: ["glutenFree"], avoid: [] });
  });

  it("carries the newer updatedAt forward", () => {
    expect(
      mergeState(state({ updatedAt: T1 }), state({ updatedAt: T2 })).updatedAt,
    ).toBe(T2);
  });

  it("does not let an unparseable timestamp win", () => {
    const merged = mergeState(
      state({ updatedAt: "not a date", staples: ["junk"] }),
      state({ updatedAt: T1, staples: ["good"] }),
    );
    expect(merged.staples).toEqual(["good"]);
  });
});

describe("idempotency", () => {
  it("merging twice equals merging once", () => {
    // Sync pushes the merged result straight back, so a non-idempotent merge
    // would grow history and the shopping list on every round trip.
    const mine = state({
      updatedAt: T2,
      pantry: [{ ingredientId: "egg", addedAt: T1 }],
      favorites: ["a"],
      history: [{ recipeId: "x", cookedAt: T1 }],
      shoppingList: [
        { ingredientId: "onion", forRecipes: ["stew"], checked: false, addedAt: T1 },
      ],
      invented: [recipe("i1")],
      staples: ["salt"],
    });
    const theirs = state({
      updatedAt: T1,
      pantry: [{ ingredientId: "rice", addedAt: T1 }],
      favorites: ["b"],
      history: [{ recipeId: "y", cookedAt: T2 }],
      shoppingList: [
        { ingredientId: "onion", forRecipes: ["soup"], checked: false, addedAt: T2 },
      ],
      invented: [recipe("i2")],
      staples: ["salt", "pepper"],
    });

    const once = mergeState(mine, theirs);
    const twice = mergeState(once, theirs);
    expect(twice).toEqual(once);
  });

  it("merging a state with itself changes nothing", () => {
    const s = state({
      updatedAt: T2,
      pantry: [{ ingredientId: "egg", addedAt: T1, expiresAt: T2 }],
      favorites: ["a"],
      history: [{ recipeId: "x", cookedAt: T1 }],
    });
    expect(mergeState(s, s)).toEqual(s);
  });

  it("reaches the same collections whichever way round the arguments go", () => {
    const a = state({
      updatedAt: T2,
      pantry: [{ ingredientId: "egg", addedAt: T1 }],
      favorites: ["x"],
    });
    const b = state({
      updatedAt: T1,
      pantry: [{ ingredientId: "rice", addedAt: T1 }],
      favorites: ["y"],
    });
    const ab = mergeState(a, b);
    const ba = mergeState(b, a);
    expect(ab.pantry.map((p) => p.ingredientId).sort()).toEqual(
      ba.pantry.map((p) => p.ingredientId).sort(),
    );
    expect(ab.favorites.sort()).toEqual(ba.favorites.sort());
    // Preferences resolve by timestamp, not argument order.
    expect(ab.staples).toEqual(ba.staples);
  });
});

describe("empty and gain helpers", () => {
  it("recognises a state with nothing worth keeping", () => {
    expect(isEmptyState(state())).toBe(true);
    expect(isEmptyState(state({ staples: ["salt"] }))).toBe(true);
    expect(
      isEmptyState(state({ pantry: [{ ingredientId: "egg", addedAt: T1 }] })),
    ).toBe(false);
  });

  it("counts only what the local side would contribute", () => {
    const gain = mergeGain(
      state({
        pantry: [
          { ingredientId: "egg", addedAt: T1 },
          { ingredientId: "rice", addedAt: T1 },
        ],
        favorites: ["a"],
      }),
      state({
        pantry: [{ ingredientId: "egg", addedAt: T1 }],
        favorites: ["a"],
      }),
    );
    expect(gain).toEqual({ pantry: 1, favorites: 0, list: 0 });
  });
});
