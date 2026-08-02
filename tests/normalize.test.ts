import { describe, expect, it } from "vitest";
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
