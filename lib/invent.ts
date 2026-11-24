import { getIngredient, ingredientName } from "@/data/ingredients";
import { DIET_LABELS, dietIssues } from "@/lib/diet";
import { resolveIngredient } from "@/lib/normalize";
import type {
  DietKey,
  IngredientId,
  Recipe,
  RecipeIngredient,
  Unit,
} from "@/lib/types";

/**
 * The parts of recipe invention that don't touch the network: reading the
 * request, writing the prompt, and turning the model's answer into a `Recipe`.
 *
 * Kept apart from `app/api/invent/route.ts` so they can be tested, and because
 * both ends are untrusted. The request comes from anyone who can reach the
 * URL, and the answer comes from a model — each is checked here before it is
 * allowed to cost money or land in someone's saved recipes.
 */

export const INVENT_LIMITS = {
  /** Largest request body read at all. A full fridge is a few kilobytes. */
  maxBodyChars: 16 * 1024,
  /** Ingredients passed to the model. Nobody cooks from more. */
  maxPantry: 80,
  maxAvoid: 50,
  /** The "what do you feel like" box. A mood, not an essay. */
  maxMoodChars: 200,
  maxIngredients: 30,
  maxSteps: 20,
  maxTips: 3,
} as const;

export const VALID_UNITS: Unit[] = [
  "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "piece", "clove",
  "slice", "pinch", "handful", "can", "bunch", "to taste",
];

export interface InventInput {
  pantryIds: IngredientId[];
  restrictions: DietKey[];
  avoid: IngredientId[];
  mood?: string;
}

export type ParsedInvent =
  | { ok: true; input: InventInput }
  | { ok: false; error: string };

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string");
}

/**
 * Validate a request body.
 *
 * Everything is narrowed to what the catalogue knows: ingredient ids that
 * aren't real are dropped rather than forwarded, so nothing in the prompt is
 * free text except the mood, and that is length-capped and flattened to one
 * line.
 */
export function parseInventRequest(body: unknown): ParsedInvent {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Invalid request body." };
  }
  const data = body as Record<string, unknown>;

  const pantryIds = [...new Set(stringList(data.pantryIds))]
    .filter((id) => getIngredient(id))
    .slice(0, INVENT_LIMITS.maxPantry);
  if (pantryIds.length < 2) {
    return {
      ok: false,
      error: "Add at least two ingredients to your kitchen first.",
    };
  }

  const restrictions = [...new Set(stringList(data.restrictions))].filter(
    (r): r is DietKey => Object.hasOwn(DIET_LABELS, r),
  );

  const avoid = [...new Set(stringList(data.avoid))]
    .filter((id) => getIngredient(id))
    .slice(0, INVENT_LIMITS.maxAvoid);

  const mood =
    typeof data.mood === "string"
      ? data.mood
          // Control characters and line breaks would let the box impersonate
          // further lines of the prompt.
          .replace(/[\u0000-\u001f\u007f]+/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, INVENT_LIMITS.maxMoodChars)
      : "";

  return {
    ok: true,
    input: { pantryIds, restrictions, avoid, mood: mood || undefined },
  };
}

