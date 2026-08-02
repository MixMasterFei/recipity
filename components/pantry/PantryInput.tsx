"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchIngredients } from "@/lib/normalize";
import { getIngredient } from "@/data/ingredients";
import { useStore } from "@/lib/store";
import { Button, cx } from "@/components/ui/primitives";
import type { IngredientId } from "@/lib/types";

/**
 * Keyboard-first ingredient entry.
 *
 * Typing filters the catalogue; arrows move; Enter adds. The whole point is
 * that adding fifteen things should take fifteen seconds, so the input never
 * loses focus and never clears its own results underneath you.
 */
export function PantryInput({ autoFocus }: { autoFocus?: boolean }) {
  const { state, actions } = useStore();
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const owned = useMemo(
    () => new Set(state.pantry.map((p) => p.ingredientId)),
    [state.pantry],
  );

  const results = useMemo(() => {
    if (query.trim().length === 0) return [];
    return searchIngredients(query, 8);
  }, [query]);

  // Keep the highlight in range when the result list shrinks under it.
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
    // Deliberately keep focus so the next ingredient can be typed immediately.
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

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-2 rounded-2xl px-4 py-3 transition-shadow focus-within:shadow-[var(--shadow-lift)]"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border-strong)",
        }}
      >
        <SearchIcon />
        <input
          ref={inputRef}
          value={query}
          autoFocus={autoFocus}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="What's in your kitchen? Try 'eggs'…"
          aria-label="Search ingredients to add to your kitchen"
          aria-expanded={open && results.length > 0}
          aria-autocomplete="list"
          role="combobox"
          aria-controls="pantry-suggestions"
          className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--text-faint)]"
          style={{ color: "var(--text)" }}
        />
        {query && (
          <button
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-[var(--bg-sunken)]"
            style={{ color: "var(--text-faint)" }}
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {open && results.length > 0 && (
        <ul
          id="pantry-suggestions"
          role="listbox"
          className="animate-rise absolute inset-x-0 top-full z-20 mt-2 max-h-80 overflow-y-auto rounded-2xl p-1.5"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lift)",
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
                  className={cx(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  )}
                  style={{
                    background:
                      idx === highlight ? "var(--bg-sunken)" : "transparent",
                    color: "var(--text)",
                  }}
                >
                  <span className="w-5 text-center" aria-hidden>
                    {ing?.emoji ?? "•"}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{hit.name}</span>
                  {already ? (
                    <span
                      className="shrink-0 text-xs"
                      style={{ color: "var(--ready)" }}
                    >
                      in kitchen
                    </span>
                  ) : (
                    <span
                      className="shrink-0 text-xs capitalize"
                      style={{ color: "var(--text-faint)" }}
                    >
                      {ing?.category}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {open && query.trim().length > 1 && results.length === 0 && (
        <div
          className="animate-rise absolute inset-x-0 top-full z-20 mt-2 rounded-2xl px-4 py-3 text-sm"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow-lift)",
            color: "var(--text-muted)",
          }}
        >
          Nothing matching &ldquo;{query}&rdquo;. Try a simpler word — &ldquo;pepper&rdquo;
          rather than &ldquo;romano peppers&rdquo;.
        </div>
      )}
    </div>
  );
}

/** One-tap adds for the things most likely to be in a kitchen already. */
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

export function QuickAdd() {
  const { state, actions } = useStore();
  const owned = new Set(state.pantry.map((p) => p.ingredientId));
  const available = QUICK_ADD.filter((id) => !owned.has(id));

  if (available.length === 0) return null;

  return (
    <div className="mt-4">
      <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-faint)" }}>
        Quick add
      </p>
      <div className="flex flex-wrap gap-2">
        {available.slice(0, 12).map((id) => {
          const ing = getIngredient(id);
          if (!ing) return null;
          return (
            <button
              key={id}
              onClick={() => actions.addPantryItem(id)}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm transition-all hover:shadow-[var(--shadow-card)] active:scale-95"
              style={{
                background: "var(--bg-raised)",
                border: "1px solid var(--border)",
                color: "var(--text-muted)",
              }}
            >
              {ing.emoji && <span aria-hidden>{ing.emoji}</span>}
              {ing.name}
              <span style={{ color: "var(--text-faint)" }} aria-hidden>
                +
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Load a plausible starter kitchen, so an empty app is never a dead end. */
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
      variant="secondary"
      onClick={() => DEMO_PANTRY.forEach((id) => actions.addPantryItem(id))}
    >
      Fill a sample kitchen
    </Button>
  );
}

function SearchIcon() {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-faint)"
      strokeWidth={2}
      strokeLinecap="round"
      className="shrink-0"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      width={16}
      height={16}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
