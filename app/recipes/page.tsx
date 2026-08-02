"use client";

import { useMemo, useState } from "react";
import { RECIPES, TAGS } from "@/data/recipes";
import { matchPantry, totalTime } from "@/lib/match";
import { useStore, useToday } from "@/lib/store";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import {
  BrowseControls,
  DietFilterBar,
  type BrowseSort,
} from "@/components/filters/DietFilterBar";
import { EmptyState, SkeletonGrid } from "@/components/ui/primitives";

/**
 * Browse the whole library.
 *
 * Still scored against the pantry — even when you're browsing rather than
 * asking "what can I cook", knowing how close each recipe is stays useful.
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
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-5">
        <h1
          className="font-display text-3xl leading-tight sm:text-4xl"
          style={{ color: "var(--text)" }}
        >
          All recipes
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
          {allRecipes.length}{" "}
          {allRecipes.length === 1 ? "recipe" : "recipes"}, each scored against
          what&apos;s in your kitchen.
        </p>
      </header>

      <div className="mb-6 space-y-4">
        <BrowseControls
          sort={sort}
          onSort={setSort}
          tags={TAGS}
          activeTag={tag}
          onTag={setTag}
          query={query}
          onQuery={setQuery}
        />
        <DietFilterBar label="Diet" />
      </div>

      {!hydrated ? (
        <SkeletonGrid count={9} />
      ) : results.length === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">🥄</span>}
          title="Nothing matches"
        >
          Try clearing the search, the tag filter, or a dietary restriction.
        </EmptyState>
      ) : (
        <>
          <p className="mb-4 text-sm" style={{ color: "var(--text-faint)" }}>
            Showing {results.length} recipe{results.length === 1 ? "" : "s"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {results.map((result) => (
              <RecipeCard key={result.recipe.id} result={result} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
