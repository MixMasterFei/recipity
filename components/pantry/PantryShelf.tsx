"use client";

import { useMemo, useState } from "react";
import { AISLE_LABEL, AISLE_ORDER, getIngredient } from "@/data/ingredients";
import {
  daysUntil,
  useByInDays,
  useByInputValue,
  useByIso,
} from "@/lib/expiry";
import { useStore, useToday } from "@/lib/store";
import { expiryLabel } from "@/lib/voice";
import { UNIT_CHOICES, formatAmount } from "@/lib/quantity";
import { Eyebrow, cx } from "@/components/ui/primitives";
import type { Aisle, IngredientId, PantryItem, Unit } from "@/lib/types";

/**
 * The fridge.
 *
 * Sorbet renders one flat alphabetical row; we keep aisle grouping because it
 * makes a large pantry scannable, using the design's eyebrow label for the
 * headers so it still reads as the same system.
 *
 * Chips carry their own expiry state: peach and pulsing within 3 days, pale
 * yellow within 7. That urgency is the input to the engine's rescue bonus, so
 * setting a date is one tap.
 */
export function PantryShelf() {
  const { state, actions } = useStore();
  const today = useToday();
  const [editing, setEditing] = useState<IngredientId | null>(null);

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
    <div style={{ marginTop: 26 }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: 12 }}>
        <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: "var(--ink)" }}>
          in the fridge{" "}
          <span style={{ color: "var(--sky-deep)" }}>({state.pantry.length})</span>
        </p>
        <button
          onClick={() => {
            if (confirm("Empty your whole kitchen?")) actions.clearPantry();
          }}
          className="msc-hover-orange"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-45)" }}
        >
          empty everything 🗑
        </button>
      </div>

      <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 12 }}>
        {grouped.map(({ aisle, items }) => (
          <div key={aisle}>
            <Eyebrow>{AISLE_LABEL[aisle].toUpperCase()}</Eyebrow>
            <div className="flex flex-wrap" style={{ gap: 8, marginTop: 6 }}>
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
            </div>
          </div>
        ))}
      </div>
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
  const urgency = expiryStyle(days);
  const amount = formatAmount(item.quantity, item.unit);

  return (
    // The msc-pop animation carries a transform with `both` fill, which leaves
    // this element as a permanent stacking context. That traps the popover's
    // own z-index inside it, so later siblings that are themselves transformed
    // — the leverage banner — would paint on top. Lift the whole chip while
    // its editor is open.
    <div
      className="msc-pop relative"
      style={{ zIndex: editing ? 40 : undefined }}
    >
      <div
        className="flex items-center"
        style={{
          gap: 6,
          borderRadius: 999,
          padding: "6px 8px 6px 13px",
          fontSize: 13,
          fontWeight: 600,
          background: urgency.bg,
          border: `1.5px solid ${urgency.border}`,
          color: urgency.color,
          animation: urgency.pulse ? "msc-pulse 2s ease-in-out infinite" : "none",
        }}
      >
        {ing.emoji && <span aria-hidden>{ing.emoji}</span>}
        <button onClick={onEdit}>{ing.name.toLowerCase()}</button>
        {amount && (
          <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.7 }}>
            {amount}
          </span>
        )}
        {days !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.85 }}>
            {expiryLabel(days)}
          </span>
        )}
        <button
          onClick={() => actions.removePantryItem(item.ingredientId)}
          aria-label={`Remove ${ing.name}`}
          className="opacity-50 hover:opacity-100"
          style={{ marginLeft: 2, fontWeight: 800, fontSize: 12 }}
        >
          ✕
        </button>
      </div>

      {editing && <ItemPopover item={item} onClose={onClose} />}
    </div>
  );
}

/**
 * The chip editor: how much, and use it by when.
 *
 * Both fields are optional and stay that way. The app is at its best when you
 * can dump fifteen ingredients in fifteen seconds, so nothing here is ever
 * required or prompted for — it's here for the times you know you're running
 * low and want the portions advice.
 */
