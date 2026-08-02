"use client";

import { getIngredient } from "@/data/ingredients";
import {
  orphanedItems,
  rescueResults,
  turningSummary,
  type TurningItem,
} from "@/lib/rescue";
import { expiryLabel } from "@/lib/voice";
import { CardGrid, RecipeCard } from "@/components/recipe/RecipeCard";
import { CountPill } from "@/components/ui/primitives";
import type { MatchResult } from "@/lib/types";

/**
 * "Use it or lose it" — the first thing you see when something is turning.
 *
 * This is the app's actual edge over the incumbents, so it gets the top of the
 * screen rather than a badge on a card. It also asks a narrower question than
 * the tiers below it — "what uses this spinach" instead of "what can I cook" —
 * which a curated library answers far better than a broad one.
 *
 * Renders nothing at all when nothing is turning, so a well-stocked fridge
 * sees the Kitchen exactly as before.
 */
export function RescueBoard({
  results,
  turning,
}: {
  results: MatchResult[];
  turning: TurningItem[];
}) {
  if (turning.length === 0) return null;

  const rescue = rescueResults(results, turning);
  const orphans = orphanedItems(results, turning);

  return (
    <section
      style={{
        marginTop: 26,
        borderRadius: 24,
        padding: "22px 22px 26px",
        background: "var(--peach)",
        border: "2px solid var(--orange)",
        transform: "rotate(-0.3deg)",
        boxShadow: "6px 6px 0 var(--tan-shadow)",
      }}
    >
      <div className="flex flex-wrap items-baseline" style={{ gap: 10 }}>
        <h2
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: "-0.02em",
            color: "var(--brown)",
          }}
        >
          use it or lose it
        </h2>
        <CountPill color="var(--brown)" bg="var(--surface)">
          {turning.length}
        </CountPill>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--brown)", opacity: 0.75 }}>
          {turningSummary(turning)}
        </span>
      </div>

      {/* What's turning */}
      <div className="flex flex-wrap" style={{ gap: 8, marginTop: 14 }}>
        {turning.map(({ item, days }) => {
          const ing = getIngredient(item.ingredientId);
          return (
            <span
              key={item.ingredientId}
              className="flex items-center"
              style={{
                gap: 6,
                borderRadius: 999,
                padding: "6px 13px",
                fontSize: 13,
                fontWeight: 700,
                background: "var(--surface)",
                border: "1.5px solid var(--orange)",
                color: "var(--brown)",
              }}
            >
              {ing?.emoji && <span aria-hidden>{ing.emoji}</span>}
              {(ing?.name ?? item.ingredientId).toLowerCase()}
              <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.75 }}>
                {expiryLabel(days)}
              </span>
            </span>
          );
        })}
      </div>

      {rescue.length > 0 ? (
        <>
          <p
            style={{
              margin: "18px 0 0",
              fontSize: 13,
              fontWeight: 700,
              color: "var(--brown)",
            }}
          >
            cook one of these and nothing goes in the bin →
          </p>
          <CardGrid marginTop={12}>
            {rescue.map((result, idx) => (
              <RecipeCard
                key={result.recipe.id}
                result={result}
                index={idx}
                voice="kitchen"
                showRescue
              />
            ))}
          </CardGrid>
        </>
      ) : (
        <p
          style={{
            margin: "16px 0 0",
            fontSize: 14,
            fontWeight: 600,
            lineHeight: 1.55,
            color: "var(--brown)",
            maxWidth: "48ch",
          }}
        >
          nothing in the cookbook rescues these without a shop. add another
          ingredient or two and check back.
        </p>
      )}

      {/*
        Told plainly rather than hidden. It's honest, and it's the clearest
        signal we have of where the recipe library is thin.
      */}
      {rescue.length > 0 && orphans.length > 0 && (
        <p
          style={{
            margin: "14px 0 0",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--brown)",
            opacity: 0.8,
          }}
        >
          nothing here saves the{" "}
          {orphans.map((o) => o.name.toLowerCase()).join(", ")} — you&apos;d
          need a shop for that.
        </p>
      )}
    </section>
  );
}
