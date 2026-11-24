"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ingredientName } from "@/data/ingredients";
import {
  DIET_LABELS,
  allowedGroupMembers,
  dietIssues,
  recipeDietBadges,
  type DietIssue,
} from "@/lib/diet";
import { scoreOne, totalTime } from "@/lib/match";
import { coverageRatio, formatAmount, isEnough, toAmount } from "@/lib/quantity";
import { useStore, useToday } from "@/lib/store";
import { Main } from "@/components/shell/AppShell";
import {
  STATUS_STYLE,
  cuisineGlyph,
  cx,
} from "@/components/ui/primitives";
import type {
  DietPrefs,
  IngredientMatch,
  MatchResult,
  PantryItem,
  Recipe,
  RecipeIngredient,
} from "@/lib/types";

/**
 * Full recipe view.
 *
 * Every ingredient is annotated against the fridge — that's the difference
 * between a recipe page and a recipe page that knows your kitchen. The
 * coverage ring from the previous build is replaced by Sorbet's rotated
 * percentage box.
 */
export function RecipeDetail({ recipe }: { recipe: Recipe }) {
  const { state, actions } = useStore();
  const today = useToday();
  const [servings, setServings] = useState(recipe.servings);
  const [done, setDone] = useState<Set<number>>(new Set());

  // Every way this recipe breaks the eating rules. Usually empty: the lists
  // never show a recipe that does, so this only fires for a direct link or a
  // favourite saved before the rules changed.
  const issues = useMemo(
    () => dietIssues(recipe, state.diet),
    [recipe, state.diet],
  );
  const withinRules = issues.length === 0;

  const result = useMemo(
    () =>
      scoreOne(recipe, state.pantry, {
        staples: state.staples,
        diet: state.diet,
        now: today,
      }),
    [recipe, state.pantry, state.staples, state.diet, today],
  );

  const matchByRef = useMemo(() => {
    const map = new Map<string, IngredientMatch>();
    for (const m of result.matches) map.set(m.ref, m);
    return map;
  }, [result.matches]);

  // What you actually hold, so each line can say whether it's enough.
  const heldByRef = useMemo(
    () => new Map(state.pantry.map((p) => [p.ingredientId, p])),
    [state.pantry],
  );

  const style = STATUS_STYLE[result.status];
  const saved = state.favorites.includes(recipe.id);
  const scale = servings / recipe.servings;
  const dietBadges = recipeDietBadges(recipe);
  const onList = new Set(state.shoppingList.map((i) => i.ingredientId));
  const allMissingOnList =
    result.missing.length > 0 && result.missing.every((id) => onList.has(id));
  const coveragePct = `${Math.round(result.coverage * 100)}%`;

  const toggleStep = (index: number) => {
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  return (
    <Main max={980} paddingBottom={56} paddingTop="clamp(20px, 3vw, 36px)">
      <Link
        href="/recipes"
        className="inline-flex items-center"
        style={{
          gap: 6,
          fontSize: 13,
          fontWeight: 700,
          color: "var(--ink-50)",
        }}
      >
        ← the cookbook
      </Link>

      {/* Hero */}
      <div
        className="flex flex-wrap items-start justify-between"
        style={{ marginTop: 18, gap: 24 }}
      >
        <div style={{ minWidth: "min(100%, 400px)", flex: 1 }}>
          <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
            <span
              className="inline-block"
              style={{
                fontWeight: 800,
                fontSize: 12,
                letterSpacing: "0.1em",
                color: style.tagColor,
                background: style.badgeBg,
                border: `1.5px solid ${style.badgeBorder}`,
                borderRadius: 999,
                padding: "3px 11px",
                transform: "rotate(-1deg)",
              }}
            >
              {style.tag}
            </span>
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-50)" }}
            >
              {recipe.cuisine.toLowerCase()} · {totalTime(recipe)} min total ·{" "}
              {recipe.difficulty}
            </span>
            {recipe.generated && (
              <span
                style={{
                  fontWeight: 800,
                  fontSize: 12,
                  color: "var(--sky-deep)",
                  background: "var(--sky)",
                  borderRadius: 999,
                  padding: "3px 11px",
                }}
              >
                ✨ invented for you
              </span>
            )}
          </div>

          <h1
            style={{
              margin: "12px 0 0",
              fontWeight: 800,
              fontSize: "clamp(38px, 5.5vw, 64px)",
              lineHeight: 0.98,
              letterSpacing: "-0.03em",
              color: "var(--ink)",
            }}
          >
            {cuisineGlyph(recipe.cuisine)} {recipe.title}
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.55,
              color: "var(--ink-65)",
              maxWidth: "58ch",
            }}
          >
            {recipe.description}
          </p>

          <div className="flex flex-wrap" style={{ marginTop: 12, gap: 6 }}>
            {dietBadges.map(({ key, certain }) => (
              <span
                key={key}
                title={
                  certain
                    ? undefined
                    : "depends which ingredient you pick where the recipe says “any”"
                }
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--green-text)",
                  // Solid when it holds whatever you cook it with; outlined
                  // when it only holds if you pick the right "any …".
                  background: certain ? "var(--green-pale)" : "transparent",
                  border: certain
                    ? "1.5px solid transparent"
                    : "1.5px dashed var(--green-stroke)",
                  borderRadius: 999,
                  padding: "2px 10px",
                  textTransform: "lowercase",
                }}
              >
                {certain ? DIET_LABELS[key] : `can be ${DIET_LABELS[key]}`}
              </span>
            ))}
            {recipe.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--ink-55)",
                  background: "var(--tan-shadow)",
                  borderRadius: 999,
                  padding: "3px 10px",
                  textTransform: "lowercase",
                }}
              >
                {tag.replace(/-/g, " ")}
              </span>
            ))}
          </div>
        </div>

        <div
          className="shrink-0 text-center"
          style={{
            background: "var(--surface)",
            border: `2px solid ${style.badgeBorder}`,
            borderRadius: 18,
            padding: "16px 20px",
            transform: "rotate(1.5deg)",
            boxShadow: `5px 5px 0 ${style.shadow}`,
          }}
        >
          <span
            className="block"
            style={{
              fontWeight: 800,
              fontSize: 34,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            {coveragePct}
          </span>
          <span
            className="block"
            style={{
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: style.tagColor,
            }}
          >
            OF THIS IS IN
            <br />
            YOUR FRIDGE
          </span>
        </div>
      </div>

      {!withinRules && <RulesWarning issues={issues} />}

      {/* Actions */}
      <div className="flex flex-wrap" style={{ marginTop: 22, gap: 10 }}>
        <ActionButton
          onClick={() => actions.toggleFavorite(recipe.id)}
          background={saved ? "var(--peach)" : "var(--surface)"}
          border={saved ? "var(--orange)" : "var(--tan-border)"}
        >
          {saved ? "💛 kept" : "🤍 keep it"}
        </ActionButton>

        {result.missing.length > 0 && (
          <ActionButton
            onClick={() => actions.addMissing(result)}
            background="var(--surface)"
            border="var(--orange)"
            disabled={allMissingOnList}
            opacity={allMissingOnList ? 0.45 : 1}
          >
            {allMissingOnList
              ? "already on the haul ✓"
              : `add ${result.missing.length} missing to the haul 🛒`}
          </ActionButton>
        )}

        <CookedButton result={result} />

        {recipe.generated && (
          <ActionButton
            onClick={() => {
              if (confirm("Delete this invented recipe?")) {
                actions.removeInvented(recipe.id);
                window.location.href = "/";
              }
            }}
            background="var(--surface)"
            border="var(--tan-border)"
          >
            delete
          </ActionButton>
        )}
      </div>

      {/* Two columns */}
      <div
        style={{
          marginTop: 32,
          display: "grid",
          gap: 24,
          gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 340px), 1fr))",
        }}
      >
        {/* the goods */}
        <section
          style={{
            height: "fit-content",
            background: "var(--surface)",
            border: "2px solid var(--tan-border)",
            borderRadius: 18,
            padding: 22,
            transform: "rotate(-0.4deg)",
            boxShadow: "6px 6px 0 var(--tan-shadow)",
          }}
        >
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <h2
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              the goods
            </h2>
            <div
              className="flex items-center"
              style={{
                gap: 4,
                borderRadius: 999,
                padding: 3,
                background: "var(--ground)",
                border: "1.5px solid var(--tan-border)",
              }}
            >
              <StepperButton
                label="Fewer servings"
                onClick={() => setServings((s) => Math.max(1, s - 1))}
              >
                −
              </StepperButton>
              <span
                className="text-center"
                style={{ minWidth: "3.4rem", fontSize: 13, fontWeight: 700 }}
              >
                {servings} serv
              </span>
              <StepperButton
                label="More servings"
                onClick={() => setServings((s) => Math.min(24, s + 1))}
              >
                +
              </StepperButton>
            </div>
          </div>

          <ul
            style={{
              margin: "14px 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              padding: 0,
              listStyle: "none",
            }}
          >
            {recipe.ingredients.map((ri, idx) => (
              <IngredientLine
                key={`${ri.ref}-${idx}`}
                ri={ri}
                match={matchByRef.get(ri.ref)}
                held={heldByRef.get(ri.ref)}
                scale={scale}
                diet={withinRules ? state.diet : undefined}
              />
            ))}
          </ul>

          <div
            className="flex flex-wrap"
            style={{
              marginTop: 14,
              columnGap: 16,
              rowGap: 4,
              fontSize: 12,
              fontWeight: 600,
              color: "var(--ink-50)",
            }}
          >
            <span>
              <span style={{ color: "var(--green-text)" }}>✓</span> got it
            </span>
            <span>
              <span style={{ color: "var(--amber)" }}>≈</span> can fake it
            </span>
            <span>
              <span style={{ color: "var(--orange)" }}>+</span> gotta buy it
            </span>
          </div>
        </section>

        {/* the moves */}
        <section>
          <div className="flex items-center justify-between" style={{ gap: 12 }}>
            <h2
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: "-0.02em",
                color: "var(--ink)",
              }}
            >
              the moves
            </h2>
            {done.size > 0 && (
              <button
                onClick={() => setDone(new Set())}
                style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-45)" }}
              >
                reset ({done.size}/{recipe.steps.length})
              </button>
            )}
          </div>

          <ol
            style={{
              margin: "14px 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              padding: 0,
              listStyle: "none",
            }}
          >
            {recipe.steps.map((step, idx) => {
              const complete = done.has(idx);
              return (
                <li key={idx}>
                  <button
                    onClick={() => toggleStep(idx)}
                    aria-pressed={complete}
                    className="flex w-full text-left"
                    style={{
                      gap: 12,
                      borderRadius: 16,
                      padding: "14px 16px",
                      boxSizing: "border-box",
                      background: "var(--surface)",
                      border: `2px solid ${
                        complete ? "var(--green-stroke)" : "var(--tan-border)"
                      }`,
                      transition: "opacity 150ms",
                      opacity: complete ? 0.55 : 1,
                    }}
                  >
                    <span
                      className="grid shrink-0 place-items-center"
                      style={{
                        height: 28,
                        width: 28,
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: 800,
                        background: complete
                          ? "var(--green-fill)"
                          : "var(--ground)",
                        color: complete ? "var(--green-text)" : "var(--ink-60)",
                      }}
                    >
                      {complete ? "✓" : idx + 1}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 500,
                        lineHeight: 1.55,
                        color: "var(--ink)",
                        textDecoration: complete ? "line-through" : "none",
                      }}
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
              style={{
                marginTop: 18,
                borderRadius: 16,
                padding: "16px 18px",
                background: "var(--peach)",
                border: "2px solid var(--orange)",
                transform: "rotate(0.4deg)",
                boxShadow: "4px 4px 0 var(--tan-shadow)",
              }}
            >
              <h3
                style={{
                  margin: "0 0 8px",
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: "0.08em",
                  color: "var(--brown)",
                }}
              >
                INSIDER INTEL
              </h3>
              <ul
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  margin: 0,
                  padding: 0,
                  listStyle: "none",
                }}
              >
                {recipe.tips.map((tip, idx) => (
                  <li
                    key={idx}
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      lineHeight: 1.55,
                      color: "var(--ink)",
                    }}
                  >
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </Main>
  );
}

