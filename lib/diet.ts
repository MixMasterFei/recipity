import { GROUP_MEMBERS, getIngredient } from "@/data/ingredients";
import type {
  DietFlags,
  DietKey,
  DietPrefs,
  IngredientId,
  Recipe,
} from "@/lib/types";

/**
 * Dietary classification.
 *
 * Recipe diet tags are *derived* from ingredient flags rather than hand-written
 * per recipe. That's the whole point: a recipe listing butter can never be
 * mislabelled vegan, no matter how the recipe data is edited later.
 *
 * Two different questions are answered here and they must not be confused:
 *
 *   "Can this recipe be cooked within these rules?"  — `recipeSatisfiesDiet`.
 *   A recipe asking for "any milk" can, because oat milk exists.
 *
 *   "May this particular ingredient go in the pot?"   — `dietGate`.
 *   Cow's milk may not, however many recipes accept "any milk".
 *
 * The matching engine asks the second question about everything in the fridge,
 * which is what stops a dairy-free recipe being declared ready on the strength
 * of the cheddar.
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

const ALL_TRUE: DietFlags = {
  vegan: true,
  vegetarian: true,
  glutenFree: true,
  dairyFree: true,
  nutFree: true,
};

/** Unknown ingredient or empty group: assume the worst so we never over-promise. */
const ALL_FALSE: DietFlags = {
  vegan: false,
  vegetarian: false,
  glutenFree: false,
  dairyFree: false,
  nutFree: false,
};

function groupMembers(ref: string): IngredientId[] {
  return GROUP_MEMBERS.get(ref.slice(6)) ?? [];
}

/**
 * Diet flags for one ref, which may be a `group:` ref.
 *
 * With `mode: "any"` a group is as permissive as its most permissive member:
 * `group:milk` counts as dairy-free because oat milk is in it and the cook can
 * choose. With `mode: "every"` it is only as permissive as its *least*
 * permissive member — true whatever the cook reaches for. `group:cured-pork`
 * is never vegetarian in either mode, because nothing in it is.
 */
function flagsForRef(ref: string, mode: "any" | "every" = "any"): DietFlags {
  if (ref.startsWith("group:")) {
    const memberFlags = groupMembers(ref)
      .map((m) => getIngredient(m)?.diet)
      .filter((d): d is DietFlags => Boolean(d));

    if (memberFlags.length === 0) return ALL_FALSE;

    const holds = (key: DietKey) =>
      mode === "any"
        ? memberFlags.some((f) => f[key])
        : memberFlags.every((f) => f[key]);

    return {
      vegan: holds("vegan"),
      vegetarian: holds("vegetarian"),
      glutenFree: holds("glutenFree"),
      dairyFree: holds("dairyFree"),
      nutFree: holds("nutFree"),
    };
  }

  return getIngredient(ref)?.diet ?? ALL_FALSE;
}

/**
 * Diet flags for a single ref, read the way a recipe reads them: a group is
 * as permissive as its most permissive member.
 */
export function dietFlagsFor(ref: string): DietFlags {
  return flagsForRef(ref, "any");
}

function combine(recipe: Recipe, mode: "any" | "every"): DietFlags {
  // Asking what a recipe *can* be, optional ingredients are ignored — a vegan
  // pasta doesn't stop being vegan-able because parmesan is listed as an
  // optional finish. Asking what it is *whatever you do*, they count: add the
  // parmesan and it isn't.
  const counted =
    mode === "any"
      ? recipe.ingredients.filter((i) => !i.optional)
      : recipe.ingredients;
  return counted.reduce<DietFlags>((acc, ri) => {
    const f = flagsForRef(ri.ref, mode);
    return {
      vegan: acc.vegan && f.vegan,
      vegetarian: acc.vegetarian && f.vegetarian,
      glutenFree: acc.glutenFree && f.glutenFree,
      dairyFree: acc.dairyFree && f.dairyFree,
      nutFree: acc.nutFree && f.nutFree,
    };
  }, ALL_TRUE);
}

/**
 * Derive a recipe's diet flags from its ingredients: can it be cooked this
 * way, given a free choice wherever it says "any …"?
 */
export function recipeDiet(recipe: Recipe): DietFlags {
  return combine(recipe, "any");
}

/** Diet keys a recipe can satisfy. */
export function recipeDietTags(recipe: Recipe): DietKey[] {
  const flags = recipeDiet(recipe);
  return DIET_KEYS.filter((k) => flags[k]);
}

export interface DietBadge {
  key: DietKey;
  /**
   * True when the label holds whatever the cook does. False when it depends
   * on a choice — picking the right member of a group (porridge is vegan with
   * oat milk and isn't with cow's) or leaving out an optional ingredient (the
   * peanuts scattered on top) — so the UI can say "can be vegan" instead of
   * asserting it.
   */
  certain: boolean;
}

/** Badges for a recipe, each marked as unconditional or dependent on a choice. */
export function recipeDietBadges(recipe: Recipe): DietBadge[] {
  const possible = combine(recipe, "any");
  const always = combine(recipe, "every");
  return DIET_KEYS.filter((k) => possible[k]).map((key) => ({
    key,
    certain: always[key],
  }));
}

