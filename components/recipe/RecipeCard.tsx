"use client";

import Link from "next/link";
import { ingredientName } from "@/data/ingredients";
import { recipeDietTags } from "@/lib/diet";
import { totalTime } from "@/lib/match";
import { useStore } from "@/lib/store";
import {
  Badge,
  CoverageRing,
  cuisineGlyph,
  recipeArtwork,
  STATUS_META,
} from "@/components/ui/primitives";
import type { MatchResult } from "@/lib/types";

/**
 * One recipe in a grid.
 *
 * The coverage ring and the missing-ingredient line are the two things a person
 * actually scans for, so they get the most prominent positions.
 */
export function RecipeCard({ result }: { result: MatchResult }) {
  const { recipe, status, coverage, missing, rescues } = result;
  const { state, actions } = useStore();
  const art = recipeArtwork(recipe.slug);
  const meta = STATUS_META[status];
  const saved = state.favorites.includes(recipe.id);
  const dietTags = recipeDietTags(recipe);

  return (
    <article
      className="surface group relative flex flex-col overflow-hidden rounded-2xl transition-all hover:shadow-[var(--shadow-lift)]"
      style={{ transitionDuration: "220ms" }}
    >
      <Link href={`/recipes/${recipe.slug}`} className="flex flex-1 flex-col">
        <div
          className="relative flex h-24 items-center justify-center"
          style={{ background: art.gradient }}
        >
          <span className="text-3xl opacity-90 drop-shadow-sm" aria-hidden>
            {cuisineGlyph(recipe.cuisine)}
          </span>
          <div className="absolute right-3 top-3">
            <CoverageRing
              coverage={coverage}
              status={status}
              missingCount={missing.length}
              size={44}
            />
          </div>
          {rescues.length > 0 && (
            <span
              className="absolute left-3 top-3 rounded-full px-2 py-0.5 text-[0.68rem] font-semibold"
              style={{ background: "var(--bg-raised)", color: "var(--stretch)" }}
            >
              ⏳ Uses {ingredientName(rescues[0] ?? "")}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <div className="mb-1.5 flex items-center gap-2 text-xs" style={{ color: "var(--text-faint)" }}>
            <span>{recipe.cuisine}</span>
            <span aria-hidden>·</span>
            <span>{totalTime(recipe)} min</span>
            <span aria-hidden>·</span>
            <span>Serves {recipe.servings}</span>
          </div>

          <h3
            className="font-display text-lg leading-tight"
            style={{ color: "var(--text)" }}
          >
            {recipe.title}
          </h3>

          <p
            className="mt-1.5 line-clamp-2 text-sm leading-relaxed"
            style={{ color: "var(--text-muted)" }}
          >
            {recipe.description}
          </p>

          <div className="mt-auto pt-3">
            {missing.length === 0 ? (
              <span
                className="text-sm font-medium"
                style={{ color: meta.color }}
              >
                ✓ You have everything
              </span>
            ) : (
              <span className="text-sm" style={{ color: "var(--text-muted)" }}>
                <span style={{ color: meta.color }} className="font-medium">
                  Need{" "}
                </span>
                {missing.slice(0, 3).map(ingredientName).join(", ")}
                {missing.length > 3 && ` +${missing.length - 3} more`}
              </span>
            )}

            {dietTags.includes("vegan") && (
              <Badge className="ml-2" color="var(--ready)" bg="var(--ready-bg)">
                Vegan
              </Badge>
            )}
          </div>
        </div>
      </Link>

      <button
        onClick={() => actions.toggleFavorite(recipe.id)}
        aria-label={saved ? "Remove from saved" : "Save recipe"}
        aria-pressed={saved}
        className="absolute bottom-3 right-3 rounded-full p-2 transition-all hover:scale-110 active:scale-90"
        style={{
          background: "var(--bg-sunken)",
          color: saved ? "var(--stretch)" : "var(--text-faint)",
        }}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill={saved ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M19.5 5.5a5 5 0 0 0-7.5.6 5 5 0 0 0-7.5-.6 5.2 5.2 0 0 0 0 7.3L12 20.5l7.5-7.7a5.2 5.2 0 0 0 0-7.3z" />
        </svg>
      </button>
    </article>
  );
}

/** A titled band of results, used for the ready / almost / stretch tiers. */
export function ResultSection({
  title,
  subtitle,
  color,
  results,
  limit,
}: {
  title: string;
  subtitle?: string;
  color?: string;
  results: MatchResult[];
  limit?: number;
}) {
  if (results.length === 0) return null;
  const shown = limit ? results.slice(0, limit) : results;

  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2
          className="font-display text-xl"
          style={{ color: color ?? "var(--text)" }}
        >
          {title}
        </h2>
        <span className="text-sm tabular-nums" style={{ color: "var(--text-faint)" }}>
          {results.length}
        </span>
        {subtitle && (
          <span className="text-sm" style={{ color: "var(--text-muted)" }}>
            {subtitle}
          </span>
        )}
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {shown.map((result) => (
          <RecipeCard key={result.recipe.id} result={result} />
        ))}
      </div>
    </section>
  );
}
