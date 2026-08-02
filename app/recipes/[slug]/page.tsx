"use client";

import Link from "next/link";
import { use } from "react";
import { getRecipe } from "@/data/recipes";
import { useStore } from "@/lib/store";
import { Main } from "@/components/shell/AppShell";
import { RecipeDetail } from "@/components/recipe/RecipeDetail";
import { EmptyPanel, PillLinkStyle } from "@/components/ui/primitives";

/**
 * Recipe detail.
 *
 * Client-rendered because an invented recipe lives only in this browser's
 * localStorage — the server has no way to know it exists. Bundled recipes
 * resolve synchronously.
 */
export default function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { state, hydrated } = useStore();

  const recipe = getRecipe(slug) ?? state.invented.find((r) => r.slug === slug);

  if (!recipe) {
    // Until localStorage loads we can't tell an invented recipe from a real
    // 404, so hold the space rather than flashing "not found".
    if (!hydrated) {
      return (
        <Main max={980}>
          <div className="msc-skeleton" style={{ height: 40, width: "60%", borderRadius: 999 }} />
        </Main>
      );
    }

    return (
      <Main max={980}>
        <EmptyPanel
          glyph="🔍"
          title="that recipe ghosted us."
          action={
            <Link href="/recipes" style={PillLinkStyle("primary")}>
              back to the cookbook →
            </Link>
          }
        >
          it doesn&apos;t exist, or it was an invented one that got deleted.
        </EmptyPanel>
      </Main>
    );
  }

  return <RecipeDetail recipe={recipe} />;
}
