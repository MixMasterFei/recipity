"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/primitives";
import type { Recipe } from "@/lib/types";

/**
 * "Invent something" — asks Claude for an original recipe built from the
 * user's exact pantry.
 *
 * The panel asks the route whether it's enabled before rendering anything, so
 * when no API key is configured the feature is simply absent rather than
 * offering a button that fails.
 */
export function InventPanel() {
  const { state, actions } = useStore();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [latest, setLatest] = useState<Recipe | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/invent")
      .then((r) => r.json())
      .then((data: { enabled?: boolean }) => {
        if (!cancelled) setEnabled(Boolean(data.enabled));
      })
      .catch(() => {
        if (!cancelled) setEnabled(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (enabled !== true) return null;
  if (state.pantry.length < 2) return null;

  const invent = async () => {
    setBusy(true);
    setError(null);
    setLatest(null);
    try {
      const response = await fetch("/api/invent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          pantryIds: state.pantry.map((p) => p.ingredientId),
          restrictions: state.diet.restrictions,
          mood: mood.trim() || undefined,
        }),
      });
      const data = (await response.json()) as {
        recipe?: Recipe;
        error?: string;
      };

      if (!response.ok || !data.recipe) {
        setError(data.error ?? "Couldn't invent a recipe just now.");
        return;
      }

      actions.addInvented(data.recipe);
      setLatest(data.recipe);
      setMood("");
    } catch {
      setError("Network problem — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      className="mb-8 rounded-2xl p-4 sm:p-5"
      style={{
        background: "var(--bg-sunken)",
        border: "1px dashed var(--border-strong)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2
            className="font-display flex items-center gap-2 text-lg"
            style={{ color: "var(--text)" }}
          >
            <span aria-hidden>✨</span> Invent something
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: "var(--text-muted)" }}>
            Nothing in the library appealing? Have Claude write one from exactly
            what you have.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? "Hide options" : "Add a nudge"}
          </Button>
          <Button variant="primary" onClick={invent} disabled={busy}>
            {busy ? "Thinking…" : "Invent a recipe"}
          </Button>
        </div>
      </div>

      {expanded && (
        <input
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) invent();
          }}
          placeholder="Something quick and spicy… / comfort food… / no oven"
          aria-label="What kind of dish do you feel like?"
          className="mt-3 w-full rounded-xl px-3 py-2.5 text-sm outline-none"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
            color: "var(--text)",
          }}
        />
      )}

      {busy && (
        <div className="mt-4 space-y-2">
          <div className="skeleton h-4 w-1/3 rounded" />
          <div className="skeleton h-3 w-full rounded" />
          <div className="skeleton h-3 w-4/5 rounded" />
        </div>
      )}

      {error && (
        <p className="mt-3 text-sm" style={{ color: "var(--stretch)" }}>
          {error}
        </p>
      )}

      {latest && (
        <Link
          href={`/recipes/${latest.slug}`}
          className="animate-rise mt-4 flex items-center gap-3 rounded-xl px-4 py-3 transition-all hover:shadow-[var(--shadow-card)]"
          style={{
            background: "var(--bg-raised)",
            border: "1px solid var(--border)",
          }}
        >
          <span className="text-xl" aria-hidden>
            🍳
          </span>
          <span className="min-w-0">
            <strong className="block truncate" style={{ color: "var(--text)" }}>
              {latest.title}
            </strong>
            <span className="text-sm" style={{ color: "var(--text-muted)" }}>
              {latest.prepMin + latest.cookMin} min · tap to read the method
            </span>
          </span>
        </Link>
      )}
    </section>
  );
}
