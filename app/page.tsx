"use client";

import Link from "next/link";
import { useMemo } from "react";
import { RECIPES } from "@/data/recipes";
import { ingredientName } from "@/data/ingredients";
import { groupByStatus, matchPantry } from "@/lib/match";
import { highestLeverageBuy } from "@/lib/shopping";
import { useStore, useToday } from "@/lib/store";
import { TIER_COPY, heroSub, leverageUnlocks, tickerText } from "@/lib/voice";
import { turningHeadline, turningItems } from "@/lib/rescue";
import { Main, Ticker } from "@/components/shell/AppShell";
import {
  DemoPantryButton,
  PantryInput,
  QuickAdd,
} from "@/components/pantry/PantryInput";
import { PantryShelf, StaplesEditor } from "@/components/pantry/PantryShelf";
import { TierSection } from "@/components/recipe/RecipeCard";
import { DietFilterBar } from "@/components/filters/DietFilterBar";
import { InventPanel } from "@/components/invent/InventPanel";
import { SpinThePan } from "@/components/kitchen/SpinThePan";
import { RescueBoard } from "@/components/kitchen/RescueBoard";
import {
  Button,
  CardSkeleton,
  EmptyPanel,
  PillLinkStyle,
} from "@/components/ui/primitives";

/**
 * The Kitchen — the front door.
 *
 * Add what you have; the three tiers re-rank live underneath. This is the only
 * screen with the ticker.
 */
export default function KitchenPage() {
  const { state, hydrated, actions } = useStore();
  const today = useToday();

  const allRecipes = useMemo(
    () => [...state.invented, ...RECIPES],
    [state.invented],
  );

  const results = useMemo(
    () =>
      matchPantry(allRecipes, state.pantry, {
        staples: state.staples,
        diet: state.diet,
        now: today,
      }),
    [allRecipes, state.pantry, state.staples, state.diet, today],
  );

  const { ready, almost, stretch } = useMemo(
    () => groupByStatus(results),
    [results],
  );

  const leverage = useMemo(() => highestLeverageBuy(results), [results]);
  // Drives both the hero and the rescue board. Empty for most fridges, which
  // is why the Kitchen looks unchanged when nothing is at risk.
  const turning = useMemo(
    () => turningItems(state.pantry, today),
    [state.pantry, today],
  );
  const hasPantry = state.pantry.length > 0;
  const ticker = tickerText(hydrated, state.pantry, ready.length, today);

  return (
    <>
      <Main>
        {/* Hero */}
        <div
          className="flex flex-wrap items-start justify-between"
          style={{ gap: 28 }}
        >
          <div style={{ minWidth: "min(100%, 420px)", flex: 1 }}>
            {/*
              The headline answers whichever question actually matters. Nothing
              at risk and it's the usual "what shall I cook"; something turning
              and that becomes the more urgent question, which is also the one
              a curated library answers best.
            */}
            <h1
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: "clamp(44px, 7vw, 76px)",
                lineHeight: 0.95,
                letterSpacing: "-0.03em",
                color: "var(--ink)",
              }}
            >
              {hydrated && turning.length > 0 ? (
                <>
                  <em style={{ fontStyle: "normal", color: "var(--orange)" }}>
                    {turningHeadline(turning)}
                  </em>
                  .
                </>
              ) : (
                <>
                  feed me,
                  <br />
                  i&apos;m{" "}
                  <em style={{ fontStyle: "normal", color: "var(--sky-deep)" }}>
                    bored
                  </em>
                  .
                </>
              )}
            </h1>
            <p
              style={{
                margin: "14px 0 0",
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                color: "var(--ink-60)",
                maxWidth: "44ch",
              }}
            >
              {hydrated && turning.length > 0
                ? "cook something below and none of it goes in the bin."
                : heroSub(hydrated, state.pantry.length, ready.length)}
            </p>
          </div>

          <SpinThePan results={results} />
        </div>

        <PantryInput autoFocus={hydrated && !hasPantry} />

        {hydrated && <QuickAdd />}

        {!hydrated ? (
          <CardSkeleton />
        ) : !hasPantry ? (
          <EmptyPanel
            glyph="🧺"
            title="your kitchen is a blank canvas."
            action={<DemoPantryButton />}
          >
            terrifying. add a few ingredients above and dinners appear
            instantly, ranked by how close you are. nothing leaves this browser.
          </EmptyPanel>
        ) : (
          <>
            <RescueBoard results={results} turning={turning} />

            <PantryShelf />

            <div style={{ marginTop: 18 }}>
              <DietFilterBar />
            </div>

            <StaplesEditor />

            {leverage && (
              <Link
                href="/list"
                className="msc-straighten inline-flex items-center"
                style={{
                  marginTop: 20,
                  gap: 10,
                  borderRadius: 14,
                  padding: "12px 18px",
                  fontSize: 14,
                  fontWeight: 600,
                  background: "var(--peach)",
                  border: "2px solid var(--orange)",
                  color: "var(--ink)",
                  transform: "rotate(-0.5deg)",
                  boxShadow: "4px 4px 0 var(--tan-shadow)",
                  transition: "transform 150ms",
                }}
              >
                <span aria-hidden>💡</span>
                <span>
                  buy{" "}
                  <strong>
                    {ingredientName(leverage.ingredientId).toLowerCase()}
                  </strong>
                  , unlock <strong>{leverageUnlocks(leverage.unlocks)}</strong> →
                </span>
              </Link>
            )}

            <InventPanel />

            <TierSection
              title={TIER_COPY.ready.title}
              subtitle={TIER_COPY.ready.subtitle}
              status="ready"
              results={ready}
              showRescue
            />
            <TierSection
              title={TIER_COPY.almost.title}
              subtitle={TIER_COPY.almost.subtitle}
              status="almost"
              results={almost.slice(0, 12)}
              total={almost.length}
              showRescue
            />
            <TierSection
              title={TIER_COPY.stretch.title}
              subtitle={TIER_COPY.stretch.subtitle}
              status="stretch"
              results={stretch.slice(0, 6)}
              total={stretch.length}
            >
              {stretch.length > 6 && (
                <div style={{ marginTop: 24, textAlign: "center" }}>
                  <Link
                    href="/recipes"
                    className="msc-hover-sky inline-flex items-center"
                    style={{ ...PillLinkStyle("outline"), gap: 8 }}
                  >
                    see all {allRecipes.length} recipes →
                  </Link>
                </div>
              )}
            </TierSection>

            {results.length === 0 && (
              <EmptyPanel
                glyph="🥄"
                title="your eating rules ate everything."
                action={
                  <Button
                    variant="primary"
                    onClick={() =>
                      actions.setDiet({ ...state.diet, restrictions: [] })
                    }
                  >
                    clear the rules
                  </Button>
                }
              >
                every recipe in the library breaks one of your restrictions. try
                relaxing one.
              </EmptyPanel>
            )}
          </>
        )}
      </Main>

      <Ticker text={ticker} />
    </>
  );
}
