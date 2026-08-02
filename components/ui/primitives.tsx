"use client";

import type { MatchStatus } from "@/lib/types";

/**
 * Sorbet primitives.
 *
 * The design contains zero `<svg>` elements — the coverage ring and the
 * gradient card artwork from the previous build are gone, replaced by a text
 * pill and an emoji. Every raised surface carries a hard 0-blur offset shadow
 * and a small rotation.
 */

export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ */
/* Status vocabulary                                                   */
/* ------------------------------------------------------------------ */

export interface StatusStyle {
  tag: string;
  tagColor: string;
  borderColor: string;
  shadow: string;
  badgeBg: string;
  badgeBorder: string;
  countColor: string;
  countBg: string;
}

/**
 * `ready` turns the whole card border green. `almost` and `stretch` share the
 * neutral tan chrome and are told apart only by their tag and badge colours.
 */
export const STATUS_STYLE: Record<MatchStatus, StatusStyle> = {
  ready: {
    tag: "READY RN",
    tagColor: "var(--green-text)",
    borderColor: "var(--green-stroke)",
    shadow: "var(--green-pale)",
    badgeBg: "var(--green-fill)",
    badgeBorder: "var(--green-stroke)",
    countColor: "var(--green-text)",
    countBg: "var(--green-fill)",
  },
  almost: {
    tag: "SO CLOSE",
    tagColor: "var(--amber)",
    borderColor: "var(--tan-border)",
    shadow: "var(--tan-shadow)",
    badgeBg: "var(--peach)",
    badgeBorder: "var(--orange)",
    countColor: "var(--amber)",
    countBg: "var(--peach)",
  },
  stretch: {
    tag: "WORTH A SHOP",
    tagColor: "var(--sky-deep)",
    borderColor: "var(--tan-border)",
    shadow: "var(--tan-shadow)",
    badgeBg: "var(--sky)",
    badgeBorder: "var(--sky-deep)",
    countColor: "var(--sky-deep)",
    countBg: "var(--sky)",
  },
};

/** `100%` or `−3`. The minus is U+2212, not a hyphen. */
export function coverageBadge(missingCount: number): string {
  return missingCount === 0 ? "100%" : `−${missingCount}`;
}

/** Cards tilt in a repeating cycle so a grid never looks mechanical. */
const TILTS = ["-1.2deg", "0.8deg", "-0.6deg"] as const;

export function cardTilt(index: number): string {
  return TILTS[index % TILTS.length] ?? "0deg";
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "quiet" | "go";
};

/**
 * `primary` is the sky pill with a peach offset shadow. `go` is the same
 * shape but white — used for secondary actions on the recipe page.
 */
export function Button({
  variant = "outline",
  className,
  style,
  ...rest
}: ButtonProps) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-full font-bold whitespace-nowrap msc-press disabled:pointer-events-none";

  const styles: Record<string, React.CSSProperties> = {
    primary: {
      fontSize: 14,
      padding: "11px 20px",
      background: "var(--sky)",
      border: "2px solid var(--sky-deep)",
      color: "var(--ink)",
      boxShadow: "3px 3px 0 var(--peach)",
    },
    outline: {
      fontSize: 14,
      padding: "11px 20px",
      background: "var(--surface)",
      border: "2px solid var(--tan-border)",
      color: "var(--ink)",
      boxShadow: "3px 3px 0 var(--tan-shadow)",
    },
    go: {
      fontSize: 14,
      padding: "10px 18px",
      background: "var(--surface)",
      border: "2px solid var(--tan-border)",
      color: "var(--ink)",
      boxShadow: "3px 3px 0 var(--tan-shadow)",
    },
    quiet: {
      fontSize: 13,
      fontWeight: 600,
      padding: "4px 2px",
      color: "var(--ink-45)",
    },
  };

  return (
    <button
      className={cx(base, variant !== "quiet" && "msc-hover-sky", variant === "quiet" && "msc-hover-orange", className)}
      style={{ ...styles[variant], ...style }}
      {...rest}
    />
  );
}

