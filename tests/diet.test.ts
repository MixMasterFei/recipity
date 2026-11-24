import { describe, expect, it } from "vitest";
import {
  DEFAULT_STAPLES,
  INGREDIENTS,
  getIngredient,
} from "@/data/ingredients";
import { RECIPES, getRecipe } from "@/data/recipes";
import { recipe, i, opt, g } from "@/data/recipes/helpers";
import {
  DIET_KEYS,
  allowedGroupMembers,
  dietGate,
  dietIssues,
  recipeDietBadges,
  recipeSatisfiesDiet,
} from "@/lib/diet";
import { matchPantry, scoreOne, scoreRecipe } from "@/lib/match";
import type { DietKey, DietPrefs, PantryItem, Recipe } from "@/lib/types";

/**
 * Eating rules are the one place this app can hurt someone, so the property
 * that matters is tested against the whole library rather than a few
 * hand-picked cases: with a restriction on, nothing that breaks it may ever be
 * counted as an ingredient you are cooking with.
 */

const NOW = new Date("2026-06-15T12:00:00Z");

function pantry(ids: string[]): PantryItem[] {
  return ids.map((ingredientId) => ({
    ingredientId,
    addedAt: NOW.toISOString(),
  }));
}

function rules(
  restrictions: DietKey[] = [],
  avoid: string[] = [],
): DietPrefs {
  return { restrictions, avoid };
}

function real(slug: string): Recipe {
  const found = getRecipe(slug);
  if (!found) throw new Error(`fixture recipe "${slug}" is gone`);
  return found;
}

/** Everything a match says you would be cooking with. */
function usedBy(match: { ref: string; kind: string; satisfiedBy?: string[] }) {
  if (match.kind === "missing") return [];
  if (match.satisfiedBy && match.satisfiedBy.length > 0) return match.satisfiedBy;
  return [match.ref];
}

describe("the engine never cooks with something the rules forbid", () => {
  // A fridge holding the entire catalogue is the worst case: every group,
  // sibling swap and substitution has a forbidden option within reach.
  const everything = pantry(INGREDIENTS.map((ing) => ing.id));

  for (const key of DIET_KEYS) {
    it(`holds for ${key} across the whole library`, () => {
      const results = matchPantry(RECIPES, everything, {
        staples: DEFAULT_STAPLES,
        diet: rules([key]),
        now: NOW,
      });
      expect(results.length).toBeGreaterThan(0);

      const breaches: string[] = [];
      for (const result of results) {
        for (const match of result.matches) {
          for (const id of usedBy(match)) {
            if (!getIngredient(id)?.diet[key]) {
              breaches.push(`${result.recipe.slug}: ${match.ref} via ${id}`);
            }
          }
        }
        for (const id of [...result.uses, ...result.rescues]) {
          if (!getIngredient(id)?.diet[key]) {
            breaches.push(`${result.recipe.slug}: uses ${id}`);
          }
        }
      }
      expect(breaches).toEqual([]);
    });
  }

  it("holds for an avoided ingredient too", () => {
    const results = matchPantry(RECIPES, everything, {
      staples: DEFAULT_STAPLES,
      diet: rules([], ["milk", "cheddar", "peanut-butter"]),
      now: NOW,
    });
    const breaches = results.flatMap((result) =>
      result.matches
        .flatMap(usedBy)
        .filter((id) => ["milk", "cheddar", "peanut-butter"].includes(id))
        .map((id) => `${result.recipe.slug}: ${id}`),
    );
    expect(breaches).toEqual([]);
  });
});

