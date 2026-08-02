"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { scoreRecipe } from "@/lib/match";
import { useStore, useToday } from "@/lib/store";
import { Main } from "@/components/shell/AppShell";
import { CardGrid, RecipeCard } from "@/components/recipe/RecipeCard";
import {
  CardSkeleton,
  CountPill,
  EmptyPanel,
  Headline,
  PillLinkStyle,
} from "@/components/ui/primitives";
import type { Recipe } from "@/lib/types";

/** The keepers — favourites, invented recipes, and what you've cooked. */
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
        .filter((e): e is { event: typeof e.event; recipe: Recipe } =>
          Boolean(e.recipe),
        )
        .slice(0, 20),
    [state.history, lookup],
  );

  if (!hydrated) {
    return (
      <Main>
        <Headline before="the " accent="keepers" after="." />
        <CardSkeleton />
      </Main>
    );
  }

  const nothingAtAll =
    favorites.length === 0 && invented.length === 0 && history.length === 0;

  return (
    <Main>
      <Headline before="the " accent="keepers" after="." />

      {nothingAtAll ? (
        <EmptyPanel
          glyph="🤍"
          title="no keepers yet."
          action={
            <Link href="/recipes" style={PillLinkStyle("primary")}>
              browse the cookbook →
            </Link>
          }
        >
          tap the heart on any recipe and it lives here forever. or until you
          unheart it. brutal.
        </EmptyPanel>
      ) : (
        <div
          style={{
            marginTop: 24,
            display: "flex",
            flexDirection: "column",
            gap: 40,
          }}
        >
          {favorites.length > 0 && (
            <section>
              <div className="flex items-baseline" style={{ gap: 10 }}>
                <h2
                  style={{
                    margin: 0,
                    fontWeight: 800,
                    fontSize: 28,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                  }}
                >
                  hearted
                </h2>
                <CountPill color="var(--amber)" bg="var(--peach)">
                  {favorites.length}
                </CountPill>
              </div>
              <CardGrid>
                {favorites.map((result, idx) => (
                  <RecipeCard
                    key={result.recipe.id}
                    result={result}
                    index={idx}
                    forceSaved
                  />
                ))}
              </CardGrid>
            </section>
          )}

          {invented.length > 0 && (
            <section>
              <div className="flex items-baseline" style={{ gap: 10 }}>
                <h2
                  style={{
                    margin: 0,
                    fontWeight: 800,
                    fontSize: 28,
                    letterSpacing: "-0.02em",
                    color: "var(--ink)",
                  }}
                >
                  ✨ invented for you
                </h2>
                <CountPill color="var(--sky-deep)" bg="var(--sky)">
                  {invented.length}
                </CountPill>
              </div>
              <CardGrid>
                {invented.map((result, idx) => (
                  <RecipeCard
                    key={result.recipe.id}
                    result={result}
                    index={idx}
                  />
                ))}
              </CardGrid>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h2
                style={{
                  margin: "0 0 14px",
                  fontWeight: 800,
                  fontSize: 28,
                  letterSpacing: "-0.02em",
                  color: "var(--ink)",
                }}
              >
                cooked &amp; conquered
              </h2>
              <ul
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {history.map(({ event, recipe }, idx) => (
                  <li key={`${event.recipeId}-${idx}`}>
                    <Link
                      href={`/recipes/${recipe.slug}`}
                      className="msc-hover-sky flex items-center"
                      style={{
                        gap: 12,
                        borderRadius: 14,
                        padding: "12px 16px",
                        background: "var(--surface)",
                        border: "2px solid var(--tan-border)",
                        transition: "border-color 150ms",
                      }}
                    >
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate"
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: "var(--ink)",
                          }}
                        >
                          {recipe.title}
                        </span>
                        <span
                          className="block"
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            color: "var(--ink-45)",
                          }}
                        >
                          {formatWhen(event.cookedAt)}
                        </span>
                      </span>
                      <span
                        style={{ color: "var(--sky-deep)", fontWeight: 800 }}
                        aria-hidden
                      >
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
    </Main>
  );
}

function formatWhen(iso: string): string {
  const then = new Date(iso);
  const days = Math.floor((Date.now() - then.getTime()) / 86_400_000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return then
    .toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year:
        then.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    })
    .toLowerCase();
}
