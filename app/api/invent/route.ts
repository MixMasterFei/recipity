import { NextResponse } from "next/server";
import { getIngredient, ingredientName } from "@/data/ingredients";
import { resolveIngredient } from "@/lib/normalize";
import { DIET_LABELS } from "@/lib/diet";
import type { DietKey, Recipe, RecipeIngredient, Unit } from "@/lib/types";

/**
 * Invent a recipe from exactly what the user has.
 *
 * Claude returns a structured recipe via a forced tool call, and every
 * ingredient name it produces is put back through `resolveIngredient` so the
 * result speaks the same canonical vocabulary as the bundled library. That's
 * what lets an invented recipe participate in matching, the shopping list and
 * favourites like any other.
 *
 * With no ANTHROPIC_API_KEY set this route reports itself disabled and the UI
 * hides the feature. Nothing else in the app depends on it.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

/** Long enough for a full recipe, short enough to stay inside Vercel limits. */
export const maxDuration = 60;

const VALID_UNITS: Unit[] = [
  "g", "kg", "ml", "l", "tsp", "tbsp", "cup", "piece", "clove",
  "slice", "pinch", "handful", "can", "bunch", "to taste",
];

/** Tool schema Claude must fill in. Mirrors the `Recipe` type. */
const RECIPE_TOOL = {
  name: "publish_recipe",
  description:
    "Publish the invented recipe. Call this exactly once with the complete recipe.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "Short, appetising dish name." },
      description: {
        type: "string",
        description:
          "One or two sentences. Say what makes it good or what technique matters. No marketing language.",
      },
      cuisine: { type: "string", description: "e.g. Italian, Thai, Modern." },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "3-5 lowercase tags, e.g. quick, one-pot, vegetarian.",
      },
      servings: { type: "integer", minimum: 1, maximum: 12 },
      prepMin: { type: "integer", minimum: 0, maximum: 240 },
      cookMin: { type: "integer", minimum: 0, maximum: 480 },
      difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
      ingredients: {
        type: "array",
        minItems: 3,
        items: {
          type: "object",
          properties: {
            name: {
              type: "string",
              description:
                "Plain ingredient name only, no quantity. e.g. 'chicken thigh', 'soy sauce'.",
            },
            quantity: { type: "number" },
            unit: { type: "string", enum: VALID_UNITS },
            note: {
              type: "string",
              description: "Prep note, e.g. 'finely diced'. Optional.",
            },
            optional: {
              type: "boolean",
              description: "True for garnishes and anything non-essential.",
            },
          },
          required: ["name"],
        },
      },
      steps: {
        type: "array",
        minItems: 3,
        items: { type: "string" },
        description:
          "Numbered method. Each step one clear action, with times and temperatures.",
      },
      tips: {
        type: "array",
        items: { type: "string" },
        description: "Up to two genuinely useful tips. Optional.",
      },
    },
    required: [
      "title", "description", "cuisine", "tags", "servings",
      "prepMin", "cookMin", "difficulty", "ingredients", "steps",
    ],
  },
} as const;

const SYSTEM_PROMPT = `You are a working cook writing a recipe for someone who has told you exactly what is in their kitchen.

Rules:
- Build the recipe around the ingredients they actually have. Use as many as make sense together — but do not force incompatible things into one dish.
- You may require at most TWO ingredients they do not have, and only if they are common (an onion, a lemon, stock). Prefer requiring none.
- Assume basic seasoning (salt, pepper, oil, water) is always available.
- Respect every dietary restriction absolutely. A restriction is a hard constraint, not a preference.
- Write real quantities and real timings. "Cook until done" is useless.
- Method steps should each be one action, in order, with the sensory cue that tells you it worked ("until the edges are lacy and dark").
- Write plainly. No adjective stacking, no "delicious", no "elevate", no "burst of flavour".

Call publish_recipe exactly once.`;

interface InventRequest {
  pantryIds?: string[];
  restrictions?: DietKey[];
  mood?: string;
}

