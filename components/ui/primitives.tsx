"use client";

import type { MatchStatus } from "@/lib/types";

/** Shared visual primitives. Small, unopinionated, used everywhere. */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Match status vocabulary                                             */
/* ------------------------------------------------------------------ */

export const STATUS_META: Record<
  MatchStatus,
  { label: string; color: string; bg: string; blurb: string }
> = {
  ready: {
    label: "Ready to cook",
    color: "var(--ready)",
    bg: "var(--ready-bg)",
    blurb: "You have everything",
  },
  almost: {
    label: "Almost there",
    color: "var(--almost)",
    bg: "var(--almost-bg)",
    blurb: "A couple of things short",
  },
  stretch: {
    label: "Worth a shop",
    color: "var(--stretch)",
    bg: "var(--stretch-bg)",
    blurb: "Needs a few more ingredients",
  },
};

/* ------------------------------------------------------------------ */
/* Coverage ring — the signature element                               */
/* ------------------------------------------------------------------ */

/**
 * An SVG arc filled to the match percentage, with the missing count in the
 * middle. Legible at a glance across a grid, which is the whole job.
 */
export function CoverageRing({
  coverage,
  status,
  missingCount,
  size = 48,
}: {
  coverage: number;
  status: MatchStatus;
  missingCount: number;
  size?: number;
}) {
  const stroke = size >= 44 ? 4 : 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = Math.max(0, Math.min(1, coverage)) * circumference;
  const meta = STATUS_META[status];

  return (
    <div
      className="relative shrink-0"
      style={{ width: size, height: size }}
      role="img"
      aria-label={
        missingCount === 0
          ? "You have every ingredient"
          : `Missing ${missingCount} ingredient${missingCount === 1 ? "" : "s"}`
      }
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={meta.color}
          strokeWidth={stroke}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          style={{ transition: "stroke-dasharray 400ms cubic-bezier(.22,1,.36,1)" }}
        />
      </svg>
      <span
        className="absolute inset-0 grid place-items-center font-semibold tabular-nums"
        style={{
          color: meta.color,
          fontSize: size >= 44 ? "0.8rem" : "0.68rem",
        }}
      >
        {missingCount === 0 ? (
          <CheckGlyph size={size >= 44 ? 16 : 12} />
        ) : (
          `−${missingCount}`
        )}
      </span>
    </div>
  );
}

function CheckGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden>
      <path
        d="M3 8.5L6.5 12L13 4.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Buttons, chips, badges                                              */
/* ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all disabled:opacity-40 disabled:pointer-events-none active:scale-[0.97] whitespace-nowrap";
  const sizes = {
    sm: "text-sm px-3 py-1.5",
    md: "text-sm px-4 py-2.5",
  };
  const variants = {
    primary: "text-white shadow-sm hover:brightness-110",
    secondary: "hover:brightness-[0.97]",
    ghost: "hover:bg-[var(--bg-sunken)]",
    danger: "hover:brightness-105",
  };
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "var(--bg)" },
    secondary: {
      background: "var(--bg-raised)",
      border: "1px solid var(--border-strong)",
      color: "var(--text)",
    },
    ghost: { color: "var(--text-muted)" },
    danger: {
      background: "transparent",
      border: "1px solid var(--border-strong)",
      color: "var(--stretch)",
    },
  };

  return (
    <button
      className={cx(base, sizes[size], variants[variant], className)}
      style={styles[variant]}
      {...rest}
    />
  );
}

export function Badge({
  children,
  color,
  bg,
  className,
}: {
  children: React.ReactNode;
  color?: string;
  bg?: string;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        className,
      )}
      style={{
        color: color ?? "var(--text-muted)",
        background: bg ?? "var(--bg-sunken)",
      }}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: MatchStatus }) {
  const meta = STATUS_META[status];
  return (
    <Badge color={meta.color} bg={meta.bg}>
      {meta.label}
    </Badge>
  );
}

/* ------------------------------------------------------------------ */
/* Empty states & skeletons                                            */
/* ------------------------------------------------------------------ */

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {icon && (
        <div
          className="mb-4 grid h-14 w-14 place-items-center rounded-2xl"
          style={{ background: "var(--bg-sunken)", color: "var(--text-faint)" }}
        >
          {icon}
        </div>
      )}
      <h3 className="font-display text-xl" style={{ color: "var(--text)" }}>
        {title}
      </h3>
      {children && (
        <p
          className="mt-2 max-w-sm text-sm leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          {children}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="surface overflow-hidden rounded-2xl">
      <div className="skeleton h-28 w-full" />
      <div className="space-y-2 p-4">
        <div className="skeleton h-4 w-3/4 rounded" />
        <div className="skeleton h-3 w-full rounded" />
        <div className="skeleton h-3 w-2/3 rounded" />
      </div>
    </div>
  );
}

