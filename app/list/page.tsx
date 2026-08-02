"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AISLE_LABEL, getIngredient } from "@/data/ingredients";
import { RECIPE_BY_SLUG } from "@/data/recipes";
import { groupByAisle } from "@/lib/shopping";
import { useStore } from "@/lib/store";
import { Main } from "@/components/shell/AppShell";
import {
  Button,
  EmptyPanel,
  Headline,
  PillLinkStyle,
  RowSkeleton,
  cx,
} from "@/components/ui/primitives";

/**
 * The haul.
 *
 * Deduped across recipes and grouped by aisle so you walk the shop once. The
 * useful trick is "move to my kitchen": ticking things off and pressing one
 * button updates the pantry, which immediately re-ranks every recipe.
 */
export default function ShoppingPage() {
  const { state, hydrated, actions } = useStore();

  const groups = useMemo(
    () => groupByAisle(state.shoppingList),
    [state.shoppingList],
  );

  const checkedCount = state.shoppingList.filter((i) => i.checked).length;
  const total = state.shoppingList.length;

  if (!hydrated) {
    return (
      <Main max={760}>
        <Headline before="the " accent="haul" after="." />
        <RowSkeleton count={5} />
      </Main>
    );
  }

  return (
    <Main max={760}>
      <Headline before="the " accent="haul" after="." />

      {total > 0 && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 15,
            fontWeight: 500,
            color: "var(--ink-60)",
          }}
        >
          {checkedCount} of {total} in the basket, grouped by aisle so you walk
          the shop once.
        </p>
      )}

      {total === 0 ? (
        <EmptyPanel
          glyph="🛒"
          title="the cart is empty. sinister."
          bodyWidth="42ch"
          action={
            <Link href="/" style={PillLinkStyle("primary")}>
              find dinners →
            </Link>
          }
        >
          open any recipe you&apos;re missing things for and hit &ldquo;add
          missing to the haul&rdquo;. duplicates merge themselves.
        </EmptyPanel>
      ) : (
        <>
          {checkedCount > 0 && (
            <div
              className="flex flex-wrap items-center justify-between"
              style={{
                marginTop: 20,
                gap: 12,
                borderRadius: 16,
                padding: "14px 18px",
                background: "var(--green-fill)",
                border: "2px solid var(--green-stroke)",
                transform: "rotate(-0.4deg)",
                boxShadow: "4px 4px 0 var(--green-pale)",
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
                {checkedCount} {checkedCount === 1 ? "thing" : "things"} in the
                basket. nice.
              </span>
              <button
                onClick={actions.checkedToPantry}
                className="msc-press"
                style={{
                  borderRadius: 999,
                  fontWeight: 700,
                  fontSize: 13,
                  padding: "8px 15px",
                  background: "var(--surface)",
                  border: "2px solid var(--green-text)",
                  color: "var(--ink)",
                }}
              >
                move to my kitchen 🏠
              </button>
            </div>
          )}

          <div
            style={{
              marginTop: 24,
              display: "flex",
              flexDirection: "column",
              gap: 26,
            }}
          >
            {groups.map((group) => (
              <section key={group.aisle}>
                <h2
                  style={{
                    margin: "0 0 10px",
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: "0.14em",
                    color: "var(--ink-45)",
                  }}
                >
                  {AISLE_LABEL[group.aisle].toUpperCase()}
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
                  {group.items.map((item) => {
                    const ing = getIngredient(item.ingredientId);
                    const recipeNames = item.forRecipes
                      .map((id) => RECIPE_BY_SLUG.get(id)?.title)
                      .filter(Boolean);

                    return (
                      <li key={item.ingredientId}>
                        <div
                          className="flex items-center"
                          style={{
                            gap: 12,
                            borderRadius: 14,
                            padding: "11px 14px",
                            background: "var(--surface)",
                            border: "2px solid var(--tan-border)",
                            opacity: item.checked ? 0.55 : 1,
                          }}
                        >
                          <button
                            onClick={() =>
                              actions.toggleShoppingItem(item.ingredientId)
                            }
                            role="checkbox"
                            aria-checked={item.checked}
                            aria-label={`Tick off ${ing?.name ?? item.ingredientId}`}
                            className="grid shrink-0 place-items-center"
                            style={{
                              height: 24,
                              width: 24,
                              borderRadius: 8,
                              transition: "background 150ms",
                              background: item.checked
                                ? "var(--green-stroke)"
                                : "var(--ground)",
                              border: `2px solid ${
                                item.checked
                                  ? "var(--green-text)"
                                  : "var(--tan-dashed)"
                              }`,
                              color: "#ffffff",
                              fontWeight: 800,
                              fontSize: 13,
                            }}
                          >
                            {item.checked ? "✓" : ""}
                          </button>

                          <span className="min-w-0 flex-1">
                            <span
                              className={cx("block", item.checked && "line-through")}
                              style={{
                                fontSize: 14,
                                fontWeight: 600,
                                color: "var(--ink)",
                              }}
                            >
                              {ing?.emoji && (
                                <span style={{ marginRight: 4 }} aria-hidden>
                                  {ing.emoji}
                                </span>
                              )}
                              {(ing?.name ?? item.ingredientId).toLowerCase()}
                            </span>
                            {recipeNames.length > 0 && (
                              <span
                                className="block truncate"
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  color: "var(--ink-45)",
                                }}
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
                            className="msc-hover-orange shrink-0"
                            style={{
                              fontWeight: 800,
                              fontSize: 13,
                              color: "var(--ink-35)",
                              padding: 4,
                            }}
                          >
                            ✕
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <div style={{ marginTop: 32, display: "flex", justifyContent: "center" }}>
            <Button
              variant="quiet"
              onClick={() => {
                if (confirm("Torch the whole list?")) actions.clearShoppingList();
              }}
            >
              torch the whole list 🔥
            </Button>
          </div>
        </>
      )}
    </Main>
  );
}
