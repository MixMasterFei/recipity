import type { Recipe } from "@/lib/types";
import { PASTA_RECIPES } from "./pasta";
import { RICE_GRAIN_RECIPES } from "./rice-grains";
import { SOUP_STEW_RECIPES } from "./soups-stews";
import { STIR_FRY_RECIPES } from "./stir-fries";
import { EGG_BREAKFAST_RECIPES } from "./eggs-breakfast";
import { SALAD_RECIPES } from "./salads";
import { ROAST_RECIPES } from "./roasts-traybakes";
import { CURRY_RECIPES } from "./curries";
import { HANDHELD_RECIPES } from "./handhelds";
import { SWEET_RECIPES } from "./sweets";

/** Every bundled recipe, in one list. */
export const RECIPES: Recipe[] = [
  ...PASTA_RECIPES,
  ...RICE_GRAIN_RECIPES,
  ...SOUP_STEW_RECIPES,
  ...STIR_FRY_RECIPES,
  ...EGG_BREAKFAST_RECIPES,
  ...SALAD_RECIPES,
  ...ROAST_RECIPES,
  ...CURRY_RECIPES,
  ...HANDHELD_RECIPES,
  ...SWEET_RECIPES,
];

export const RECIPE_BY_SLUG = new Map<string, Recipe>(
  RECIPES.map((r) => [r.slug, r]),
);

export function getRecipe(slug: string): Recipe | undefined {
  return RECIPE_BY_SLUG.get(slug);
}

/** Every cuisine present in the library, alphabetical. */
export const CUISINES: string[] = [
  ...new Set(RECIPES.map((r) => r.cuisine)),
].sort();

/** Every tag, ordered by how many recipes carry it. */
export const TAGS: string[] = (() => {
  const counts = new Map<string, number>();
  for (const r of RECIPES) {
    for (const t of r.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([tag]) => tag);
})();
