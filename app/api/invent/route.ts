import { NextResponse } from "next/server";
import {
  INVENT_LIMITS,
  VALID_UNITS,
  buildInventPrompt,
  checkInvented,
  parseInventRequest,
  toRecipe,
} from "@/lib/invent";
import { createRateLimiter } from "@/lib/rate-limit";

/**
 * Invent a recipe from exactly what the user has.
 *
 * Claude returns a structured recipe through a tool call, and every
 * ingredient name it produces is put back through `resolveIngredient` so the
 * result speaks the same canonical vocabulary as the bundled library. That's
 * what lets an invented recipe participate in matching, the shopping list and
 * favourites like any other.
 *
 * With no ANTHROPIC_API_KEY set this route reports itself disabled and the UI
 * hides the feature. Nothing else in the app depends on it.
 *
 * This is the only route that spends money, and it needs no account, so it is
 * guarded in layers — each cheap, none sufficient alone:
 *
 *   1. Browsers on other sites are refused (origin check).
 *   2. The body is size-capped and narrowed to catalogue ids (`lib/invent.ts`),
 *      so a request can't be made arbitrarily expensive.
 *   3. Requests are rate-limited per client and overall.
 *   4. `max_tokens` bounds what any single call can cost.
 *
 * The rate limits are per server instance — see `lib/rate-limit.ts`. Before
 * enabling this somewhere public, add the hosting platform's own rate-limit
 * rule on `/api/invent` as well.
 */

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const API_URL = "https://api.anthropic.com/v1/messages";

/** Long enough for a full recipe, short enough to stay inside Vercel limits. */
export const maxDuration = 60;
/** Give up on the model slightly before the platform gives up on us. */
const UPSTREAM_TIMEOUT_MS = 55_000;

/**
 * Room for the recipe plus any thinking the model does first, which counts
 * against the same budget. Checked via `stop_reason`, so running out produces
 * a clean "try again" rather than half a recipe.
 */
const MAX_TOKENS = 8000;

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Per client, per hour. Inventing dinner a handful of times is plenty. */
const perClient = createRateLimiter({
  limit: positiveInt(process.env.INVENT_PER_HOUR, 8),
  windowMs: 60 * 60 * 1000,
});

/** Everyone together, per day: the ceiling on what one instance can spend. */
const overall = createRateLimiter({
  limit: positiveInt(process.env.INVENT_PER_DAY, 300),
  windowMs: 24 * 60 * 60 * 1000,
  maxKeys: 1,
});

/** Tool schema Claude fills in. Mirrors the `Recipe` type. */
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
- Respect every dietary restriction and every "never use" absolutely. These are hard constraints, not preferences.
- Name each ingredient plainly and separately: "chicken thigh", not "boneless chicken thighs or breasts".
- Write real quantities and real timings. "Cook until done" is useless.
- Method steps should each be one action, in order, with the sensory cue that tells you it worked ("until the edges are lacy and dark").
- Write plainly. No adjective stacking, no "delicious", no "elevate", no "burst of flavour".

Answer only by calling publish_recipe, exactly once. Write nothing before or after the call.`;

export async function GET() {
  // The client asks this on mount to decide whether to show the feature.
  return NextResponse.json({ enabled: Boolean(process.env.ANTHROPIC_API_KEY) });
}

function fail(error: string, status: number, headers?: HeadersInit) {
  return NextResponse.json({ error }, { status, headers });
}

/**
 * Refuse browsers calling from another site.
 *
 * Browsers always say where a request came from, so a page on someone else's
 * domain can't spend this key through its visitors. A script outside a
 * browser sends no such headers and passes — that is what the rate limits are
 * for.
 */
function fromThisSite(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false;
  }
  const hosts = [
    request.headers.get("host"),
    request.headers.get("x-forwarded-host"),
  ].filter(Boolean);
  return hosts.includes(originHost);
}

/**
 * Best available identity for rate limiting.
 *
 * `x-forwarded-for` is set by the hosting platform's proxy; behind one that
 * doesn't overwrite it a caller could vary it to dodge the per-client limit,
 * which is why the overall limit exists and doesn't depend on it.
 */
function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return fail(
      "Recipe invention is switched off. Add an ANTHROPIC_API_KEY environment variable and redeploy to enable it.",
      503,
    );
  }

  if (!fromThisSite(request)) {
    return fail("This endpoint only answers the app itself.", 403);
  }

  // Read the body as text first so its size can be checked before parsing.
  let bodyText: string;
  try {
    bodyText = await request.text();
  } catch {
    return fail("Invalid request body.", 400);
  }
  if (bodyText.length > INVENT_LIMITS.maxBodyChars) {
    return fail("That request is too large.", 413);
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    return fail("Invalid request body.", 400);
  }

  const parsed = parseInventRequest(body);
  if (!parsed.ok) return fail(parsed.error, 400);
  const input = parsed.input;

  // Only requests that would actually reach the model count against a limit.
  const mine = perClient.take(clientKey(request));
  if (!mine.ok) {
    return fail(
      "That's a lot of inventing. Give it a rest and try again later.",
      429,
      { "retry-after": String(mine.retryAfterSec) },
    );
  }
  const everyone = overall.take("all");
  if (!everyone.ok) {
    return fail(
      "The kitchen is closed for today — too many inventions. Try again tomorrow.",
      429,
      { "retry-after": String(everyone.retryAfterSec) },
    );
  }

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
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        tools: [RECIPE_TOOL],
        // `auto`, not a forced call: the current Sonnet and Opus models reject
        // forced tool use outright, and the prompt asks for the call anyway.
        // The price is that a call isn't guaranteed, so its absence is
        // handled below as "try again".
        tool_choice: { type: "auto" },
        messages: [{ role: "user", content: buildInventPrompt(input) }],
      }),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Anthropic API error", response.status, detail);
      return fail(
        response.status === 401
          ? "The configured API key was rejected."
          : "Couldn't reach the recipe model. Try again in a moment.",
        502,
      );
    }

    const payload = (await response.json()) as {
      stop_reason?: string;
      content?: { type: string; name?: string; input?: unknown }[];
    };

    if (payload.stop_reason === "refusal") {
      return fail("The model declined that one. Try a different mood.", 422);
    }

    const toolUse = payload.content?.find(
      (block) => block.type === "tool_use" && block.name === RECIPE_TOOL.name,
    );

    // Out of tokens mid-call leaves a recipe that parses but stops halfway
    // through the method, so a truncated answer is treated as no answer.
    if (!toolUse?.input || payload.stop_reason === "max_tokens") {
      return fail("The model didn't return a usable recipe. Try again.", 502);
    }

    const recipe = toRecipe(toolUse.input);
    const problem = checkInvented(recipe, input);
    if (problem) {
      console.error("Invented recipe rejected", problem);
      return fail(problem, 502);
    }

    return NextResponse.json({ recipe });
  } catch (error) {
    console.error("Invent route failed", error);
    const timedOut =
      error instanceof DOMException && error.name === "TimeoutError";
    return fail(
      timedOut
        ? "The recipe model took too long. Try again."
        : "Something went wrong inventing that recipe.",
      timedOut ? 504 : 500,
    );
  }
}
