"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RECIPES } from "@/data/recipes";
import { ingredientName } from "@/data/ingredients";
import { groupByStatus, matchPantry } from "@/lib/match";
import { highestLeverageBuy } from "@/lib/shopping";
import { useStore, useToday } from "@/lib/store";
import {
  DemoPantryButton,
  PantryInput,
  QuickAdd,
} from "@/components/pantry/PantryInput";
import {
  ExpiringBanner,
  PantryShelf,
  StaplesEditor,
} from "@/components/pantry/PantryShelf";
import { ResultSection } from "@/components/recipe/RecipeCard";
import { DietFilterBar } from "@/components/filters/DietFilterBar";
import { InventPanel } from "@/components/invent/InventPanel";
import {
  Button,
  EmptyState,
  SkeletonGrid,
  STATUS_META,
} from "@/components/ui/primitives";

/**
 * The Kitchen — the app's front door.
 *
 * Add what you have at the top; the three match tiers re-rank live underneath.
 */
export default function KitchenPage() {
  const { state, hydrated, actions } = useStore();
  const today = useToday();

  // Bundled recipes plus anything Claude has invented for this user.
  const allRecipes = useMemo(
    () => [...state.invented, ...RECIPES],
    [state.invented],
  );

  const results = useMemo(
    () =>
      matchPantry(allRecipes, state.pantry, {
        staples: state.staples,
        diet: state.diet,
        now: today,
      }),
    [allRecipes, state.pantry, state.staples, state.diet, today],
  );

  const { ready, almost, stretch } = useMemo(
    () => groupByStatus(results),
    [results],
  );

  const leverage = useMemo(() => highestLeverageBuy(results), [results]);
  const hasPantry = state.pantry.length > 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1
          className="font-display text-3xl leading-tight sm:text-4xl"
          style={{ color: "var(--text)" }}
        >
          What can I cook?
        </h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>
          Add what&apos;s in your fridge and cupboards. Recipity ranks every recipe
          by how much of it you can already make.
        </p>
      </header>

      <div className="mb-5">
        <PantryInput autoFocus={!hasPantry} />
        {hydrated && !hasPantry && <QuickAdd />}
      </div>

      {!hydrated ? (
        <div className="space-y-6">
          <div className="skeleton h-12 w-full rounded-2xl" />
          <SkeletonGrid count={6} />
        </div>
      ) : !hasPantry ? (
        <EmptyState
          icon={<span className="text-2xl">🧺</span>}
          title="Your kitchen is empty"
          action={<DemoPantryButton />}
        >
          Add a few ingredients above and recipes will appear instantly — sorted
          by how close you are to being able to cook them. Nothing is sent
          anywhere; it all stays in this browser.
        </EmptyState>
      ) : (
        <>
          <div className="mb-6 space-y-4">
            <ExpiringBanner />
            <PantryShelf />
            <QuickAdd />
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <StaplesEditor />
            </div>
          </div>

          <div
            className="mb-8 border-t pt-6"
            style={{ borderColor: "var(--border)" }}
          >
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                  <strong style={{ color: "var(--text)" }}>
                    {ready.length}
                  </strong>{" "}
                  {ready.length === 1 ? "recipe" : "recipes"} you can make right
                  now, from {state.pantry.length}{" "}
                  {state.pantry.length === 1 ? "ingredient" : "ingredients"}.
                </p>
              </div>
              <DietFilterBar />
            </div>

            {leverage && (
              <Link
                href="/list"
                className="mb-6 flex items-center gap-3 rounded-2xl px-4 py-3 text-sm transition-all hover:shadow-[var(--shadow-card)]"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                }}
              >
                <span className="text-lg" aria-hidden>
                  💡
                </span>
                <span>
                  Buy{" "}
                  <strong>{ingredientName(leverage.ingredientId)}</strong> and
                  you unlock{" "}
                  <strong>
                    {leverage.unlocks} more recipe
                    {leverage.unlocks === 1 ? "" : "s"}
                  </strong>
                  .
                </span>
              </Link>
            )}

            <InventPanel />

            <ResultSection
              title="Ready to cook"
              subtitle="Nothing missing"
              color={STATUS_META.ready.color}
              results={ready}
            />
            <ResultSection
              title="Almost there"
              subtitle="One or two ingredients short"
              color={STATUS_META.almost.color}
              results={almost}
              limit={12}
            />
            <ResultSection
              title="Worth a shop"
              color={STATUS_META.stretch.color}
              results={stretch}
              limit={6}
            />

            {results.length === 0 && (
              <EmptyState
                icon={<span className="text-2xl">🥄</span>}
                title="No recipes match your filters"
                action={
                  <Button
                    onClick={() =>
                      actions.setDiet({ ...state.diet, restrictions: [] })
                    }
                  >
                    Clear dietary filters
                  </Button>
                }
              >
                Your dietary restrictions are excluding everything in the
                library. Try relaxing one.
              </EmptyState>
            )}

            {stretch.length > 6 && (
              <div className="text-center">
                <Link href="/recipes">
                  <Button variant="secondary">
                    Browse all {allRecipes.length} recipes
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
