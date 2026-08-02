"use client";

import { useState } from "react";
import { DIET_KEYS, DIET_LABELS } from "@/lib/diet";
import { useStore } from "@/lib/store";
import { cx } from "@/components/ui/primitives";
import type { DietKey } from "@/lib/types";

/**
 * Dietary restrictions.
 *
 * These are a hard filter in the engine, not a ranking penalty — set once and
 * anything that breaks them stops appearing anywhere in the app.
 */
export function DietFilterBar({ label }: { label?: string }) {
  const { state, actions } = useStore();
  const active = state.diet.restrictions;

  const toggle = (key: DietKey) => {
    const next = active.includes(key)
      ? active.filter((k) => k !== key)
      : [...active, key];
    actions.setDiet({ ...state.diet, restrictions: next });
  };

  return (
    <div className="scroll-x no-scrollbar -mx-1 flex items-center gap-2 px-1 py-1">
      {label && (
        <span
          className="shrink-0 text-xs font-medium"
          style={{ color: "var(--text-faint)" }}
        >
          {label}
        </span>
      )}
      {DIET_KEYS.map((key) => {
        const on = active.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            aria-pressed={on}
            className="shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-all active:scale-95"
            style={{
              background: on ? "var(--accent)" : "var(--bg-raised)",
              border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`,
              color: on ? "var(--bg)" : "var(--text-muted)",
            }}
          >
            {DIET_LABELS[key]}
          </button>
        );
      })}
    </div>
  );
}

/** Sort + tag controls for the browse page. */
export type BrowseSort = "match" | "quickest" | "alphabetical";

export function BrowseControls({
  sort,
  onSort,
  tags,
  activeTag,
  onTag,
  query,
  onQuery,
}: {
  sort: BrowseSort;
  onSort: (s: BrowseSort) => void;
  tags: string[];
  activeTag: string | null;
  onTag: (t: string | null) => void;
  query: string;
  onQuery: (q: string) => void;
}) {
  const [showAllTags, setShowAllTags] = useState(false);
  const visibleTags = showAllTags ? tags : tags.slice(0, 12);

  const sorts: { key: BrowseSort; label: string }[] = [
    { key: "match", label: "Best match" },
    { key: "quickest", label: "Quickest" },
    { key: "alphabetical", label: "A–Z" },
  ];

  return (
    <div className="space-y-4">
      <div
        className="flex items-center gap-2 rounded-2xl px-4 py-2.5"
        style={{
          background: "var(--bg-raised)",
          border: "1px solid var(--border)",
        }}
      >
        <svg
          width={17}
          height={17}
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
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search recipes…"
          aria-label="Search recipes by name"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--text-faint)]"
          style={{ color: "var(--text)" }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium" style={{ color: "var(--text-faint)" }}>
          Sort
        </span>
        {sorts.map((s) => (
          <button
            key={s.key}
            onClick={() => onSort(s.key)}
            aria-pressed={sort === s.key}
            className="rounded-full px-3 py-1 text-sm transition-all"
            style={{
              background: sort === s.key ? "var(--accent-soft)" : "transparent",
              color: sort === s.key ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${sort === s.key ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => onTag(null)}
          aria-pressed={activeTag === null}
          className={cx("rounded-full px-3 py-1 text-sm transition-all")}
          style={{
            background: activeTag === null ? "var(--accent-soft)" : "transparent",
            color: activeTag === null ? "var(--accent)" : "var(--text-muted)",
            border: `1px solid ${activeTag === null ? "var(--accent)" : "var(--border)"}`,
          }}
        >
          All
        </button>
        {visibleTags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTag(activeTag === tag ? null : tag)}
            aria-pressed={activeTag === tag}
            className="rounded-full px-3 py-1 text-sm capitalize transition-all"
            style={{
              background: activeTag === tag ? "var(--accent-soft)" : "transparent",
              color: activeTag === tag ? "var(--accent)" : "var(--text-muted)",
              border: `1px solid ${activeTag === tag ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            {tag.replace(/-/g, " ")}
          </button>
        ))}
        {tags.length > 12 && (
          <button
            onClick={() => setShowAllTags(!showAllTags)}
            className="text-sm underline underline-offset-2"
            style={{ color: "var(--text-faint)" }}
          >
            {showAllTags ? "Fewer" : `+${tags.length - 12} more`}
          </button>
        )}
      </div>
    </div>
  );
}
