import { describe, expect, it } from "vitest";
import { RECIPES } from "@/data/recipes";
import { GROUP_MEMBERS, INGREDIENTS, INGREDIENT_BY_ID } from "@/data/ingredients";
import { SUBSTITUTIONS } from "@/data/substitutions";
import { recipeDiet } from "@/lib/diet";

/**
 * Integrity checks on the bundled data.
 *
 * These catch the failure mode that would otherwise be silent: a recipe
 * referencing an ingredient id that doesn't exist never matches anything, and
 * nothing in the UI would tell you why.
 */

describe("ingredient catalogue", () => {
  it("has unique ids", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const ing of INGREDIENTS) {
      if (seen.has(ing.id)) dupes.push(ing.id);
      seen.add(ing.id);
    }
    expect(dupes).toEqual([]);
  });

  it("is substantial enough to cover a real kitchen", () => {
    expect(INGREDIENTS.length).toBeGreaterThan(350);
  });

  it("marks vegan ingredients as vegetarian too", () => {
    const contradictions = INGREDIENTS.filter(
      (i) => i.diet.vegan && !i.diet.vegetarian,
    ).map((i) => i.id);
    expect(contradictions).toEqual([]);
  });

  it("marks vegan ingredients as dairy-free too", () => {
    const contradictions = INGREDIENTS.filter(
      (i) => i.diet.vegan && !i.diet.dairyFree,
    ).map((i) => i.id);
    expect(contradictions).toEqual([]);
  });
});

describe("recipe library", () => {
  it("has a meaningful number of recipes", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(120);
  });

  it("has unique slugs", () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const r of RECIPES) {
      if (seen.has(r.slug)) dupes.push(r.slug);
      seen.add(r.slug);
    }
    expect(dupes).toEqual([]);
  });

  it("references only real ingredients and real groups", () => {
    const bad: string[] = [];
    for (const r of RECIPES) {
      for (const ri of r.ingredients) {
        if (ri.ref.startsWith("group:")) {
          if (!GROUP_MEMBERS.has(ri.ref.slice(6))) {
            bad.push(`${r.slug} -> ${ri.ref}`);
          }
        } else if (!INGREDIENT_BY_ID.has(ri.ref)) {
          bad.push(`${r.slug} -> ${ri.ref}`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  it("gives every recipe steps, ingredients and a sane time", () => {
    for (const r of RECIPES) {
      expect(r.steps.length, `${r.slug} steps`).toBeGreaterThan(1);
      expect(r.ingredients.length, `${r.slug} ingredients`).toBeGreaterThan(1);
      expect(r.servings, `${r.slug} servings`).toBeGreaterThan(0);
      expect(r.prepMin + r.cookMin, `${r.slug} time`).toBeGreaterThan(0);
    }
  });

  it("has at least one non-optional ingredient per recipe", () => {
    const allOptional = RECIPES.filter((r) =>
      r.ingredients.every((i) => i.optional),
    ).map((r) => r.slug);
    expect(allOptional).toEqual([]);
  });

  it("does not tag a recipe vegan when its ingredients are not", () => {
    // The `vegan` tag is hand-written; the diet flags are derived. Where a
    // recipe claims both, they must agree.
    const liars = RECIPES.filter(
      (r) => r.tags.includes("vegan") && !recipeDiet(r).vegan,
    ).map((r) => r.slug);
    expect(liars).toEqual([]);
  });

  it("does not tag a recipe vegetarian when its ingredients are not", () => {
    const liars = RECIPES.filter(
      (r) => r.tags.includes("vegetarian") && !recipeDiet(r).vegetarian,
    ).map((r) => r.slug);
    expect(liars).toEqual([]);
  });
});

describe("substitutions", () => {
  it("references only real ingredients", () => {
    const bad: string[] = [];
    for (const sub of SUBSTITUTIONS) {
      for (const id of [sub.target, ...sub.requires]) {
        if (!INGREDIENT_BY_ID.has(id)) bad.push(`${sub.target} -> ${id}`);
      }
    }
    expect(bad).toEqual([]);
  });

  it("never lists an ingredient as its own substitute", () => {
    const silly = SUBSTITUTIONS.filter((s) =>
      s.requires.includes(s.target),
    ).map((s) => s.target);
    expect(silly).toEqual([]);
  });
});