export function SkeletonGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }, (_, idx) => (
        <SkeletonCard key={idx} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Recipe artwork                                                      */
/* ------------------------------------------------------------------ */

/**
 * Deterministic gradient + glyph, keyed to the recipe slug.
 *
 * There's no licensed photography here, and a broken or mismatched image looks
 * far worse than none. This gives every recipe a stable, distinct identity that
 * reads as intentional.
 */
/**
 * Explicit gradient pairs rather than computed hues.
 *
 * Generated hues wander into bright greens and magentas, which read as
 * anything but food. These are all warm or earthy — terracotta, saffron,
 * olive, paprika, wine — kept muted so the white title text sits comfortably
 * on top and a grid of them doesn't shout.
 */
const ARTWORK_PAIRS: [string, string][] = [
  ["#c2704a", "#8f3f26"], // terracotta → rust
  ["#d99a3f", "#a8651a"], // amber → ochre
  ["#8f9455", "#5c6135"], // olive → moss
  ["#c15b4b", "#8a2f28"], // paprika → brick
  ["#b8874b", "#7d5225"], // bronze → cocoa
  ["#7d9070", "#4c5f42"], // sage → forest
  ["#a4576b", "#6d2f42"], // rosehip → wine
  ["#cf8b52", "#96522a"], // apricot → burnt orange
  ["#96794f", "#615029"], // wheat → bronze
  ["#5f8280", "#37544f"], // sea green → deep teal
  ["#b5654e", "#7a3324"], // clay → oxblood
  ["#c9a24d", "#8f6d1e"], // mustard → old gold
];

export function recipeArtwork(slug: string): { gradient: string } {
  let hash = 0;
  for (let idx = 0; idx < slug.length; idx += 1) {
    hash = (hash * 31 + slug.charCodeAt(idx)) % 100000;
  }
  const pair = ARTWORK_PAIRS[hash % ARTWORK_PAIRS.length] ?? ARTWORK_PAIRS[0]!;
  return {
    gradient: `linear-gradient(135deg, ${pair[0]} 0%, ${pair[1]} 100%)`,
  };
}

const CUISINE_EMOJI: Record<string, string> = {
  Italian: "🍝",
  Chinese: "🥢",
  Thai: "🌶️",
  Indian: "🍛",
  Japanese: "🍜",
  Korean: "🌶️",
  Sichuan: "🌶️",
  Mexican: "🌮",
  "Tex-Mex": "🌮",
  French: "🥖",
  British: "🫖",
  American: "🍔",
  Spanish: "🥘",
  Greek: "🫒",
  Turkish: "🍳",
  Vietnamese: "🥖",
  Levantine: "🧆",
  "Middle Eastern": "🧆",
  "North African": "🍲",
  Mediterranean: "🫒",
  Cajun: "🍤",
  German: "🥔",
  Kashmiri: "🍛",
  "Eastern European": "🍲",
  "Southeast Asian": "🥥",
  "Latin American": "🌽",
  Australian: "🍓",
  Indonesian: "🍚",
  Modern: "🥗",
};

export function cuisineGlyph(cuisine: string): string {
  return CUISINE_EMOJI[cuisine] ?? "🍽️";
}
