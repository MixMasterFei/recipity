"use client";

import { useState } from "react";
import { DIET_KEYS, DIET_LABELS } from "@/lib/diet";
import { useStore } from "@/lib/store";
import { Eyebrow } from "@/components/ui/primitives";
import type { DietKey } from "@/lib/types";

/** Sorbet chip: pill, 1.5px border, sky fill when on. */
function chipStyle(on: boolean, padding: string): React.CSSProperties {
  return {
    borderRadius: 999,
    padding,
    fontSize: 13,
    fontWeight: 600,
    background: on ? "var(--sky)" : "var(--surface)",
    border: `1.5px solid ${on ? "var(--sky-deep)" : "var(--tan-border)"}`,
    color: "var(--ink)",
  };
}

/**
 * EATING RULES.
 *
 * These are a hard filter in the engine, not a ranking penalty — set once and
 * anything breaking them stops appearing anywhere.
 */
export function DietFilterBar({ padding = "6px 13px" }: { padding?: string }) {
  const { state, actions } = useStore();
  const active = state.diet.restrictions;

  const toggle = (key: DietKey) => {
    const next = active.includes(key)
      ? active.filter((k) => k !== key)
      : [...active, key];
    actions.setDiet({ ...state.diet, restrictions: next });
  };

  return (
    <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
      <Eyebrow>EATING RULES</Eyebrow>
      {DIET_KEYS.map((key) => {
        const on = active.includes(key);
        return (
          <button
            key={key}
            onClick={() => toggle(key)}
            aria-pressed={on}
            className="msc-press"
            style={chipStyle(on, padding)}
          >
            {DIET_LABELS[key].toLowerCase()}
          </button>
        );
      })}
    </div>
  );
}

export type BrowseSort = "match" | "quickest" | "alphabetical";

/** SORT / MOOD / EATING RULES stack on the browse screen. */
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
    { key: "match", label: "best match" },
    { key: "quickest", label: "quickest" },
    // En dash, matching the design.
    { key: "alphabetical", label: "a–z" },
  ];

  return (
    <>
      <div
        className="flex items-center"
        style={{
          marginTop: 22,
          gap: 10,
          borderRadius: 999,
          padding: "11px 20px",
          background: "var(--surface)",
          border: "2px solid var(--tan-border)",
          maxWidth: 520,
        }}
      >
        <span style={{ fontSize: 15 }} aria-hidden>
          🔍
        </span>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="search the cookbook…"
          aria-label="Search recipes by name"
          className="min-w-0 flex-1 border-none bg-transparent outline-none"
          style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}
        />
      </div>

      <div
        className="flex flex-wrap items-center"
        style={{ marginTop: 14, gap: 8 }}
      >
        <Eyebrow>SORT</Eyebrow>
        {sorts.map((s) => (
          <button
            key={s.key}
            onClick={() => onSort(s.key)}
            aria-pressed={sort === s.key}
            className="msc-press"
            style={chipStyle(sort === s.key, "5px 13px")}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div
        className="flex flex-wrap items-center"
        style={{ marginTop: 10, gap: 8 }}
      >
        <Eyebrow>MOOD</Eyebrow>
        <button
          onClick={() => onTag(null)}
          aria-pressed={activeTag === null}
          className="msc-press"
          style={{ ...chipStyle(activeTag === null, "5px 13px"), textTransform: "lowercase" }}
        >
          all
        </button>
        {visibleTags.map((tag) => (
          <button
            key={tag}
            onClick={() => onTag(activeTag === tag ? null : tag)}
            aria-pressed={activeTag === tag}
            className="msc-press"
            style={{
              ...chipStyle(activeTag === tag, "5px 13px"),
              textTransform: "lowercase",
            }}
          >
            {tag.replace(/-/g, " ")}
          </button>
        ))}
        {tags.length > 12 && (
          <button
            onClick={() => setShowAllTags(!showAllTags)}
            style={{
              fontSize: 13,
              fontWeight: 600,
              textDecoration: "underline",
              textUnderlineOffset: 2,
              color: "var(--ink-45)",
            }}
          >
            {showAllTags ? "fewer" : `+${tags.length - 12} more`}
          </button>
        )}
      </div>

      <div style={{ marginTop: 10 }}>
        <DietFilterBar padding="5px 13px" />
      </div>
    </>
  );
}
