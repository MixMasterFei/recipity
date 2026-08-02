"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchIngredients } from "@/lib/normalize";
import { getIngredient } from "@/data/ingredients";
import { useStore } from "@/lib/store";
import { Button, Eyebrow } from "@/components/ui/primitives";
import type { IngredientId } from "@/lib/types";

/**
 * The fridge input.
 *
 * A rounded pill that turns sky-blue at the border on focus, with a dropdown
 * that rises in. Keyboard-first: arrows wrap the highlight, Enter adds,
 * Escape closes and clears. Focus is never taken away, so you can rattle off
 * fifteen ingredients without touching the mouse.
 */
export function PantryInput({ autoFocus }: { autoFocus?: boolean }) {
  const { state, actions } = useStore();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const owned = useMemo(
    () => new Set(state.pantry.map((p) => p.ingredientId)),
    [state.pantry],
  );

  const results = useMemo(
    () => (query.trim().length === 0 ? [] : searchIngredients(query, 8)),
    [query],
  );

  useEffect(() => {
    setHighlight((h) => Math.min(h, Math.max(0, results.length - 1)));
  }, [results.length]);

  useEffect(() => {
    function onClickOutside(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const add = (id: IngredientId) => {
    actions.addPantryItem(id);
    setQuery("");
    setHighlight(0);
    inputRef.current?.focus();
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => (h + 1) % Math.max(1, results.length));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => (h - 1 + results.length) % Math.max(1, results.length));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const hit = results[highlight];
      if (hit) add(hit.id);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  const showSuggestions = open && results.length > 0;
  const showNoHits = open && query.trim().length > 1 && results.length === 0;

  return (
    <div ref={containerRef} className="relative" style={{ marginTop: 26 }}>
      <div
        className="flex items-center"
        style={{
          gap: 10,
          borderRadius: 999,
          padding: "13px 22px",
          background: "var(--surface)",
          border: `2px solid ${focused ? "var(--sky-deep)" : "var(--tan-border)"}`,
          transition: "border-color 150ms",
        }}
      >
        <span style={{ fontSize: 17 }} aria-hidden>
          🔍
        </span>
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setFocused(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onKeyDown}
          placeholder="what's in the fridge? type it…"
          aria-label="Add an ingredient to your kitchen"
          aria-expanded={showSuggestions}
          aria-autocomplete="list"
          aria-controls="fridge-suggestions"
          role="combobox"
          className="min-w-0 flex-1 border-none bg-transparent outline-none"
          style={{ fontSize: 16, fontWeight: 600, color: "var(--ink)" }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            style={{ fontWeight: 800, fontSize: 14, color: "var(--ink-40)" }}
          >
            ✕
          </button>
        )}
      </div>

      {showSuggestions && (
        <ul
          id="fridge-suggestions"
          role="listbox"
          className="msc-rise absolute"
          style={{
            left: 12,
            right: 12,
            top: "100%",
            zIndex: 20,
            margin: "8px 0 0",
            maxHeight: 320,
            overflowY: "auto",
            borderRadius: 18,
            padding: 6,
            listStyle: "none",
            background: "var(--surface)",
            border: "2px solid var(--tan-border)",
            boxShadow: "6px 6px 0 var(--tan-shadow)",
          }}
        >
          {results.map((hit, idx) => {
            const ing = getIngredient(hit.id);
            const already = owned.has(hit.id);
            return (
              <li key={hit.id} role="option" aria-selected={idx === highlight}>
                <button
                  onMouseEnter={() => setHighlight(idx)}
                  onClick={() => add(hit.id)}
                  className="flex w-full items-center text-left"
                  style={{
                    gap: 12,
                    borderRadius: 12,
                    padding: "10px 12px",
                    fontSize: 14,
                    fontWeight: 600,
                    boxSizing: "border-box",
                    background:
                      idx === highlight ? "var(--ground)" : "transparent",
                    color: "var(--ink)",
                  }}
                >
                  <span style={{ width: 20, textAlign: "center" }} aria-hidden>
                    {ing?.emoji ?? "•"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      textTransform: "lowercase",
                      color: already ? "var(--green-text)" : "var(--ink-40)",
                    }}
                  >
                    {already ? "got it ✓" : ing?.category}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {showNoHits && (
        <div
          className="msc-rise absolute"
          style={{
            left: 12,
            right: 12,
            top: "100%",
            zIndex: 20,
            marginTop: 8,
            borderRadius: 18,
            padding: "12px 18px",
            fontSize: 14,
            fontWeight: 500,
            background: "var(--surface)",
            border: "2px solid var(--tan-border)",
            boxShadow: "6px 6px 0 var(--tan-shadow)",
            color: "var(--ink-60)",
          }}
        >
          nothing called &ldquo;{query}&rdquo; in the catalogue. try a simpler
          word — &ldquo;pepper&rdquo;, not &ldquo;romano peppers&rdquo;.
        </div>
      )}
    </div>
  );
}

const QUICK_ADD: IngredientId[] = [
  "egg",
  "onion",
  "garlic",
  "potato",
  "carrot",
  "tomato",
  "chicken-breast",
  "rice",
  "spaghetti",
  "canned-tomatoes",
  "cheddar",
  "milk",
  "butter",
  "chickpeas",
  "mushroom",
  "spinach",
  "bell-pepper",
  "lemon",
];

/** One-tap adds for the things most kitchens already contain. */
export function QuickAdd() {
  const { state, actions } = useStore();
  const owned = new Set(state.pantry.map((p) => p.ingredientId));
  const available = QUICK_ADD.filter((id) => !owned.has(id)).slice(0, 12);

  if (available.length === 0) return null;

  return (
    <div style={{ marginTop: 16 }}>
      <Eyebrow>SPEEDRUN IT</Eyebrow>
      <div className="flex flex-wrap" style={{ gap: 8, marginTop: 8 }}>
        {available.map((id) => {
          const ing = getIngredient(id);
          if (!ing) return null;
          return (
            <button
              key={id}
              onClick={() => actions.addPantryItem(id)}
              className="msc-press msc-hover-sky flex items-center"
              style={{
                gap: 6,
                borderRadius: 999,
                padding: "6px 13px",
                fontSize: 13,
                fontWeight: 600,
                background: "var(--surface)",
                border: "1.5px solid var(--tan-border)",
                color: "var(--ink)",
              }}
            >
              {ing.emoji && <span aria-hidden>{ing.emoji}</span>}
              {ing.name.toLowerCase()}
              <span
                style={{ color: "var(--sky-deep)", fontWeight: 800 }}
                aria-hidden
              >
                +
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const DEMO_PANTRY: IngredientId[] = [
  "egg",
  "onion",
  "garlic",
  "rice",
  "spaghetti",
  "canned-tomatoes",
  "chicken-thigh",
  "carrot",
  "potato",
  "cheddar",
  "parmesan",
  "soy-sauce",
  "mushroom",
  "spinach",
  "lemon",
  "chickpeas",
];

export function DemoPantryButton() {
  const { actions } = useStore();
  return (
    <Button
      variant="primary"
      onClick={() => DEMO_PANTRY.forEach((id) => actions.addPantryItem(id))}
    >
      fill a sample kitchen 🎒
    </Button>
  );
}