describe("groups under a restriction", () => {
  it("does not let cheddar make a dairy-free frittata ready", () => {
    // The frittata takes "any cheese", and vegan cheese is a cheese — so it
    // can be dairy-free. The cheddar in the fridge still must not count.
    const frittata = real("frittata");
    const fridge = pantry(["egg", "cheddar", "onion", "potato", "spinach"]);

    const without = scoreRecipe(frittata, fridge, {
      staples: DEFAULT_STAPLES,
      now: NOW,
    });
    expect(
      without.matches.find((m) => m.ref === "group:any-cheese")?.satisfiedBy,
    ).toEqual(["cheddar"]);

    const dairyFree = scoreRecipe(frittata, fridge, {
      staples: DEFAULT_STAPLES,
      diet: rules(["dairyFree"]),
      now: NOW,
    });
    expect(dairyFree.missing).toContain("group:any-cheese");
    expect(dairyFree.status).not.toBe("ready");
    expect(dairyFree.uses).not.toContain("cheddar");
  });

  it("accepts the member of the group the rules allow", () => {
    const result = scoreRecipe(
      real("frittata"),
      pantry(["egg", "vegan-cheese", "cheddar", "onion", "potato", "spinach"]),
      { staples: DEFAULT_STAPLES, diet: rules(["dairyFree"]), now: NOW },
    );
    expect(
      result.matches.find((m) => m.ref === "group:any-cheese")?.satisfiedBy,
    ).toEqual(["vegan-cheese"]);
  });

  it("does not count the cow's milk staple towards a vegan porridge", () => {
    const porridge = real("porridge");
    expect(DEFAULT_STAPLES).toContain("milk");

    const result = scoreRecipe(porridge, pantry(["oats"]), {
      staples: DEFAULT_STAPLES,
      diet: rules(["vegan"]),
      now: NOW,
    });
    expect(result.missing).toContain("group:milk");

    const withOatMilk = scoreRecipe(porridge, pantry(["oats", "oat-milk"]), {
      staples: DEFAULT_STAPLES,
      diet: rules(["vegan"]),
      now: NOW,
    });
    expect(withOatMilk.missing).not.toContain("group:milk");
  });

  it("names the members a restriction leaves open", () => {
    const open = allowedGroupMembers("group:milk", rules(["dairyFree"]));
    expect(open).toContain("oat-milk");
    expect(open).not.toContain("milk");
    expect(allowedGroupMembers("milk", rules(["dairyFree"]))).toEqual([]);
  });
});

describe("swaps and substitutions under a restriction", () => {
  const base = {
    description: "",
    cuisine: "Test",
    tags: [],
    servings: 2,
    prep: 1,
    cook: 1,
    steps: ["Cook.", "Eat."],
  };

  it("does not swap in a sibling the rules forbid", () => {
    // Oat milk and cow's milk share a group, so one normally stands in for
    // the other. Not for a vegan.
    const oaty = recipe({
      ...base,
      slug: "test-oat",
      title: "Oaty",
      ingredients: [i("oats", 100, "g"), i("oat-milk", 200, "ml")],
    });
    const fridge = pantry(["oats", "milk"]);

    expect(scoreRecipe(oaty, fridge, { now: NOW }).status).toBe("ready");
    expect(
      scoreRecipe(oaty, fridge, { diet: rules(["vegan"]), now: NOW }).missing,
    ).toEqual(["oat-milk"]);
  });

  it("does not substitute peanut butter for tahini when nut-free", () => {
    const dip = recipe({
      ...base,
      slug: "test-dip",
      title: "Dip",
      ingredients: [i("chickpeas", 400, "g"), i("tahini", 2, "tbsp")],
    });
    const fridge = pantry(["chickpeas", "peanut-butter"]);

    expect(
      scoreRecipe(dip, fridge, { now: NOW }).matches.find(
        (m) => m.ref === "tahini",
      )?.kind,
    ).toBe("sub");
    expect(
      scoreRecipe(dip, fridge, { diet: rules(["nutFree"]), now: NOW }).missing,
    ).toEqual(["tahini"]);
  });

  it("does not substitute soy sauce for tamari when gluten-free", () => {
    const glaze = recipe({
      ...base,
      slug: "test-glaze",
      title: "Glaze",
      ingredients: [i("tofu", 200, "g"), i("tamari", 2, "tbsp")],
    });
    const result = scoreRecipe(glaze, pantry(["tofu", "soy-sauce"]), {
      diet: rules(["glutenFree"]),
      now: NOW,
    });
    expect(result.missing).toEqual(["tamari"]);
  });

  it("does not let an avoided ingredient satisfy a group", () => {
    const cheesy = recipe({
      ...base,
      slug: "test-cheesy",
      title: "Cheesy",
      ingredients: [i("spaghetti", 200, "g"), g("hard-cheese", 50, "g")],
    });
    const fridge = pantry(["spaghetti", "parmesan"]);
    expect(
      scoreRecipe(cheesy, fridge, { diet: rules([], ["parmesan"]), now: NOW })
        .missing,
    ).toEqual(["group:hard-cheese"]);
    // ...while another member of the same group still does.
    expect(
      scoreRecipe(cheesy, pantry(["spaghetti", "parmesan", "pecorino"]), {
        diet: rules([], ["parmesan"]),
        now: NOW,
      }).status,
    ).toBe("ready");
  });
});

