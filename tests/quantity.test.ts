import { describe, expect, it } from "vitest";
import {
  coverageRatio,
  formatAmount,
  isEnough,
  toAmount,
  unitFamily,
} from "@/lib/quantity";
import { scoreRecipe } from "@/lib/match";
import { recipe, i, opt, g, type RecipeSpec } from "@/data/recipes/helpers";
import type { PantryItem } from "@/lib/types";

const NOW = new Date("2026-08-02T12:00:00Z");

function pantry(
  items: { id: string; quantity?: number; unit?: string }[],
): PantryItem[] {
  return items.map((it) => ({
    ingredientId: it.id,
    addedAt: NOW.toISOString(),
    quantity: it.quantity,
    unit: it.unit as PantryItem["unit"],
  }));
}

/** 400g spaghetti + 2 onions, serves 4. */
const PASTA_SPEC: RecipeSpec = {
  slug: "test-amounts",
  title: "Test Amounts",
  description: "",
  cuisine: "Test",
  tags: [],
  servings: 4,
  prep: 5,
  cook: 10,
  ingredients: [i("spaghetti", 400, "g"), i("onion", 2, "piece"), i("salt")],
  steps: ["a", "b"],
};
const PASTA = recipe(PASTA_SPEC);
const OPTS = { staples: ["salt"], now: NOW };

describe("unit families", () => {
  it("groups mass, volume, count and vague separately", () => {
    expect(unitFamily("kg")).toBe("mass");
    expect(unitFamily("cup")).toBe("volume");
    expect(unitFamily("clove")).toBe("count");
    expect(unitFamily("handful")).toBe("vague");
  });
});

describe("coverageRatio", () => {
  it("converts within mass", () => {
    expect(coverageRatio(toAmount(1, "kg"), toAmount(500, "g"))).toBe(2);
  });

  it("converts spoons and cups within volume", () => {
    expect(coverageRatio(toAmount(1, "cup"), toAmount(16, "tbsp"))).toBeCloseTo(1, 3);
    expect(coverageRatio(toAmount(1, "tbsp"), toAmount(3, "tsp"))).toBeCloseTo(1, 3);
  });

  it("refuses to guess across families", () => {
    // A cup of flour weighs 120g, a cup of sugar 200g. Guessing produces
    // confident nonsense, so we say nothing.
    expect(coverageRatio(toAmount(1, "cup"), toAmount(200, "g"))).toBeNull();
  });

  it("keeps counted units in separate buckets", () => {
    // Half a bunch of parsley is not half a can of tomatoes.
    expect(coverageRatio(toAmount(2, "can"), toAmount(1, "bunch"))).toBeNull();
    expect(coverageRatio(toAmount(4, "clove"), toAmount(2, "clove"))).toBe(2);
  });

  it("never compares vague amounts", () => {
    expect(coverageRatio(toAmount(1, "handful"), toAmount(1, "handful"))).toBeNull();
    expect(coverageRatio(toAmount(1, "pinch"), toAmount(2, "g"))).toBeNull();
  });

  it("returns null when either side has no amount", () => {
    expect(coverageRatio(null, toAmount(400, "g"))).toBeNull();
    expect(coverageRatio(toAmount(400, "g"), null)).toBeNull();
  });

  it("ignores zero and negative amounts", () => {
    expect(toAmount(0, "g")).toBeNull();
    expect(toAmount(-5, "g")).toBeNull();
  });
});

describe("isEnough", () => {
  it("treats no opinion as fine", () => {
    // The critical default: unknown must never read as a shortfall.
    expect(isEnough(null)).toBe(true);
  });

  it("tolerates being marginally under", () => {
    // 500g against a 520g recipe is not a shortage worth mentioning.
    expect(isEnough(0.96)).toBe(true);
    expect(isEnough(0.8)).toBe(false);
  });
});

describe("scoreRecipe — amounts are optional", () => {
  it("says nothing when no amounts are entered", () => {
    const result = scoreRecipe(PASTA, pantry([{ id: "spaghetti" }, { id: "onion" }]), OPTS);
    expect(result.status).toBe("ready");
    expect(result.servingsPossible).toBe(4);
    expect(result.short).toEqual([]);
  });

  it("says nothing when the units cannot be compared", () => {
    const result = scoreRecipe(
      PASTA,
      pantry([{ id: "spaghetti", quantity: 1, unit: "can" }, { id: "onion" }]),
      OPTS,
    );
    expect(result.servingsPossible).toBe(4);
    expect(result.short).toEqual([]);
  });

  it("confirms full servings when you have plenty", () => {
    const result = scoreRecipe(
      PASTA,
      pantry([
        { id: "spaghetti", quantity: 1, unit: "kg" },
        { id: "onion", quantity: 5, unit: "piece" },
      ]),
      OPTS,
    );
    expect(result.servingsPossible).toBe(4);
    expect(result.short).toEqual([]);
  });
});

