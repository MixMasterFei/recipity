# Recipity

Tell Recipity what's in your kitchen. It tells you what you can cook.

Not a recipe search box — a matching engine. Every recipe is scored against
your actual ingredients, so the ones you can make *right now* rise to the top,
the ones you're two ingredients short of get their own band, and anything using
food that's about to go off gets pushed up the list.

No account, no database, no server-side anything. Your pantry lives in your
browser's localStorage and never leaves it.

## What it does

- **Kitchen** — add ingredients with a keyboard-first typeahead over ~470
  canonical ingredients. Aliases work: type "green onions" or "courgette" and it
  resolves them. Optionally tag anything with a use-by date.
- **Live matching** — 139 recipes re-ranked on every change, split into
  *Ready to cook* / *Almost there* / *Worth a shop*.
- **Shopping list** — one tap adds a recipe's missing ingredients, deduped
  across recipes and grouped by supermarket aisle. Tick things off and move them
  straight into your kitchen.
- **Diet & allergy filters** — vegetarian, vegan, gluten-free, dairy-free,
  nut-free. Applied as a hard filter, so restricted recipes never appear at all.
- **Favourites & cook history** — and marking something cooked can deduct what
  it used from your pantry.
- **Invent something** — optional: has Claude write an original recipe from
  exactly what you have. See [enabling it](#enabling-recipe-invention).

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

```bash
npm run test         # Vitest — engine + data integrity
npm run typecheck    # tsc --noEmit
npm run build        # production build
```

## How the matching engine works

`lib/match.ts` is the whole product; everything else is presentation. For each
recipe it classifies every required ingredient against your pantry:

| Kind | Meaning |
| --- | --- |
| `have` | you own exactly this |
| `group` | you own something that counts — recipe wanted "any hard cheese", you have pecorino |
| `sub` | a substitution rule fired — no buttermilk, but you have milk and a lemon |
| `staple` | assumed always on hand; excluded from the maths entirely |
| `missing` | you need to buy it |

Coverage is `satisfied / required`, with **staples excluded from both sides** —
otherwise a three-ingredient pasta would score 100% off salt and olive oil alone
and the ranking would be meaningless.

The rank score then applies:

- `coverage × 100` — the dominant term
- `+8` per pantry item used that expires within 3 days (`+4` within 7)
- a small bonus for using more of your pantry
- `−3` per substitution — a real ingredient beats an improvised one
- `−12` per missing ingredient

Optional ingredients never block a match, so a vegan pasta doesn't fall out of
"ready" because parmesan is listed as an optional finish.

### Diet tags are derived, not written

`lib/diet.ts` computes a recipe's diet flags from its ingredients' flags rather
than reading a hand-written label. A recipe listing butter therefore *cannot* be
mislabelled vegan, however the recipe data is edited later. A test enforces the
same thing in the other direction: any recipe tagged `vegan` whose ingredients
disagree fails the build.

## Project layout

```
app/            routes — kitchen, browse, detail, list, saved, /api/invent
components/     pantry/ recipe/ filters/ invent/ shell/ ui/
lib/            types, match, normalize, diet, shopping, store
data/           ingredients, substitutions, recipes/
tests/          engine + data-integrity tests
```

## Enabling recipe invention

The "Invent something" panel is built and wired but ships **switched off**,
because it needs an Anthropic API key. Without one, `GET /api/invent` returns
`{"enabled": false}` and the UI hides the feature entirely — nothing else in the
app depends on it.

To turn it on:

1. Get a key from [console.anthropic.com](https://console.anthropic.com/).
2. Add it as an environment variable named `ANTHROPIC_API_KEY` — in Vercel:
   *Project → Settings → Environment Variables*. Locally, put it in `.env.local`.
3. Redeploy (or restart `npm run dev`).

The key is read server-side only and is never exposed to the browser. The model
defaults to `claude-sonnet-5` and can be overridden with `ANTHROPIC_MODEL`.

Claude returns the recipe through a forced tool call matching the `Recipe` type,
and every ingredient name it produces is run back through `lib/normalize.ts`.
That's what lets an invented recipe join matching, the shopping list and
favourites like any bundled one.

## Notes

- **No food photography.** Licensed stock imagery needs an API and a mismatched
  or broken photo looks far worse than none, so each recipe gets a deterministic
  warm gradient keyed to its slug plus a cuisine glyph.
- **Recipes are hand-authored**, not scraped — real quantities, real timings,
  weighted toward dishes built from common staples so matches actually fire.
- **Hydration** is handled once, in `lib/store.tsx`. State starts empty and
  loads from localStorage in an effect; `hydrated` tells the UI when it's safe to
  render real content. Reading localStorage during render would desync SSR from
  the client.