/** The pill link used for empty-state calls to action. */
export function PillLinkStyle(
  variant: "primary" | "outline" = "primary",
): React.CSSProperties {
  return variant === "primary"
    ? {
        fontSize: 14,
        fontWeight: 700,
        padding: "11px 20px",
        background: "var(--sky)",
        border: "2px solid var(--sky-deep)",
        color: "var(--ink)",
        boxShadow: "3px 3px 0 var(--peach)",
        borderRadius: 999,
      }
    : {
        fontSize: 14,
        fontWeight: 700,
        padding: "11px 20px",
        background: "var(--surface)",
        border: "2px solid var(--tan-border)",
        color: "var(--ink)",
        boxShadow: "3px 3px 0 var(--tan-shadow)",
        borderRadius: 999,
      };
}

/* ------------------------------------------------------------------ */
/* Text atoms                                                          */
/* ------------------------------------------------------------------ */

/** The small all-caps label above a group: SPEEDRUN IT, EATING RULES, SORT. */
export function Eyebrow({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx("shrink-0", className)}
      style={{
        fontSize: 12,
        fontWeight: 800,
        letterSpacing: "0.1em",
        color: "var(--ink-45)",
      }}
    >
      {children}
    </span>
  );
}

/**
 * Page headline. Sorbet's pattern is `the <word>.` with the middle word in
 * sky-deep — rendered via `<em>` with the italics removed.
 */
export function Headline({
  before,
  accent,
  after,
  size = "page",
}: {
  before?: string;
  accent: string;
  after?: string;
  size?: "page" | "hero";
}) {
  return (
    <h1
      style={{
        margin: 0,
        fontWeight: 800,
        fontSize:
          size === "hero"
            ? "clamp(44px, 7vw, 76px)"
            : "clamp(38px, 5.5vw, 60px)",
        lineHeight: 0.95,
        letterSpacing: "-0.03em",
        color: "var(--ink)",
      }}
    >
      {before}
      <em style={{ fontStyle: "normal", color: "var(--sky-deep)" }}>{accent}</em>
      {after}
    </h1>
  );
}

/** The rounded count pill next to a section heading. */
export function CountPill({
  children,
  color,
  bg,
}: {
  children: React.ReactNode;
  color: string;
  bg: string;
}) {
  return (
    <span
      style={{
        fontWeight: 800,
        fontSize: 13,
        borderRadius: 999,
        padding: "2px 10px",
        color,
        background: bg,
      }}
    >
      {children}
    </span>
  );
}

export function SectionSubtitle({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-50)" }}>
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Empty states & skeletons                                            */
/* ------------------------------------------------------------------ */

export function EmptyPanel({
  glyph,
  title,
  children,
  action,
  bodyWidth = "40ch",
}: {
  glyph: string;
  title: string;
  children?: React.ReactNode;
  action?: React.ReactNode;
  bodyWidth?: string;
}) {
  return (
    <div
      className="flex flex-col items-center justify-center text-center"
      style={{
        marginTop: 28,
        padding: "56px 24px",
        border: "2px dashed var(--tan-dashed)",
        borderRadius: 24,
      }}
    >
      <span style={{ fontSize: 40 }} aria-hidden>
        {glyph}
      </span>
      <h3
        style={{
          margin: "14px 0 0",
          fontWeight: 800,
          fontSize: 26,
          letterSpacing: "-0.02em",
          color: "var(--ink)",
        }}
      >
        {title}
      </h3>
      {children && (
        <p
          style={{
            margin: "8px 0 0",
            maxWidth: bodyWidth,
            fontSize: 14,
            lineHeight: 1.55,
            color: "var(--ink-60)",
          }}
        >
          {children}
        </p>
      )}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        marginTop: 28,
        display: "grid",
        gap: 18,
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
      }}
    >
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className="msc-skeleton"
          style={{ height: 150, borderRadius: 18 }}
        />
      ))}
    </div>
  );
}

export function RowSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div
      style={{
        marginTop: 24,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      {Array.from({ length: count }, (_, idx) => (
        <div
          key={idx}
          className="msc-skeleton"
          style={{ height: 52, borderRadius: 14 }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Cuisine glyphs                                                      */
/* ------------------------------------------------------------------ */

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
