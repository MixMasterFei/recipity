import { describe, expect, it } from "vitest";
import { INGREDIENTS } from "@/data/ingredients";
import { dietFlagsFor } from "@/lib/diet";
import {
  normalizeText,
  resolveIngredient,
  searchIngredients,
} from "@/lib/normalize";

describe("normalizeText", () => {
  it("lowercases and strips punctuation", () => {
    expect(normalizeText("Olive Oil!")).toBe("olive oil");
  });

  it("drops parentheticals", () => {
    expect(normalizeText("eggs (beaten)")).toBe("egg");
  });

  it("drops quantities", () => {
    expect(normalizeText("200 g flour")).toBe("g flour");
  });

  it("strips accents", () => {
    expect(normalizeText("jalapeño")).toBe("jalapeno");
    expect(normalizeText("Gruyère")).toBe("gruyere");
  });

  it("singularises regular plurals", () => {
    expect(normalizeText("carrots")).toBe("carrot");
    expect(normalizeText("berries")).toBe("berry");
  });

  it("handles irregular plurals", () => {
    expect(normalizeText("tomatoes")).toBe("tomato");
    expect(normalizeText("potatoes")).toBe("potato");
    expect(normalizeText("bay leaves")).toBe("bay leaf");
  });

  it("strips preparation noise", () => {
    expect(normalizeText("finely chopped fresh parsley")).toBe("parsley");
    expect(normalizeText("2 large free-range eggs")).toBe("egg");
  });

  it("falls back rather than returning nothing when all words are noise", () => {
    // "to taste" is entirely noise words; returning "" would make every
    // ingredient match it.
    expect(normalizeText("to taste")).not.toBe("");
  });
});

describe("resolveIngredient", () => {
  it("resolves exact names", () => {
    expect(resolveIngredient("Olive oil")).toBe("olive-oil");
  });

  it("resolves aliases", () => {
    expect(resolveIngredient("green onions")).toBe("scallion");
    expect(resolveIngredient("spring onion")).toBe("scallion");
    expect(resolveIngredient("courgette")).toBe("zucchini");
    expect(resolveIngredient("aubergine")).toBe("eggplant");
    expect(resolveIngredient("garbanzo beans")).toBe("chickpeas");
    expect(resolveIngredient("cilantro")).toBe("cilantro");
  });

  it("prefers the longest match so specific beats generic", () => {
    // The classic failure: "sweet potato" collapsing to "potato".
    expect(resolveIngredient("sweet potato")).toBe("sweet-potato");
    expect(resolveIngredient("potato")).toBe("potato");
  });

  it("resolves messy real-world text", () => {
    expect(resolveIngredient("2 large free-range eggs, beaten")).toBe("egg");
    expect(resolveIngredient("finely chopped fresh parsley")).toBe("parsley");
  });

  it("returns undefined for nonsense", () => {
    expect(resolveIngredient("xyzzy quantum widget")).toBeUndefined();
    expect(resolveIngredient("")).toBeUndefined();
  });
});

describe("resolveIngredient — whole words only", () => {
  it("never matches inside a word", () => {
    // Each of these once resolved by substring: butter*nut*, bec*ham*el,
    // f*ice*-spice, te*x*tured. The first labelled a dish nut-free.
    expect(resolveIngredient("nuts")).not.toBe("butternut-pumpkin-seed");
    expect(resolveIngredient("béchamel")).toBeUndefined();
    expect(resolveIngredient("ice")).toBeUndefined();
    expect(resolveIngredient("x")).toBeUndefined();
    expect(resolveIngredient("in")).toBeUndefined();
  });

  it("does not read a modifier as the ingredient", () => {
    // "goat" is not goat's cheese — one is vegetarian and the other isn't.
    expect(resolveIngredient("goat")).toBeUndefined();
  });

  it("finds a known name among extra words", () => {
    expect(resolveIngredient("boneless skinless chicken breasts")).toBe(
      "chicken-breast",
    );
    expect(resolveIngredient("juice of 1 lemon")).toBe("lemon");
    expect(resolveIngredient("3 garlic cloves, minced")).toBe("garlic");
    expect(resolveIngredient("freshly ground black pepper")).toBe(
      "black-pepper",
    );
  });

  it("does not guess from a fragment", () => {
    // Better an honest "missing: juice" than a confident wrong juice.
    expect(resolveIngredient("juice")).toBeUndefined();
    expect(resolveIngredient("sauce")).toBeUndefined();
    expect(resolveIngredient("to taste")).toBeUndefined();
  });
});