/**
 * Shown when a recipe breaks the eating rules — which only happens when
 * someone reaches it directly, since the lists filter these out. Names the
 * ingredient, because "not vegetarian" is less useful than "because of the
 * bacon".
 */
function RulesWarning({ issues }: { issues: DietIssue[] }) {
  // One line per rule, listing the ingredients that break it.
  const byRule = new Map<DietIssue["rule"], DietIssue[]>();
  for (const issue of issues) {
    const list = byRule.get(issue.rule);
    if (list) list.push(issue);
    else byRule.set(issue.rule, [issue]);
  }

  return (
    <div
      role="note"
      style={{
        marginTop: 20,
        borderRadius: 14,
        padding: "12px 16px",
        background: "var(--peach)",
        border: "2px solid var(--orange)",
        color: "var(--ink)",
        fontSize: 14,
        fontWeight: 600,
        lineHeight: 1.5,
      }}
    >
      <strong style={{ fontWeight: 800 }}>
        heads up: this one breaks your eating rules.
      </strong>
      <ul style={{ margin: "6px 0 0", padding: 0, listStyle: "none" }}>
        {[...byRule.entries()].map(([rule, list]) => {
          const names = [...new Set(list.map((i) => ingredientName(i.ref)))]
            .map((n) => n.toLowerCase())
            .join(", ");
          const unverified = list.every((i) => !i.known);
          return (
            <li key={rule}>
              {rule === "avoid"
                ? `you avoid ${names}`
                : unverified
                  ? `can't confirm it's ${DIET_LABELS[rule].toLowerCase()}: ${names} isn't in the catalogue`
                  : `not ${DIET_LABELS[rule].toLowerCase()}: ${names}`}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  background,
  border,
  disabled,
  opacity = 1,
}: {
  children: React.ReactNode;
  onClick: () => void;
  background: string;
  border: string;
  disabled?: boolean;
  opacity?: number;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="msc-press inline-flex items-center justify-center"
      style={{
        gap: 8,
        borderRadius: 999,
        fontWeight: 700,
        fontSize: 14,
        padding: "10px 18px",
        background,
        border: `2px solid ${border}`,
        color: "var(--ink)",
        boxShadow: "3px 3px 0 var(--tan-shadow)",
        opacity,
      }}
    >
      {children}
    </button>
  );
}

function StepperButton({
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
      className="msc-hover-peach grid place-items-center"
      style={{ height: 26, width: 26, borderRadius: 999, fontWeight: 800 }}
    >
      {children}
    </button>
  );
}

/** An ingredient the eating rules forbid: not something to go and buy. */
const RULED_OUT_MARKER = { symbol: "✕", color: "var(--ink-40)" } as const;

const MARKERS = {
  have: { symbol: "✓", color: "var(--green-text)" },
  group: { symbol: "✓", color: "var(--green-text)" },
  staple: { symbol: "·", color: "var(--ink-40)" },
  sub: { symbol: "≈", color: "var(--amber)" },
  missing: { symbol: "+", color: "var(--orange)" },
} as const;

/** How many permitted members of a group to name before trailing off. */
const NAMED_OPTIONS = 4;

function IngredientLine({
  ri,
  match,
  held,
  scale,
  diet,
}: {
  ri: RecipeIngredient;
  match: IngredientMatch | undefined;
  held: PantryItem | undefined;
  scale: number;
  /** The eating rules, when this recipe is being scored within them. */
  diet: DietPrefs | undefined;
}) {
  const kind = match?.kind ?? "missing";
  const ruledOut = match?.ruledOut === true;
  const marker = ruledOut ? RULED_OUT_MARKER : MARKERS[kind];
  const name = ingredientName(ri.ref);

  // "any milk" means something narrower to someone avoiding dairy. When the
  // rules cut a group down and nothing in the fridge fills it, name what
  // would, so the shopping trip buys the right one.
  const options =
    kind === "missing" && !ruledOut ? allowedGroupMembers(ri.ref, diet) : [];
  const narrowed =
    options.length > 0 &&
    options.length < allowedGroupMembers(ri.ref, undefined).length;

  // Amounts only speak for a direct hit — a group or substitute means you're
  // cooking with something else, so the recipe's amount doesn't describe what
  // you hold. Scale the requirement to the chosen serving count first.
  const ratio =
    kind === "have"
      ? coverageRatio(
          toAmount(held?.quantity, held?.unit),
          toAmount(
            ri.quantity === undefined ? undefined : ri.quantity * scale,
            ri.unit,
          ),
        )
      : null;
  const shortHere = ratio !== null && !isEnough(ratio);

  return (
    <li
      className="flex"
      style={{
        gap: 10,
        padding: "6px 0",
        fontSize: 14,
        fontWeight: 500,
        borderBottom: "1px dashed var(--tan-skeleton)",
      }}
    >
      <span
        className="shrink-0 text-center"
        style={{
          marginTop: 1,
          width: 18,
          fontWeight: 800,
          color: marker.color,
        }}
        aria-hidden
      >
        {marker.symbol}
      </span>
      <span className="min-w-0 flex-1">
        <span
          style={{
            color: kind === "missing" ? "var(--ink-55)" : "var(--ink)",
          }}
        >
          {formatQuantity(ri, scale)}
          <span className={cx(ri.optional && "italic")}>{name}</span>
          {ri.note && <span style={{ color: "var(--ink-45)" }}>, {ri.note}</span>}
          {ri.optional && (
            <span
              style={{ marginLeft: 4, fontSize: 12, color: "var(--ink-45)" }}
            >
              (optional)
            </span>
          )}
        </span>

        {kind === "group" && match?.satisfiedBy?.[0] && (
          <span
            className="block"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--green-text)" }}
          >
            using your {ingredientName(match.satisfiedBy[0]).toLowerCase()}
          </span>
        )}
        {kind === "sub" && (
          <span
            className="block"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--amber)" }}
          >
            hack: {match?.substitutionNote}
          </span>
        )}
        {kind === "staple" && (
          <span
            className="block"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-40)" }}
          >
            staple. you have this.
          </span>
        )}
        {ruledOut && (
          <span
            className="block"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-55)" }}
          >
            outside your eating rules. leave it out.
          </span>
        )}
        {narrowed && (
          <span
            className="block"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-55)" }}
          >
            for your eating rules:{" "}
            {options
              .slice(0, NAMED_OPTIONS)
              .map((id) => ingredientName(id).toLowerCase())
              .join(", ")}
            {options.length > NAMED_OPTIONS && ", …"}
          </span>
        )}
        {shortHere && (
          <span
            className="block"
            style={{ fontSize: 12, fontWeight: 600, color: "var(--sky-deep)" }}
          >
            you have {formatAmount(held?.quantity, held?.unit)} — about{" "}
            {Math.round((ratio ?? 0) * 100)}% of this
          </span>
        )}
      </span>
    </li>
  );
}

