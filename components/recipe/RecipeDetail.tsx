"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { getIngredient, ingredientName } from "@/data/ingredients";
import { recipeDietTags, DIET_LABELS } from "@/lib/diet";
import { scoreRecipe, totalTime } from "@/lib/match";
import { useStore, useToday } from "@/lib/store";
import {
  Badge,
  Button,
  CoverageRing,
  cuisineGlyph,
  recipeArtwork,
  STATUS_META,
  cx,
} from "@/components/ui/primitives";
import type {
  IngredientMatch,
  Recipe,
  RecipeIngredient,
} from "@/lib/types";

/**
 * Full recipe view.
 *
 * Every ingredient line is annotated with whether you have it, can substitute
 * it, or need to buy it — that's the difference between a recipe page and a
 * recipe page that knows about your kitchen.
 */
export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { state, actions } = useStore();
  const today = useToday();
  const [servings, setServings] = useState(recipe.servings);
  const [done, setDone] = useState<Set<number>>(new Set());

  const result = useMemo(
    () =>
      scoreRecipe(recipe, state.pantry, {
        staples: state.staples,
        now: today,
      }),
    [recipe, state.pantry, state.staples, today],
  );

  const matchByRef = useMemo(() => {
    const map = new Map<string, IngredientMatch>();
    for (const m of result.matches) map.set(m.ref, m);
    return map;
  }, [result.matches]);

  const art = recipeArtwork(recipe.slug);
  const meta = STATUS_META[result.status];
  const saved = state.favorites.includes(recipe.id);
  const scale = servings / recipe.servings;
  const dietTags = recipeDietTags(recipe);
  const onList = new Set(state.shoppingList.map((i) => i.ingredientId));
  const allMissingOnList =
    result.missing.length > 0 && result.missing.every((id) => onList.has(id));

  const toggleStep = (index: number) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <article className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:py-10">
      <Link
        href="/recipes"
        className="mb-5 inline-flex items-center gap-1.5 text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        <svg
          width={16}
          height={16}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m15 18-6-6 6-6" />
        </svg>
        All recipes
      </Link>

      <header
        className="surface mb-6 overflow-hidden rounded-3xl"
        style={{ borderRadius: "1.5rem" }}
      >
        <div
          className="flex h-32 items-center justify-center sm:h-40"
          style={{ background: art.gradient }}
        >
          <span className="text-5xl opacity-90 drop-shadow" aria-hidden>
            {cuisineGlyph(recipe.cuisine)}
          </span>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div
                className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs"
                style={{ color: "var(--text-faint)" }}
              >
                <span>{recipe.cuisine}</span>
                <span aria-hidden>·</span>
                <span>{totalTime(recipe)} min total</span>
                <span aria-hidden>·</span>
                <span className="capitalize">{recipe.difficulty}</span>
                {recipe.generated && (
                  <Badge color="var(--accent)" bg="var(--accent-soft)">
                    ✨ Invented for you
                  </Badge>
                )}
              </div>

              <h1
                className="font-display text-3xl leading-tight sm:text-4xl"
                style={{ color: "var(--text)" }}
              >
                {recipe.title}
              </h1>

              <p
                className="mt-2 text-base leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                {recipe.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {dietTags.map((tag) => (
                  <Badge key={tag} color="var(--ready)" bg="var(--ready-bg)">
                    {DIET_LABELS[tag]}
                  </Badge>
                ))}
                {recipe.tags.map((tag) => (
                  <Badge key={tag} className="capitalize">
                    {tag.replace(/-/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="flex shrink-0 flex-col items-center gap-2">
              <CoverageRing
                coverage={result.coverage}
                status={result.status}
                missingCount={result.missing.length}
                size={64}
              />
              <span
                className="text-xs font-medium"
                style={{ color: meta.color }}
              >
                {meta.label}
              </span>
            </div>
          </div>

          <div
            className="mt-5 flex flex-wrap gap-2 border-t pt-4"
            style={{ borderColor: "var(--border)" }}
          >
            <Button
              variant={saved ? "primary" : "secondary"}
              onClick={() => actions.toggleFavorite(recipe.id)}
            >
              {saved ? "♥ Saved" : "♡ Save"}
            </Button>

            {result.missing.length > 0 && (
              <Button
                variant="secondary"
                onClick={() => actions.addMissing(result)}
                disabled={allMissingOnList}
              >
                {allMissingOnList
                  ? "On your list"
                  : `Add ${result.missing.length} missing to list`}
              </Button>
            )}

            <CookedButton result={result} />

            {recipe.generated && (
              <Button
                variant="ghost"
                onClick={() => {
                  if (confirm("Delete this invented recipe?")) {
                    actions.removeInvented(recipe.id);
                    window.location.href = "/";
                  }
                }}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        {/* Ingredients */}
        <section className="surface h-fit rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl" style={{ color: "var(--text)" }}>
              Ingredients
            </h2>
            <div
              className="flex items-center gap-1 rounded-full p-0.5"
              style={{ background: "var(--bg-sunken)" }}
            >
              <ServingButton
                label="Fewer servings"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
              >
                −
              </ServingButton>
              <span
                className="min-w-[3.5rem] text-center text-sm tabular-nums"
                style={{ color: "var(--text)" }}
              >
                {servings} serv
              </span>
              <ServingButton
                label="More servings"
                onClick={() => setServings((s) => Math.min(24, s + 1))}
              >
                +
              </ServingButton>
            </div>
          </div>

          <ul className="space-y-1">
            {recipe.ingredients.map((ri, idx) => (
              <IngredientLine
                key={`${ri.ref}-${idx}`}
                ri={ri}
                match={matchByRef.get(ri.ref)}
                scale={scale}
              />
            ))}
          </ul>

          <Legend />
        </section>

        {/* Method */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-display text-xl" style={{ color: "var(--text)" }}>
              Method
            </h2>
            {done.size > 0 && (
              <button
                onClick={() => setDone(new Set())}
                className="text-sm"
                style={{ color: "var(--text-faint)" }}
              >
                Reset ({done.size}/{recipe.steps.length})
              </button>
            )}
          </div>

          <ol className="space-y-3">
            {recipe.steps.map((step, idx) => {
              const complete = done.has(idx);
              return (
                <li key={idx}>
                  <button
                    onClick={() => toggleStep(idx)}
                    aria-pressed={complete}
                    className="surface-flat flex w-full gap-3 rounded-2xl p-4 text-left transition-all"
                    style={{ opacity: complete ? 0.5 : 1 }}
                  >
                    <span
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-sm font-semibold tabular-nums"
                      style={{
                        background: complete
                          ? "var(--ready)"
                          : "var(--bg-sunken)",
                        color: complete ? "var(--bg)" : "var(--text-muted)",
                      }}
                    >
                      {complete ? "✓" : idx + 1}
                    </span>
                    <span
                      className={cx(
                        "text-[0.95rem] leading-relaxed",
                        complete && "line-through",
                      )}
                      style={{ color: "var(--text)" }}
                    >
                      {step}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>

          {recipe.tips && recipe.tips.length > 0 && (
            <div
              className="mt-5 rounded-2xl p-4"
              style={{ background: "var(--accent-soft)" }}
            >
              <h3
                className="mb-2 text-sm font-semibold"
                style={{ color: "var(--accent)" }}
              >
                Worth knowing
              </h3>
              <ul className="space-y-1.5">
                {recipe.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    className="text-sm leading-relaxed"
                    style={{ color: "var(--text)" }}
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </article>
  );
}

function ServingButton({
  children,
  label,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="grid h-7 w-7 place-items-center rounded-full text-base transition-colors hover:bg-[var(--bg-raised)]"
      style={{ color: "var(--text-muted)" }}
    >
      {children}
    </button>
  );
}

/**
 * One ingredient row, annotated against the pantry.
 *
 * Substitutions show their instruction inline — that note is the difference
 * between "you don't have buttermilk" and "here's how to make some".
 */
function IngredientLine({
  ri,
  match,
  scale,
}: {
  ri: RecipeIngredient;
  match: IngredientMatch | undefined;
  scale: number;
}) {
  const kind = match?.kind ?? "missing";
  const name = ingredientName(ri.ref);

  const marker = {
    have: { symbol: "✓", color: "var(--ready)" },
    group: { symbol: "✓", color: "var(--ready)" },
    staple: { symbol: "·", color: "var(--text-faint)" },
    sub: { symbol: "≈", color: "var(--almost)" },
    missing: { symbol: "+", color: "var(--stretch)" },
  }[kind];

  return (
    <li className="flex gap-2.5 py-1.5 text-sm">
      <span
        className="mt-0.5 w-4 shrink-0 text-center font-semibold"
        style={{ color: marker.color }}
        aria-hidden
      >
        {marker.symbol}
      </span>
      <span className="min-w-0 flex-1">
        <span style={{ color: kind === "missing" ? "var(--text-muted)" : "var(--text)" }}>
          {formatQuantity(ri, scale)}
          <span className={cx(ri.optional && "italic")}>{name}</span>
          {ri.note && (
            <span style={{ color: "var(--text-faint)" }}>, {ri.note}</span>
          )}
          {ri.optional && (
            <span className="ml-1 text-xs" style={{ color: "var(--text-faint)" }}>
              (optional)
            </span>
          )}
        </span>

        {kind === "group" && match?.satisfiedBy?.[0] && (
          <span className="block text-xs" style={{ color: "var(--ready)" }}>
            using your {ingredientName(match.satisfiedBy[0])}
          </span>
        )}
        {kind === "sub" && (
          <span className="block text-xs" style={{ color: "var(--almost)" }}>
            swap: {match?.substitutionNote}
          </span>
        )}
        {kind === "staple" && (
          <span className="block text-xs" style={{ color: "var(--text-faint)" }}>
            assumed staple
          </span>
        )}
      </span>
    </li>
  );
}

/** Scale a quantity and print it in a way a person would actually write. */
function formatQuantity(ri: RecipeIngredient, scale: number): string {
  if (ri.quantity === undefined) return "";
  const scaled = ri.quantity * scale;

  const rounded =
    scaled >= 10
      ? Math.round(scaled)
      : Math.round(scaled * 4) / 4; // nearest quarter for small amounts

  const text = Number.isInteger(rounded)
    ? String(rounded)
    : formatFraction(rounded);

  return ri.unit && ri.unit !== "piece" ? `${text} ${ri.unit} ` : `${text} `;
}

const FRACTIONS: Record<string, string> = {
  "0.25": "¼",
  "0.5": "½",
  "0.75": "¾",
};

function formatFraction(value: number): string {
  const whole = Math.floor(value);
  const remainder = (value - whole).toFixed(2);
  const glyph = FRACTIONS[String(Number(remainder))];
  if (!glyph) return String(Math.round(value * 10) / 10);
  return whole > 0 ? `${whole}${glyph}` : glyph;
}

function Legend() {
  const items = [
    { symbol: "✓", color: "var(--ready)", label: "you have it" },
    { symbol: "≈", color: "var(--almost)", label: "substitute available" },
    { symbol: "+", color: "var(--stretch)", label: "need to buy" },
  ];
  return (
    <div
      className="mt-4 flex flex-wrap gap-x-4 gap-y-1 border-t pt-3 text-xs"
      style={{ borderColor: "var(--border)", color: "var(--text-faint)" }}
    >
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1">
          <span style={{ color: item.color }} aria-hidden>
            {item.symbol}
          </span>
          {item.label}
        </span>
      ))}
    </div>
  );
}

/** Records the cook, optionally emptying what it used out of the pantry. */
function CookedButton({
  result,
}: {
  result: ReturnType<typeof scoreRecipe>;
}) {
  const { actions } = useStore();
  const [asking, setAsking] = useState(false);
  const [doneAt, setDoneAt] = useState<string | null>(null);

  if (doneAt) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 text-sm"
        style={{ color: "var(--ready)" }}
      >
        ✓ Logged as cooked
      </span>
    );
  }

  if (asking) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button
          variant="primary"
          onClick={() => {
            actions.markCooked(result, true);
            setDoneAt(new Date().toISOString());
          }}
        >
          Yes, use them up
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            actions.markCooked(result, false);
            setDoneAt(new Date().toISOString());
          }}
        >
          Keep my kitchen as-is
        </Button>
      </div>
    );
  }

  return (
    <Button variant="secondary" onClick={() => setAsking(true)}>
      I cooked this
    </Button>
  );
}