describe("optional ingredients the rules forbid", () => {
  const veganPasta = recipe({
    slug: "test-vegan-pasta",
    title: "Vegan Pasta",
    description: "",
    cuisine: "Test",
    tags: [],
    servings: 2,
    prep: 1,
    cook: 1,
    ingredients: [
      i("spaghetti", 200, "g"),
      i("tomato", 3),
      opt("parmesan", 20, "g"),
    ],
    steps: ["Cook.", "Eat."],
  });

  it("marks them ruled out instead of something to buy", () => {
    const result = scoreRecipe(
      veganPasta,
      pantry(["spaghetti", "tomato", "parmesan"]),
      { diet: rules(["vegan"]), now: NOW },
    );
    const parmesan = result.matches.find((m) => m.ref === "parmesan");
    expect(parmesan?.kind).toBe("missing");
    expect(parmesan?.ruledOut).toBe(true);
    expect(result.status).toBe("ready");
    expect(result.missing).toEqual([]);
  });

  it("does not credit the recipe with using or rescuing them", () => {
    const tomorrow = new Date(NOW.getTime() + 86_400_000).toISOString();
    const fridge: PantryItem[] = [
      ...pantry(["spaghetti", "tomato"]),
      { ingredientId: "parmesan", addedAt: NOW.toISOString(), expiresAt: tomorrow },
    ];
    const result = scoreRecipe(veganPasta, fridge, {
      diet: rules(["vegan"]),
      now: NOW,
    });
    expect(result.uses).not.toContain("parmesan");
    expect(result.rescues).toEqual([]);
  });

  it("leaves them alone when no rule is set", () => {
    const result = scoreRecipe(
      veganPasta,
      pantry(["spaghetti", "tomato", "parmesan"]),
      { now: NOW },
    );
    const parmesan = result.matches.find((m) => m.ref === "parmesan");
    expect(parmesan?.kind).toBe("have");
    expect(parmesan?.ruledOut).toBeUndefined();
  });
});

describe("scoreOne — a recipe opened directly", () => {
  it("applies the rules when the recipe can be cooked within them", () => {
    const result = scoreOne(real("porridge"), pantry(["oats"]), {
      staples: DEFAULT_STAPLES,
      diet: rules(["dairyFree"]),
      now: NOW,
    });
    expect(result.missing).toContain("group:milk");
  });

  it("sets them aside when the recipe breaks them outright", () => {
    // A vegetarian who opens carbonara anyway should see their real fridge,
    // not a page claiming they own nothing.
    const carbonara = real("carbonara");
    const fridge = pantry(["spaghetti", "egg", "bacon", "parmesan"]);
    expect(recipeSatisfiesDiet(carbonara, rules(["vegetarian"]))).toBe(false);

    const result = scoreOne(carbonara, fridge, {
      staples: DEFAULT_STAPLES,
      diet: rules(["vegetarian"]),
      now: NOW,
    });
    expect(result.uses).toContain("bacon");
    expect(result.matches.every((m) => !m.ruledOut)).toBe(true);
  });
});