/** The user turn sent to the model. */
export function buildInventPrompt(input: InventInput): string {
  return [
    `In my kitchen: ${input.pantryIds.map(ingredientName).join(", ")}.`,
    input.restrictions.length > 0
      ? `Dietary restrictions (hard constraints): ${input.restrictions
          .map((r) => DIET_LABELS[r])
          .join(", ")}.`
      : null,
    input.avoid.length > 0
      ? `Never use (hard constraint): ${input.avoid
          .map(ingredientName)
          .join(", ")}.`
      : null,
    input.mood ? `What I feel like: ${input.mood}` : null,
    "Invent one recipe for me and publish it with publish_recipe.",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ------------------------------------------------------------------ */
/* Model output -> Recipe                                              */
/* ------------------------------------------------------------------ */

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function clamp(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "recipe"
  );
}

/**
 * A name the catalogue doesn't know, kept as the ref so it still displays.
 *
 * It must never look like a `group:` ref: those are trusted to have members,
 * and one invented by a model would be a group nothing can satisfy.
 */
function rawRef(name: string): string {
  return name.toLowerCase().replace(/^(group\s*:\s*)+/, "").trim();
}

/**
 * Map the model's output onto our `Recipe` type.
 *
 * The important step is resolving each free-text ingredient name back to a
 * canonical id. Anything unrecognised keeps its raw text as the ref — it still
 * displays correctly, counts as missing, and fails every diet check, which is
 * the honest answer for something we can't identify.
 *
 * Nothing in here trusts the shape of `input`: a model can return a string
 * where an array was asked for, and this must not throw on it.
 */
export function toRecipe(input: unknown, now: number = Date.now()): Recipe {
  const raw = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  const title = text(raw.title, 120) || "Invented recipe";

  const seen = new Set<string>();
  const ingredients: RecipeIngredient[] = [];
  for (const entry of Array.isArray(raw.ingredients) ? raw.ingredients : []) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const name = text(item.name, 80);
    if (!name) continue;

    const ref = resolveIngredient(name) ?? rawRef(name);
    // The same ingredient listed twice would show as two lines and could
    // disagree about being optional. First mention wins.
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);

    ingredients.push({
      ref,
      quantity:
        typeof item.quantity === "number" &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
          ? item.quantity
          : undefined,
      unit: VALID_UNITS.includes(item.unit as Unit)
        ? (item.unit as Unit)
        : undefined,
      note: text(item.note, 120) || undefined,
      optional: item.optional === true,
    });
    if (ingredients.length >= INVENT_LIMITS.maxIngredients) break;
  }

  const lines = (value: unknown, max: number, limit: number) =>
    (Array.isArray(value) ? value : [])
      .map((line) => text(line, max))
      .filter(Boolean)
      .slice(0, limit);

  const difficulty =
    raw.difficulty === "medium" || raw.difficulty === "hard"
      ? raw.difficulty
      : "easy";

  // Slug is time-stamped so re-inventing never collides with a saved recipe.
  const slug = `invented-${slugify(title)}-${now.toString(36)}`;

  return {
    id: slug,
    slug,
    title,
    description: text(raw.description, 400),
    cuisine: text(raw.cuisine, 40) || "Invented",
    tags: lines(raw.tags, 30, 6),
    servings: clamp(raw.servings, 1, 12, 2),
    prepMin: clamp(raw.prepMin, 0, 240, 10),
    cookMin: clamp(raw.cookMin, 0, 480, 20),
    difficulty,
    ingredients,
    steps: lines(raw.steps, 600, INVENT_LIMITS.maxSteps),
    tips: lines(raw.tips, 300, INVENT_LIMITS.maxTips),
    generated: true,
  };
}

/**
 * Is this worth handing back? Returns a message for the user if not.
 *
 * The model is told the restrictions are hard constraints, but "told" isn't
 * "guaranteed" — so anything it used that we can positively identify as
 * breaking them is refused here rather than saved. Ingredients we couldn't
 * identify are let through: the recipe page flags those as unconfirmed, and
 * refusing every recipe with one unknown word would make the feature useless
 * to exactly the people with restrictions.
 */
export function checkInvented(
  recipe: Recipe,
  input: Pick<InventInput, "restrictions" | "avoid">,
): string | null {
  const required = recipe.ingredients.filter((ri) => !ri.optional);
  if (required.length < 2 || recipe.steps.length < 2) {
    return "The model didn't return a usable recipe. Try again.";
  }

  const broken = dietIssues(recipe, input).filter((issue) => issue.known);
  if (broken.length > 0) {
    const names = [...new Set(broken.map((issue) => ingredientName(issue.ref)))]
      .map((name) => name.toLowerCase())
      .join(", ");
    return `That one used ${names}, which breaks your eating rules. Try again.`;
  }

  return null;
}