function ItemPopover({
  item,
  onClose,
}: {
  item: PantryItem;
  onClose: () => void;
}) {
  const { actions } = useStore();
  const [quantity, setQuantity] = useState(
    item.quantity !== undefined ? String(item.quantity) : "",
  );
  const [unit, setUnit] = useState<Unit>(item.unit ?? "g");

  const commitAmount = (rawQuantity: string, nextUnit: Unit) => {
    const parsed = Number.parseFloat(rawQuantity);
    const valid = Number.isFinite(parsed) && parsed > 0;
    actions.updatePantryItem(item.ingredientId, {
      quantity: valid ? parsed : undefined,
      unit: valid ? nextUnit : undefined,
    });
  };

  const setExpiry = (iso: string | undefined) => {
    actions.updatePantryItem(item.ingredientId, { expiresAt: iso });
  };

  const presets = [
    { label: "today", days: 0 },
    { label: "2 days", days: 2 },
    { label: "this week", days: 6 },
    { label: "2 weeks", days: 14 },
  ];

  return (
    <div
      className="msc-rise absolute"
      style={{
        left: 0,
        top: "100%",
        zIndex: 30,
        marginTop: 8,
        width: 244,
        borderRadius: 16,
        padding: 14,
        background: "var(--surface)",
        border: "2px solid var(--tan-border)",
        boxShadow: "6px 6px 0 var(--tan-shadow)",
      }}
    >
      {/* ---- how much ---- */}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-60)" }}>
        how much? optional — it sizes the portions.
      </p>
      <div style={{ marginTop: 8, display: "flex", gap: 6 }}>
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          value={quantity}
          placeholder="any"
          aria-label={`Amount of ${getIngredient(item.ingredientId)?.name ?? "ingredient"}`}
          onChange={(e) => {
            setQuantity(e.target.value);
            commitAmount(e.target.value, unit);
          }}
          style={{
            minWidth: 0,
            flex: 1,
            boxSizing: "border-box",
            borderRadius: 8,
            padding: "6px 8px",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--ground)",
            border: "1.5px solid var(--tan-border)",
            color: "var(--ink)",
          }}
        />
        <select
          value={unit}
          aria-label="Unit"
          onChange={(e) => {
            const next = e.target.value as Unit;
            setUnit(next);
            commitAmount(quantity, next);
          }}
          style={{
            borderRadius: 8,
            padding: "6px 8px",
            fontSize: 12,
            fontWeight: 600,
            background: "var(--ground)",
            border: "1.5px solid var(--tan-border)",
            color: "var(--ink)",
          }}
        >
          {UNIT_CHOICES.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      {item.quantity !== undefined && (
        <button
          onClick={() => {
            setQuantity("");
            actions.updatePantryItem(item.ingredientId, {
              quantity: undefined,
              unit: undefined,
            });
          }}
          style={{
            marginTop: 6,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--ink-45)",
          }}
        >
          forget the amount
        </button>
      )}

      <div
        style={{
          margin: "12px 0",
          borderTop: "1px dashed var(--tan-skeleton)",
        }}
      />

      {/* ---- use by ---- */}
      <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--ink-60)" }}>
        use it by when? rescue dinners rank higher.
      </p>
      <div
        style={{
          marginTop: 8,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
        }}
      >
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => setExpiry(useByInDays(p.days))}
            className="msc-hover-peach"
            style={{
              borderRadius: 8,
              padding: "6px 8px",
              fontSize: 12,
              fontWeight: 600,
              background: "var(--ground)",
              color: "var(--ink)",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      <input
        type="date"
        defaultValue={item.expiresAt ? useByInputValue(item.expiresAt) : undefined}
        aria-label="Use-by date"
        onChange={(e) => setExpiry(useByIso(e.target.value))}
        style={{
          marginTop: 8,
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 8,
          padding: "6px 8px",
          fontSize: 12,
          background: "var(--ground)",
          border: "1.5px solid var(--tan-border)",
          color: "var(--ink)",
        }}
      />
      {item.expiresAt && (
        <button
          onClick={() => setExpiry(undefined)}
          style={{
            marginTop: 8,
            width: "100%",
            fontSize: 12,
            fontWeight: 600,
            color: "var(--ink-45)",
          }}
        >
          remove date
        </button>
      )}
      <button
        onClick={onClose}
        style={{
          marginTop: 6,
          width: "100%",
          fontSize: 12,
          fontWeight: 600,
          color: "var(--ink-45)",
        }}
      >
        close
      </button>
    </div>
  );
}

