"use client";

import Link from "next/link";
import { useStore } from "@/lib/store";
import { kitchenSubLine, plainSubLine, rescueLabel } from "@/lib/voice";
import {
  CountPill,
  SectionSubtitle,
  STATUS_STYLE,
  cardTilt,
  coverageBadge,
  cuisineGlyph,
} from "@/components/ui/primitives";
import type { MatchResult } from "@/lib/types";

/**
 * The Sorbet recipe card.
 *
 * White, tilted, with a hard offset shadow and a heart that overhangs the
 * top-right corner. `ready` recipes get a green border and shadow; `almost`
 * and `stretch` share neutral chrome and differ only in their tag and badge.
 *
 * `voice` picks which sub-line formula applies — the Kitchen is cheeky, the
 * Browse and Saved grids are plain. Deliberate asymmetry from the design.
 */
export function RecipeCard({
  result,
  index,
  voice = "plain",
  showRescue = false,
  forceSaved = false,
}: {
  result: MatchResult;
  index: number;
  voice?: "kitchen" | "plain";
  showRescue?: boolean;
  forceSaved?: boolean;
}) {
  const { state, actions } = useStore();
  const style = STATUS_STYLE[result.status];
  const saved = forceSaved || state.favorites.includes(result.recipe.id);
  const subLine =
    voice === "kitchen"
      ? kitchenSubLine(result, index)
      : plainSubLine(result);
  const rescue = showRescue && result.rescues.length > 0;

  return (
    <article
      className="msc-card relative"
      style={{
        background: "var(--surface)",
        border: `2px solid ${style.borderColor}`,
        borderRadius: 18,
        padding: 18,
        transform: `rotate(${cardTilt(index)})`,
        boxShadow: `6px 6px 0 ${style.shadow}`,
      }}
    >
      <Link href={`/recipes/${result.recipe.slug}`} className="block">
        <div className="flex items-center justify-between" style={{ gap: 8 }}>
          <span
            style={{
              fontWeight: 800,
              fontSize: 12,
              letterSpacing: "0.1em",
              color: style.tagColor,
            }}
          >
            {style.tag}
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 14,
              color: "var(--ink)",
              background: style.badgeBg,
              border: `1.5px solid ${style.badgeBorder}`,
              borderRadius: 999,
              padding: "2px 9px",
            }}
          >
            {coverageBadge(result.missing.length)}
          </span>
        </div>

        <h3
          style={{
            margin: "10px 0 4px",
            fontWeight: 700,
            fontSize: 22,
            lineHeight: 1.05,
            letterSpacing: "-0.01em",
            color: "var(--ink)",
          }}
        >
          {cuisineGlyph(result.recipe.cuisine)} {result.recipe.title}
        </h3>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            fontWeight: 500,
            lineHeight: 1.45,
            color: "var(--ink-55)",
          }}
        >
          {subLine}
        </p>

        {rescue && (
          <span
            className="inline-block"
            style={{
              marginTop: 8,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.06em",
              color: "var(--amber)",
              background: "var(--ground)",
              border: "1.5px solid var(--peach)",
              borderRadius: 999,
              padding: "2px 8px",
            }}
          >
            ⏰ {rescueLabel(result)}
          </span>
        )}
      </Link>

      <button
        onClick={() => actions.toggleFavorite(result.recipe.id)}
        aria-label={saved ? "Remove from saved" : "Save recipe"}
        aria-pressed={saved}
        className="msc-heart absolute grid place-items-center"
        style={{
          top: -10,
          right: -8,
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "var(--surface)",
          border: `2px solid ${saved ? "var(--orange)" : "var(--tan-border)"}`,
          fontSize: 14,
          transform: "rotate(6deg)",
          boxShadow: "2px 2px 0 var(--tan-shadow)",
        }}
      >
        {saved ? "💛" : "🤍"}
      </button>
    </article>
  );
}

/** The `repeat(auto-fill, minmax(260px, 1fr))` grid used on every screen. */
export function CardGrid({
  children,
  marginTop = 16,
}: {
  children: React.ReactNode;
  marginTop?: number;
}) {
  return (
    <div
      style={{
        marginTop,
        display: "grid",
        gap: 20,
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}
    >
      {children}
    </div>
  );
}

/**
 * One of the three Kitchen tiers.
 *
 * `results` is what gets rendered (the design caps "so close" at 12 cards and
 * "worth a shop" at 6), while `total` is the real size of the tier. The count
 * pill always shows the total — "so close 29" above twelve cards is the point,
 * not a bug.
 */
export function TierSection({
  title,
  subtitle,
  results,
  total,
  status,
  showRescue,
  children,
}: {
  title: string;
  subtitle: string;
  results: MatchResult[];
  total?: number;
  status: MatchResult["status"];
  showRescue?: boolean;
  children?: React.ReactNode;
}) {
  if (results.length === 0) return null;
  const style = STATUS_STYLE[status];
  const count = total ?? results.length;

  return (
    <section style={{ marginTop: 36 }}>
      <div className="flex flex-wrap items-baseline" style={{ gap: 10 }}>
        <h2
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 28,
            letterSpacing: "-0.02em",
            color: "var(--ink)",
          }}
        >
          {title}
        </h2>
        <CountPill color={style.countColor} bg={style.countBg}>
          {count}
        </CountPill>
        <SectionSubtitle>{subtitle}</SectionSubtitle>
      </div>

      <CardGrid>
        {results.map((result, idx) => (
          <RecipeCard
            key={result.recipe.id}
            result={result}
            index={idx}
            voice="kitchen"
            showRescue={showRescue}
          />
        ))}
      </CardGrid>

      {children}
    </section>
  );
}
