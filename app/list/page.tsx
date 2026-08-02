"use client";

import Link from "next/link";
import { useMemo } from "react";
import { getIngredient } from "@/data/ingredients";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { groupByAisle } from "@/lib/shopping";
import { useStore } from "@/lib/store";
import {
  Button,
  EmptyState,
  cx,
} from "@/components/ui/primitives";

/**
 * Shopping list — deduped across recipes and grouped by aisle.
 *
 * The useful trick here is "move bought items into the kitchen": ticking things
 * off and pressing one button updates the pantry, which immediately re-ranks
 * every recipe in the app.
 */
export default function ShoppingListPage() {
  const { state, hydrated, actions } = useStore();

  const groups = useMemo(
    () => groupByAisle(state.shoppingList),
    [state.shoppingList],
  );

  const checkedCount = state.shoppingList.filter((i) => i.checked).length;
  const total = state.shoppingList.length;

  if (!hydrated) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10 sm:px-6">
        <div className="skeleton mb-6 h-10 w-48 rounded" />
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="skeleton h-12 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6 lg:py-10">
      <header className="mb-6">
        <h1
          className="font-display text-3xl leading-tight sm:text-4xl"
          style={{ color: "var(--text)" }}
        >
          Shopping list
        </h1>
        {total > 0 && (
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            {checkedCount} of {total} ticked off, grouped by aisle.
          </p>
        )}
      </header>

      {total === 0 ? (
        <EmptyState
          icon={<span className="text-2xl">🛒</span>}
          title="Nothing on the list"
          action={
            <Link href="/">
              <Button variant="primary">Find recipes</Button>
            </Link>
          }
        >
          Open any recipe you&apos;re missing ingredients for and press
          &ldquo;add missing to list&rdquo;. Items from different recipes get
          merged automatically.
        </EmptyState>
      ) : (
        <>
          {checkedCount > 0 && (
            <div
              className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ background: "var(--ready-bg)" }}
            >
              <span className="text-sm" style={{ color: "var(--ready)" }}>
                {checkedCount} item{checkedCount === 1 ? "" : "s"} in the basket
              </span>
              <Button
                size="sm"
                variant="primary"
                onClick={actions.checkedToPantry}
              >
                Move to my kitchen
              </Button>
            </div>
          )}

          <div className="space-y-6">
            {groups.map((group) => (
              <section key={group.aisle}>
                <h2
                  className="mb-2 text-xs font-semibold uppercase tracking-wide"
                  style={{ color: "var(--text-faint)" }}
                >
                  {group.label}
                </h2>
                <ul className="space-y-1.5">
                  {group.items.map((item) => {
                    const ing = getIngredient(item.ingredientId);
                    const recipeNames = item.forRecipes
                      .map((id) => RECIPE_BY_SLUG.get(id)?.title)
                      .filter(Boolean);

                    return (
                      <li key={item.ingredientId}>
                        <div
                          className="surface-flat flex items-center gap-3 rounded-xl px-3 py-2.5"
                          style={{ opacity: item.checked ? 0.55 : 1 }}
                        >
                          <button
                            onClick={() =>
                              actions.toggleShoppingItem(item.ingredientId)
                            }
                            role="checkbox"
                            aria-checked={item.checked}
                            aria-label={`Tick off ${ing?.name ?? item.ingredientId}`}
                            className="grid h-5 w-5 shrink-0 place-items-center rounded-md transition-colors"
                            style={{
                              background: item.checked
                                ? "var(--ready)"
                                : "transparent",
                              border: `1.5px solid ${
                                item.checked ? "var(--ready)" : "var(--border-strong)"
                              }`,
                              color: "var(--bg)",
                            }}
                          >
                            {item.checked && (
                              <svg
                                width={12}
                                height={12}
                                viewBox="0 0 16 16"
                                fill="none"
                                aria-hidden
                              >
                                <path
                                  d="M3 8.5L6.5 12L13 4.5"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              </svg>
                            )}
                          </button>

                          <span className="min-w-0 flex-1">
                            <span
                              className={cx(
                                "block text-sm",
                                item.checked && "line-through",
                              )}
                              style={{ color: "var(--text)" }}
                            >
                              {ing?.emoji && (
                                <span className="mr-1" aria-hidden>
                                  {ing.emoji}
                                </span>
                              )}
                              {ing?.name ?? item.ingredientId}
                            </span>
                            {recipeNames.length > 0 && (
                              <span
                                className="block truncate text-xs"
                                style={{ color: "var(--text-faint)" }}
                              >
                                for {recipeNames.join(", ")}
                              </span>
                            )}
                          </span>

                          <button
                            onClick={() =>
                              actions.removeShoppingItem(item.ingredientId)
                            }
                            aria-label={`Remove ${ing?.name ?? "item"} from list`}
                            className="shrink-0 rounded-full p-1.5 transition-colors hover:bg-[var(--bg-sunken)]"
                            style={{ color: "var(--text-faint)" }}
                          >
                            <svg
                              width={14}
                              height={14}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={2}
                              strokeLinecap="round"
                              aria-hidden
                            >
                              <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <div className="mt-8 flex justify-center">
            <Button
              variant="ghost"
              onClick={() => {
                if (confirm("Clear the whole shopping list?"))
                  actions.clearShoppingList();
              }}
            >
              Clear list
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
