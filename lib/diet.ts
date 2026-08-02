import { GROUP_MEMBERS, getIngredient } from "@/data/ingredients";
import type { DietFlags, DietKey, DietPrefs, Recipe } from "@/lib/types";

/**
 * Dietary classification.
 *
 * Recipe diet tags are *derived* from ingredient flags rather than hand-written
 * per recipe. That's the whole point: a recipe listing butter can never be
 * mislabelled vegan, no matter how the recipe data is edited later.
 */

export const DIET_LABELS: Record<DietKey, string> = {
  vegan: "Vegan",
  vegetarian: "Vegetarian",
  glutenFree: "Gluten-free",
  dairyFree: "Dairy-free",
  nutFree: "Nut-free",
};

export const DIET_KEYS: DietKey[] = [
  "vegetarian",
  "vegan",
  "glutenFree",
  "dairyFree",
  "nutFree",
];

/**
 * Diet flags for one ref, which may be a `group:` ref.
 *
 * A group is only as permissive as its most permissive member: `group:milk`
 * counts as dairy-free because oat milk is in it and the cook can choose. But
 * `group:cured-pork` is never vegetarian, because nothing in it is.
 */
function flagsForRef(ref: string): DietFlags {
  if (ref.startsWith("group:")) {
    const members = GROUP_MEMBERS.get(ref.slice(6)) ?? [];
    const memberFlags = members
      .map((m) => getIngredient(m)?.diet)
      .filter((d): d is DietFlags => Boolean(d));

    if (memberFlags.length === 0) {
      return {
        vegan: true,
        vegetarian: true,
        glutenFree: true,
        dairyFree: true,
        nutFree: true,
      };
    }
    return {
      vegan: memberFlags.some((f) => f.vegan),
      vegetarian: memberFlags.some((f) => f.vegetarian),
      glutenFree: memberFlags.some((f) => f.glutenFree),
      dairyFree: memberFlags.some((f) => f.dairyFree),
      nutFree: memberFlags.some((f) => f.nutFree),
    };
  }

  return (
    getIngredient(ref)?.diet ?? {
      // Unknown ingredient: assume the worst so we never over-promise.
      vegan: false,
      vegetarian: false,
      glutenFree: false,
      dairyFree: false,
      nutFree: false,
    }
  );
}

/**
 * Derive a recipe's diet flags from its ingredients.
 *
 * Optional ingredients are ignored — a vegan pasta doesn't stop being vegan
 * because parmesan is listed as an optional finish. The UI notes this.
 */
export function recipeDiet(recipe: Recipe): DietFlags {
  const required = recipe.ingredients.filter((i) => !i.optional);
  return required.reduce<DietFlags>(
    (acc, ri) => {
      const f = flagsForRef(ri.ref);
      return {
        vegan: acc.vegan && f.vegan,
        vegetarian: acc.vegetarian && f.vegetarian,
        glutenFree: acc.glutenFree && f.glutenFree,
        dairyFree: acc.dairyFree && f.dairyFree,
        nutFree: acc.nutFree && f.nutFree,
      };
    },
    {
      vegan: true,
      vegetarian: true,
      glutenFree: true,
      dairyFree: true,
      nutFree: true,
    },
  );
}

/** Diet keys a recipe satisfies, for badges. */
export function recipeDietTags(recipe: Recipe): DietKey[] {
  const flags = recipeDiet(recipe);
  return DIET_KEYS.filter((k) => flags[k]);
}

/**
 * Hard filter: does this recipe clear every active restriction, and avoid
 * every explicitly-avoided ingredient?
 */
export function recipeSatisfiesDiet(recipe: Recipe, prefs: DietPrefs): boolean {
  const flags = recipeDiet(recipe);
  for (const key of prefs.restrictions) {
    if (!flags[key]) return false;
  }

  if (prefs.avoid.length > 0) {
    const avoid = new Set(prefs.avoid);
    for (const ri of recipe.ingredients) {
      // Avoidance applies to optional ingredients too — an allergen on the
      // plate is an allergen, garnish or not.
      if (avoid.has(ri.ref)) return false;
      if (ri.ref.startsWith("group:")) {
        const members = GROUP_MEMBERS.get(ri.ref.slice(6)) ?? [];
        // Only a problem if every option is off-limits; otherwise the cook
        // can simply pick a different member of the group.
        if (members.length > 0 && members.every((m) => avoid.has(m))) return false;
      }
    }
  }

  return true;
}

export const EMPTY_DIET: DietPrefs = { restrictions: [], avoid: [] };
