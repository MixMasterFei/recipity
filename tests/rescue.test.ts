import { describe, expect, it } from "vitest";
import {
  orphanedItems,
  rescueResults,
  turningHeadline,
  turningItems,
  turningSummary,
} from "@/lib/rescue";
import { rescueLabel } from "@/lib/voice";
import { matchPantry, scoreRecipe } from "@/lib/match";
import { RECIPES } from "@/data/recipes";
import type { PantryItem } from "@/lib/types";

const NOW = new Date("2026-08-02T12:00:00Z");

function daysFromNow(days: number): string {
  const d = new Date(NOW);
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

function pantry(
  items: { id: string; expires?: number }[],
): PantryItem[] {
  return items.map((it) => ({
    ingredientId: it.id,
    addedAt: NOW.toISOString(),
    expiresAt: it.expires === undefined ? undefined : daysFromNow(it.expires),
  }));
}

describe("turningItems", () => {
  it("finds only what's within the window, soonest first", () => {
    const turning = turningItems(
      pantry([
        { id: "milk", expires: 2 },
        { id: "spinach", expires: 0 },
        { id: "rice", expires: 200 },
        { id: "flour" },
      ]),
      NOW,
    );
    expect(turning.map((t) => t.item.ingredientId)).toEqual(["spinach", "milk"]);
  });

  it("includes things already past their date", () => {
    const turning = turningItems(pantry([{ id: "milk", expires: -3 }]), NOW);
    expect(turning).toHaveLength(1);
    expect(turning[0]?.days).toBe(-3);
  });

  it("is empty when nothing carries a date", () => {
    expect(turningItems(pantry([{ id: "rice" }, { id: "egg" }]), NOW)).toEqual([]);
  });
});

describe("rescueResults", () => {
  const kitchen = pantry([
    { id: "egg", expires: 1 },
    { id: "rice" },
    { id: "scallion" },
    { id: "soy-sauce" },
    { id: "vegetable-oil" },
    { id: "peas" },
  ]);
  const opts = { staples: ["salt", "black-pepper", "water"], now: NOW };

  it("only suggests recipes that actually use something turning", () => {
    const results = matchPantry(RECIPES, kitchen, opts);
    const turning = turningItems(kitchen, NOW);
    const rescue = rescueResults(results, turning);

    expect(rescue.length).toBeGreaterThan(0);
    for (const r of rescue) {
      expect(r.rescues).toContain("egg");
    }
  });

  it("never suggests something you'd need a shop for", () => {
    // Being told to rescue your eggs with a dish needing five missing things
    // is not rescue, it's a shopping list.
    const results = matchPantry(RECIPES, kitchen, opts);
    const rescue = rescueResults(results, turningItems(kitchen, NOW));
    for (const r of rescue) {
      expect(r.status).not.toBe("stretch");
    }
  });

  it("prefers recipes that save more than one thing at once", () => {
    const twoTurning = pantry([
      { id: "egg", expires: 1 },
      { id: "spinach", expires: 1 },
      { id: "onion" },
      { id: "potato" },
      { id: "cheddar" },
    ]);
    const results = matchPantry(RECIPES, twoTurning, opts);
    const rescue = rescueResults(results, turningItems(twoTurning, NOW));

    if (rescue.length > 1) {
      const saves = (r: (typeof rescue)[number]) =>
        r.rescues.filter((id) => id === "egg" || id === "spinach").length;
      expect(saves(rescue[0]!)).toBeGreaterThanOrEqual(saves(rescue[1]!));
    }
  });

  it("gives the most urgent thing a card, even when something else has more recipes", () => {
    // Eggs appear in far more of the library than spinach does, and score
    // better here. Rank alone would hand the whole board to the eggs and let
    // the spinach — which goes off tonight — rot.
    const kitchen = pantry([
      { id: "spinach", expires: 0 },
      { id: "egg", expires: 2 },
      { id: "onion" },
      { id: "potato" },
      { id: "cheddar" },
      { id: "garlic" },
    ]);
    const results = matchPantry(RECIPES, kitchen, opts);
    const rescue = rescueResults(results, turningItems(kitchen, NOW));

    expect(rescue.some((r) => r.rescues.includes("spinach"))).toBe(true);
    expect(rescue[0]?.rescues).toContain("spinach");
  });

  it("says nothing when nothing is turning", () => {
    const calm = pantry([{ id: "rice" }, { id: "egg" }]);
    const results = matchPantry(RECIPES, calm, opts);
    expect(rescueResults(results, turningItems(calm, NOW))).toEqual([]);
  });

  it("respects the limit", () => {
    const results = matchPantry(RECIPES, kitchen, opts);
    expect(rescueResults(results, turningItems(kitchen, NOW), 2).length).toBeLessThanOrEqual(2);
  });
});

describe("orphanedItems", () => {
  it("names what the library cannot save", () => {
    // Tahini going off, and nothing else in the fridge to build a dish around.
    const lonely = pantry([{ id: "tahini", expires: 1 }]);
    const results = matchPantry(RECIPES, lonely, { now: NOW });
    const orphans = orphanedItems(results, turningItems(lonely, NOW));
    expect(orphans.map((o) => o.item.ingredientId)).toContain("tahini");
  });

  it("is empty when everything turning has a rescue", () => {
    const kitchen = pantry([
      { id: "egg", expires: 1 },
      { id: "rice" },
      { id: "scallion" },
      { id: "soy-sauce" },
      { id: "vegetable-oil" },
    ]);
    const results = matchPantry(RECIPES, kitchen, {
      staples: ["salt", "black-pepper", "water"],
      now: NOW,
    });
    expect(orphanedItems(results, turningItems(kitchen, NOW))).toEqual([]);
  });
});

describe("headline and summary copy", () => {
  it("names a single item rather than counting it", () => {
    const turning = turningItems(pantry([{ id: "spinach", expires: 1 }]), NOW);
    expect(turningHeadline(turning)).toBe("the spinach is about to turn");
  });

  it("counts when there are several", () => {
    const turning = turningItems(
      pantry([
        { id: "spinach", expires: 1 },
        { id: "milk", expires: 2 },
      ]),
      NOW,
    );
    expect(turningHeadline(turning)).toBe("2 things are about to turn");
  });

  it("breaks the urgency down", () => {
    const turning = turningItems(
      pantry([
        { id: "milk", expires: -1 },
        { id: "spinach", expires: 0 },
        { id: "egg", expires: 2 },
      ]),
      NOW,
    );
    expect(turningSummary(turning)).toBe("1 already gone · 1 today · 1 within 3 days");
  });

  it("omits the parts that don't apply", () => {
    const turning = turningItems(pantry([{ id: "egg", expires: 2 }]), NOW);
    expect(turningSummary(turning)).toBe("1 within 3 days");
  });
});

describe("rescueLabel", () => {
  const result = (rescues: string[]) =>
    ({ rescues }) as unknown as Parameters<typeof rescueLabel>[0];

  it("says nothing when nothing is rescued", () => {
    expect(rescueLabel(result([]))).toBe("");
  });

  it("names the one thing it saves", () => {
    expect(rescueLabel(result(["spinach"]))).toBe("uses the spinach");
  });

  it("names both, rather than selling a double rescue short", () => {
    expect(rescueLabel(result(["egg", "spinach"]))).toBe(
      "uses the eggs + spinach",
    );
  });

  it("counts the rest once the pill would overflow", () => {
    expect(rescueLabel(result(["egg", "spinach", "milk", "cheddar"]))).toBe(
      "uses the eggs + 3 more",
    );
  });
});

describe("the engine still ranks rescue recipes above equivalents", () => {
  it("lifts a recipe that uses something turning", () => {
    const withExpiry = pantry([
      { id: "rice" },
      { id: "egg", expires: 1 },
      { id: "scallion" },
      { id: "soy-sauce" },
      { id: "vegetable-oil" },
    ]);
    const without = pantry([
      { id: "rice" },
      { id: "egg" },
      { id: "scallion" },
      { id: "soy-sauce" },
      { id: "vegetable-oil" },
    ]);
    const opts = { staples: ["salt", "black-pepper", "water"], now: NOW };
    const fried = RECIPES.find((r) => r.slug === "egg-fried-rice")!;

    expect(scoreRecipe(fried, withExpiry, opts).score).toBeGreaterThan(
      scoreRecipe(fried, without, opts).score,
    );
  });
});
