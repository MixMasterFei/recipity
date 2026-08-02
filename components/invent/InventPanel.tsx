"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/primitives";
import type { Recipe } from "@/lib/types";

/**
 * "make something up" — Claude writes an original recipe from exactly what's
 * in the fridge.
 *
 * Not part of the Sorbet design, so it's built in Sorbet's language: dashed
 * panel, offset-shadow pill, lowercase voice. The panel asks the route whether
 * it's enabled before rendering anything, so with no API key configured the
 * feature is simply absent rather than a button that fails.
 */
export function InventPanel() {
  const { state, actions } = useStore();
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mood, setMood] = useState("");
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
        setError(data.error ?? "couldn't invent anything just now.");
        return;
      }

      actions.addInvented(data.recipe);
      setLatest(data.recipe);
      setMood("");
    } catch {
      setError("network problem. try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section
      style={{
        marginTop: 24,
        borderRadius: 24,
        padding: "20px 22px",
        border: "2px dashed var(--tan-dashed)",
      }}
    >
      <div className="flex flex-wrap items-center justify-between" style={{ gap: 12 }}>
        <div className="min-w-0">
          <h2
            style={{
              margin: 0,
              fontWeight: 800,
              fontSize: 22,
              letterSpacing: "-0.02em",
              color: "var(--ink)",
            }}
          >
            ✨ make something up
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              fontWeight: 500,
              color: "var(--ink-60)",
            }}
          >
            nothing in the cookbook doing it for you? have claude invent one
            from exactly what you have.
          </p>
        </div>
        <Button variant="primary" onClick={invent} disabled={busy}>
          {busy ? "thinking…" : "invent a dinner 🎲"}
        </Button>
      </div>

      <input
        value={mood}
        onChange={(e) => setMood(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !busy) invent();
        }}
        placeholder="quick and spicy… / comfort food… / no oven"
        aria-label="What kind of dish do you feel like?"
        style={{
          marginTop: 14,
          width: "100%",
          boxSizing: "border-box",
          borderRadius: 999,
          padding: "10px 18px",
          fontSize: 14,
          fontWeight: 600,
          outline: "none",
          background: "var(--surface)",
          border: "2px solid var(--tan-border)",
          color: "var(--ink)",
        }}
      />

      {busy && (
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="msc-skeleton" style={{ height: 14, width: "35%", borderRadius: 999 }} />
          <div className="msc-skeleton" style={{ height: 12, width: "100%", borderRadius: 999 }} />
          <div className="msc-skeleton" style={{ height: 12, width: "80%", borderRadius: 999 }} />
        </div>
      )}

      {error && (
        <p style={{ marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--orange)" }}>
          {error}
        </p>
      )}

      {latest && (
        <Link
          href={`/recipes/${latest.slug}`}
          className="msc-pop flex items-center"
          style={{
            marginTop: 14,
            gap: 12,
            borderRadius: 14,
            padding: "12px 16px",
            background: "var(--surface)",
            border: "2px solid var(--green-stroke)",
            boxShadow: "4px 4px 0 var(--green-pale)",
            transform: "rotate(-0.5deg)",
          }}
        >
          <span style={{ fontSize: 20 }} aria-hidden>
            🍳
          </span>
          <span className="min-w-0">
            <strong
              className="block truncate"
              style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)" }}
            >
              {latest.title}
            </strong>
            <span style={{ fontSize: 13, fontWeight: 500, color: "var(--ink-55)" }}>
              {latest.prepMin + latest.cookMin} min · tap for the method
            </span>
          </span>
        </Link>
      )}
    </section>
  );
}
