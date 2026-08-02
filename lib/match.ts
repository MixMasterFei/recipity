import { GROUP_MEMBERS, getIngredient } from "@/data/ingredients";
import { SUBSTITUTIONS } from "@/data/substitutions";
import type {
  IngredientId,
  IngredientMatch,
  MatchResult,
  MatchStatus,
  PantryItem,
  Recipe,
  RecipeIngredient,
} from "@/lib/types";
import { recipeSatisfiesDiet } from "@/lib/diet";
import { coverageRatio, isEnough, toAmount } from "@/lib/quantity";
import type { DietPrefs } from "@/lib/types";

/**
 * The matching engine.
 *
 * Everything the app does hangs off `matchPantry`: given what you own, score
 * every recipe by how much of it you can already make, and rank so the most
 * useful thing to cook tonight lands at the top.
 *
 * All functions here are pure and synchronous — cheap enough to re-run on
 * every keystroke behind a `useMemo`, and trivially unit-testable.
 */

/** Ingredients expiring within this many days earn the full rescue bonus. */
const URGENT_DAYS = 3;
/** ...and within this many, a smaller one. */
const SOON_DAYS = 7;

const SCORE = {
  /** Coverage is the dominant term: a recipe you can fully make wins. */
  coveragePerPoint: 100,
  /** Rescuing food about to go off is the app's whole reason for existing. */
  rescueUrgent: 8,
  rescueSoon: 4,
  /** Mild preference for recipes that clear more of the fridge. */
  perPantryItemUsed: 1.5,
  /** A real ingredient beats an improvised one. */
  substitutionPenalty: 3,
  /** Each shopping trip item hurts. */
  missingPenalty: 12,
  /**
   * Being short on an amount is a nudge, not a verdict.
   *
   * Deliberately tiny next to `missingPenalty`: having half the pasta is
   * nothing like having no pasta, and halving a recipe is normal cooking. This
   * only breaks ties between otherwise equal recipes.
   */
  shortPenalty: 2,
} as const;

export interface MatchOptions {
  /** Assumed-on-hand ids, excluded from the coverage maths entirely. */
  staples?: IngredientId[];
  diet?: DietPrefs;
  /** Injectable clock so expiry logic is testable. */
  now?: Date;
}

/** Substitution rules keyed by what they replace. */
const SUBS_BY_TARGET = (() => {
  const map = new Map<IngredientId, typeof SUBSTITUTIONS>();
  for (const sub of SUBSTITUTIONS) {
    const list = map.get(sub.target);
    if (list) list.push(sub);
    else map.set(sub.target, [sub]);
  }
  return map;
})();

/** Whole days from `now` until `iso`; negative when already past. */
export function daysUntil(iso: string, now: Date): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return Infinity;
  return Math.floor((then - now.getTime()) / 86_400_000);
}

/**
 * Resolve a recipe ingredient ref against the pantry.
 *
 * A ref may be a plain ingredient id or a `group:` ref, which any member of
 * that group satisfies — so a recipe calling for "any hard cheese" is happy
 * with the pecorino you actually own.
 */
function classify(
  ref: IngredientId,
  owned: Set<IngredientId>,
  staples: Set<IngredientId>,
): IngredientMatch {
  if (ref.startsWith("group:")) {
    const members = GROUP_MEMBERS.get(ref.slice(6)) ?? [];
    const ownedMember = members.find((m) => owned.has(m));
    if (ownedMember) {
      return { ref, kind: "group", satisfiedBy: [ownedMember] };
    }
    const stapleMember = members.find((m) => staples.has(m));
    if (stapleMember) {
      return { ref, kind: "staple", satisfiedBy: [stapleMember] };
    }
    return { ref, kind: "missing" };
  }

  if (owned.has(ref)) return { ref, kind: "have" };
  if (staples.has(ref)) return { ref, kind: "staple" };

  // Does anything we own belong to a group this ingredient also belongs to?
  // Covers "recipe wants parmesan, you have pecorino".
  const ing = getIngredient(ref);
  for (const group of ing?.groups ?? []) {
    const members = GROUP_MEMBERS.get(group) ?? [];
    const swap = members.find((m) => m !== ref && owned.has(m));
    if (swap) return { ref, kind: "group", satisfiedBy: [swap] };
  }

  // Last resort: an explicit substitution rule, all of whose inputs we have.
  for (const sub of SUBS_BY_TARGET.get(ref) ?? []) {
    const satisfied = sub.requires.every((r) => owned.has(r) || staples.has(r));
    if (satisfied) {
      return {
        ref,
        kind: "sub",
        satisfiedBy: sub.requires,
        substitutionNote: sub.note,
      };
    }
  }

  return { ref, kind: "missing" };
}

/** Ingredients that actually gate the recipe (optional ones never do). */
function requiredOf(recipe: Recipe): RecipeIngredient[] {
  return recipe.ingredients.filter((i) => !i.optional);
}

/**
 * Score one recipe against one pantry.
 *
 * Coverage deliberately excludes staples from *both* sides of the fraction:
 * counting salt and olive oil as wins would push every three-ingredient pasta
 * to 100% and make the ranking meaningless.
 */