export async function GET() {
  // The client asks this on mount to decide whether to show the feature.
  return NextResponse.json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) });
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Recipe invention is switched off. Add an ANTHROPIC_API_KEY environment variable and redeploy to enable it.",
      },
      { status: 503 },
    );
  }

  let body: InventRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pantryIds = (body.pantryIds ?? []).filter((id) => getIngredient(id));
  if (pantryIds.length < 2) {
    return NextResponse.json(
      { error: "Add at least two ingredients to your kitchen first." },
      { status: 400 },
    );
  }

  const restrictions = (body.restrictions ?? []).filter(
    (r): r is DietKey => r in DIET_LABELS,
  );

  const prompt = [
    `In my kitchen: ${pantryIds.map(ingredientName).join(", ")}.`,
    restrictions.length > 0
      ? `Dietary restrictions (hard constraints): ${restrictions
          .map((r) => DIET_LABELS[r])
          .join(", ")}.`
      : null,
    body.mood?.trim() ? `What I feel like: ${body.mood.trim()}` : null,
    "Invent one recipe for me.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        tools: [RECIPE_TOOL],
        tool_choice: { type: "tool", name: RECIPE_TOOL.name },
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Anthropic API error", response.status, detail);
      return NextResponse.json(
        {
          error:
            response.status === 401
              ? "The configured API key was rejected."
              : "Couldn't reach the recipe model. Try again in a moment.",
        },
        { status: 502 },
      );
    }

    const payload = (await response.json()) as {
      content?: { type: string; name?: string; input?: unknown }[];
    };

    const toolUse = payload.content?.find(
      (block) => block.type === "tool_use" && block.name === RECIPE_TOOL.name,
    );

    if (!toolUse?.input) {
      return NextResponse.json(
        { error: "The model didn't return a usable recipe. Try again." },
        { status: 502 },
      );
    }

    return NextResponse.json({ recipe: toRecipe(toolUse.input) });
  } catch (error) {
    console.error("Invent route failed", error);
    return NextResponse.json(
      { error: "Something went wrong inventing that recipe." },
      { status: 500 },
    );
  }
}

interface RawIngredient {
  name?: string;
  quantity?: number;
  unit?: string;
  note?: string;
  optional?: boolean;
}

interface RawRecipe {
  title?: string;
  description?: string;
  cuisine?: string;
  tags?: string[];
  servings?: number;
  prepMin?: number;
  cookMin?: number;
  difficulty?: string;
  ingredients?: RawIngredient[];
  steps?: string[];
  tips?: string[];
}

/**
 * Map the model's output onto our `Recipe` type.
 *
 * The important step is resolving each free-text ingredient name back to a
 * canonical id. Anything unrecognised keeps its raw text as the ref — it still
 * displays correctly and simply counts as missing, which is the honest answer.
 */
function toRecipe(input: unknown): Recipe {
  const raw = input as RawRecipe;
  const title = (raw.title ?? "Invented recipe").trim();

  const ingredients: RecipeIngredient[] = (raw.ingredients ?? [])
    .filter((entry) => entry.name?.trim())
    .map((entry) => {
      const resolved = resolveIngredient(entry.name ?? "");
      return {
        ref: resolved ?? (entry.name ?? "").trim().toLowerCase(),
        quantity: typeof entry.quantity === "number" ? entry.quantity : undefined,
        unit: VALID_UNITS.includes(entry.unit as Unit)
          ? (entry.unit as Unit)
          : undefined,
        note: entry.note?.trim() || undefined,
        optional: entry.optional === true,
      };
    });

  const difficulty =
    raw.difficulty === "medium" || raw.difficulty === "hard"
      ? raw.difficulty
      : "easy";

  // Slug is time-stamped so re-inventing never collides with a saved recipe.
  const slug = `invented-${slugify(title)}-${Date.now().toString(36)}`;

  return {
    id: slug,
    slug,
    title,
    description: (raw.description ?? "").trim(),
    cuisine: (raw.cuisine ?? "Invented").trim(),
    tags: Array.isArray(raw.tags) ? raw.tags.slice(0, 6).map(String) : [],
    servings: clamp(raw.servings, 1, 12, 2),
    prepMin: clamp(raw.prepMin, 0, 240, 10),
    cookMin: clamp(raw.cookMin, 0, 480, 20),
    difficulty,
    ingredients,
    steps: (raw.steps ?? []).map((s) => String(s).trim()).filter(Boolean),
    tips: (raw.tips ?? []).map((s) => String(s).trim()).filter(Boolean),
    generated: true,
  };
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

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || "recipe"
  );
}