/** Scale a quantity and print it the way a person would write it. */
function formatQuantity(ri: RecipeIngredient, scale: number): string {
  if (ri.quantity === undefined) return "";
  const scaled = ri.quantity * scale;
  const rounded =
    scaled >= 10 ? Math.round(scaled) : Math.round(scaled * 4) / 4;
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

/** Records the cook, optionally emptying what it used out of the fridge. */
function CookedButton({ result }: { result: MatchResult }) {
  const { actions } = useStore();
  const [asking, setAsking] = useState(false);
  const [logged, setLogged] = useState(false);

  if (logged) {
    return (
      <span
        className="inline-flex items-center"
        style={{
          gap: 6,
          padding: "10px 8px",
          fontSize: 14,
          fontWeight: 700,
          color: "var(--green-text)",
        }}
      >
        ✓ logged. chef behavior.
      </span>
    );
  }

  if (asking) {
    return (
      <div className="flex flex-wrap items-center" style={{ gap: 10 }}>
        <span
          style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-60)" }}
        >
          clear the used stuff from your fridge?
        </span>
        <button
          onClick={() => {
            actions.markCooked(result, true);
            setLogged(true);
          }}
          className="msc-press"
          style={{
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 15px",
            background: "var(--green-fill)",
            border: "2px solid var(--green-stroke)",
            color: "var(--ink)",
          }}
        >
          yes, it&apos;s gone
        </button>
        <button
          onClick={() => {
            actions.markCooked(result, false);
            setLogged(true);
          }}
          className="msc-press"
          style={{
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            padding: "8px 15px",
            background: "var(--surface)",
            border: "2px solid var(--tan-border)",
            color: "var(--ink)",
          }}
        >
          keep it as-is
        </button>
      </div>
    );
  }

  return (
    <ActionButton
      onClick={() => setAsking(true)}
      background="var(--surface)"
      border="var(--tan-border)"
    >
      i cooked this 🏆
    </ActionButton>
  );
}
