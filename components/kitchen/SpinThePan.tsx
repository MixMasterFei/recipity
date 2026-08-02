"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MatchResult, Recipe } from "@/lib/types";

/**
 * "Spin the pan" — a slot machine for picking dinner.
 *
 * Cycles a random title every 90ms for 1400ms, then lands on the real pick.
 * The dashed ring turns slowly at rest (14s) and speeds up ~17× while
 * spinning (0.8s), which is what sells the whole thing.
 */
const CYCLE_MS = 90;
const SPIN_MS = 1400;

export function SpinThePan({ results }: { results: MatchResult[] }) {
  const [spinning, setSpinning] = useState(false);
  const [title, setTitle] = useState<string | null>(null);
  const [pick, setPick] = useState<Recipe | null>(null);
  const cycleTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const endTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Prefer something they can actually cook; fall back to the best-scored.
  const ready = results.filter((r) => r.status === "ready");
  const pool = ready.length > 0 ? ready : results.slice(0, 20);

  useEffect(
    () => () => {
      if (cycleTimer.current) clearInterval(cycleTimer.current);
      if (endTimer.current) clearTimeout(endTimer.current);
    },
    [],
  );

  const spin = () => {
    // Clicking mid-spin must be a no-op, or the timers stack up.
    if (spinning || pool.length === 0) return;
    setSpinning(true);
    setPick(null);

    cycleTimer.current = setInterval(() => {
      const r = pool[Math.floor(Math.random() * pool.length)];
      if (r) setTitle(r.recipe.title);
    }, CYCLE_MS);

    endTimer.current = setTimeout(() => {
      if (cycleTimer.current) clearInterval(cycleTimer.current);
      const chosen = pool[Math.floor(Math.random() * pool.length)];
      setSpinning(false);
      if (chosen) {
        setPick(chosen.recipe);
        setTitle(chosen.recipe.title);
      }
    }, SPIN_MS);
  };

  return (
    <div
      className="flex shrink-0 flex-col items-center"
      style={{ gap: 14 }}
    >
      <button
        onClick={spin}
        aria-label="Spin the pan — pick a random recipe you can cook"
        className="msc-press relative block"
        style={{ width: 150, height: 150 }}
      >
        <span
          className="absolute block"
          style={{
            inset: 0,
            border: "2.5px dashed var(--sky-deep)",
            borderRadius: "50%",
            animation: `msc-spin ${spinning ? "0.8s" : "14s"} linear infinite`,
          }}
          aria-hidden
        />
        <span
          className="absolute grid place-items-center text-center"
          style={{
            inset: 14,
            borderRadius: "50%",
            background: "var(--peach)",
            transform: "rotate(3deg)",
            boxShadow: "3px 3px 0 var(--green-fill)",
          }}
        >
          <span
            style={{
              fontWeight: 800,
              fontSize: 20,
              lineHeight: 1.05,
              color: "var(--ink)",
            }}
          >
            SPIN
            <br />
            THE PAN
            <br />
            🍳
          </span>
        </span>
      </button>

      {spinning && title && (
        <span
          className="text-center"
          style={{
            fontWeight: 700,
            fontSize: 14,
            color: "var(--amber)",
            maxWidth: 180,
          }}
        >
          {title}…
        </span>
      )}

      {!spinning && pick && (
        <Link
          href={`/recipes/${pick.slug}`}
          className="msc-pop block text-center"
          style={{
            maxWidth: 200,
            background: "var(--surface)",
            border: "2px solid var(--green-stroke)",
            borderRadius: 14,
            padding: "10px 14px",
            transform: "rotate(-1.5deg)",
            boxShadow: "4px 4px 0 var(--green-pale)",
          }}
        >
          <span
            className="block"
            style={{
              fontWeight: 800,
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--green-text)",
            }}
          >
            FATE SAYS
          </span>
          <span
            className="block"
            style={{
              fontWeight: 700,
              fontSize: 16,
              lineHeight: 1.1,
              color: "var(--ink)",
              marginTop: 2,
            }}
          >
            {pick.title}
          </span>
          <span
            className="block"
            style={{
              fontWeight: 600,
              fontSize: 12,
              color: "var(--sky-deep)",
              marginTop: 4,
            }}
          >
            take me there →
          </span>
        </Link>
      )}
    </div>
  );
}
