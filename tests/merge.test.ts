import { describe, expect, it } from "vitest";
import {
  isEmptyState,
  isPristine,
  mergeGain,
  mergeState,
  sameState,
} from "@/lib/merge";
import { emptySync } from "@/lib/stamps";
import type { RecipityState, SyncMeta } from "@/lib/types";

/**
 * The merge runs every time a signed-in device talks to the server. Getting
 * it wrong either loses the user's work or resurrects things they
 * deliberately deleted, and neither failure is visible until it bites — hence
 * the coverage.
 */

const T1 = "2026-08-01T10:00:00.000Z"; // oldest
const T2 = "2026-08-02T10:00:00.000Z";
const T3 = "2026-08-03T10:00:00.000Z"; // newest

type SyncPatch = {
  added?: Partial<SyncMeta["added"]>;
  removed?: Partial<SyncMeta["removed"]>;
};

function sync(patch: SyncPatch = {}): SyncMeta {
  const base = emptySync();
  return {
    added: { ...base.added, ...patch.added },
    removed: { ...base.removed, ...patch.removed },
  };
}

function state(
  patch: Partial<Omit<RecipityState, "sync">> & { sync?: SyncPatch } = {},
): RecipityState {
  const { sync: syncPatch, ...rest } = patch;
  return {
    schemaVersion: 3,
    updatedAt: T1,
    pantry: [],
    staples: [],
    favorites: [],
    history: [],
    shoppingList: [],
    diet: { restrictions: [], avoid: [] },
    invented: [],
    sync: sync(syncPatch),
    ...rest,
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

const ids = (s: RecipityState) => s.pantry.map((p) => p.ingredientId);

describe("additions from both sides are kept", () => {
  it("keeps pantry items from both sides", () => {
    const merged = mergeState(
      state({ pantry: [{ ingredientId: "egg", addedAt: T1 }] }),
      state({ pantry: [{ ingredientId: "rice", addedAt: T1 }] }),
    );
    expect(ids(merged).sort()).toEqual(["egg", "rice"]);
  });

  it("keeps a use-by date when the newer record is a bare re-add", () => {
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

  it("lets an edit clear a use-by date", () => {
    // The other half of the rule above: an edit is a decision. Clearing the
    // date on one device must not be undone by the other still having it.
    const merged = mergeState(
      state({
        pantry: [{ ingredientId: "milk", addedAt: T1, updatedAt: T3 }],
      }),
      state({
        pantry: [{ ingredientId: "milk", addedAt: T1, expiresAt: T2 }],
      }),
    );
    expect(merged.pantry[0]?.expiresAt).toBeUndefined();
  });

  it("prefers the more recently touched pantry record", () => {
    const merged = mergeState(
      state({ pantry: [{ ingredientId: "egg", addedAt: T2, quantity: 6 }] }),
      state({ pantry: [{ ingredientId: "egg", addedAt: T1, quantity: 2 }] }),
    );
    expect(merged.pantry[0]?.quantity).toBe(6);

    const edited = mergeState(
      state({ pantry: [{ ingredientId: "egg", addedAt: T2, quantity: 6 }] }),
      state({
        pantry: [
          { ingredientId: "egg", addedAt: T1, updatedAt: T3, quantity: 2 },
        ],
      }),
    );
    expect(edited.pantry[0]?.quantity).toBe(2);
  });

  it("unions favourites without duplicating", () => {
    const merged = mergeState(
      state({ favorites: ["a", "b"] }),
      state({ favorites: ["b", "c"] }),
    );
    expect(merged.favorites).toEqual(["a", "b", "c"]);
  });

  it("keeps favourites in the order they were saved", () => {
    const merged = mergeState(
      state({
        favorites: ["zebra"],
        sync: { added: { favorites: { zebra: T1 } } },
      }),
      state({
        favorites: ["apple"],
        sync: { added: { favorites: { apple: T2 } } },
      }),
    );
    expect(merged.favorites).toEqual(["zebra", "apple"]);
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
    expect(merged.shoppingList[0]?.forRecipes).toEqual(["soup", "stew"]);
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

describe("removals are not undone by a copy that hadn't heard", () => {
  it("does not resurrect a pantry item deleted on another device", () => {
    // The bug this design exists for: a plain union brought the spinach back
    // the next time the phone, which still had it, synced.
    const laptop = state({
      pantry: [{ ingredientId: "egg", addedAt: T1 }],
      sync: { removed: { pantry: { spinach: T2 } } },
    });
    const phone = state({
      pantry: [
        { ingredientId: "egg", addedAt: T1 },
        { ingredientId: "spinach", addedAt: T1 },
      ],
    });
    expect(ids(mergeState(laptop, phone))).toEqual(["egg"]);
    expect(ids(mergeState(phone, laptop))).toEqual(["egg"]);
    // The marker is kept, for the next device that still has it.
    expect(mergeState(laptop, phone).sync.removed.pantry).toEqual({
      spinach: T2,
    });
  });

  it("keeps something re-added after it was removed", () => {
    const merged = mergeState(
      state({ sync: { removed: { pantry: { spinach: T2 } } } }),
      state({ pantry: [{ ingredientId: "spinach", addedAt: T3 }] }),
    );
    expect(ids(merged)).toEqual(["spinach"]);
    // The item outlived the marker, so the marker goes.
    expect(merged.sync.removed.pantry).toEqual({});
  });

  it("keeps something edited after it was removed elsewhere", () => {
    const merged = mergeState(
      state({ sync: { removed: { pantry: { milk: T2 } } } }),
      state({
        pantry: [{ ingredientId: "milk", addedAt: T1, updatedAt: T3 }],
      }),
    );
    expect(ids(merged)).toEqual(["milk"]);
  });

  it("keeps an emptied fridge empty", () => {
    const emptied = state({
      sync: { removed: { pantry: { egg: T2, rice: T2, spinach: T2 } } },
    });
    const stale = state({
      pantry: [
        { ingredientId: "egg", addedAt: T1 },
        { ingredientId: "rice", addedAt: T1 },
        { ingredientId: "spinach", addedAt: T1 },
      ],
    });
    expect(mergeState(emptied, stale).pantry).toEqual([]);
  });

  it("takes nothing from a dead copy, not even its use-by date", () => {
    // Milk bought, dated, finished and deleted; then bought again elsewhere.
    // The new carton must not inherit the old carton's date.
    const merged = mergeState(
      state({
        pantry: [{ ingredientId: "milk", addedAt: T3 }],
        sync: { removed: { pantry: { milk: T2 } } },
      }),
      state({
        pantry: [{ ingredientId: "milk", addedAt: T1, expiresAt: T1 }],
      }),
    );
    expect(merged.pantry).toHaveLength(1);
    expect(merged.pantry[0]?.expiresAt).toBeUndefined();
  });

  it("keeps an un-saved favourite un-saved", () => {
    const merged = mergeState(
      state({ sync: { removed: { favorites: { carbonara: T2 } } } }),
      state({ favorites: ["carbonara", "dal"] }),
    );
    expect(merged.favorites).toEqual(["dal"]);
  });

  it("keeps a bought item off the shopping list", () => {
    const merged = mergeState(
      state({ sync: { removed: { shoppingList: { onion: T2 } } } }),
      state({
        shoppingList: [
          { ingredientId: "onion", forRecipes: ["stew"], checked: false, addedAt: T1 },
        ],
      }),
    );
    expect(merged.shoppingList).toEqual([]);
  });

  it("keeps a deleted invented recipe deleted", () => {
    const merged = mergeState(
      state({ sync: { removed: { invented: { a: T2 } } } }),
      state({ invented: [recipe("a"), recipe("b")] }),
    );
    expect(merged.invented.map((r) => r.id)).toEqual(["b"]);
  });

  it("does not let a corrupt marker delete anything", () => {
    const merged = mergeState(
      state({ sync: { removed: { pantry: { egg: "not a date" } } } }),
      state({ pantry: [{ ingredientId: "egg", addedAt: T1 }] }),
    );
    expect(ids(merged)).toEqual(["egg"]);
  });
});

describe("staples and diet merge item by item", () => {
  it("does not resurrect a staple that was unticked", () => {
    // Staples are curated by removal — unticking must stick.
    const merged = mergeState(
      state({
        staples: ["salt"],
        sync: { removed: { staples: { pepper: T2 } } },
      }),
      state({ staples: ["salt", "pepper"] }),
    );
    expect(merged.staples).toEqual(["salt"]);
  });

  it("keeps a staple added on one device while another unticks a different one", () => {
    // Whole-field last-write-wins would have thrown one of these away.
    const merged = mergeState(
      state({
        staples: ["salt", "ghee"],
        sync: { added: { staples: { ghee: T2 } } },
      }),
      state({
        staples: ["pepper"],
        sync: { removed: { staples: { salt: T3 } } },
      }),
    );
    expect(merged.staples).toEqual(["ghee", "pepper"]);
  });

  it("keeps a restriction through an unrelated, more recent edit elsewhere", () => {
    // The dangerous version of the old bug: nut-free set on the phone, an egg
    // added on a laptop that hadn't synced since — and the laptop's blank
    // diet, being "newer", wiped the restriction for both.
    const phone = state({
      updatedAt: T1,
      diet: { restrictions: ["nutFree"], avoid: ["peanuts"] },
      sync: {
        added: { restrictions: { nutFree: T1 }, avoid: { peanuts: T1 } },
      },
    });
    const laptop = state({
      updatedAt: T3,
      pantry: [{ ingredientId: "egg", addedAt: T3 }],
    });
    for (const merged of [mergeState(phone, laptop), mergeState(laptop, phone)]) {
      expect(merged.diet).toEqual({
        restrictions: ["nutFree"],
        avoid: ["peanuts"],
      });
      expect(ids(merged)).toEqual(["egg"]);
    }
  });

  it("combines restrictions set on different devices", () => {
    const merged = mergeState(
      state({
        diet: { restrictions: ["glutenFree"], avoid: [] },
        sync: { added: { restrictions: { glutenFree: T2 } } },
      }),
      state({
        diet: { restrictions: ["vegetarian"], avoid: [] },
        sync: { added: { restrictions: { vegetarian: T3 } } },
      }),
    );
    expect(merged.diet.restrictions).toEqual(["glutenFree", "vegetarian"]);
  });

  it("lets a restriction be switched off for good", () => {
    const merged = mergeState(
      state({ sync: { removed: { restrictions: { vegan: T2 } } } }),
      state({
        diet: { restrictions: ["vegan", "nutFree"], avoid: [] },
        sync: { added: { restrictions: { vegan: T1, nutFree: T1 } } },
      }),
    );
    expect(merged.diet.restrictions).toEqual(["nutFree"]);
  });

  it("lets a restriction be switched back on after that", () => {
    const merged = mergeState(
      state({ sync: { removed: { restrictions: { vegan: T2 } } } }),
      state({
        diet: { restrictions: ["vegan"], avoid: [] },
        sync: { added: { restrictions: { vegan: T3 } } },
      }),
    );
    expect(merged.diet.restrictions).toEqual(["vegan"]);
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

  it("caps invented recipes at 50 and both devices keep the same 50", () => {
    // If each device kept its own first, they would overwrite one another's
    // choice on every sync and never settle.
    const many = (p: string) =>
      Array.from({ length: 40 }, (_, i) => recipe(`${p}-${(1000 + i).toString(36)}`));
    const a = state({ invented: many("a") });
    const b = state({ invented: many("b") });
    const ab = mergeState(a, b);
    expect(ab.invented).toHaveLength(50);
    expect(mergeState(b, a).invented.map((r) => r.id)).toEqual(
      ab.invented.map((r) => r.id),
    );
  });

  it("carries the newer updatedAt forward", () => {
    expect(
      mergeState(state({ updatedAt: T1 }), state({ updatedAt: T2 })).updatedAt,
    ).toBe(T2);
  });
});

describe("the result does not depend on who is merging", () => {
  // A realistic pair: overlapping contents, edits on both sides, removals on
  // both sides, everything deliberately out of order.
  const a = state({
    updatedAt: T3,
    pantry: [
      { ingredientId: "rice", addedAt: T2 },
      { ingredientId: "egg", addedAt: T1, updatedAt: T3, quantity: 6 },
      { ingredientId: "milk", addedAt: T1, expiresAt: T3 },
    ],
    favorites: ["dal", "carbonara"],
    staples: ["salt", "ghee"],
    diet: { restrictions: ["vegetarian"], avoid: [] },
    history: [{ recipeId: "x", cookedAt: T1 }],
    shoppingList: [
      { ingredientId: "onion", forRecipes: ["stew"], checked: false, addedAt: T1 },
    ],
    invented: [recipe("i-1")],
    sync: {
      added: {
        favorites: { dal: T2, carbonara: T1 },
        staples: { ghee: T2 },
        restrictions: { vegetarian: T3 },
      },
      removed: { pantry: { spinach: T2 }, staples: { pepper: T2 } },
    },
  });
  const b = state({
    updatedAt: T2,
    pantry: [
      { ingredientId: "spinach", addedAt: T1 },
      { ingredientId: "egg", addedAt: T1, quantity: 2 },
      { ingredientId: "milk", addedAt: T2 },
      { ingredientId: "tofu", addedAt: T3 },
    ],
    favorites: ["carbonara", "ramen"],
    staples: ["pepper", "salt"],
    diet: { restrictions: ["nutFree"], avoid: ["peanuts"] },
    history: [{ recipeId: "y", cookedAt: T2 }],
    shoppingList: [
      { ingredientId: "onion", forRecipes: ["soup"], checked: true, addedAt: T2 },
    ],
    invented: [recipe("i-2")],
    sync: {
      added: {
        favorites: { ramen: T3 },
        restrictions: { nutFree: T1 },
        avoid: { peanuts: T1 },
      },
      removed: { favorites: { dal: T1 } },
    },
  });

  it("is the same either way round, contents and order", () => {
    const ab = mergeState(a, b);
    const ba = mergeState(b, a);
    expect(ab).toEqual(ba);
    expect(sameState(ab, ba)).toBe(true);
  });

  it("reaches the expected result", () => {
    const merged = mergeState(a, b);
    expect(ids(merged)).toEqual(["egg", "milk", "rice", "tofu"]);
    expect(merged.pantry.find((p) => p.ingredientId === "egg")?.quantity).toBe(6);
    expect(merged.favorites).toEqual(["carbonara", "dal", "ramen"]);
    expect(merged.staples).toEqual(["ghee", "salt"]);
    expect(merged.diet).toEqual({
      restrictions: ["nutFree", "vegetarian"],
      avoid: ["peanuts"],
    });
    expect(merged.shoppingList[0]?.checked).toBe(true);
  });

  it("merging again changes nothing", () => {
    // Every device pushes what it merged, so a merge that kept moving would
    // have two devices rewriting each other's copy forever.
    const once = mergeState(a, b);
    expect(mergeState(once, b)).toEqual(once);
    expect(mergeState(once, a)).toEqual(once);
    expect(mergeState(once, once)).toEqual(once);
  });

  it("is stable when a state is merged with itself", () => {
    const settled = mergeState(a, a);
    expect(mergeState(settled, settled)).toEqual(settled);
    expect(ids(settled).sort()).toEqual(ids(a).sort());
  });
});

describe("sameState", () => {
  it("ignores key order, which a round trip through the server changes", () => {
    const s = state({ pantry: [{ ingredientId: "egg", addedAt: T1, quantity: 2 }] });
    const shuffled = JSON.parse(
      JSON.stringify({
        sync: s.sync,
        pantry: [{ quantity: 2, addedAt: T1, ingredientId: "egg" }],
        invented: [],
        diet: { avoid: [], restrictions: [] },
        shoppingList: [],
        history: [],
        favorites: [],
        staples: [],
        updatedAt: T1,
        schemaVersion: 3,
      }),
    ) as RecipityState;
    expect(sameState(s, shuffled)).toBe(true);
  });

  it("treats an absent field and an undefined one alike", () => {
    expect(
      sameState(
        state({ pantry: [{ ingredientId: "egg", addedAt: T1 }] }),
        state({
          pantry: [{ ingredientId: "egg", addedAt: T1, expiresAt: undefined }],
        }),
      ),
    ).toBe(true);
  });

  it("notices a real difference", () => {
    expect(
      sameState(state({ favorites: ["a"] }), state({ favorites: ["b"] })),
    ).toBe(false);
    expect(
      sameState(
        state(),
        state({ sync: { removed: { pantry: { egg: T1 } } } }),
      ),
    ).toBe(false);
  });
});

describe("empty, pristine and gain helpers", () => {
  it("recognises a state with nothing worth keeping", () => {
    expect(isEmptyState(state())).toBe(true);
    expect(isEmptyState(state({ staples: ["salt"] }))).toBe(true);
    expect(
      isEmptyState(state({ pantry: [{ ingredientId: "egg", addedAt: T1 }] })),
    ).toBe(false);
  });

  it("does not call an emptied fridge pristine", () => {
    // Empty, but it has news: other devices need to hear the egg is gone.
    const emptied = state({ sync: { removed: { pantry: { egg: T2 } } } });
    expect(isEmptyState(emptied)).toBe(true);
    expect(isPristine(emptied)).toBe(false);
    expect(isPristine(state())).toBe(true);
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