describe("scoreRecipe — running low scales portions, never blocks", () => {
  it("halves the servings when you have half the pasta", () => {
    const result = scoreRecipe(
      PASTA,
      pantry([
        { id: "spaghetti", quantity: 200, unit: "g" },
        { id: "onion", quantity: 5, unit: "piece" },
      ]),
      OPTS,
    );
    expect(result.servingsPossible).toBe(2);
    expect(result.short).toEqual(["spaghetti"]);
  });

  it("still counts as ready — half the pasta is not no pasta", () => {
    // The whole design hinges on this: running low must never demote a recipe
    // out of "ready rn", or the feature makes the app worse.
    const result = scoreRecipe(
      PASTA,
      pantry([
        { id: "spaghetti", quantity: 50, unit: "g" },
        { id: "onion", quantity: 1, unit: "piece" },
      ]),
      OPTS,
    );
    expect(result.status).toBe("ready");
    expect(result.missing).toEqual([]);
  });

  it("never drops below one serving", () => {
    const result = scoreRecipe(
      PASTA,
      pantry([
        { id: "spaghetti", quantity: 1, unit: "g" },
        { id: "onion", quantity: 5, unit: "piece" },
      ]),
      OPTS,
    );
    expect(result.servingsPossible).toBe(1);
  });

  it("is limited by the scarcest ingredient", () => {
    // Loads of pasta, one onion of the two needed -> the onion decides.
    const result = scoreRecipe(
      PASTA,
      pantry([
        { id: "spaghetti", quantity: 10, unit: "kg" },
        { id: "onion", quantity: 1, unit: "piece" },
      ]),
      OPTS,
    );
    expect(result.servingsPossible).toBe(2);
    expect(result.short).toEqual(["onion"]);
  });

  it("ranks a fully-stocked recipe above a short one, but only just", () => {
    const full = scoreRecipe(
      PASTA,
      pantry([
        { id: "spaghetti", quantity: 1, unit: "kg" },
        { id: "onion", quantity: 5, unit: "piece" },
      ]),
      OPTS,
    );
    const low = scoreRecipe(
      PASTA,
      pantry([
        { id: "spaghetti", quantity: 100, unit: "g" },
        { id: "onion", quantity: 5, unit: "piece" },
      ]),
      OPTS,
    );
    expect(full.score).toBeGreaterThan(low.score);
    // The nudge must stay far smaller than a missing ingredient.
    expect(full.score - low.score).toBeLessThan(12);
  });
});

describe("scoreRecipe — amounts only speak for direct matches", () => {
  it("ignores amounts when a substitute or group is doing the work", () => {
    // The recipe asks for 80g of any hard cheese; you hold 10g of pecorino.
    // The recipe's amount doesn't describe the thing you actually have, so we
    // stay quiet rather than inventing a shortage.
    const grouped = recipe({
      ...PASTA_SPEC,
      slug: "test-grouped",
      ingredients: [g("hard-cheese", 80, "g"), i("salt")],
    });
    const result = scoreRecipe(
      grouped,
      pantry([{ id: "pecorino", quantity: 10, unit: "g" }]),
      OPTS,
    );
    expect(result.short).toEqual([]);
    expect(result.servingsPossible).toBe(4);
  });

  it("ignores optional ingredients", () => {
    const garnished = recipe({
      ...PASTA_SPEC,
      slug: "test-garnish-amount",
      ingredients: [i("spaghetti", 400, "g"), opt("basil", 50, "g"), i("salt")],
    });
    const result = scoreRecipe(
      garnished,
      pantry([
        { id: "spaghetti", quantity: 400, unit: "g" },
        { id: "basil", quantity: 1, unit: "g" },
      ]),
      OPTS,
    );
    expect(result.short).toEqual([]);
    expect(result.servingsPossible).toBe(4);
  });
});

describe("formatAmount", () => {
  it("closes up weights and volumes", () => {
    expect(formatAmount(400, "g")).toBe("400g");
    expect(formatAmount(1.5, "l")).toBe("1.5l");
  });

  it("spaces and pluralises counted things", () => {
    expect(formatAmount(1, "can")).toBe("1 can");
    expect(formatAmount(2, "can")).toBe("2 cans");
    expect(formatAmount(3, "clove")).toBe("3 cloves");
  });

  it("returns nothing when there is no amount", () => {
    expect(formatAmount(undefined, "g")).toBe("");
    expect(formatAmount(0, "g")).toBe("");
  });
});