describe("resolveIngredient — words that change what a thing is", () => {
  it("keeps ground, dried and whole when they are part of the name", () => {
    expect(resolveIngredient("coriander")).toBe("cilantro");
    expect(resolveIngredient("ground coriander")).toBe("coriander-seed");
    expect(resolveIngredient("cranberries")).toBe("cranberry");
    expect(resolveIngredient("dried cranberries")).toBe("dried-cranberry");
    expect(resolveIngredient("whole chicken")).toBe("whole-chicken");
    expect(resolveIngredient("ground chicken")).toBe("ground-chicken");
  });

  it("round-trips every catalogue name and alias to a real entry", () => {
    // Guards the index itself: nothing in the catalogue may become
    // unresolvable, whatever else changes here.
    const lost = INGREDIENTS.flatMap((ing) =>
      [ing.name, ...ing.aliases].filter(
        (text) => resolveIngredient(text) === undefined,
      ),
    );
    expect(lost).toEqual([]);
  });
});

describe("resolveIngredient — generic words become groups", () => {
  it("answers a generic word with the group it names", () => {
    expect(resolveIngredient("nuts")).toBe("group:nut");
    expect(resolveIngredient("chopped mixed nuts")).toBe("group:nut");
    expect(resolveIngredient("cheese")).toBe("group:any-cheese");
    expect(resolveIngredient("chicken")).toBe("group:chicken");
    expect(resolveIngredient("oil")).toBe("group:cooking-oil");
    expect(resolveIngredient("white fish fillets")).toBe("group:white-fish");
  });

  it("still prefers an ingredient that owns the word outright", () => {
    expect(resolveIngredient("rice")).toBe("rice");
    expect(resolveIngredient("milk")).toBe("milk");
    expect(resolveIngredient("onion")).toBe("onion");
  });

  it("never resolves nuts to something flagged nut-free", () => {
    for (const text of ["nuts", "chopped nuts", "mixed nuts", "toasted nuts"]) {
      const id = resolveIngredient(text);
      expect(id, text).toBeDefined();
      expect(dietFlagsFor(id!).nutFree, text).toBe(false);
    }
  });
});

describe("resolveIngredient — choosing between two readings", () => {
  it("takes the reading that promises less", () => {
    // Bread admits to gluten; garlic doesn't. Reading "garlic bread" as
    // garlic would call it gluten-free.
    expect(resolveIngredient("garlic bread")).toBe("bread");
    expect(resolveIngredient("oat cream")).toBe("heavy-cream");
    expect(resolveIngredient("peanut oil")).toBe("peanuts");
    expect(resolveIngredient("chicken stock cube")).toBe("chicken-stock");
  });

  it("declines when neither reading is safe to assume", () => {
    // Nuts one way, dairy the other: either guess hides an allergen.
    expect(resolveIngredient("cashew cream")).toBeUndefined();
    expect(resolveIngredient("butter chicken")).toBeUndefined();
  });

  it("takes the last word when the readings are equally safe", () => {
    expect(resolveIngredient("salt and pepper")).toBe("black-pepper");
  });
});

describe("searchIngredients", () => {
  it("puts the obvious answer first for a prefix", () => {
    const hits = searchIngredients("on");
    expect(hits[0]?.id).toBe("onion");
  });

  it("prefers the shorter name on an exact word match", () => {
    // "rice" should beat "rice noodles" and "rice vinegar".
    expect(searchIngredients("rice")[0]?.id).toBe("rice");
  });

  it("finds ingredients by alias", () => {
    const ids = searchIngredients("coriander").map((h) => h.id);
    expect(ids).toContain("cilantro");
  });

  it("respects the limit", () => {
    expect(searchIngredients("a", 3)).toHaveLength(3);
  });

  it("returns nothing for an empty query", () => {
    expect(searchIngredients("")).toEqual([]);
  });
});
