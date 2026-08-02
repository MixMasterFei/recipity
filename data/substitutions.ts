import type { Substitution } from "@/lib/types";

/**
 * Rules for making do without something.
 *
 * A rule fires only when *every* id in `requires` is in the pantry (or is a
 * staple). The `note` is shown verbatim in the recipe view, so it has to be a
 * real instruction, not just "use milk instead".
 *
 * These are deliberately conservative — a substitution that ruins the dish is
 * worse than telling someone to buy one thing. Matching applies a small score
 * penalty per substitution so a true match always ranks above a improvised one.
 */
export const SUBSTITUTIONS: Substitution[] = [
  {
    target: "buttermilk",
    requires: ["milk", "lemon"],
    note: "1 cup milk + 1 tbsp lemon juice, stand 5 min until curdled",
  },
  {
    target: "buttermilk",
    requires: ["yogurt", "milk"],
    note: "¾ cup yogurt thinned with ¼ cup milk",
  },
  {
    target: "heavy-cream",
    requires: ["milk", "butter"],
    note: "¾ cup milk whisked with ¼ cup melted butter",
  },
  {
    target: "sour-cream",
    requires: ["yogurt", "lemon"],
    note: "Greek yogurt with a squeeze of lemon",
  },
  {
    target: "self-raising-flour",
    requires: ["flour", "baking-powder"],
    note: "1 cup flour + 1½ tsp baking powder",
  },
  {
    target: "baking-powder",
    requires: ["baking-soda", "white-vinegar"],
    note: "¼ tsp baking soda + ½ tsp vinegar per 1 tsp baking powder",
  },
  {
    target: "breadcrumbs",
    requires: ["bread"],
    note: "Blitz or grate stale bread, then dry it in a low oven",
  },
  {
    target: "tomato-paste",
    requires: ["passata"],
    note: "3 tbsp passata reduced hard in the pan per 1 tbsp paste",
  },
  {
    target: "canned-tomatoes",
    requires: ["passata"],
    note: "Use passata one-for-one; the sauce will be smoother",
  },
  {
    target: "passata",
    requires: ["canned-tomatoes"],
    note: "Blend canned tomatoes until smooth",
  },
  {
    target: "chicken-stock",
    requires: ["stock-cube", "water"],
    note: "1 stock cube dissolved in 500ml hot water",
  },
  {
    target: "vegetable-stock",
    requires: ["stock-cube", "water"],
    note: "1 stock cube dissolved in 500ml hot water",
  },
  {
    target: "beef-stock",
    requires: ["stock-cube", "water"],
    note: "1 stock cube dissolved in 500ml hot water",
  },
  {
    target: "soy-sauce",
    requires: ["tamari"],
    note: "Tamari one-for-one (and it's gluten-free)",
  },
  {
    target: "tamari",
    requires: ["soy-sauce"],
    note: "Soy sauce one-for-one",
  },
  {
    target: "rice-vinegar",
    requires: ["apple-cider-vinegar"],
    note: "Cider vinegar with a pinch of sugar",
  },
  {
    target: "white-wine-vinegar",
    requires: ["lemon"],
    note: "Equal parts lemon juice",
  },
  {
    target: "shaoxing",
    requires: ["white-wine"],
    note: "Dry sherry or dry white wine one-for-one",
  },
  {
    target: "mirin",
    requires: ["sugar", "rice-vinegar"],
    note: "1 tbsp rice vinegar + ½ tsp sugar per 1 tbsp mirin",
  },
  {
    target: "parmesan",
    requires: ["pecorino"],
    note: "Pecorino one-for-one — sharper and saltier, so go easy on salt",
  },
  {
    target: "pecorino",
    requires: ["parmesan"],
    note: "Parmesan one-for-one",
  },
  {
    target: "butter",
    requires: ["olive-oil"],
    note: "Olive oil for sautéing (not for baking or pastry)",
  },
  {
    target: "shallot",
    requires: ["onion"],
    note: "Half a small onion per shallot",
  },
  {
    target: "scallion",
    requires: ["onion"],
    note: "A little finely sliced onion, or chives",
  },
  {
    target: "lemon",
    requires: ["lime"],
    note: "Lime one-for-one",
  },
  {
    target: "lime",
    requires: ["lemon"],
    note: "Lemon one-for-one",
  },
  {
    target: "honey",
    requires: ["maple-syrup"],
    note: "Maple syrup one-for-one",
  },
  {
    target: "maple-syrup",
    requires: ["honey"],
    note: "Honey one-for-one",
  },
  {
    target: "brown-sugar",
    requires: ["sugar", "molasses"],
    note: "1 cup sugar + 1 tbsp molasses",
  },
  {
    target: "cornstarch",
    requires: ["flour"],
    note: "2 tbsp flour per 1 tbsp cornstarch (sauce will be less glossy)",
  },
  {
    target: "chili-flakes",
    requires: ["chili"],
    note: "One fresh chili, finely chopped",
  },
  {
    target: "chili",
    requires: ["chili-flakes"],
    note: "½ tsp chili flakes per fresh chili",
  },
  {
    target: "garam-masala",
    requires: ["cumin", "coriander-seed", "cinnamon"],
    note: "2 parts cumin, 2 parts coriander, 1 part cinnamon",
  },
  {
    target: "curry-powder",
    requires: ["cumin", "turmeric", "coriander-seed"],
    note: "Equal cumin and coriander, half as much turmeric",
  },
  {
    target: "ghee",
    requires: ["butter"],
    note: "Butter one-for-one; watch it doesn't catch at high heat",
  },
  {
    target: "mascarpone",
    requires: ["cream-cheese", "heavy-cream"],
    note: "Cream cheese loosened with a splash of cream",
  },
  {
    target: "ricotta",
    requires: ["cream-cheese"],
    note: "Cream cheese thinned with a little milk",
  },
  {
    target: "pancetta",
    requires: ["bacon"],
    note: "Bacon one-for-one",
  },
  {
    target: "bacon",
    requires: ["pancetta"],
    note: "Pancetta one-for-one",
  },
  {
    target: "sesame-oil",
    requires: ["sesame-seeds", "vegetable-oil"],
    note: "Toast sesame seeds and add them directly instead",
  },
  {
    target: "fish-sauce",
    requires: ["soy-sauce"],
    note: "Soy sauce with a pinch of salt (vegetarian, less funky)",
  },
  {
    target: "oyster-sauce",
    requires: ["soy-sauce", "sugar"],
    note: "2 tbsp soy sauce + 1 tsp sugar per 2 tbsp oyster sauce",
  },
  {
    target: "hoisin",
    requires: ["soy-sauce", "peanut-butter", "honey"],
    note: "2 tbsp soy + 1 tbsp peanut butter + 1 tsp honey",
  },
  {
    target: "yogurt",
    requires: ["sour-cream"],
    note: "Sour cream one-for-one",
  },
  {
    target: "heavy-cream",
    requires: ["coconut-milk"],
    note: "The thick top of a tin of coconut milk (adds coconut flavour)",
  },
  {
    target: "milk",
    requires: ["oat-milk"],
    note: "Oat milk one-for-one",
  },
  {
    target: "milk",
    requires: ["almond-milk"],
    note: "Almond milk one-for-one",
  },
  {
    target: "arborio-rice",
    requires: ["sushi-rice"],
    note: "Short-grain rice releases enough starch for a passable risotto",
  },
  {
    target: "pine-nuts",
    requires: ["walnuts"],
    note: "Walnuts, toasted, chopped small",
  },
  {
    target: "pine-nuts",
    requires: ["almonds"],
    note: "Flaked almonds, toasted",
  },
  {
    target: "red-wine-vinegar",
    requires: ["white-wine-vinegar"],
    note: "White wine vinegar one-for-one",
  },
  {
    target: "white-wine",
    requires: ["chicken-stock", "lemon"],
    note: "Stock plus a squeeze of lemon for the acidity",
  },
  {
    target: "vanilla",
    requires: ["cinnamon"],
    note: "A pinch of cinnamon carries the warmth, though it's not the same",
  },
  {
    target: "gochujang",
    requires: ["miso", "sriracha"],
    note: "1 tbsp miso + 1 tbsp sriracha + ½ tsp sugar",
  },
  {
    target: "harissa",
    requires: ["tomato-paste", "chili-flakes", "cumin"],
    note: "1 tbsp tomato paste + 1 tsp chili flakes + ½ tsp cumin",
  },
  {
    target: "tahini",
    requires: ["peanut-butter"],
    note: "Peanut butter one-for-one (nuttier, sweeter)",
  },
  {
    target: "mayonnaise",
    requires: ["yogurt", "mustard"],
    note: "Greek yogurt sharpened with a little mustard",
  },
];