function expiryStyle(days: number | undefined) {
  if (days === undefined) {
    return {
      bg: "var(--surface)",
      border: "var(--tan-border)",
      color: "var(--ink)",
      pulse: false,
    };
  }
  if (days <= 3) {
    return {
      bg: "var(--peach)",
      border: "var(--orange)",
      color: "var(--brown)",
      pulse: true,
    };
  }
  if (days <= 7) {
    return {
      bg: "var(--yellow-pale)",
      border: "var(--peach)",
      color: "var(--ink)",
      pulse: false,
    };
  }
  return {
    bg: "var(--surface)",
    border: "var(--tan-border)",
    color: "var(--ink)",
    pulse: false,
  };
}

/**
 * The assumed-on-hand set.
 *
 * Not in the Sorbet design, but the engine excludes staples from both sides of
 * the coverage fraction, so it has to stay adjustable — otherwise the maths is
 * driven by a set the user can't see or change.
 */
const STAPLE_CANDIDATES: IngredientId[] = [
  "salt", "black-pepper", "olive-oil", "vegetable-oil", "water", "butter",
  "flour", "sugar", "garlic", "onion", "egg", "milk", "rice", "spaghetti",
  "lemon", "soy-sauce", "chili-flakes", "cumin", "paprika", "italian-herbs",
  "white-vinegar", "mustard", "tomato-paste", "honey", "stock-cube",
];

export function StaplesEditor() {
  const { state, actions } = useStore();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: 18 }}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center"
        style={{ gap: 6, fontSize: 13, fontWeight: 600, color: "var(--ink-45)" }}
        aria-expanded={open}
      >
        assuming you always have{" "}
        <strong style={{ color: "var(--ink)" }}>
          {state.staples.length} staples
        </strong>
        <span className={cx("transition-transform", open && "rotate-180")} aria-hidden>
          ⌄
        </span>
      </button>

      {open && (
        <div
          className="msc-rise"
          style={{
            marginTop: 10,
            borderRadius: 16,
            padding: 16,
            background: "var(--surface)",
            border: "2px solid var(--tan-border)",
            boxShadow: "4px 4px 0 var(--tan-shadow)",
          }}
        >
          <p
            style={{
              margin: 0,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.55,
              color: "var(--ink-60)",
            }}
          >
            staples are ignored when scoring a recipe — otherwise every simple
            pasta would hit 100% on salt and oil alone. untick anything you
            don&apos;t actually keep.
          </p>
          <div className="flex flex-wrap" style={{ gap: 8, marginTop: 12 }}>
            {STAPLE_CANDIDATES.map((id) => {
              const ing = getIngredient(id);
              if (!ing) return null;
              const on = state.staples.includes(id);
              return (
                <button
                  key={id}
                  onClick={() => actions.toggleStaple(id)}
                  aria-pressed={on}
                  className="msc-press"
                  style={{
                    borderRadius: 999,
                    padding: "6px 13px",
                    fontSize: 13,
                    fontWeight: 600,
                    background: on ? "var(--sky)" : "var(--ground)",
                    border: `1.5px solid ${on ? "var(--sky-deep)" : "var(--tan-border)"}`,
                    color: "var(--ink)",
                  }}
                >
                  {ing.name.toLowerCase()}
                </button>
              );
            })}
          </div>
          <button
            onClick={actions.resetStaples}
            className="msc-hover-orange"
            style={{
              marginTop: 12,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--ink-45)",
            }}
          >
            reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}
