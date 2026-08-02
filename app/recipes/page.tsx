"use client";

import { useMemo, useState } from "react";
import { RECIPES, TAGS } from "@/data/recipes";
import { matchPantry, totalTime } from "@/lib/match";
import { useStore, useToday } from "@/lib/store";
import { Main } from "@/components/shell/AppShell";
import { CardGrid, RecipeCard } from "@/components/recipe/RecipeCard";
import {
  BrowseControls,
  type BrowseSort,
} from "@/components/filters/DietFilterBar";
import {
  CardSkeleton,
  EmptyPanel,
  Headline,
} from "@/components/ui/primitives";

/**
 * The whole cookbook.
 *
 * Still scored against the fridge — even when browsing rather than asking
 * "what can I cook", knowing how close each one is stays useful. Cards here
 * use the plain voice, not the Kitchen's cheeky one.
 */
export default function BrowsePage() {
  const { state, hydrated } = useStore();
  const today = useToday();
  const [sort, setSort] = useState<BrowseSort>("match");
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const allRecipes = useMemo(
    () => [...state.invented, ...RECIPES],
    [state.invented],
  );

  const results = useMemo(() => {
    const scored = matchPantry(allRecipes, state.pantry, {
      staples: state.staples,
      diet: state.diet,
      now: today,
    });

    const needle = query.trim().toLowerCase();
    const filtered = scored.filter((r) => {
      if (tag && !r.recipe.tags.includes(tag)) return false;
      if (!needle) return true;
      return (
        r.recipe.title.toLowerCase().includes(needle) ||
        r.recipe.cuisine.toLowerCase().includes(needle) ||
        r.recipe.description.toLowerCase().includes(needle)
      );
    });

    if (sort === "quickest") {
      return [...filtered].sort(
        (a, b) => totalTime(a.recipe) - totalTime(b.recipe),
      );
    }
    if (sort === "alphabetical") {
      return [...filtered].sort((a, b) =>
        a.recipe.title.localeCompare(b.recipe.title),
      );
    }
    return filtered;
  }, [allRecipes, state.pantry, state.staples, state.diet, today, sort, tag, query]);

  return (
    <Main>
      <Headline before="the whole " accent="cookbook" after="." />
      <p
        style={{
          margin: "12px 0 0",
          fontSize: 15,
          fontWeight: 500,
          color: "var(--ink-60)",
        }}
      >
        {allRecipes.length} recipes, every one scored against your fridge.
      </p>

      <BrowseControls
        sort={sort}
        onSort={setSort}
        tags={TAGS}
        activeTag={tag}
        onTag={setTag}
        query={query}
        onQuery={setQuery}
      />

      {!hydrated ? (
        <CardSkeleton count={6} />
      ) : results.length === 0 ? (
        <EmptyPanel glyph="🥄" title="nothing matches.">
          try clearing the search, the mood, or an eating rule.
        </EmptyPanel>
      ) : (
        <>
          <p
            style={{
              margin: "24px 0 0",
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-45)",
            }}
          >
            showing {results.length}{" "}
            {results.length === 1 ? "recipe" : "recipes"}
          </p>
          <CardGrid marginTop={14}>
            {results.map((result, idx) => (
              <RecipeCard key={result.recipe.id} result={result} index={idx} />
            ))}
          </CardGrid>
        </>
      )}
    </Main>
  );
}
