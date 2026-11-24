/**
 * Core domain types for Recipity.
 *
 * The whole app is built around one idea: every ingredient — whether it came
 * from a recipe, the user's pantry, or a Claude-generated suggestion — is
 * resolved to a single canonical `IngredientId`. Once everything speaks the
 * same vocabulary, matching is just set arithmetic.
 */

export type IngredientId = string;
export type RecipeId = string;

/** Where an ingredient lives in a shop, used to group the shopping list. */
export type Aisle =
  | "produce"
  | "meat"
  | "seafood"
  | "dairy"
  | "bakery"
  | "frozen"
  | "pantry"
  | "baking"
  | "spices"
  | "condiments"
  | "drinks";

/** Broad kind, used for category-level matching ("any hard cheese"). */
export type IngredientCategory =
  | "vegetable"
  | "fruit"
  | "herb"
  | "spice"
  | "grain"
  | "pasta"
  | "legume"
  | "meat"
  | "poultry"
  | "seafood"
  | "dairy"
  | "cheese"
  | "egg"
  | "nut"
  | "oil"
  | "vinegar"
  | "sauce"
  | "sweetener"
  | "baking"
  | "stock"
  | "alcohol"
  | "other";

/**
 * Dietary properties of a single ingredient.
 *
 * Recipe-level diet tags are *derived* from these rather than hand-written, so
 * a recipe can never claim to be vegan while listing butter. See `lib/diet.ts`.
 */
export interface DietFlags {
  vegan: boolean;
  vegetarian: boolean;
  glutenFree: boolean;
  dairyFree: boolean;
  nutFree: boolean;
}

export interface Ingredient {
  id: IngredientId;
  name: string;
  /** Alternate names users might type: "scallion" ~ "green onion" ~ "spring onion". */
  aliases: string[];
  category: IngredientCategory;
  aisle: Aisle;
  diet: DietFlags;
  /**
   * Groups this ingredient can stand in for. A recipe asking for the group
   * `hard-cheese` is satisfied by any member. Keeps recipes from being
   * needlessly picky about which brand of parmesan you own.
   */
  groups?: string[];
  /** True for things nearly every kitchen has; seeds the default staples set. */
  staple?: boolean;
  emoji?: string;
}

export type Unit =
  | "g"
  | "kg"
  | "ml"
  | "l"
  | "tsp"
  | "tbsp"
  | "cup"
  | "piece"
  | "clove"
  | "slice"
  | "pinch"
  | "handful"
  | "can"
  | "bunch"
  | "to taste";

export interface RecipeIngredient {
  /** Canonical ingredient id, or a `group:` prefixed group id. */
  ref: IngredientId;
  quantity?: number;
  unit?: Unit;
  /** Preparation note shown next to the ingredient: "finely diced". */
  note?: string;
  /** Optional ingredients never block a match (garnishes, "to serve"). */
  optional?: boolean;
}

export type Difficulty = "easy" | "medium" | "hard";

export interface Recipe {
  id: RecipeId;
  slug: string;
  title: string;
  description: string;
  cuisine: string;
  tags: string[];
  servings: number;
  prepMin: number;
  cookMin: number;
  difficulty: Difficulty;
  ingredients: RecipeIngredient[];
  steps: string[];
  tips?: string[];
  /** Present only on recipes invented by Claude, so the UI can badge them. */
  generated?: boolean;
}

/* ------------------------------------------------------------------ */
/* User state                                                          */
/* ------------------------------------------------------------------ */

export interface PantryItem {
  ingredientId: IngredientId;
  quantity?: number;
  unit?: Unit;
  /** ISO date string. */
  addedAt: string;
  /** ISO date string; drives the "use this up" ranking bonus. */
  expiresAt?: string;
  /**
   * ISO time of the last add or edit, used by sync to tell an edit from a
   * stale copy. Absent on items saved before sync kept stamps — `addedAt`
   * stands in for it.
   */
  updatedAt?: string;
}

export interface ShoppingItem {
  ingredientId: IngredientId;
  /** Recipes that put this on the list, so we can explain why it's there. */
  forRecipes: RecipeId[];
  checked: boolean;
  addedAt: string;
  /** ISO time of the last change; see `PantryItem.updatedAt`. */
  updatedAt?: string;
}

