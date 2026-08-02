import { describe, expect, it } from "vitest";
import {
  daysUntil,
  expiringItems,
  groupByStatus,
  matchPantry,
  scoreRecipe,
  statusFor,
} from "@/lib/match";
import { recipe, i, opt, g, type RecipeSpec } from "@/data/recipes/helpers";
import { RECIPES } from "@/data/recipes";
import type { PantryItem } from "@/lib/types";

/** Fixed clock so expiry assertions don't drift with the wall clock. */
const NOW = new Date("2026-06-15T12:00:00Z");

function pantry(
  ids: string[],
  expiries: Record<string, string> = {},
): PantryItem[] {
  return ids.map((ingredientId) => ({
    ingredientId,
    addedAt: NOW.toISOString(),
    expiresAt: expiries[ingredientId],
  }));
}

function daysFromNow(days: number): string {
  const date = new Date(NOW);
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

/** Kept as a spec (not a built Recipe) so variants can spread it cleanly. */
const SIMPLE_SPEC: RecipeSpec = {
  slug: "test-simple",
  title: "Test Simple",
  description: "Three required ingredients plus salt.",
  cuisine: "Test",
  tags: [],
  servings: 2,
  prep: 5,
  cook: 5,
  ingredients: [
    i("spaghetti", 200, "g"),
    i("tomato", 3),
    i("garlic", 2, "clove"),
    i("salt"),
  ],
  steps: ["Cook it.", "Eat it."],
};

const SIMPLE = recipe(SIMPLE_SPEC);

describe("scoreRecipe — coverage", () => {
  it("is 100% and ready when everything is present", () => {
    const result = scoreRecipe(
      SIMPLE,
      pantry(["spaghetti", "tomato", "garlic"]),
      { staples: ["salt"], now: NOW },
    );
    expect(result.coverage).toBe(1);
    expect(result.status).toBe("ready");
    expect(result.missing).toEqual([]);
  });

  it("excludes staples from both sides of the fraction", () => {
    // With salt counted, an empty pantry would score 1/4 = 25%. It must be 0:
    // staples are neither a win nor a requirement.
    const result = scoreRecipe(SIMPLE, pantry([]), {
      staples: ["salt"],
      now: NOW,
    });
    expect(result.coverage).toBe(0);
    expect(result.missing).toEqual(["spaghetti", "tomato", "garlic"]);
  });

  it("does not count a staple as a missing ingredient", () => {
    const result = scoreRecipe(SIMPLE, pantry(["spaghetti", "tomato", "garlic"]), {
      staples: ["salt"],
      now: NOW,
    });
    expect(result.missing).not.toContain("salt");
  });

  it("treats a non-staple salt as a genuine requirement", () => {
    const result = scoreRecipe(SIMPLE, pantry(["spaghetti", "tomato", "garlic"]), {
      staples: [],
      now: NOW,
    });
    expect(result.missing).toEqual(["salt"]);
    expect(result.status).toBe("almost");
  });

  it("ignores optional ingredients when scoring", () => {
    const withGarnish = recipe({
      ...SIMPLE_SPEC,
      slug: "test-garnish",
      ingredients: [...SIMPLE_SPEC.ingredients, opt("basil", 1, "handful")],
    });
    const result = scoreRecipe(
      withGarnish,
      pantry(["spaghetti", "tomato", "garlic"]),
      { staples: ["salt"], now: NOW },
    );
    expect(result.status).toBe("ready");
    expect(result.missing).toEqual([]);
  });
});

describe("scoreRecipe — status tiers", () => {
  it("maps missing counts to tiers", () => {
    expect(statusFor(0)).toBe("ready");
    expect(statusFor(1)).toBe("almost");
    expect(statusFor(2)).toBe("almost");
    expect(statusFor(3)).toBe("stretch");
    expect(statusFor(9)).toBe("stretch");
  });

  it("drops from ready to almost when one ingredient is removed", () => {
    const full = scoreRecipe(SIMPLE, pantry(["spaghetti", "tomato", "garlic"]), {
      staples: ["salt"],
      now: NOW,
    });
    const short = scoreRecipe(SIMPLE, pantry(["spaghetti", "tomato"]), {
      staples: ["salt"],
      now: NOW,
    });
    expect(full.status).toBe("ready");
    expect(short.status).toBe("almost");
    expect(short.missing).toEqual(["garlic"]);
    expect(short.score).toBeLessThan(full.score);
  });
});

describe("scoreRecipe — group matching", () => {
  const GROUPED_SPEC: RecipeSpec = {
    slug: "test-group",
    title: "Test Group",
    description: "Wants any hard cheese.",
    cuisine: "Test",
    tags: [],
    servings: 2,
    prep: 5,
    cook: 5,
    ingredients: [i("spaghetti", 200, "g"), g("hard-cheese", 50, "g")],
    steps: ["Cook.", "Serve."],
  };
  const GROUPED = recipe(GROUPED_SPEC);

  it("is satisfied by any member of the group", () => {
    const result = scoreRecipe(GROUPED, pantry(["spaghetti", "pecorino"]), {
      now: NOW,
    });
    expect(result.status).toBe("ready");
    const cheese = result.matches.find((m) => m.ref === "group:hard-cheese");
    expect(cheese?.kind).toBe("group");
    expect(cheese?.satisfiedBy).toContain("pecorino");
  });

  it("is missing when you own nothing in the group", () => {
    const result = scoreRecipe(GROUPED, pantry(["spaghetti", "lettuce"]), {
      now: NOW,
    });
    expect(result.missing).toContain("group:hard-cheese");
  });

  it("accepts a sibling for a specific ingredient", () => {
    // Recipe asks for parmesan; pecorino shares the hard-cheese group.
    const specific = recipe({
      ...GROUPED_SPEC,
      slug: "test-specific",
      ingredients: [i("spaghetti", 200, "g"), i("parmesan", 50, "g")],
    });
    const result = scoreRecipe(specific, pantry(["spaghetti", "pecorino"]), {
      now: NOW,
    });
    expect(result.status).toBe("ready");
    expect(
      result.matches.find((m) => m.ref === "parmesan")?.kind,
    ).toBe("group");
  });
});

describe("scoreRecipe — substitutions", () => {
  const BAKED = recipe({
    slug: "test-sub",
    title: "Test Sub",
    description: "Needs buttermilk.",
    cuisine: "Test",
    tags: [],
    servings: 4,
    prep: 10,
    cook: 20,
    ingredients: [i("flour", 200, "g"), i("buttermilk", 200, "ml")],
    steps: ["Mix.", "Bake."],
  });

  it("fires when every required input is present", () => {
    const result = scoreRecipe(BAKED, pantry(["flour", "milk", "lemon"]), {
      now: NOW,
    });
    const sub = result.matches.find((m) => m.ref === "buttermilk");
    expect(sub?.kind).toBe("sub");
    expect(sub?.substitutionNote).toContain("lemon juice");
    expect(result.status).toBe("ready");
  });

  it("does not fire when an input is missing", () => {
    const result = scoreRecipe(BAKED, pantry(["flour", "milk"]), { now: NOW });
    expect(result.missing).toContain("buttermilk");
  });

  it("accepts staples as substitution inputs", () => {
    const result = scoreRecipe(BAKED, pantry(["flour"]), {
      staples: ["milk", "lemon"],
      now: NOW,
    });
    expect(result.matches.find((m) => m.ref === "buttermilk")?.kind).toBe("sub");
  });

  it("ranks a true match above a substituted one", () => {
    const real = scoreRecipe(BAKED, pantry(["flour", "buttermilk"]), {
      now: NOW,
    });
    const improvised = scoreRecipe(BAKED, pantry(["flour", "milk", "lemon"]), {
      now: NOW,
    });
    expect(real.score).toBeGreaterThan(improvised.score);
  });
});

describe("scoreRecipe — expiry rescue", () => {
  it("ranks a recipe higher when it uses something expiring", () => {
    const urgent = scoreRecipe(
      SIMPLE,
      pantry(["spaghetti", "tomato", "garlic"], { tomato: daysFromNow(1) }),
      { staples: ["salt"], now: NOW },
    );
    const relaxed = scoreRecipe(
      SIMPLE,
      pantry(["spaghetti", "tomato", "garlic"]),
      { staples: ["salt"], now: NOW },
    );
    expect(urgent.score).toBeGreaterThan(relaxed.score);
    expect(urgent.rescues).toContain("tomato");
  });

  it("weights imminent expiry above merely soon", () => {
    const tomorrow = scoreRecipe(
      SIMPLE,
      pantry(["spaghetti", "tomato", "garlic"], { tomato: daysFromNow(1) }),
      { staples: ["salt"], now: NOW },
    );
    const nextWeek = scoreRecipe(
      SIMPLE,
      pantry(["spaghetti", "tomato", "garlic"], { tomato: daysFromNow(6) }),
      { staples: ["salt"], now: NOW },
    );
    expect(tomorrow.score).toBeGreaterThan(nextWeek.score);
  });

  it("ignores expiry dates far in the future", () => {
    const result = scoreRecipe(
      SIMPLE,
      pantry(["spaghetti", "tomato", "garlic"], { tomato: daysFromNow(60) }),
      { staples: ["salt"], now: NOW },
    );
    expect(result.rescues).toEqual([]);
  });

  it("still rescues an item already past its date", () => {
    const result = scoreRecipe(
      SIMPLE,
      pantry(["spaghetti", "tomato", "garlic"], { tomato: daysFromNow(-2) }),
      { staples: ["salt"], now: NOW },
    );
    expect(result.rescues).toContain("tomato");
  });
});

describe("matchPantry", () => {
  it("ranks recipes you can fully make above ones you cannot", () => {
    const results = matchPantry(
      RECIPES,
      pantry(["rice", "egg", "scallion", "soy-sauce", "vegetable-oil"]),
      { staples: ["salt", "black-pepper"], now: NOW },
    );
    expect(results[0]?.status).toBe("ready");
    // Sorted descending by score throughout.
    for (let idx = 1; idx < results.length; idx += 1) {
      expect(results[idx - 1]!.score).toBeGreaterThanOrEqual(
        results[idx]!.score,
      );
    }
  });

  it("finds egg fried rice from exactly its ingredients", () => {
    const results = matchPantry(
      RECIPES,
      pantry(["rice", "egg", "scallion", "soy-sauce", "vegetable-oil"]),
      { staples: ["salt", "black-pepper"], now: NOW },
    );
    const friedRice = results.find((r) => r.recipe.slug === "egg-fried-rice");
    expect(friedRice?.status).toBe("ready");
  });

  it("demotes that recipe to almost when the eggs run out", () => {
    const results = matchPantry(
      RECIPES,
      pantry(["rice", "scallion", "soy-sauce", "vegetable-oil"]),
      { staples: ["salt", "black-pepper"], now: NOW },
    );
    const friedRice = results.find((r) => r.recipe.slug === "egg-fried-rice");
    expect(friedRice?.status).toBe("almost");
    expect(friedRice?.missing).toContain("egg");
  });

  it("hard-filters on dietary restrictions rather than ranking them down", () => {
    const results = matchPantry(RECIPES, pantry(["rice", "egg"]), {
      diet: { restrictions: ["vegan"], avoid: [] },
      now: NOW,
    });
    // Nothing containing egg or meat may survive a vegan filter.
    const violations = results.filter((r) =>
      r.recipe.ingredients.some(
        (ri) => !ri.optional && ri.ref === "egg",
      ),
    );
    expect(violations).toEqual([]);
    expect(results.length).toBeGreaterThan(0);
  });

  it("excludes recipes containing an avoided ingredient", () => {
    const results = matchPantry(RECIPES, pantry(["spaghetti", "tomato"]), {
      diet: { restrictions: [], avoid: ["garlic"] },
      now: NOW,
    });
    const withGarlic = results.filter((r) =>
      r.recipe.ingredients.some((ri) => ri.ref === "garlic"),
    );
    expect(withGarlic).toEqual([]);
  });

  it("returns every recipe when the pantry is empty", () => {
    const results = matchPantry(RECIPES, [], { now: NOW });
    expect(results).toHaveLength(RECIPES.length);
    expect(results.every((r) => r.status === "stretch" || r.status === "almost")).toBe(
      true,
    );
  });
});

describe("groupByStatus", () => {
  it("partitions results with nothing lost or duplicated", () => {
    const results = matchPantry(RECIPES, pantry(["rice", "egg", "onion"]), {
      now: NOW,
    });
    const { ready, almost, stretch } = groupByStatus(results);
    expect(ready.length + almost.length + stretch.length).toBe(results.length);
  });
});

describe("daysUntil", () => {
  it("counts whole days forward", () => {
    expect(daysUntil(daysFromNow(3), NOW)).toBe(3);
  });

  it("goes negative once past", () => {
    expect(daysUntil(daysFromNow(-2), NOW)).toBe(-2);
  });

  it("returns Infinity for an unparseable date rather than throwing", () => {
    expect(daysUntil("not a date", NOW)).toBe(Infinity);
  });
});

describe("expiringItems", () => {
  it("lists soonest first and omits distant dates", () => {
    const items = expiringItems(
      pantry(["milk", "spinach", "rice"], {
        milk: daysFromNow(5),
        spinach: daysFromNow(1),
        rice: daysFromNow(300),
      }),
      NOW,
    );
    expect(items.map((e) => e.item.ingredientId)).toEqual(["spinach", "milk"]);
  });

  it("ignores items with no date at all", () => {
    expect(expiringItems(pantry(["milk", "rice"]), NOW)).toEqual([]);
  });
});
