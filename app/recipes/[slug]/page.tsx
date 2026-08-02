"use client";

import Link from "next/link";
import { use } from "react";
import { getRecipe } from "@/data/recipes";
import { useStore } from "@/lib/store";
import { RecipeDetail } from "@/components/recipe/RecipeDetail";
import { Button, EmptyState } from "@/components/ui/primitives";

/**
 * Recipe detail.
 *
 * Rendered on the client because an invented recipe lives only in this
 * browser's localStorage — the server has no way to know it exists. Bundled
 * recipes resolve synchronously from the library.
 */
export default function RecipePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { state, hydrated } = useStore();

  const recipe =
    getRecipe(slug) ?? state.invented.find((r) => r.slug === slug);

  if (!recipe) {
    // Until localStorage has loaded we can't know whether this is an invented
    // recipe or a genuine 404, so show a placeholder rather than "not found".
    if (!hydrated) {
      return (
        <div className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
          <div className="skeleton mb-6 h-40 w-full rounded-3xl" />
          <div className="skeleton mb-3 h-8 w-2/3 rounded" />
          <div className="skeleton h-4 w-full rounded" />
        </div>
      );
    }

    return (
      <EmptyState
        icon={<span className="text-2xl">🔍</span>}
        title="Recipe not found"
        action={
          <Link href="/recipes">
            <Button variant="primary">Browse all recipes</Button>
          </Link>
        }
      >
        That recipe doesn&apos;t exist, or it was an invented one that has since
        been deleted.
      </EmptyState>
    );
  }

  return <RecipeDetail recipe={recipe} />;
}