export function scoreRecipe(
  recipe: Recipe,
  pantry: PantryItem[],
  options: MatchOptions = {},
): MatchResult {
  const now = options.now ?? new Date();
  const staples = new Set(options.staples ?? []);
  const owned = new Set(pantry.map((p) => p.ingredientId));
  const expiryById = new Map(
    pantry.filter((p) => p.expiresAt).map((p) => [p.ingredientId, p.expiresAt!]),
  );

  const matches = recipe.ingredients.map((ri) =>
    classify(ri.ref, owned, staples),
  );

  const requiredRefs = new Set(requiredOf(recipe).map((i) => i.ref));
  const requiredMatches = matches.filter((m) => requiredRefs.has(m.ref));

  // Staples are invisible to the coverage fraction.
  const counted = requiredMatches.filter((m) => m.kind !== "staple");
  const satisfied = counted.filter((m) => m.kind !== "missing");
  const coverage = counted.length === 0 ? 1 : satisfied.length / counted.length;

  const missing = counted.filter((m) => m.kind === "missing").map((m) => m.ref);
  const subCount = requiredMatches.filter((m) => m.kind === "sub").length;

  // Which pantry items does this recipe actually consume? Includes optional
  // ingredients — using up your wilting cilantro as a garnish still counts.
  const uses = new Set<IngredientId>();
  for (const m of matches) {
    if (m.kind === "missing") continue;
    if (owned.has(m.ref)) uses.add(m.ref);
    for (const s of m.satisfiedBy ?? []) if (owned.has(s)) uses.add(s);
  }

  const rescues: IngredientId[] = [];
  let rescueBonus = 0;
  for (const id of uses) {
    const expiry = expiryById.get(id);
    if (!expiry) continue;
    const days = daysUntil(expiry, now);
    if (days <= URGENT_DAYS) {
      rescueBonus += SCORE.rescueUrgent;
      rescues.push(id);
    } else if (days <= SOON_DAYS) {
      rescueBonus += SCORE.rescueSoon;
      rescues.push(id);
    }
  }

  /**
   * How far the amounts you entered actually stretch.
   *
   * Only ingredients you genuinely hold, where both sides carry a comparable
   * amount, have anything to say. Everything else is silent — an unmeasured
   * fridge behaves exactly as it did before amounts existed, which is the
   * whole point: entering amounts must stay optional.
   */
  const pantryById = new Map(pantry.map((p) => [p.ingredientId, p]));
  const short: IngredientId[] = [];
  let tightestRatio = Infinity;

  for (const ri of requiredOf(recipe)) {
    const match = matches.find((m) => m.ref === ri.ref);
    // Only direct hits: a group or substitute match means you're cooking with
    // something else, so the recipe's amount doesn't describe what you hold.
    if (match?.kind !== "have") continue;

    const held = pantryById.get(ri.ref);
    if (!held) continue;

    const ratio = coverageRatio(
      toAmount(held.quantity, held.unit),
      toAmount(ri.quantity, ri.unit),
    );
    if (ratio === null) continue;

    tightestRatio = Math.min(tightestRatio, ratio);
    if (!isEnough(ratio)) short.push(ri.ref);
  }

  // The scarcest ingredient sets the portions. Always at least one serving —
  // running low means a smaller plate, never an impossible dish.
  const servingsPossible =
    tightestRatio === Infinity || tightestRatio >= 1
      ? recipe.servings
      : Math.max(1, Math.floor(recipe.servings * tightestRatio));

  const score =
    coverage * SCORE.coveragePerPoint +
    rescueBonus +
    uses.size * SCORE.perPantryItemUsed -
    subCount * SCORE.substitutionPenalty -
    missing.length * SCORE.missingPenalty -
    short.length * SCORE.shortPenalty;

  return {
    recipe,
    coverage,
    status: statusFor(missing.length),
    score,
    matches,
    missing,
    uses: [...uses],
    rescues,
    servingsPossible,
    short,
  };
}

export function statusFor(missingCount: number): MatchStatus {
  if (missingCount === 0) return "ready";
  if (missingCount <= 2) return "almost";
  return "stretch";
}

/**
 * Score and rank a whole recipe list.
 *
 * Diet restrictions are a hard filter, not a penalty — someone who can't eat
 * gluten should never see a recipe they'd have to scroll past.
 */
export function matchPantry(
  recipes: Recipe[],
  pantry: PantryItem[],
  options: MatchOptions = {},
): MatchResult[] {
  const diet = options.diet;
  const eligible = diet
    ? recipes.filter((r) => recipeSatisfiesDiet(r, diet))
    : recipes;

  return eligible
    .map((r) => scoreRecipe(r, pantry, options))
    .sort(
      (a, b) =>
        b.score - a.score ||
        totalTime(a.recipe) - totalTime(b.recipe) ||
        a.recipe.title.localeCompare(b.recipe.title),
    );
}

export function totalTime(recipe: Recipe): number {
  return recipe.prepMin + recipe.cookMin;
}

/** Split ranked results into the three tiers the UI renders as sections. */
export function groupByStatus(results: MatchResult[]): {
  ready: MatchResult[];
  almost: MatchResult[];
  stretch: MatchResult[];
} {
  return {
    ready: results.filter((r) => r.status === "ready"),
    almost: results.filter((r) => r.status === "almost"),
    stretch: results.filter((r) => r.status === "stretch"),
  };
}

/** Pantry items at or past their use-by date, soonest first. */
export function expiringItems(
  pantry: PantryItem[],
  now: Date = new Date(),
  withinDays: number = SOON_DAYS,
): { item: PantryItem; days: number }[] {
  return pantry
    .filter((p) => p.expiresAt)
    .map((item) => ({ item, days: daysUntil(item.expiresAt!, now) }))
    .filter((e) => e.days <= withinDays)
    .sort((a, b) => a.days - b.days);
}
