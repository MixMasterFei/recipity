# Midnight Snack Club

Tell the club what's in your fridge. It tells you what you can cook.

Not a recipe search box — a matching engine. Every recipe is scored against
your actual ingredients, so the ones you can make *right now* rise to the top,
the ones you're two ingredients short of get their own band, and anything using
food that's about to go off gets pushed up the list.

**No account required.** Your fridge lives in this browser's localStorage and
works entirely offline. Sign in only if you want it to follow you to another
device — see [Accounts](#accounts-optional).

## What it does

- **Kitchen** — add ingredients with a keyboard-first typeahead over ~470
  canonical ingredients. Aliases work: type "green onions" or "courgette" and it
  resolves them. Optionally tag anything with a use-by date and how much you
  have.
- **Live matching** — 139 recipes re-ranked on every change, split into
  *ready rn* / *so close* / *worth a shop*.
- **Use it or lose it** — anything about to turn takes over the top of the
  Kitchen, along with the dinners that actually rescue it. See
  [Rescue first](#rescue-first).
- **Spin the pan** — can't decide? It picks for you, slot-machine style.
- **Portions sized to you** — tell it you've got 50g of pasta left and a recipe
  for four says "makes 1, not 2". See [Amounts](#amounts-and-why-most-apps-get-this-wrong).
- **Shopping list** — one tap adds a recipe's missing ingredients, deduped
  across recipes and grouped by supermarket aisle. Tick things off and move them
  straight into your kitchen.
- **Diet & allergy filters** — vegetarian, vegan, gluten-free, dairy-free,
  nut-free. Applied as a hard filter, so restricted recipes never appear at all.
- **Favourites & cook history** — and marking something cooked can deduct what
  it used from your pantry.
- **Make something up** — optional: has Claude write an original recipe from
  exactly what you have. See [enabling it](#enabling-recipe-invention).
- **Accounts** — optional: sign in with Google or a magic link and your fridge
  syncs across devices. See [Accounts](#accounts-optional).

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

## Rescue first

When something in your fridge is within three days of its use-by date, the
Kitchen changes what it asks. The headline stops being *feed me, i'm bored* and
becomes *2 things are about to turn*, and a **use it or lose it** board takes
the top of the page with the dinners that actually use them.

That isn't only a nicer framing, it's a smaller problem. *"What can I cook from
my twenty ingredients?"* needs an enormous recipe corpus to answer well, and
with 139 hand-written recipes it fails often. *"What uses up this spinach before
Thursday?"* needs only a handful of spinach recipes to succeed. Narrowing the
question narrows how much library it takes to answer it.

Two rules keep the board honest:

- Nothing on it is a shopping list. Only recipes you can make now or nearly
  qualify — being told to rescue your spinach with a dish needing five things
  you haven't got isn't rescue.
- When the library genuinely can't save something, it says so, by name, instead
  of padding the board. That's also the clearest signal available of where the
  recipe corpus is thin.

Nothing is turning in most fridges, and then this renders nothing at all and the
Kitchen looks exactly as it did.

### A use-by date is a day, not an instant

`lib/expiry.ts` exists because the obvious implementation of "days until" is
wrong twice. Diffing two timestamps and flooring means something stamped *use by
today* reads as **expired** a millisecond later; and a `YYYY-MM-DD` from a date
input parses as *UTC* midnight, so picking today reads as yesterday for everyone
west of Greenwich. So both sides are floored to local midnight before
subtracting, dates chosen in the picker are stored at local noon (the same
calendar day in every timezone, daylight saving included), and the day
difference is rounded so the 23- and 25-hour days either side of a clock change
still count as one.

### Diet tags are derived, not written

`lib/diet.ts` computes a recipe's diet flags from its ingredients' flags rather
than reading a hand-written label. A recipe listing butter therefore *cannot* be
mislabelled vegan, however the recipe data is edited later. A test enforces the
same thing in the other direction: any recipe tagged `vegan` whose ingredients
disagree fails the build.

## Project layout

```
app/            routes — kitchen, browse, detail, list, saved, /api/invent
components/     kitchen/ pantry/ recipe/ filters/ invent/ shell/ ui/
lib/            types, match, normalize, diet, shopping, store, voice
                expiry, quantity, rescue      (use-by dates and amounts)
                merge, sync, auth, supabase   (accounts)
data/           ingredients, substitutions, recipes/
supabase/       migrations/                   (schema + row-level security)
tests/          engine, data-integrity and merge tests
```

## Enabling recipe invention

The "make something up" panel is built and wired but ships **switched off**,
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

## Design

The interface is a clone of the **Sorbet** direction produced by Claude Design
from this codebase — one typeface (Bricolage Grotesque), a cream/slate/sky/peach
palette, hard 0-blur offset shadows, and small deliberate rotations on almost
every raised element. `lib/voice.ts` holds the copy vocabulary, including the
ready-state quips that cycle by card index rather than at random.

Four things depart from that design, on purpose:

1. **The fridge is grouped by aisle.** Sorbet uses one flat alphabetical row.
2. **There's a dark mode.** Sorbet hardcodes every hex and has no theme system,
   so the light values here map 1:1 to its literals and the dark set is derived.
3. **The AI invent panel exists**, restyled into Sorbet's language.
4. **The staples editor exists** — the engine excludes staples from both sides of
   the coverage fraction, so that set has to stay adjustable.

## Accounts (optional)

Off by default. With no Supabase credentials set there is no sign-in UI
anywhere, no network calls, and the app behaves exactly as it did before
accounts existed — same dormancy pattern as recipe invention.

Signing in is **additive, never destructive**. On first sign-in your local
fridge is *merged* with whatever is on the account rather than one replacing the
other, and signing out leaves this device's data exactly where it is.

### Turning it on

1. Create a Supabase project (the free tier is plenty).
2. Run `supabase/migrations/0001_kitchen_state.sql` against it — SQL Editor,
   or `supabase db push` if you use the CLI. Then check
   Advisors → Security comes up clean.
3. **Google:** Google Cloud Console → Credentials → OAuth client ID (Web).
   Set the authorized redirect URI to
   `https://<project-ref>.supabase.co/auth/v1/callback`, then paste the client
   ID and secret into Supabase → Authentication → Providers → Google.
4. In Supabase → Authentication → URL Configuration, set your site URL and add
   `https://<your-domain>/auth/callback` to the redirect allowlist.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   (see `.env.example`) and redeploy.

Magic-link sign-in needs no extra setup — it uses Supabase's built-in email,
which is rate-limited on the free tier (a handful per hour). Wire up a custom
SMTP provider in Supabase → Authentication → Emails before real use.

Either key name works: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the modern
`sb_publishable_...` form, preferred) or `NEXT_PUBLIC_SUPABASE_ANON_KEY` (the
legacy JWT, which is what Vercel's Supabase integration injects).

### On the key being public

It is `NEXT_PUBLIC_` on purpose and ships in the browser bundle, which is what
that key is designed for. **Row-level security is the actual security
boundary** — the policies in the migration are what stop one signed-in user
reading another's fridge. Don't disable them.

The policies are scoped `to authenticated`, so a signed-out client has no
policy at all and cannot read the table even to count rows. They also wrap the
uid lookup as `(select auth.uid())`, which lets Postgres evaluate it once per
statement rather than once per row.

### How the merge works

`lib/merge.ts`, with its own tests, because getting this wrong either loses
someone's work or resurrects things they deleted. Two rules, because the state
holds two kinds of field:

- **Collections** (pantry, favourites, shopping list, history, invented) union
  by key. Losing an entry loses real work.
- **Preferences** (staples, diet) take the newer side wholesale. These are
  curated by *removal* — untick salt and a union would put it straight back,
  forever.

The merge is idempotent, which matters because sync pushes the merged result
straight back; without it, every round trip would duplicate history.

Trade-off worth knowing: a device offline for a long time loses its staple and
diet edits to the newer side. That's the price of not resurrecting deleted
staples.

## Amounts, and why most apps get this wrong

Every competitor either ignores quantities or drowns in them. SuperCook is
purely binary — no amounts at all — and gets criticised because portions are
never sized to you. Cooklist tracks quantities on paper and users report it
doesn't work. Plan to Eat shipped a pantry and then *removed* it, reasoning
that a digital inventory and a real kitchen can never stay synchronised.

They're right about the system they built. Modelling a **running balance** is
unwinnable: every unobserved event — you cook without opening the app, your
partner cooks, you eyeball half a packet — pushes the number further from
truth, the error only accumulates, and wrong inventory is worse than none
because it lies to you confidently.

So this doesn't model a balance. Three rules, each enforced by a test:

1. **Amounts are optional and always will be.** No amount entered, or units
   that can't be compared, and the engine says nothing at all. An unmeasured
   fridge behaves exactly as it did before the feature existed.
2. **An amount never blocks a recipe.** Half the pasta is not no pasta. Running
   low scales the portions and applies a rank nudge one-sixth the size of a
   missing ingredient — it never demotes a recipe out of *ready rn*.
3. **Nothing is decremented silently.** `markCooked` removes an ingredient
   outright rather than adjusting a hidden number, so a stale amount is one
   wrong value you can fix in a tap, not a drifting balance you can't see.

### What it will and won't compare

`lib/quantity.ts` only compares within a unit family — mass with mass, volume
with volume, cans with cans. It will happily tell you 1kg covers 500g, or that
a cup is 16 tablespoons.

It refuses to convert *across* families, because a cup of flour weighs 120g and
a cup of sugar weighs 200g. Guessing that produces confident nonsense, so an
incomparable pair returns "no opinion" and the UI stays quiet. Vague amounts —
a pinch, a handful, to taste — are never compared either. Nobody measures a
pinch.

Ratios within 5% count as enough: someone with 500g for a 520g recipe should
not be told they're short.

## Notes

- **No food photography, and no artwork at all.** Sorbet's cards are plain
  white with a cuisine emoji beside the title — there are zero `<svg>` elements
  and no images in the whole design. Licensed stock imagery would need an API,
  and a mismatched photo looks far worse than none.
- **Recipes are hand-authored**, not scraped — real quantities, real timings,
  weighted toward dishes built from common staples so matches actually fire.
- **Hydration** is handled once, in `lib/store.tsx`. State starts empty and
  loads from localStorage in an effect; `hydrated` tells the UI when it's safe to
  render real content. Reading localStorage during render would desync SSR from
  the client.