describe("badges say how sure they are", () => {
  it("marks a label that depends on a choice as uncertain", () => {
    const porridge = recipeDietBadges(real("porridge"));
    expect(porridge.find((b) => b.key === "vegan")).toEqual({
      key: "vegan",
      certain: false,
    });

    const frittata = recipeDietBadges(real("frittata"));
    expect(frittata.find((b) => b.key === "dairyFree")?.certain).toBe(false);
    // Eggs are in every frittata, so it is never offered as vegan at all.
    expect(frittata.find((b) => b.key === "vegan")).toBeUndefined();
  });

  it("marks a label that depends on skipping a garnish as uncertain", () => {
    // Scattering peanuts on top is optional. "Nut-free" is still not a
    // promise this recipe can make.
    const garnished = recipe({
      slug: "test-garnish-nuts",
      title: "Garnished",
      description: "",
      cuisine: "Test",
      tags: [],
      servings: 2,
      prep: 1,
      cook: 1,
      ingredients: [i("rice", 200, "g"), opt("peanuts", 1, "handful")],
      steps: ["Cook.", "Eat."],
    });
    const badges = recipeDietBadges(garnished);
    expect(badges.find((b) => b.key === "nutFree")).toEqual({
      key: "nutFree",
      certain: false,
    });
    expect(badges.find((b) => b.key === "vegan")?.certain).toBe(true);
  });

  it("marks a label that holds whatever you pick as certain", () => {
    const badges = recipeDietBadges(real("spaghetti-aglio-olio"));
    expect(badges.find((b) => b.key === "vegan")?.certain).toBe(true);
  });
});

describe("dietIssues", () => {
  it("names the ingredient behind each broken rule", () => {
    const issues = dietIssues(real("carbonara"), rules(["vegetarian"]));
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every((issue) => issue.rule === "vegetarian")).toBe(true);
    expect(issues.map((issue) => issue.ref)).toContain("group:cured-pork");
  });

  it("is empty exactly when the recipe satisfies the rules", () => {
    for (const key of DIET_KEYS) {
      for (const r of RECIPES) {
        expect(dietIssues(r, rules([key])).length === 0).toBe(
          recipeSatisfiesDiet(r, rules([key])),
        );
      }
    }
  });

  it("flags an ingredient it cannot identify as unverified, not as fine", () => {
    const mystery = recipe({
      slug: "test-mystery",
      title: "Mystery",
      description: "",
      cuisine: "Test",
      tags: [],
      servings: 2,
      prep: 1,
      cook: 1,
      ingredients: [i("rice", 200, "g"), i("unicorn tears", 1, "tbsp")],
      steps: ["Cook.", "Eat."],
    });
    const issues = dietIssues(mystery, rules(["vegan"]));
    expect(issues).toEqual([
      { rule: "vegan", ref: "unicorn tears", known: false },
    ]);
  });

  it("counts an avoided garnish, optional or not", () => {
    const garnished = recipe({
      slug: "test-garnished",
      title: "Garnished",
      description: "",
      cuisine: "Test",
      tags: [],
      servings: 2,
      prep: 1,
      cook: 1,
      ingredients: [i("rice", 200, "g"), opt("peanuts", 1, "handful")],
      steps: ["Cook.", "Eat."],
    });
    expect(dietIssues(garnished, rules([], ["peanuts"]))).toEqual([
      { rule: "avoid", ref: "peanuts", known: true },
    ]);
  });
});

describe("dietGate", () => {
  it("is inactive and lets everything through when no rule is set", () => {
    expect(dietGate(undefined).active).toBe(false);
    expect(dietGate(rules()).active).toBe(false);
    expect(dietGate(rules())("bacon")).toBe(true);
  });

  it("refuses what it cannot identify once a restriction is on", () => {
    const gate = dietGate(rules(["vegan"]));
    expect(gate.active).toBe(true);
    expect(gate("unicorn tears")).toBe(false);
    expect(gate("rice")).toBe(true);
    expect(gate("butter")).toBe(false);
  });
});

describe("catalogue flags that over-promised", () => {
  it("does not call wheat- and barley-based pastes or cereals gluten-free", () => {
    for (const id of ["gochujang", "doubanjiang", "cornflakes", "soy-sauce"]) {
      expect(getIngredient(id)?.diet.glutenFree, id).toBe(false);
    }
  });
});
