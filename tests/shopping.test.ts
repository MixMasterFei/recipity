import { describe, expect, it } from "vitest";
import {
  addMissingToList,
  groupByAisle,
  highestLeverageBuy,
  removeRecipeFromList,
} from "@/lib/shopping";
import { scoreRecipe } from "@/lib/match";
import { recipe, i } from "@/data/recipes/helpers";
import type { MatchResult, ShoppingItem } from "@/lib/types";

const NOW = new Date("2026-06-15T12:00:00Z");

function makeResult(slug: string, refs: string[]): MatchResult {
  const r = recipe({
    slug,
    title: slug,
    description: "",
    cuisine: "Test",
    tags: [],
    servings: 2,
    prep: 1,
    cook: 1,
    ingredients: refs.map((ref) => i(ref, 1)),
    steps: ["a", "b"],
  });
  // Empty pantry, so every ingredient lands in `missing`.
  return scoreRecipe(r, [], { now: NOW });
}

describe("addMissingToList", () => {
  it("adds every missing ingredient", () => {
    const list = addMissingToList([], makeResult("a", ["onion", "garlic"]), NOW);
    expect(list.map((i) => i.ingredientId).sort()).toEqual(["garlic", "onion"]);
  });

  it("dedupes across recipes and records both as reasons", () => {
    let list: ShoppingItem[] = [];
    list = addMissingToList(list, makeResult("a", ["onion", "garlic"]), NOW);
    list = addMissingToList(list, makeResult("b", ["onion", "carrot"]), NOW);

    expect(list).toHaveLength(3);
    const onion = list.find((i) => i.ingredientId === "onion");
    expect(onion?.forRecipes).toEqual(["a", "b"]);
  });

  it("does not record the same recipe twice", () => {
    let list: ShoppingItem[] = [];
    const result = makeResult("a", ["onion"]);
    list = addMissingToList(list, result, NOW);
    list = addMissingToList(list, result, NOW);
    expect(list[0]?.forRecipes).toEqual(["a"]);
  });

  it("un-ticks an item that gets re-added", () => {
    let list = addMissingToList([], makeResult("a", ["onion"]), NOW);
    list = list.map((item) => ({ ...item, checked: true }));
    list = addMissingToList(list, makeResult("b", ["onion"]), NOW);
    expect(list[0]?.checked).toBe(false);
  });

  it("does not mutate the list it was given", () => {
    const original = addMissingToList([], makeResult("a", ["onion"]), NOW);
    const snapshot = JSON.stringify(original);
    addMissingToList(original, makeResult("b", ["onion", "garlic"]), NOW);
    expect(JSON.stringify(original)).toBe(snapshot);
  });
});

describe("removeRecipeFromList", () => {
  it("drops items no other recipe still needs", () => {
    let list: ShoppingItem[] = [];
    list = addMissingToList(list, makeResult("a", ["onion", "garlic"]), NOW);
    list = addMissingToList(list, makeResult("b", ["onion"]), NOW);

    const after = removeRecipeFromList(list, "a");
    // Garlic was only for recipe a, so it goes; onion is still wanted by b.
    expect(after.map((i) => i.ingredientId)).toEqual(["onion"]);
    expect(after[0]?.forRecipes).toEqual(["b"]);
  });

  it("is a no-op for a recipe not on the list", () => {
    const list = addMissingToList([], makeResult("a", ["onion"]), NOW);
    expect(removeRecipeFromList(list, "zzz")).toHaveLength(1);
  });
});

describe("groupByAisle", () => {
  it("groups items into aisles in walking order", () => {
    const list = addMissingToList(
      [],
      makeResult("a", ["onion", "cheddar", "spaghetti", "carrot"]),
      NOW,
    );
    const groups = groupByAisle(list);
    // Produce comes before dairy, which comes before pantry.
    expect(groups.map((g) => g.aisle)).toEqual(["produce", "dairy", "pantry"]);
    expect(groups[0]?.items.map((i) => i.ingredientId)).toEqual([
      "carrot",
      "onion",
    ]);
  });

  it("omits aisles with nothing in them", () => {
    const list = addMissingToList([], makeResult("a", ["onion"]), NOW);
    expect(groupByAisle(list)).toHaveLength(1);
  });

  it("returns nothing for an empty list", () => {
    expect(groupByAisle([])).toEqual([]);
  });
});

describe("highestLeverageBuy", () => {
  it("finds the ingredient that unlocks the most recipes", () => {
    const results = [
      makeResult("a", ["onion"]),
      makeResult("b", ["onion"]),
      makeResult("c", ["garlic"]),
    ];
    const best = highestLeverageBuy(results);
    expect(best?.ingredientId).toBe("onion");
    expect(best?.unlocks).toBe(2);
  });

  it("ignores recipes more than one ingredient short", () => {
    // Buying garlic here unlocks nothing, because carrot is also missing.
    const results = [makeResult("a", ["garlic", "carrot"])];
    expect(highestLeverageBuy(results)).toBeUndefined();
  });

  it("returns undefined when nothing is missing", () => {
    expect(highestLeverageBuy([])).toBeUndefined();
  });
});