/* ------------------------------------------------------------------ */
/* Per-ingredient gate                                                 */
/* ------------------------------------------------------------------ */

/** Answers "may this ingredient be used under the active eating rules?". */
export type DietGate = ((id: IngredientId) => boolean) & {
  /** False when no rule is set, so callers can skip diet-only work. */
  active: boolean;
};

const ALLOW_ALL: DietGate = Object.assign(() => true, { active: false });

/** One gate per prefs object: the engine asks for it once per recipe scored. */
const GATES = new WeakMap<DietPrefs, DietGate>();

/**
 * Build the per-ingredient test for a set of eating rules.
 *
 * An ingredient passes when it clears every active restriction and isn't on
 * the avoid list. Anything not in the catalogue fails as soon as a restriction
 * is active — we can't vouch for what we can't identify.
 */
export function dietGate(prefs: DietPrefs | undefined): DietGate {
  if (!prefs) return ALLOW_ALL;
  if (prefs.restrictions.length === 0 && prefs.avoid.length === 0) {
    return ALLOW_ALL;
  }

  const cached = GATES.get(prefs);
  if (cached) return cached;

  const avoid = new Set(prefs.avoid);
  const restrictions = [...prefs.restrictions];
  const memo = new Map<IngredientId, boolean>();

  const gate: DietGate = Object.assign(
    (id: IngredientId) => {
      const known = memo.get(id);
      if (known !== undefined) return known;
      const flags = getIngredient(id)?.diet ?? ALL_FALSE;
      const ok = !avoid.has(id) && restrictions.every((key) => flags[key]);
      memo.set(id, ok);
      return ok;
    },
    { active: true },
  );

  GATES.set(prefs, gate);
  return gate;
}

/**
 * The members of a group the eating rules leave open. Empty when the ref is
 * not a group. Used to tell someone *which* milk "any milk" means for them.
 */
export function allowedGroupMembers(
  ref: string,
  prefs: DietPrefs | undefined,
): IngredientId[] {
  if (!ref.startsWith("group:")) return [];
  const gate = dietGate(prefs);
  return groupMembers(ref).filter((m) => gate(m));
}

/**
 * Does the ref itself fall outside the rules, so that nothing could satisfy
 * it? True for a forbidden ingredient, or a group with no permitted member.
 */
export function refRuledOut(ref: string, gate: DietGate): boolean {
  if (!gate.active) return false;
  if (ref.startsWith("group:")) {
    const members = groupMembers(ref);
    return members.length === 0 || members.every((m) => !gate(m));
  }
  return !gate(ref);
}

/* ------------------------------------------------------------------ */
/* Per-recipe verdict                                                  */
/* ------------------------------------------------------------------ */

export interface DietIssue {
  /** The rule that is broken: a restriction, or the explicit avoid list. */
  rule: DietKey | "avoid";
  /** The ingredient that breaks it. */
  ref: IngredientId;
  /**
   * False when the ingredient isn't in the catalogue. The rule is then
   * unverifiable rather than known to be broken — which still counts against
   * the recipe, but is worth wording differently.
   */
  known: boolean;
}

function findIssues(
  recipe: Recipe,
  prefs: DietPrefs,
  stopAtFirst: boolean,
): DietIssue[] {
  const issues: DietIssue[] = [];
  const avoid = new Set(prefs.avoid);

  for (const ri of recipe.ingredients) {
    const isGroup = ri.ref.startsWith("group:");
    const members = isGroup ? groupMembers(ri.ref) : [];

    if (avoid.size > 0) {
      // Avoidance applies to optional ingredients too — an allergen on the
      // plate is an allergen, garnish or not. A group is only a problem if
      // every option is off-limits; otherwise the cook picks another member.
      const avoided = isGroup
        ? members.length > 0 && members.every((m) => avoid.has(m))
        : avoid.has(ri.ref);
      if (avoided) {
        issues.push({ rule: "avoid", ref: ri.ref, known: true });
        if (stopAtFirst) return issues;
      }
    }

    if (ri.optional || prefs.restrictions.length === 0) continue;

    const flags = flagsForRef(ri.ref);
    const known = isGroup
      ? members.length > 0
      : getIngredient(ri.ref) !== undefined;

    for (const key of prefs.restrictions) {
      if (flags[key]) continue;
      issues.push({ rule: key, ref: ri.ref, known });
      if (stopAtFirst) return issues;
    }
  }

  return issues;
}

/** Every way a recipe breaks the eating rules, for explaining it to someone. */
export function dietIssues(recipe: Recipe, prefs: DietPrefs): DietIssue[] {
  return findIssues(recipe, prefs, false);
}

/**
 * Hard filter: can this recipe be cooked while clearing every active
 * restriction and avoiding every explicitly-avoided ingredient?
 */
export function recipeSatisfiesDiet(recipe: Recipe, prefs: DietPrefs): boolean {
  return findIssues(recipe, prefs, true).length === 0;
}

export const EMPTY_DIET: DietPrefs = { restrictions: [], avoid: [] };
