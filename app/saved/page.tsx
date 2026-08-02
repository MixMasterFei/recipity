"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RECIPES, RECIPE_BY_SLUG } from "@/data/recipes";
import { scoreRecipe } from "@/lib/match";
import { useStore, useToday } from "@/lib/store";
import { RecipeCard } from "@/components/recipe/RecipeCard";
import { Button, EmptyState, SkeletonGrid } from "@/components/ui/primitives";
import type { Recipe } from "@/lib/types";

/**
 * Saved recipes, invented recipes, and cook history.
 *
 * History is deliberately simple — what you cooked and when. It's enough to
 * answer "what did I make last Tuesday" without turning into a food diary.
 */
export default function SavedPage() {
  const { state, hydrated } = useStore();
  const today = useToday();

  const lookup = useMemo(() => {
    const map = new Map<string, Recipe>(RECIPE_BY_SLUG);
    for (const r of state.invented) map.set(r.id, r);
    return map;
  }, [state.invented]);

  const favorites = useMemo(
    () =>
      state.favorites
        .map((id) => lookup.get(id))
        .filter((r): r is Recipe => Boolean(r))
        .map((recipe) =>
          scoreRecipe(recipe, state.pantry, {
            staples: state.staples,
            now: today,
          }),
        ),
    [state.favorites, lookup, state.pantry, state.staples, today],
  );

  const invented = useMemo(
    () =>
      state.invented.map((recipe) =>
        scoreRecipe(recipe, state.pantry, {
          staples: state.staples,
          now: today,
        }),
      ),
    [state.invented, state.pantry, state.staples, today],
  );

  const history = useMemo(
    () =>
      state.history
        .map((event) => ({ event, recipe: lookup.get(event.recipeId) }))
        .filter((entry): entry is { event: typeof entry.event; recipe: Recipe } =>
          Boolean(entry.recipe),
        )
        .slice(0, 20),
    [state.history, lookup],
  );

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div className="skeleton mb-6 h-10 w-40 rounded" />
        <SkeletonGrid count={3} />
      </div>
    );
  }

  const nothingAtAll =
    favorites.length === 0 && invented.length === 0 && history.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1
          className="font-display text-3xl leading-tight sm:text-4xl"
          style={{ color: "var(--text)" }}
        >
          Saved
        </h1>
      </header>

      {nothingAtAll ? (
        <EmptyState
          icon={<span className="text-2xl">♡</span>}
          title="Nothing saved yet"
          action={
            <Link href="/recipes">
              <Button variant="primary">Browse recipes</Button>
            </Link>
          }
        >
          Tap the heart on any recipe to keep it here. Recipes Claude invents for
          you also land on this page.
        </EmptyState>
      ) : (
        <div className="space-y-10">
          {favorites.length > 0 && (
            <section>
              <h2
                className="font-display mb-4 text-xl"
                style={{ color: "var(--text)" }}
              >
                Favourites{" "}
                <span
                  className="text-sm tabular-nums"
                  style={{ color: "var(--text-faint)" }}
                >
                  {favorites.length}
                </span>
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {favorites.map((result) => (
                  <RecipeCard key={result.recipe.id} result={result} />
                ))}
              </div>
            </section>
          )}

          {invented.length > 0 && (
            <section>
              <h2
                className="font-display mb-1 text-xl"
                style={{ color: "var(--text)" }}
              >
                ✨ Invented for you{" "}
                <span
                  className="text-sm tabular-nums"
                  style={{ color: "var(--text-faint)" }}
                >
                  {invented.length}
                </span>
              </h2>
              <p className="mb-4 text-sm" style={{ color: "var(--text-muted)" }}>
                Written by Claude from what was in your kitchen at the time.
              </p>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {invented.map((result) => (
                  <RecipeCard key={result.recipe.id} result={result} />
                ))}
              </div>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h2
                className="font-display mb-4 text-xl"
                style={{ color: "var(--text)" }}
              >
                Recently cooked
              </h2>
              <ul className="space-y-1.5">
                {history.map(({ event, recipe }, idx) => (
                  <li key={`${event.recipeId}-${idx}`}>
                    <Link
                      href={`/recipes/${recipe.slug}`}
                      className="surface-flat flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:shadow-[var(--shadow-card)]"
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-sm font-medium"
                          style={{ color: "var(--text)" }}
                        >
                          {recipe.title}
                        </span>
                        <span
                          className="block text-xs"
                          style={{ color: "var(--text-faint)" }}
                        >
                          {formatWhen(event.cookedAt)}
                        </span>
                      </span>
                      <span style={{ color: "var(--text-faint)" }} aria-hidden>
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

function formatWhen(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  });
}
