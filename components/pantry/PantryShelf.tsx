"use client";

import { useMemo, useState } from "react";
import {
  AISLE_LABEL,
  AISLE_ORDER,
  getIngredient,
} from "@/data/ingredients";
import { daysUntil } from "@/lib/match";
import { useStore, useToday } from "@/lib/store";
import { Badge, Button, cx } from "@/components/ui/primitives";
import type { Aisle, IngredientId, PantryItem } from "@/lib/types";

/**
 * The pantry, grouped by aisle.
 *
 * Each item can carry a use-by date. That's the input to the "rescue" bonus in
 * the matching engine, so it's worth making it a single tap to set.
 */
export function PantryShelf() {
  const { state, actions } = useStore();
  const today = useToday();
  const [editing, setEditing] = useState<IngredientId | null>(null);
  // A big pantry pushes the actual results — the point of the page — below the
  // fold, so once it gets long it starts folded away behind a summary line.
  const [collapsed, setCollapsed] = useState(state.pantry.length > 14);

  const grouped = useMemo(() => {
    const buckets = new Map<Aisle, PantryItem[]>();
    for (const item of state.pantry) {
      const aisle = getIngredient(item.ingredientId)?.aisle ?? "pantry";
      const bucket = buckets.get(aisle);
      if (bucket) bucket.push(item);
      else buckets.set(aisle, [item]);
    }
    return AISLE_ORDER.filter((a) => buckets.has(a)).map((aisle) => ({
      aisle,
      items: (buckets.get(aisle) ?? []).sort((a, b) =>
        (getIngredient(a.ingredientId)?.name ?? "").localeCompare(
          getIngredient(b.ingredientId)?.name ?? "",
        ),
      ),
    }));
  }, [state.pantry]);

  if (state.pantry.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-2"
          aria-expanded={!collapsed}
        >
          <h2 className="font-display text-lg" style={{ color: "var(--text)" }}>
            Your kitchen{" "}
            <span
              className="tabular-nums"
              style={{ color: "var(--text-faint)" }}
            >
              ({state.pantry.length})
            </span>
          </h2>
          <svg
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-faint)"
            strokeWidth={2.5}
            strokeLinecap="round"
            className={cx("transition-transform", collapsed && "-rotate-90")}
            aria-hidden
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            if (confirm("Empty your whole kitchen?")) actions.clearPantry();
          }}
        >
          Clear all
        </Button>
      </div>

      {collapsed && (
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          {state.pantry
            .slice(0, 8)
            .map((p) => getIngredient(p.ingredientId)?.name)
            .filter(Boolean)
            .join(", ")}
          {state.pantry.length > 8 && ` +${state.pantry.length - 8} more`}
        </p>
      )}

      {!collapsed && grouped.map(({ aisle, items }) => (
        <section key={aisle}>
          <h3
            className="mb-2 text-xs font-semibold uppercase tracking-wide"
            style={{ color: "var(--text-faint)" }}
          >
            {AISLE_LABEL[aisle]}
          </h3>
          <ul className="flex flex-wrap gap-2">
            {items.map((item) => (
              <PantryChip
                key={item.ingredientId}
                item={item}
                today={today}
                editing={editing === item.ingredientId}
                onEdit={() =>
                  setEditing(
                    editing === item.ingredientId ? null : item.ingredientId,
                  )
                }
                onClose={() => setEditing(null)}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PantryChip({
  item,
  today,
  editing,
  onEdit,
  onClose,
}: {
  item: PantryItem;
  today: Date;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
}) {
  const { actions } = useStore();
  const ing = getIngredient(item.ingredientId);
  if (!ing) return null;

  const days = item.expiresAt ? daysUntil(item.expiresAt, today) : undefined;
  const urgency = expiryUrgency(days);

  return (
    <li className="animate-pop relative">
      <div
        className="flex items-center gap-1.5 rounded-full py-1.5 pl-3 pr-1.5 text-sm"
        style={{
          background: urgency ? urgency.bg : "var(--bg-raised)",
          border: `1px solid ${urgency ? urgency.color : "var(--border)"}`,
          color: urgency ? urgency.color : "var(--text)",
        }}
      >
        {ing.emoji && <span aria-hidden>{ing.emoji}</span>}
        <button onClick={onEdit} className="font-medium">
          {ing.name}
        </button>
        {days !== undefined && (
          <span className="text-xs tabular-nums opacity-80">
            {days < 0
              ? "expired"
              : days === 0
                ? "today"
                : `${days}d`}
          </span>
        )}
        <button
          onClick={() => actions.removePantryItem(item.ingredientId)}
          aria-label={`Remove ${ing.name}`}
          className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-black/10"
        >
          <svg
            width={14}
            height={14}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            aria-hidden
          >
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      {editing && (
        <ExpiryPopover
          item={item}
          onClose={onClose}
          onSet={(iso) => {
            actions.updatePantryItem(item.ingredientId, { expiresAt: iso });
            onClose();
          }}
        />
      )}
    </li>
  );
}

function ExpiryPopover({
  item,
  onClose,
  onSet,
}: {
  item: PantryItem;
  onClose: () => void;
  onSet: (iso: string | undefined) => void;
}) {
  const presets = [
    { label: "Today", days: 0 },
    { label: "2 days", days: 2 },
    { label: "This week", days: 6 },
    { label: "2 weeks", days: 14 },
  ];

  return (
    <div
      className="animate-rise absolute left-0 top-full z-30 mt-2 w-56 rounded-2xl p-3"
      style={{
        background: "var(--bg-raised)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-lift)",
      }}
    >
      <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-muted)" }}>
        Use by — recipes that rescue it rank higher
      </p>
      <div className="grid grid-cols-2 gap-1.5">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => {
              const date = new Date();
              date.setDate(date.getDate() + p.days);
              onSet(date.toISOString());
            }}
            className="rounded-lg px-2 py-1.5 text-xs transition-colors hover:brightness-95"
            style={{
              background: "var(--bg-sunken)",
              color: "var(--text)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input
          type="date"
          defaultValue={item.expiresAt?.slice(0, 10)}
          onChange={(e) =>
            onSet(e.target.value ? new Date(e.target.value).toISOString() : undefined)
          }
          className="min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs"
          style={{
            background: "var(--bg-sunken)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />
      </div>
      {item.expiresAt && (
        <button
          onClick={() => onSet(undefined)}
          className="mt-2 w-full rounded-lg py-1.5 text-xs"
          style={{ color: "var(--text-faint)" }}
        >
          Remove date
        </button>
      )}
      <button
        onClick={onClose}
        className="mt-1 w-full rounded-lg py-1.5 text-xs"
        style={{ color: "var(--text-faint)" }}
      >
        Close
      </button>
    </div>
  );
}

function expiryUrgency(days: number | undefined) {
  if (days === undefined) return null;
  if (days <= 3) return { color: "var(--stretch)", bg: "var(--stretch-bg)" };
  if (days <= 7) return { color: "var(--almost)", bg: "var(--almost-bg)" };
  return null;
}

/** Banner listing what's about to go off, with a nudge toward using it. */
export function ExpiringBanner() {
  const { state } = useStore();
  const today = useToday();

  const expiring = useMemo(
    () =>
      state.pantry
        .filter((p) => p.expiresAt)
        .map((p) => ({ item: p, days: daysUntil(p.expiresAt!, today) }))
        .filter((e) => e.days <= 3)
        .sort((a, b) => a.days - b.days),
    [state.pantry, today],
  );

  if (expiring.length === 0) return null;

  return (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-2xl px-4 py-3 text-sm"
      style={{ background: "var(--stretch-bg)", color: "var(--stretch)" }}
    >
      <span aria-hidden>⏳</span>
      <strong className="font-medium">Use these soon:</strong>
      {expiring.slice(0, 5).map(({ item, days }) => (
        <Badge key={item.ingredientId} color="var(--stretch)" bg="transparent">
          {getIngredient(item.ingredientId)?.name}
          <span className="opacity-70">
            {days < 0 ? " · expired" : days === 0 ? " · today" : ` · ${days}d`}
          </span>
        </Badge>
      ))}
      {expiring.length > 5 && (
        <span className="text-xs opacity-70">+{expiring.length - 5} more</span>
      )}
      <span className="w-full text-xs opacity-80">
        Recipes using them are ranked higher below.
      </span>
    </div>
  );
}

/** Editor for the assumed-on-hand set that's excluded from match maths. */
export function StaplesEditor() {
  const { state, actions } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        <span>
          Assuming you always have{" "}
          <strong style={{ color: "var(--text)" }}>
            {state.staples.length} staples
          </strong>
        </span>
        <svg
          width={14}
          height={14}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          className={cx("transition-transform", open && "rotate-180")}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          className="animate-rise mt-3 rounded-2xl p-4"
          style={{
            background: "var(--bg-sunken)",
            border: "1px solid var(--border)",
          }}
        >
          <p className="mb-3 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>
            Staples are ignored when working out how much of a recipe you have —
            otherwise every simple pasta would score 100% on salt and oil alone.
            Untick anything you don&apos;t actually keep.
          </p>
          <div className="flex flex-wrap gap-2">
            {STAPLE_CANDIDATES.map((id) => {
              const ing = getIngredient(id);
              if (!ing) return null;
              const on = state.staples.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => actions.toggleStaple(id)}
                  aria-pressed={on}
                  className="rounded-full px-3 py-1.5 text-sm transition-all active:scale-95"
                  style={{
                    background: on ? "var(--accent-soft)" : "var(--bg-raised)",
                    border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
                    color: on ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {ing.name}
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mt-3"
            onClick={actions.resetStaples}
          >
            Reset to defaults
          </Button>
        </div>
      )}
    </div>
  );
}

/** The realistic candidate set for "things I always have in". */
const STAPLE_CANDIDATES: IngredientId[] = [
  "salt",
  "black-pepper",
  "olive-oil",
  "vegetable-oil",
  "water",
  "butter",
  "flour",
  "sugar",
  "garlic",
  "onion",
  "egg",
  "milk",
  "rice",
  "spaghetti",
  "lemon",
  "soy-sauce",
  "chili-flakes",
  "cumin",
  "paprika",
  "italian-herbs",
  "vinegar",
  "white-vinegar",
  "mustard",
  "tomato-paste",
  "honey",
  "stock-cube",
];