export interface CookEvent {
  recipeId: RecipeId;
  cookedAt: string;
}

export type DietKey = keyof DietFlags;

export interface DietPrefs {
  /** Active dietary restrictions; a recipe must satisfy every one of these. */
  restrictions: DietKey[];
  /** Ingredients to exclude outright, regardless of diet flags. */
  avoid: IngredientId[];
}

/** ISO timestamps keyed by ingredient or recipe id. */
export type StampMap = Record<string, string>;

/**
 * Sync bookkeeping.
 *
 * Two devices can only agree on what was *deleted* if deletions are recorded:
 * a missing entry is otherwise indistinguishable from one the other device
 * never had, and merging would bring it straight back. So every removal leaves
 * a dated marker here, and every member of a plain id-set (favourites,
 * staples, diet) records when it was added. The later of the two wins.
 *
 * See `lib/merge.ts` for how these are read and `lib/state.ts` for how they
 * are written.
 */
export interface SyncMeta {
  /** When each member of an id-set was last added. */
  added: {
    favorites: StampMap;
    staples: StampMap;
    restrictions: StampMap;
    avoid: StampMap;
  };
  /** When a key was last removed from each collection. */
  removed: {
    pantry: StampMap;
    shoppingList: StampMap;
    invented: StampMap;
    favorites: StampMap;
    staples: StampMap;
    restrictions: StampMap;
    avoid: StampMap;
  };
}

export interface RecipityState {
  schemaVersion: number;
  /** ISO timestamp of the last local change. */
  updatedAt: string;
  pantry: PantryItem[];
  /** Ingredients assumed always on hand; excluded from match maths. */
  staples: IngredientId[];
  favorites: RecipeId[];
  history: CookEvent[];
  shoppingList: ShoppingItem[];
  diet: DietPrefs;
  /** Recipes invented by Claude, kept so they survive a refresh. */
  invented: Recipe[];
  /** Add and removal stamps that let two devices merge without guessing. */
  sync: SyncMeta;
}

/* ------------------------------------------------------------------ */
/* Matching                                                            */
/* ------------------------------------------------------------------ */

/**
 * How a single required ingredient was satisfied (or not).
 *
 * - `have`    — you own exactly this
 * - `group`   — you own something that counts (recipe wanted "any hard cheese")
 * - `sub`     — a substitution rule fired (no buttermilk, but milk + lemon)
 * - `staple`  — assumed on hand; excluded from the coverage maths entirely
 * - `missing` — you need to buy it
 */
export type MatchKind = "have" | "group" | "sub" | "staple" | "missing";

export interface IngredientMatch {
  ref: IngredientId;
  kind: MatchKind;
  /** What in the pantry satisfied this, when it wasn't a direct hit. */
  satisfiedBy?: IngredientId[];
  /** Human-readable substitution instruction, e.g. "1 cup milk + 1 tbsp lemon". */
  substitutionNote?: string;
  /**
   * True when the active eating rules forbid this ingredient outright, so
   * owning it would not help. Only ever set on optional ingredients — a
   * required one would have filtered the whole recipe out.
   */
  ruledOut?: boolean;
}

export type MatchStatus = "ready" | "almost" | "stretch";

export interface MatchResult {
  recipe: Recipe;
  /** 0–1, staples excluded from both numerator and denominator. */
  coverage: number;
  status: MatchStatus;
  score: number;
  matches: IngredientMatch[];
  missing: IngredientId[];
  /** Pantry ingredients this recipe would use up. */
  uses: IngredientId[];
  /** Pantry items nearing expiry that this recipe would rescue. */
  rescues: IngredientId[];
  /**
   * How many servings the amounts in your fridge actually stretch to.
   *
   * Equals `recipe.servings` unless you've entered amounts *and* one of them
   * falls short. Never zero — running low means smaller portions, not an
   * impossible dish.
   */
  servingsPossible: number;
  /** Ingredients you have, but less of than the recipe asks for. */
  short: IngredientId[];
}

/** A rule for making do without something. */
export interface Substitution {
  /** The ingredient you don't have. */
  target: IngredientId;
  /** Everything you need on hand for this substitution to work. */
  requires: IngredientId[];
  /** Shown to the user: "1 cup milk + 1 tbsp lemon juice, rest 5 min". */
  note: string;
}
