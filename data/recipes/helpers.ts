import type { Recipe, RecipeIngredient, Unit } from "@/lib/types";

/**
 * Terse builders for recipe data.
 *
 * Recipe files are the bulk of this codebase, so they're written with these
 * helpers rather than full object literals. Everything stays typed, so a
 * misspelled ingredient id is a compile error rather than a silent non-match.
 */

/** Required ingredient: `i("onion", 1)`, `i("flour", 200, "g", "sifted")`. */
export function i(
  ref: string,
  quantity?: number,
  unit?: Unit,
  note?: string,
): RecipeIngredient {
  return { ref, quantity, unit, note };
}

/** Optional ingredient — never blocks a match. */
export function opt(
  ref: string,
  quantity?: number,
  unit?: Unit,
  note?: string,
): RecipeIngredient {
  return { ref, quantity, unit, note, optional: true };
}

/** Group ref: `g("hard-cheese", 50, "g")` accepts any member of the group. */
export function g(
  group: string,
  quantity?: number,
  unit?: Unit,
  note?: string,
): RecipeIngredient {
  return { ref: `group:${group}`, quantity, unit, note };
}

/** Optional group ref — any member will do, and none is required. */
export function optG(
  group: string,
  quantity?: number,
  unit?: Unit,
  note?: string,
): RecipeIngredient {
  return { ref: `group:${group}`, quantity, unit, note, optional: true };
}

export interface RecipeSpec {
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  tags: string[];
  servings: number;
  prep: number;
  cook: number;
  difficulty?: Recipe["difficulty"];
  ingredients: RecipeIngredient[];
  steps: string[];
  tips?: string[];
}

export function recipe(spec: RecipeSpec): Recipe {
  return {
    id: spec.slug,
    slug: spec.slug,
    title: spec.title,
    description: spec.description,
    cuisine: spec.cuisine,
    tags: spec.tags,
    servings: spec.servings,
    prepMin: spec.prep,
    cookMin: spec.cook,
    difficulty: spec.difficulty ?? "easy",
    ingredients: spec.ingredients,
    steps: spec.steps,
    tips: spec.tips,
  };
}
