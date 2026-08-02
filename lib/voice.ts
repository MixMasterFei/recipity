import { ingredientName } from "@/data/ingredients";
import { expiringItems } from "@/lib/match";
import type { MatchResult, PantryItem } from "@/lib/types";

/**
 * The Midnight Snack Club voice.
 *
 * All user-facing flavour text lives here so the tone stays consistent and is
 * changeable in one place. Two details from the design are easy to get wrong
 * and both matter:
 *
 *   1. Ready-state quips cycle by the card's index within its tier
 *      (`idx % 5`), they are not random. Random would reshuffle every card's
 *      copy on each keystroke as results re-rank.
 *   2. The Kitchen and the Browse/Saved grids use *different* formulas for the
 *      same state — the Kitchen is cheeky ("needs lemon. betrayal."), the
 *      others are plain ("missing lemon"). That asymmetry is deliberate.
 */

/** Cycled in order by card index, never shuffled. */
export const READY_QUIPS = [
  "you have it ALL. show-off.",
  "zero shopping required.",
  "the fridge provides.",
  "no excuses left.",
  "dinner: solved.",
] as const;

function lower(id: string): string {
  return ingredientName(id).toLowerCase();
}

/**
 * Kitchen card sub-line. `idx` is the card's position inside its own tier, so
 * the first card of each tier starts the quip cycle again.
 */
export function kitchenQuip(result: MatchResult, idx: number): string {
  const missing = result.missing;
  if (missing.length === 0) {
    return READY_QUIPS[idx % READY_QUIPS.length] ?? READY_QUIPS[0];
  }
  if (missing.length === 1) {
    return `needs ${lower(missing[0] ?? "")}. betrayal.`;
  }
  if (missing.length === 2) {
    // No trailing full stop here — matches the design.
    return `needs ${missing.map(lower).join(" + ")}`;
  }
  return `needs ${missing.length} things. ambitious.`;
}

/** Browse and Saved use the plainer wording. */
export function plainNeed(result: MatchResult): string {
  const missing = result.missing;
  if (missing.length === 0) return "you have it all";
  if (missing.length > 2) return `missing ${missing.length} things`;
  return `missing ${missing.slice(0, 2).map(lower).join(", ")}`;
}

export function totalMinutes(result: MatchResult): number {
  return result.recipe.prepMin + result.recipe.cookMin;
}

/** `25 min · needs lemon. betrayal.` */
export function kitchenSubLine(result: MatchResult, idx: number): string {
  return `${totalMinutes(result)} min · ${kitchenQuip(result, idx)}`;
}

/** `25 min · missing lemon` */
export function plainSubLine(result: MatchResult): string {
  return `${totalMinutes(result)} min · ${plainNeed(result)}`;
}

/**
 * "makes 2, not 4" — shown only when the amounts you entered fall short.
 *
 * Returns null far more often than not, and that's correct: an unmeasured
 * fridge should say nothing at all.
 */
export function portionNote(result: MatchResult): string | null {
  const full = result.recipe.servings;
  const possible = result.servingsPossible;
  if (possible >= full) return null;
  return `makes ${possible}, not ${full}`;
}

/** `⏰ uses the spinach` — the emoji is rendered separately by the card. */
export function rescueLabel(result: MatchResult): string {
  const first = result.rescues[0];
  return first ? `uses the ${lower(first)}` : "";
}

/* ------------------------------------------------------------------ */
/* Hero copy                                                           */
/* ------------------------------------------------------------------ */

export function heroSub(
  hydrated: boolean,
  pantryCount: number,
  readyCount: number,
): string {
  if (!hydrated) return "…";
  const ing = pantryCount === 1 ? "ingredient" : "ingredients";
  const dinner = readyCount === 1 ? "dinner needs" : "dinners need";
  return `your fridge called. it has ${pantryCount} ${ing} and frankly, ideas. ${readyCount} ${dinner} zero shopping.`;
}

export function leverageUnlocks(count: number): string {
  return `${count} more ${count === 1 ? "dinner" : "dinners"}`;
}

/* ------------------------------------------------------------------ */
/* Ticker — Kitchen only                                               */
/* ------------------------------------------------------------------ */

/**
 * Four states, checked in this order. Note the design always says "DINNERS"
 * in the third case, even at one.
 */
export function tickerText(
  hydrated: boolean,
  pantry: PantryItem[],
  readyCount: number,
  now: Date,
): string {
  if (!hydrated) return "MIDNIGHT SNACK CLUB ★ COOK WHAT YOU HAVE ★ ";

  const urgent = expiringItems(pantry, now, 3);
  if (urgent.length > 0) {
    const names = urgent
      .slice(0, 4)
      .map((e) => `USE THE ${ingredientName(e.item.ingredientId).toUpperCase()}`)
      .join(" ★ ");
    return `${names} ★ THE CLOCK IS TICKING ★ `;
  }

  if (pantry.length > 0) {
    return `${readyCount} DINNERS NEED ZERO SHOPPING ★ NOTHING IS EXPIRING ★ SUSPICIOUS ★ `;
  }

  return "FEED THE APP ★ ADD INGREDIENTS ★ GET DINNER ★ ";
}

/* ------------------------------------------------------------------ */
/* Expiry chips                                                        */
/* ------------------------------------------------------------------ */

export function expiryLabel(days: number): string {
  if (days < 0) return "expired 💀";
  if (days === 0) return "today ⏰";
  return `${days}d ⏰`;
}

/* ------------------------------------------------------------------ */
/* Section and tier copy                                               */
/* ------------------------------------------------------------------ */

/** Sync status, in words. Shared by the account page and the header menu. */
export function syncCopy(
  status: "off" | "merging" | "synced" | "saving" | "error",
  lastSyncedAt: string | null,
): string {
  if (status === "merging") return "merging your fridge…";
  if (status === "saving") return "saving…";
  if (status === "error") return "couldn't reach the server";
  if (status === "off") return "not syncing";
  if (!lastSyncedAt) return "synced";

  const seconds = Math.max(
    0,
    Math.round((Date.now() - Date.parse(lastSyncedAt)) / 1000),
  );
  if (seconds < 45) return "synced · just now";
  if (seconds < 3600) return `synced · ${Math.round(seconds / 60)}m ago`;
  return `synced · ${Math.round(seconds / 3600)}h ago`;
}

export const TIER_COPY = {
  ready: { title: "ready rn", subtitle: "zero shopping required" },
  almost: {
    title: "so close",
    subtitle: "one or two things short. heartbreaking.",
  },
  stretch: { title: "worth a shop", subtitle: "the ambition tier" },
} as const;
