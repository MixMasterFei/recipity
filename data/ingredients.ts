import type {
  Aisle,
  DietFlags,
  Ingredient,
  IngredientCategory,
  IngredientId,
} from "@/lib/types";

/**
 * The canonical ingredient catalogue.
 *
 * Every ingredient in the app — typed into the pantry, listed by a recipe, or
 * returned by Claude — resolves to an id in here. Diet flags default from the
 * category (meat isn't vegetarian, cheese isn't vegan) and are overridden only
 * where an item breaks its category's rule, e.g. soy sauce containing wheat.
 */

interface Spec {
  id: IngredientId;
  name: string;
  category: IngredientCategory;
  aisle: Aisle;
  aliases?: string[];
  groups?: string[];
  staple?: boolean;
  emoji?: string;
  diet?: Partial<DietFlags>;
}

const ALL_OK: DietFlags = {
  vegan: true,
  vegetarian: true,
  glutenFree: true,
  dairyFree: true,
  nutFree: true,
};

const NOT_VEG: Partial<DietFlags> = { vegan: false, vegetarian: false };
const DAIRY: Partial<DietFlags> = { vegan: false, dairyFree: false };

function defaultDiet(category: IngredientCategory): DietFlags {
  switch (category) {
    case "meat":
    case "poultry":
    case "seafood":
      return { ...ALL_OK, ...NOT_VEG };
    case "dairy":
    case "cheese":
      return { ...ALL_OK, ...DAIRY };
    case "egg":
      return { ...ALL_OK, vegan: false };
    case "nut":
      return { ...ALL_OK, nutFree: false };
    case "pasta":
      return { ...ALL_OK, glutenFree: false };
    default:
      return ALL_OK;
  }
}

function build(specs: Spec[]): Ingredient[] {
  return specs.map((s) => ({
    id: s.id,
    name: s.name,
    aliases: s.aliases ?? [],
    category: s.category,
    aisle: s.aisle,
    diet: { ...defaultDiet(s.category), ...(s.diet ?? {}) },
    groups: s.groups,
    staple: s.staple,
    emoji: s.emoji,
  }));
}

const v = (
  id: string,
  name: string,
  aisle: Aisle,
  category: IngredientCategory,
  extra: Omit<Spec, "id" | "name" | "aisle" | "category"> = {},
): Spec => ({ id, name, aisle, category, ...extra });

/* ------------------------------------------------------------------ */
/* Vegetables                                                          */
/* ------------------------------------------------------------------ */

const VEGETABLES: Spec[] = [
  v("onion", "Onion", "produce", "vegetable", { aliases: ["yellow onion", "brown onion", "white onion"], groups: ["onion"], emoji: "🧅" }),
  v("red-onion", "Red onion", "produce", "vegetable", { groups: ["onion"], emoji: "🧅" }),
  v("shallot", "Shallot", "produce", "vegetable", { aliases: ["echalion"], groups: ["onion"] }),
  v("scallion", "Scallion", "produce", "vegetable", { aliases: ["green onion", "spring onion", "salad onion"], groups: ["onion"] }),
  v("leek", "Leek", "produce", "vegetable", { groups: ["onion"] }),
  v("garlic", "Garlic", "produce", "vegetable", { aliases: ["garlic clove"], staple: true, emoji: "🧄" }),
  v("ginger", "Ginger", "produce", "vegetable", { aliases: ["fresh ginger", "root ginger"] }),
  v("carrot", "Carrot", "produce", "vegetable", { groups: ["root-veg"], emoji: "🥕" }),
  v("potato", "Potato", "produce", "vegetable", { aliases: ["potatoes", "russet", "maris piper"], groups: ["root-veg"], emoji: "🥔" }),
  v("sweet-potato", "Sweet potato", "produce", "vegetable", { aliases: ["yam"], groups: ["root-veg"], emoji: "🍠" }),
  v("parsnip", "Parsnip", "produce", "vegetable", { groups: ["root-veg"] }),
  v("turnip", "Turnip", "produce", "vegetable", { groups: ["root-veg"] }),
  v("beetroot", "Beetroot", "produce", "vegetable", { aliases: ["beet", "beets"], groups: ["root-veg"] }),
  v("celery", "Celery", "produce", "vegetable", {}),
  v("celeriac", "Celeriac", "produce", "vegetable", { aliases: ["celery root"], groups: ["root-veg"] }),
  v("tomato", "Tomato", "produce", "vegetable", { aliases: ["tomatoes", "vine tomato"], emoji: "🍅" }),
  v("cherry-tomato", "Cherry tomatoes", "produce", "vegetable", { aliases: ["baby tomatoes", "grape tomatoes"], emoji: "🍅" }),
  v("bell-pepper", "Bell pepper", "produce", "vegetable", { aliases: ["capsicum", "sweet pepper", "red pepper", "green pepper"], groups: ["bell-pepper"], emoji: "🫑" }),
  v("chili", "Fresh chili", "produce", "vegetable", { aliases: ["chilli", "red chili", "birds eye chili", "jalapeno", "jalapeño", "serrano"], groups: ["chili"], emoji: "🌶️" }),
  v("cucumber", "Cucumber", "produce", "vegetable", { emoji: "🥒" }),
  v("zucchini", "Zucchini", "produce", "vegetable", { aliases: ["courgette"] }),
  v("eggplant", "Eggplant", "produce", "vegetable", { aliases: ["aubergine"], emoji: "🍆" }),
  v("mushroom", "Mushrooms", "produce", "vegetable", { aliases: ["button mushroom", "chestnut mushroom", "cremini"], groups: ["mushroom"], emoji: "🍄" }),
  v("portobello", "Portobello mushrooms", "produce", "vegetable", { groups: ["mushroom"] }),
  v("shiitake", "Shiitake mushrooms", "produce", "vegetable", { groups: ["mushroom"] }),
  v("spinach", "Spinach", "produce", "vegetable", { aliases: ["baby spinach"], groups: ["leafy-green"], emoji: "🥬" }),
  v("kale", "Kale", "produce", "vegetable", { aliases: ["cavolo nero"], groups: ["leafy-green"] }),
  v("chard", "Swiss chard", "produce", "vegetable", { aliases: ["silverbeet"], groups: ["leafy-green"] }),
  v("lettuce", "Lettuce", "produce", "vegetable", { aliases: ["romaine", "cos lettuce", "iceberg", "gem lettuce"], groups: ["leafy-green", "salad-leaf"], emoji: "🥬" }),
  v("arugula", "Arugula", "produce", "vegetable", { aliases: ["rocket"], groups: ["leafy-green", "salad-leaf"] }),
  v("cabbage", "Cabbage", "produce", "vegetable", { aliases: ["white cabbage", "green cabbage"], groups: ["cabbage"] }),
  v("red-cabbage", "Red cabbage", "produce", "vegetable", { groups: ["cabbage"] }),
  v("napa-cabbage", "Napa cabbage", "produce", "vegetable", { aliases: ["chinese cabbage", "wombok"], groups: ["cabbage"] }),
  v("bok-choy", "Bok choy", "produce", "vegetable", { aliases: ["pak choi"], groups: ["leafy-green", "cabbage"] }),
  v("broccoli", "Broccoli", "produce", "vegetable", { emoji: "🥦" }),
  v("cauliflower", "Cauliflower", "produce", "vegetable", {}),
  v("brussels-sprouts", "Brussels sprouts", "produce", "vegetable", {}),
  v("green-beans", "Green beans", "produce", "vegetable", { aliases: ["french beans", "string beans"] }),
  v("peas", "Peas", "frozen", "vegetable", { aliases: ["frozen peas", "garden peas"] }),
  v("snow-peas", "Snow peas", "produce", "vegetable", { aliases: ["mangetout", "sugar snap peas"] }),
  v("corn", "Corn", "produce", "vegetable", { aliases: ["sweetcorn", "corn kernels"], emoji: "🌽" }),
  v("asparagus", "Asparagus", "produce", "vegetable", {}),
  v("butternut-squash", "Butternut squash", "produce", "vegetable", { groups: ["winter-squash"] }),
  v("pumpkin", "Pumpkin", "produce", "vegetable", { groups: ["winter-squash"], emoji: "🎃" }),
  v("fennel", "Fennel", "produce", "vegetable", {}),
  v("radish", "Radish", "produce", "vegetable", {}),
  v("avocado", "Avocado", "produce", "vegetable", { emoji: "🥑" }),
  v("olives", "Olives", "pantry", "vegetable", { aliases: ["black olives", "green olives", "kalamata"], emoji: "🫒" }),
  v("sun-dried-tomato", "Sun-dried tomatoes", "pantry", "vegetable", {}),
  v("artichoke", "Artichoke hearts", "pantry", "vegetable", {}),
  v("sauerkraut", "Sauerkraut", "pantry", "vegetable", {}),
  v("kimchi", "Kimchi", "pantry", "vegetable", { diet: { vegan: false, vegetarian: false } }),
  v("beansprouts", "Beansprouts", "produce", "vegetable", { aliases: ["bean sprouts"] }),
  v("edamame", "Edamame", "frozen", "vegetable", {}),
  v("water-chestnut", "Water chestnuts", "pantry", "vegetable", {}),
  v("pickles", "Pickles", "condiments", "vegetable", { aliases: ["gherkins", "cornichons"] }),
  v("capers", "Capers", "condiments", "vegetable", {}),
];

/* ------------------------------------------------------------------ */
/* Fruit                                                               */
/* ------------------------------------------------------------------ */

const FRUIT: Spec[] = [
  v("lemon", "Lemon", "produce", "fruit", { groups: ["citrus"], staple: true, emoji: "🍋" }),
  v("lime", "Lime", "produce", "fruit", { groups: ["citrus"], emoji: "🍋" }),
  v("orange", "Orange", "produce", "fruit", { groups: ["citrus"], emoji: "🍊" }),
  v("apple", "Apple", "produce", "fruit", { emoji: "🍎" }),
  v("pear", "Pear", "produce", "fruit", { emoji: "🍐" }),
  v("banana", "Banana", "produce", "fruit", { emoji: "🍌" }),
  v("strawberry", "Strawberries", "produce", "fruit", { emoji: "🍓" }),
  v("blueberry", "Blueberries", "produce", "fruit", { groups: ["berry"], emoji: "🫐" }),
  v("raspberry", "Raspberries", "produce", "fruit", { groups: ["berry"] }),
  v("blackberry", "Blackberries", "produce", "fruit", { groups: ["berry"] }),
  v("grapes", "Grapes", "produce", "fruit", { emoji: "🍇" }),
  v("peach", "Peach", "produce", "fruit", { aliases: ["nectarine"], emoji: "🍑" }),
  v("plum", "Plum", "produce", "fruit", {}),
  v("mango", "Mango", "produce", "fruit", { emoji: "🥭" }),
  v("pineapple", "Pineapple", "produce", "fruit", { emoji: "🍍" }),
  v("watermelon", "Watermelon", "produce", "fruit", { emoji: "🍉" }),
  v("pomegranate", "Pomegranate", "produce", "fruit", {}),
  v("passion-fruit", "Passion fruit", "produce", "fruit", {}),
  v("cherry", "Cherries", "produce", "fruit", { groups: ["berry"], emoji: "🍒" }),
  v("kiwi", "Kiwi", "produce", "fruit", { emoji: "🥝" }),
  v("lemon-curd", "Lemon curd", "pantry", "fruit", { diet: { vegan: false, dairyFree: false } }),
  v("coconut-milk", "Coconut milk", "pantry", "fruit", { aliases: ["tinned coconut milk"], groups: ["milk"] }),
  v("coconut-flakes", "Desiccated coconut", "pantry", "fruit", { aliases: ["shredded coconut", "coconut flakes"] }),
  v("raisins", "Raisins", "pantry", "fruit", { aliases: ["sultanas", "currants"], groups: ["dried-fruit"] }),
  v("dates", "Dates", "pantry", "fruit", { groups: ["dried-fruit"] }),
  v("dried-apricot", "Dried apricots", "pantry", "fruit", { groups: ["dried-fruit"] }),
  v("dried-cranberry", "Dried cranberries", "pantry", "fruit", { groups: ["dried-fruit"] }),
  v("applesauce", "Apple sauce", "pantry", "fruit", {}),
];

/* ------------------------------------------------------------------ */
/* Herbs & spices                                                      */
/* ------------------------------------------------------------------ */

const HERBS: Spec[] = [
  v("parsley", "Parsley", "produce", "herb", { aliases: ["flat leaf parsley"], groups: ["fresh-herb"], emoji: "🌿" }),
  v("cilantro", "Cilantro", "produce", "herb", { aliases: ["coriander", "fresh coriander", "coriander leaf"], groups: ["fresh-herb"] }),
  v("basil", "Basil", "produce", "herb", { aliases: ["fresh basil"], groups: ["fresh-herb"], emoji: "🌿" }),
  v("mint", "Mint", "produce", "herb", { groups: ["fresh-herb"] }),
  v("dill", "Dill", "produce", "herb", { groups: ["fresh-herb"] }),
  v("chives", "Chives", "produce", "herb", { groups: ["fresh-herb"] }),
  v("rosemary", "Rosemary", "produce", "herb", { groups: ["fresh-herb", "hardy-herb"] }),
  v("thyme", "Thyme", "produce", "herb", { groups: ["fresh-herb", "hardy-herb"] }),
  v("sage", "Sage", "produce", "herb", { groups: ["fresh-herb", "hardy-herb"] }),
  v("oregano", "Oregano", "spices", "herb", { aliases: ["dried oregano"], groups: ["hardy-herb"] }),
  v("bay-leaf", "Bay leaves", "spices", "herb", {}),
  v("tarragon", "Tarragon", "produce", "herb", { groups: ["fresh-herb"] }),
  v("lemongrass", "Lemongrass", "produce", "herb", {}),
  v("kaffir-lime-leaf", "Kaffir lime leaves", "produce", "herb", {}),
  v("thai-basil", "Thai basil", "produce", "herb", { groups: ["fresh-herb"] }),
  v("curry-leaf", "Curry leaves", "produce", "herb", {}),
];

const SPICES: Spec[] = [
  v("salt", "Salt", "spices", "spice", { aliases: ["sea salt", "kosher salt", "table salt"], staple: true, emoji: "🧂" }),
  v("black-pepper", "Black pepper", "spices", "spice", { aliases: ["pepper", "peppercorns", "ground pepper"], staple: true }),
  v("cumin", "Cumin", "spices", "spice", { aliases: ["ground cumin", "cumin seeds"] }),
  v("coriander-seed", "Ground coriander", "spices", "spice", { aliases: ["coriander seeds", "coriander powder"] }),
  v("paprika", "Paprika", "spices", "spice", { aliases: ["sweet paprika"] }),
  v("smoked-paprika", "Smoked paprika", "spices", "spice", { aliases: ["pimenton"] }),
  v("chili-flakes", "Chili flakes", "spices", "spice", { aliases: ["red pepper flakes", "chilli flakes", "pepperoncino"], groups: ["chili"] }),
  v("chili-powder", "Chili powder", "spices", "spice", { aliases: ["chilli powder"], groups: ["chili"] }),
  v("cayenne", "Cayenne pepper", "spices", "spice", { groups: ["chili"] }),
  v("turmeric", "Turmeric", "spices", "spice", { aliases: ["ground turmeric"] }),
  v("cinnamon", "Cinnamon", "spices", "spice", { aliases: ["ground cinnamon", "cinnamon stick"] }),
  v("nutmeg", "Nutmeg", "spices", "spice", {}),
  v("cardamom", "Cardamom", "spices", "spice", { aliases: ["cardamom pods"] }),
  v("cloves", "Cloves", "spices", "spice", {}),
  v("allspice", "Allspice", "spices", "spice", {}),
  v("star-anise", "Star anise", "spices", "spice", {}),
  v("fennel-seed", "Fennel seeds", "spices", "spice", {}),
  v("mustard-seed", "Mustard seeds", "spices", "spice", {}),
  v("garam-masala", "Garam masala", "spices", "spice", {}),
  v("curry-powder", "Curry powder", "spices", "spice", {}),
  v("five-spice", "Chinese five spice", "spices", "spice", {}),
  v("zaatar", "Za'atar", "spices", "spice", { aliases: ["zatar"] }),
  v("sumac", "Sumac", "spices", "spice", {}),
  v("saffron", "Saffron", "spices", "spice", {}),
  v("vanilla", "Vanilla extract", "baking", "spice", { aliases: ["vanilla essence", "vanilla pod"] }),
  v("garlic-powder", "Garlic powder", "spices", "spice", { aliases: ["granulated garlic"] }),
  v("onion-powder", "Onion powder", "spices", "spice", {}),
  v("italian-herbs", "Dried mixed herbs", "spices", "spice", { aliases: ["italian seasoning", "herbes de provence", "mixed herbs"] }),
  v("ras-el-hanout", "Ras el hanout", "spices", "spice", {}),
  v("gochugaru", "Gochugaru", "spices", "spice", { aliases: ["korean chili flakes"], groups: ["chili"] }),
];

/* ------------------------------------------------------------------ */
/* Grains, pasta, legumes                                              */
/* ------------------------------------------------------------------ */

const GRAINS: Spec[] = [
  v("rice", "White rice", "pantry", "grain", { aliases: ["long grain rice", "jasmine rice", "basmati rice", "white rice"], groups: ["rice"], staple: true, emoji: "🍚" }),
  v("brown-rice", "Brown rice", "pantry", "grain", { groups: ["rice"] }),
  v("arborio-rice", "Arborio rice", "pantry", "grain", { aliases: ["risotto rice", "carnaroli"], groups: ["rice"] }),
  v("sushi-rice", "Sushi rice", "pantry", "grain", { aliases: ["short grain rice"], groups: ["rice"] }),
  v("quinoa", "Quinoa", "pantry", "grain", {}),
  v("couscous", "Couscous", "pantry", "grain", { diet: { glutenFree: false } }),
  v("bulgur", "Bulgur wheat", "pantry", "grain", { aliases: ["bulghur", "cracked wheat"], diet: { glutenFree: false } }),
  v("barley", "Pearl barley", "pantry", "grain", { diet: { glutenFree: false } }),
  v("oats", "Rolled oats", "pantry", "grain", { aliases: ["porridge oats", "oatmeal"] }),
  v("polenta", "Polenta", "pantry", "grain", { aliases: ["cornmeal"] }),
  v("flour", "All-purpose flour", "baking", "grain", { aliases: ["plain flour", "white flour", "ap flour"], groups: ["flour"], staple: true, diet: { glutenFree: false } }),
  v("bread-flour", "Bread flour", "baking", "grain", { aliases: ["strong flour"], groups: ["flour"], diet: { glutenFree: false } }),
  v("wholemeal-flour", "Wholemeal flour", "baking", "grain", { aliases: ["whole wheat flour"], groups: ["flour"], diet: { glutenFree: false } }),
  v("cornstarch", "Cornstarch", "baking", "grain", { aliases: ["cornflour", "corn starch"] }),
  v("breadcrumbs", "Breadcrumbs", "pantry", "grain", { aliases: ["panko", "panko breadcrumbs"], diet: { glutenFree: false } }),
  v("bread", "Bread", "bakery", "grain", { aliases: ["sliced bread", "loaf", "sourdough", "crusty bread"], groups: ["bread"], diet: { glutenFree: false }, emoji: "🍞" }),
  v("tortilla", "Tortillas", "bakery", "grain", { aliases: ["flour tortilla", "corn tortilla", "wrap"], groups: ["bread"], diet: { glutenFree: false } }),
  v("pita", "Pita bread", "bakery", "grain", { aliases: ["flatbread", "naan"], groups: ["bread"], diet: { glutenFree: false } }),
  v("burger-bun", "Burger buns", "bakery", "grain", { aliases: ["brioche bun", "rolls"], groups: ["bread"], diet: { glutenFree: false } }),
  v("puff-pastry", "Puff pastry", "frozen", "grain", { diet: { glutenFree: false, vegan: false, dairyFree: false } }),
  v("phyllo", "Filo pastry", "frozen", "grain", { aliases: ["phyllo pastry"], diet: { glutenFree: false } }),
  v("tortilla-chips", "Tortilla chips", "pantry", "grain", {}),
];

const PASTA: Spec[] = [
  v("spaghetti", "Spaghetti", "pantry", "pasta", { aliases: ["linguine", "bucatini"], groups: ["pasta", "long-pasta"], staple: true, emoji: "🍝" }),
  v("penne", "Penne", "pantry", "pasta", { aliases: ["rigatoni", "ziti"], groups: ["pasta", "short-pasta"] }),
  v("fusilli", "Fusilli", "pantry", "pasta", { aliases: ["rotini", "farfalle"], groups: ["pasta", "short-pasta"] }),
  v("macaroni", "Macaroni", "pantry", "pasta", { aliases: ["elbow macaroni"], groups: ["pasta", "short-pasta"] }),
  v("tagliatelle", "Tagliatelle", "pantry", "pasta", { aliases: ["fettuccine", "pappardelle"], groups: ["pasta", "long-pasta"] }),
  v("lasagne-sheets", "Lasagne sheets", "pantry", "pasta", { aliases: ["lasagna noodles"], groups: ["pasta"] }),
  v("orzo", "Orzo", "pantry", "pasta", { groups: ["pasta", "short-pasta"] }),
  v("gnocchi", "Gnocchi", "pantry", "pasta", { groups: ["pasta"] }),
  v("ramen-noodles", "Ramen noodles", "pantry", "pasta", { aliases: ["instant noodles"], groups: ["noodle"] }),
  v("udon", "Udon noodles", "pantry", "pasta", { groups: ["noodle"] }),
  v("rice-noodles", "Rice noodles", "pantry", "pasta", { aliases: ["vermicelli", "flat rice noodles", "pho noodles"], groups: ["noodle"], diet: { glutenFree: true } }),
  v("egg-noodles", "Egg noodles", "pantry", "pasta", { groups: ["noodle"], diet: { vegan: false } }),
  v("soba", "Soba noodles", "pantry", "pasta", { groups: ["noodle"] }),
];

const LEGUMES: Spec[] = [
  v("chickpeas", "Chickpeas", "pantry", "legume", { aliases: ["garbanzo beans", "tinned chickpeas"], groups: ["beans"] }),
  v("black-beans", "Black beans", "pantry", "legume", { groups: ["beans"] }),
  v("kidney-beans", "Kidney beans", "pantry", "legume", { groups: ["beans"] }),
  v("cannellini-beans", "Cannellini beans", "pantry", "legume", { aliases: ["white beans", "butter beans", "haricot beans"], groups: ["beans"] }),
  v("pinto-beans", "Pinto beans", "pantry", "legume", { groups: ["beans"] }),
  v("red-lentils", "Red lentils", "pantry", "legume", { aliases: ["split red lentils", "masoor dal"], groups: ["lentils"] }),
  v("green-lentils", "Green lentils", "pantry", "legume", { aliases: ["brown lentils", "puy lentils"], groups: ["lentils"] }),
  v("split-peas", "Split peas", "pantry", "legume", {}),
  v("tofu", "Tofu", "dairy", "legume", { aliases: ["firm tofu", "silken tofu", "beancurd"] }),
  v("tempeh", "Tempeh", "dairy", "legume", {}),
  v("peanut-butter", "Peanut butter", "pantry", "legume", { diet: { nutFree: false } }),
  v("hummus", "Hummus", "dairy", "legume", { aliases: ["houmous"] }),
  v("refried-beans", "Refried beans", "pantry", "legume", { groups: ["beans"] }),
];

/* ------------------------------------------------------------------ */
/* Proteins                                                            */
/* ------------------------------------------------------------------ */

const MEAT: Spec[] = [
  v("chicken-breast", "Chicken breast", "meat", "poultry", { aliases: ["chicken breasts"], groups: ["chicken-piece", "chicken"], emoji: "🍗" }),
  v("chicken-thigh", "Chicken thighs", "meat", "poultry", { aliases: ["boneless chicken thighs"], groups: ["chicken-piece", "chicken"] }),
  v("whole-chicken", "Whole chicken", "meat", "poultry", { groups: ["chicken"] }),
  v("chicken-wings", "Chicken wings", "meat", "poultry", { groups: ["chicken-piece", "chicken"] }),
  v("ground-chicken", "Ground chicken", "meat", "poultry", { aliases: ["chicken mince"], groups: ["ground-meat", "chicken"] }),
  v("turkey", "Turkey", "meat", "poultry", { aliases: ["turkey breast"] }),
  v("ground-turkey", "Ground turkey", "meat", "poultry", { aliases: ["turkey mince"], groups: ["ground-meat"] }),
  v("ground-beef", "Ground beef", "meat", "meat", { aliases: ["beef mince", "minced beef", "hamburger meat"], groups: ["ground-meat"] }),
  v("beef-steak", "Beef steak", "meat", "meat", { aliases: ["sirloin", "ribeye", "steak", "flank steak"], groups: ["beef"], emoji: "🥩" }),
  v("stewing-beef", "Stewing beef", "meat", "meat", { aliases: ["chuck", "braising steak", "beef chunks"], groups: ["beef"] }),
  v("pork-chop", "Pork chops", "meat", "meat", { groups: ["pork"] }),
  v("pork-shoulder", "Pork shoulder", "meat", "meat", { aliases: ["pork butt"], groups: ["pork"] }),
  v("ground-pork", "Ground pork", "meat", "meat", { aliases: ["pork mince"], groups: ["ground-meat", "pork"] }),
  v("bacon", "Bacon", "meat", "meat", { aliases: ["streaky bacon", "bacon rashers"], groups: ["cured-pork", "pork"], emoji: "🥓" }),
  v("pancetta", "Pancetta", "meat", "meat", { aliases: ["guanciale", "lardons"], groups: ["cured-pork", "pork"] }),
  v("prosciutto", "Prosciutto", "meat", "meat", { aliases: ["parma ham", "serrano ham"], groups: ["cured-pork", "pork"] }),
  v("ham", "Ham", "meat", "meat", { aliases: ["cooked ham", "gammon"], groups: ["pork"] }),
  v("sausage", "Sausages", "meat", "meat", { aliases: ["pork sausage", "italian sausage", "bratwurst"], groups: ["sausage", "pork"] }),
  v("chorizo", "Chorizo", "meat", "meat", { groups: ["sausage", "cured-pork"] }),
  v("salami", "Salami", "meat", "meat", { aliases: ["pepperoni"], groups: ["cured-pork"] }),
  v("lamb-chop", "Lamb chops", "meat", "meat", { groups: ["lamb"] }),
  v("ground-lamb", "Ground lamb", "meat", "meat", { aliases: ["lamb mince"], groups: ["ground-meat", "lamb"] }),
  v("lamb-shoulder", "Lamb shoulder", "meat", "meat", { aliases: ["lamb leg"], groups: ["lamb"] }),
];

const SEAFOOD: Spec[] = [
  v("salmon", "Salmon fillet", "seafood", "seafood", { aliases: ["salmon"], groups: ["oily-fish", "fish"], emoji: "🐟" }),
  v("tuna-steak", "Tuna steak", "seafood", "seafood", { groups: ["oily-fish", "fish"] }),
  v("canned-tuna", "Canned tuna", "pantry", "seafood", { aliases: ["tinned tuna", "tuna"] }),
  v("cod", "Cod fillet", "seafood", "seafood", { aliases: ["cod", "haddock", "pollock"], groups: ["white-fish", "fish"] }),
  v("sea-bass", "Sea bass", "seafood", "seafood", { aliases: ["seabass", "bream"], groups: ["white-fish", "fish"] }),
  v("tilapia", "Tilapia", "seafood", "seafood", { groups: ["white-fish", "fish"] }),
  v("shrimp", "Shrimp", "seafood", "seafood", { aliases: ["prawns", "king prawns"], groups: ["shellfish"], emoji: "🦐" }),
  v("mussels", "Mussels", "seafood", "seafood", { groups: ["shellfish"] }),
  v("clams", "Clams", "seafood", "seafood", { groups: ["shellfish"] }),
  v("scallops", "Scallops", "seafood", "seafood", { groups: ["shellfish"] }),
  v("squid", "Squid", "seafood", "seafood", { aliases: ["calamari"], groups: ["shellfish"] }),
  v("crab", "Crab meat", "seafood", "seafood", { groups: ["shellfish"], emoji: "🦀" }),
  v("anchovy", "Anchovies", "pantry", "seafood", {}),
  v("smoked-salmon", "Smoked salmon", "seafood", "seafood", { aliases: ["lox"], groups: ["oily-fish"] }),
  v("sardines", "Sardines", "pantry", "seafood", { groups: ["oily-fish"] }),
];

/* ------------------------------------------------------------------ */
/* Dairy & eggs                                                        */
/* ------------------------------------------------------------------ */

const DAIRY_EGGS: Spec[] = [
  v("egg", "Eggs", "dairy", "egg", { aliases: ["egg", "large eggs", "free range eggs"], staple: true, emoji: "🥚" }),
  v("milk", "Milk", "dairy", "dairy", { aliases: ["whole milk", "semi skimmed milk", "dairy milk"], groups: ["milk"], staple: true, emoji: "🥛" }),
  v("butter", "Butter", "dairy", "dairy", { aliases: ["unsalted butter", "salted butter"], staple: true, emoji: "🧈" }),
  v("heavy-cream", "Heavy cream", "dairy", "dairy", { aliases: ["double cream", "whipping cream", "cream"] }),
  v("sour-cream", "Sour cream", "dairy", "dairy", { aliases: ["creme fraiche", "crème fraîche"] }),
  v("yogurt", "Yogurt", "dairy", "dairy", { aliases: ["greek yogurt", "plain yogurt", "natural yoghurt"], groups: ["yogurt"] }),
  v("buttermilk", "Buttermilk", "dairy", "dairy", {}),
  v("cream-cheese", "Cream cheese", "dairy", "cheese", { groups: ["soft-cheese", "any-cheese"] }),
  v("cheddar", "Cheddar", "dairy", "cheese", { aliases: ["cheddar cheese", "mature cheddar"], groups: ["melting-cheese", "any-cheese"], emoji: "🧀" }),
  v("mozzarella", "Mozzarella", "dairy", "cheese", { groups: ["melting-cheese", "soft-cheese", "any-cheese"] }),
  v("parmesan", "Parmesan", "dairy", "cheese", { aliases: ["parmigiano", "parmigiano reggiano", "grana padano"], groups: ["hard-cheese", "any-cheese"] }),
  v("pecorino", "Pecorino", "dairy", "cheese", { aliases: ["pecorino romano"], groups: ["hard-cheese", "any-cheese"] }),
  v("feta", "Feta", "dairy", "cheese", { groups: ["soft-cheese", "any-cheese"] }),
  v("goat-cheese", "Goat cheese", "dairy", "cheese", { aliases: ["chevre"], groups: ["soft-cheese", "any-cheese"] }),
  v("ricotta", "Ricotta", "dairy", "cheese", { groups: ["soft-cheese", "any-cheese"] }),
  v("gruyere", "Gruyère", "dairy", "cheese", { aliases: ["gruyere", "emmental", "comte"], groups: ["melting-cheese", "hard-cheese", "any-cheese"] }),
  v("blue-cheese", "Blue cheese", "dairy", "cheese", { aliases: ["gorgonzola", "stilton", "roquefort"], groups: ["any-cheese"] }),
  v("halloumi", "Halloumi", "dairy", "cheese", { groups: ["any-cheese"] }),
  v("monterey-jack", "Monterey Jack", "dairy", "cheese", { aliases: ["pepper jack", "colby"], groups: ["melting-cheese", "any-cheese"] }),
  v("mascarpone", "Mascarpone", "dairy", "cheese", { groups: ["soft-cheese", "any-cheese"] }),
  v("oat-milk", "Oat milk", "dairy", "dairy", { groups: ["milk"], diet: { vegan: true, dairyFree: true } }),
  v("almond-milk", "Almond milk", "dairy", "dairy", { groups: ["milk"], diet: { vegan: true, dairyFree: true, nutFree: false } }),
  v("soy-milk", "Soy milk", "dairy", "dairy", { groups: ["milk"], diet: { vegan: true, dairyFree: true } }),
];

/* ------------------------------------------------------------------ */
/* Nuts & seeds                                                        */
/* ------------------------------------------------------------------ */

const NUTS: Spec[] = [
  v("almonds", "Almonds", "pantry", "nut", { aliases: ["flaked almonds", "ground almonds"], groups: ["nut"] }),
  v("walnuts", "Walnuts", "pantry", "nut", { groups: ["nut"] }),
  v("pecans", "Pecans", "pantry", "nut", { groups: ["nut"] }),
  v("cashews", "Cashews", "pantry", "nut", { groups: ["nut"] }),
  v("peanuts", "Peanuts", "pantry", "nut", { groups: ["nut"] }),
  v("pistachios", "Pistachios", "pantry", "nut", { groups: ["nut"] }),
  v("hazelnuts", "Hazelnuts", "pantry", "nut", { groups: ["nut"] }),
  v("pine-nuts", "Pine nuts", "pantry", "nut", { groups: ["nut"] }),
  v("sesame-seeds", "Sesame seeds", "pantry", "nut", { diet: { nutFree: true } }),
  v("sunflower-seeds", "Sunflower seeds", "pantry", "nut", { diet: { nutFree: true } }),
  v("pumpkin-seeds", "Pumpkin seeds", "pantry", "nut", { aliases: ["pepitas"], diet: { nutFree: true } }),
  v("chia-seeds", "Chia seeds", "pantry", "nut", { diet: { nutFree: true } }),
  v("tahini", "Tahini", "condiments", "nut", { diet: { nutFree: true } }),
];

/* ------------------------------------------------------------------ */
/* Oils, vinegars, sauces, condiments                                  */
/* ------------------------------------------------------------------ */

const OILS: Spec[] = [
  v("olive-oil", "Olive oil", "pantry", "oil", { aliases: ["extra virgin olive oil", "evoo"], groups: ["cooking-oil"], staple: true }),
  v("vegetable-oil", "Vegetable oil", "pantry", "oil", { aliases: ["canola oil", "rapeseed oil", "sunflower oil", "neutral oil"], groups: ["cooking-oil"], staple: true }),
  v("sesame-oil", "Sesame oil", "pantry", "oil", { aliases: ["toasted sesame oil"] }),
  v("coconut-oil", "Coconut oil", "pantry", "oil", { groups: ["cooking-oil"] }),
  v("ghee", "Ghee", "pantry", "oil", { groups: ["cooking-oil"], diet: { vegan: false, dairyFree: false } }),
  v("chili-oil", "Chili oil", "condiments", "oil", { aliases: ["chilli oil"] }),
];

const VINEGARS: Spec[] = [
  v("white-vinegar", "White vinegar", "pantry", "vinegar", { aliases: ["distilled vinegar"], groups: ["vinegar"] }),
  v("red-wine-vinegar", "Red wine vinegar", "pantry", "vinegar", { groups: ["vinegar"] }),
  v("white-wine-vinegar", "White wine vinegar", "pantry", "vinegar", { groups: ["vinegar"] }),
  v("balsamic", "Balsamic vinegar", "pantry", "vinegar", { groups: ["vinegar"] }),
  v("apple-cider-vinegar", "Apple cider vinegar", "pantry", "vinegar", { aliases: ["cider vinegar"], groups: ["vinegar"] }),
  v("rice-vinegar", "Rice vinegar", "pantry", "vinegar", { aliases: ["rice wine vinegar"], groups: ["vinegar"] }),
];

const SAUCES: Spec[] = [
  v("soy-sauce", "Soy sauce", "condiments", "sauce", { aliases: ["light soy sauce", "dark soy sauce", "shoyu"], groups: ["soy-sauce"], diet: { glutenFree: false } }),
  v("tamari", "Tamari", "condiments", "sauce", { groups: ["soy-sauce"] }),
  v("fish-sauce", "Fish sauce", "condiments", "sauce", { aliases: ["nam pla"], diet: { vegan: false, vegetarian: false } }),
  v("oyster-sauce", "Oyster sauce", "condiments", "sauce", { diet: { vegan: false, vegetarian: false, glutenFree: false } }),
  v("worcestershire", "Worcestershire sauce", "condiments", "sauce", { diet: { vegan: false, vegetarian: false } }),
  v("hoisin", "Hoisin sauce", "condiments", "sauce", { diet: { glutenFree: false } }),
  v("sriracha", "Sriracha", "condiments", "sauce", { aliases: ["hot sauce", "chili sauce"] }),
  v("tabasco", "Tabasco", "condiments", "sauce", { aliases: ["hot pepper sauce"] }),
  v("gochujang", "Gochujang", "condiments", "sauce", { aliases: ["korean chili paste"] }),
  v("miso", "Miso paste", "condiments", "sauce", { aliases: ["white miso", "red miso"] }),
  v("ketchup", "Ketchup", "condiments", "sauce", { aliases: ["tomato ketchup"] }),
  v("mustard", "Dijon mustard", "condiments", "sauce", { aliases: ["mustard", "wholegrain mustard", "english mustard"] }),
  v("mayonnaise", "Mayonnaise", "condiments", "sauce", { aliases: ["mayo"], diet: { vegan: false } }),
  v("bbq-sauce", "BBQ sauce", "condiments", "sauce", { aliases: ["barbecue sauce"] }),
  v("tomato-paste", "Tomato paste", "pantry", "sauce", { aliases: ["tomato puree", "tomato purée", "concentrated tomato"] }),
  v("canned-tomatoes", "Canned tomatoes", "pantry", "sauce", { aliases: ["tinned tomatoes", "chopped tomatoes", "crushed tomatoes", "plum tomatoes"], groups: ["canned-tomato"] }),
  v("passata", "Passata", "pantry", "sauce", { aliases: ["tomato sauce", "strained tomatoes"], groups: ["canned-tomato"] }),
  v("pesto", "Pesto", "condiments", "sauce", { diet: { vegan: false, dairyFree: false, nutFree: false } }),
  v("salsa", "Salsa", "condiments", "sauce", {}),
  v("harissa", "Harissa", "condiments", "sauce", {}),
  v("curry-paste", "Curry paste", "condiments", "sauce", { aliases: ["red curry paste", "green curry paste", "thai curry paste"] }),
  v("tzatziki", "Tzatziki", "dairy", "sauce", { diet: { vegan: false, dairyFree: false } }),
  v("horseradish", "Horseradish", "condiments", "sauce", {}),
  v("marmite", "Yeast extract", "condiments", "sauce", { aliases: ["marmite", "vegemite"], diet: { glutenFree: false } }),
];

const STOCKS: Spec[] = [
  v("chicken-stock", "Chicken stock", "pantry", "stock", { aliases: ["chicken broth", "chicken bouillon"], groups: ["stock"], diet: { vegan: false, vegetarian: false } }),
  v("vegetable-stock", "Vegetable stock", "pantry", "stock", { aliases: ["veg stock", "vegetable broth", "vegetable bouillon"], groups: ["stock"] }),
  v("beef-stock", "Beef stock", "pantry", "stock", { aliases: ["beef broth"], groups: ["stock"], diet: { vegan: false, vegetarian: false } }),
  v("fish-stock", "Fish stock", "pantry", "stock", { groups: ["stock"], diet: { vegan: false, vegetarian: false } }),
  v("dashi", "Dashi", "pantry", "stock", { groups: ["stock"], diet: { vegan: false, vegetarian: false } }),
];

const SWEET: Spec[] = [
  v("sugar", "Sugar", "baking", "sweetener", { aliases: ["white sugar", "granulated sugar", "caster sugar"], staple: true }),
  v("brown-sugar", "Brown sugar", "baking", "sweetener", { aliases: ["light brown sugar", "dark brown sugar", "muscovado"] }),
  v("powdered-sugar", "Powdered sugar", "baking", "sweetener", { aliases: ["icing sugar", "confectioners sugar"] }),
  v("honey", "Honey", "pantry", "sweetener", { diet: { vegan: false }, emoji: "🍯" }),
  v("maple-syrup", "Maple syrup", "pantry", "sweetener", {}),
  v("golden-syrup", "Golden syrup", "pantry", "sweetener", { aliases: ["corn syrup"] }),
  v("molasses", "Molasses", "pantry", "sweetener", { aliases: ["treacle"] }),
  v("jam", "Jam", "pantry", "sweetener", { aliases: ["jelly", "preserve", "marmalade"] }),
];

const BAKING: Spec[] = [
  v("baking-powder", "Baking powder", "baking", "baking", {}),
  v("baking-soda", "Baking soda", "baking", "baking", { aliases: ["bicarbonate of soda", "bicarb"] }),
  v("yeast", "Yeast", "baking", "baking", { aliases: ["dried yeast", "instant yeast", "active dry yeast"] }),
  v("cocoa", "Cocoa powder", "baking", "baking", { aliases: ["unsweetened cocoa"] }),
  v("dark-chocolate", "Dark chocolate", "baking", "baking", { aliases: ["chocolate", "chocolate chips", "semisweet chocolate"], emoji: "🍫" }),
  v("gelatin", "Gelatin", "baking", "baking", { aliases: ["gelatine"], diet: { vegan: false, vegetarian: false } }),
  v("cornflakes", "Cornflakes", "pantry", "baking", { aliases: ["cereal"] }),
];

const ALCOHOL: Spec[] = [
  v("white-wine", "White wine", "drinks", "alcohol", { aliases: ["dry white wine"] }),
  v("red-wine", "Red wine", "drinks", "alcohol", { aliases: ["dry red wine"] }),
  v("beer", "Beer", "drinks", "alcohol", { aliases: ["lager", "ale"], diet: { glutenFree: false } }),
  v("shaoxing", "Shaoxing wine", "drinks", "alcohol", { aliases: ["rice wine", "chinese cooking wine"] }),
  v("mirin", "Mirin", "condiments", "alcohol", {}),
  v("sake", "Sake", "drinks", "alcohol", {}),
  v("brandy", "Brandy", "drinks", "alcohol", { aliases: ["cognac"] }),
  v("rum", "Rum", "drinks", "alcohol", {}),
  v("vermouth", "Vermouth", "drinks", "alcohol", {}),
];

/**
 * Second pass over the catalogue: things people genuinely keep but that didn't
 * fit neatly into the category blocks above.
 */
const EXTRAS: Spec[] = [
  // Produce
  v("butternut-pumpkin-seed", "Squash seeds", "produce", "vegetable", {}),
  v("spring-greens", "Spring greens", "produce", "vegetable", { groups: ["leafy-green", "cabbage"] }),
  v("watercress", "Watercress", "produce", "vegetable", { groups: ["leafy-green", "salad-leaf"] }),
  v("endive", "Chicory", "produce", "vegetable", { aliases: ["endive", "witlof"], groups: ["salad-leaf"] }),
  v("okra", "Okra", "produce", "vegetable", { aliases: ["ladies fingers"] }),
  v("plantain", "Plantain", "produce", "vegetable", {}),
  v("horseradish-root", "Fresh horseradish", "produce", "vegetable", {}),
  v("galangal", "Galangal", "produce", "vegetable", {}),
  v("daikon", "Daikon", "produce", "vegetable", { aliases: ["mooli"], groups: ["root-veg"] }),
  v("jerusalem-artichoke", "Jerusalem artichoke", "produce", "vegetable", { groups: ["root-veg"] }),
  v("swede", "Swede", "produce", "vegetable", { aliases: ["rutabaga"], groups: ["root-veg"] }),
  v("kohlrabi", "Kohlrabi", "produce", "vegetable", { groups: ["cabbage"] }),
  v("samphire", "Samphire", "produce", "vegetable", {}),
  v("chestnut", "Chestnuts", "pantry", "vegetable", {}),
  v("truffle", "Truffle", "produce", "vegetable", {}),
  v("oyster-mushroom", "Oyster mushrooms", "produce", "vegetable", { groups: ["mushroom"] }),
  v("enoki", "Enoki mushrooms", "produce", "vegetable", { groups: ["mushroom"] }),
  v("porcini", "Dried porcini", "pantry", "vegetable", { groups: ["mushroom"] }),
  v("frozen-spinach", "Frozen spinach", "frozen", "vegetable", { groups: ["leafy-green"] }),
  v("frozen-berries", "Frozen berries", "frozen", "fruit", { groups: ["berry"] }),
  v("roasted-peppers", "Jarred roasted peppers", "pantry", "vegetable", { groups: ["bell-pepper"] }),
  v("chipotle", "Chipotle in adobo", "pantry", "vegetable", { groups: ["chili"] }),
  v("dried-chili", "Dried chilies", "spices", "vegetable", { groups: ["chili"] }),
  v("preserved-lemon", "Preserved lemon", "condiments", "vegetable", {}),

  // Fruit
  v("cranberry", "Cranberries", "produce", "fruit", { groups: ["berry"] }),
  v("fig", "Figs", "produce", "fruit", {}),
  v("apricot", "Apricots", "produce", "fruit", {}),
  v("cherry-tomato-jarred", "Sunblush tomatoes", "pantry", "vegetable", {}),
  v("grapefruit", "Grapefruit", "produce", "fruit", { groups: ["citrus"] }),
  v("clementine", "Clementines", "produce", "fruit", { aliases: ["satsuma", "mandarin", "tangerine"], groups: ["citrus"] }),
  v("prunes", "Prunes", "pantry", "fruit", { groups: ["dried-fruit"] }),
  v("banana-chips", "Dried banana", "pantry", "fruit", { groups: ["dried-fruit"] }),

  // Herbs and spices
  v("marjoram", "Marjoram", "spices", "herb", { groups: ["hardy-herb"] }),
  v("savory", "Savory", "spices", "herb", { groups: ["hardy-herb"] }),
  v("shiso", "Shiso", "produce", "herb", { groups: ["fresh-herb"] }),
  v("sichuan-pepper", "Sichuan peppercorns", "spices", "spice", {}),
  v("white-pepper", "White pepper", "spices", "spice", {}),
  v("juniper", "Juniper berries", "spices", "spice", {}),
  v("caraway", "Caraway seeds", "spices", "spice", {}),
  v("nigella", "Nigella seeds", "spices", "spice", { aliases: ["black onion seeds"] }),
  v("asafoetida", "Asafoetida", "spices", "spice", { aliases: ["hing"], diet: { glutenFree: false } }),
  v("berbere", "Berbere", "spices", "spice", {}),
  v("jerk-seasoning", "Jerk seasoning", "spices", "spice", {}),
  v("cajun-seasoning", "Cajun seasoning", "spices", "spice", {}),
  v("old-bay", "Old Bay seasoning", "spices", "spice", {}),
  v("bouquet-garni", "Bouquet garni", "spices", "herb", {}),
  v("mace", "Mace", "spices", "spice", {}),
  v("anise", "Aniseed", "spices", "spice", {}),
  v("lavender", "Culinary lavender", "spices", "spice", {}),

  // Grains and flours
  v("self-raising-flour", "Self-raising flour", "baking", "grain", { aliases: ["self rising flour"], groups: ["flour"], diet: { glutenFree: false } }),
  v("rye-flour", "Rye flour", "baking", "grain", { groups: ["flour"], diet: { glutenFree: false } }),
  v("gluten-free-flour", "Gluten-free flour", "baking", "grain", { groups: ["flour"] }),
  v("chickpea-flour", "Chickpea flour", "baking", "grain", { aliases: ["gram flour", "besan"], groups: ["flour"] }),
  v("semolina", "Semolina", "pantry", "grain", { diet: { glutenFree: false } }),
  v("freekeh", "Freekeh", "pantry", "grain", { diet: { glutenFree: false } }),
  v("farro", "Farro", "pantry", "grain", { aliases: ["spelt"], diet: { glutenFree: false } }),
  v("wild-rice", "Wild rice", "pantry", "grain", { groups: ["rice"] }),
  v("buckwheat", "Buckwheat", "pantry", "grain", {}),
  v("millet", "Millet", "pantry", "grain", {}),
  v("crackers", "Crackers", "pantry", "grain", { diet: { glutenFree: false } }),
  v("croutons", "Croutons", "pantry", "grain", { diet: { glutenFree: false } }),
  v("bagel", "Bagels", "bakery", "grain", { groups: ["bread"], diet: { glutenFree: false } }),
  v("croissant", "Croissants", "bakery", "grain", { groups: ["bread"], diet: { glutenFree: false, vegan: false, dairyFree: false } }),
  v("shortcrust", "Shortcrust pastry", "frozen", "grain", { diet: { glutenFree: false, vegan: false, dairyFree: false } }),
  v("wonton-wrapper", "Wonton wrappers", "frozen", "grain", { diet: { glutenFree: false, vegan: false } }),
  v("rice-paper", "Rice paper", "pantry", "grain", {}),
  v("glass-noodles", "Glass noodles", "pantry", "pasta", { aliases: ["cellophane noodles", "mung bean noodles"], groups: ["noodle"], diet: { glutenFree: true } }),
  v("conchiglie", "Conchiglie", "pantry", "pasta", { aliases: ["shells"], groups: ["pasta", "short-pasta"] }),
  v("cannelloni", "Cannelloni", "pantry", "pasta", { groups: ["pasta"] }),
  v("ravioli", "Ravioli", "pantry", "pasta", { aliases: ["tortellini"], groups: ["pasta"], diet: { vegan: false } }),

  // Legumes and proteins
  v("borlotti-beans", "Borlotti beans", "pantry", "legume", { groups: ["beans"] }),
  v("fava-beans", "Broad beans", "frozen", "legume", { aliases: ["fava beans"], groups: ["beans"] }),
  v("black-eyed-peas", "Black-eyed peas", "pantry", "legume", { groups: ["beans"] }),
  v("puy-lentils", "Puy lentils", "pantry", "legume", { groups: ["lentils"] }),
  v("seitan", "Seitan", "dairy", "legume", { diet: { glutenFree: false } }),
  v("textured-soy", "Soy mince", "pantry", "legume", { aliases: ["tvp", "textured vegetable protein"] }),
  v("almond-butter", "Almond butter", "pantry", "legume", { diet: { nutFree: false } }),

  // Meat and seafood
  v("duck-breast", "Duck breast", "meat", "poultry", {}),
  v("chicken-drumstick", "Chicken drumsticks", "meat", "poultry", { groups: ["chicken-piece", "chicken"] }),
  v("beef-brisket", "Beef brisket", "meat", "meat", { groups: ["beef"] }),
  v("beef-short-rib", "Short ribs", "meat", "meat", { groups: ["beef"] }),
  v("pork-belly", "Pork belly", "meat", "meat", { groups: ["pork"] }),
  v("pork-tenderloin", "Pork tenderloin", "meat", "meat", { aliases: ["pork fillet"], groups: ["pork"] }),
  v("lamb-shank", "Lamb shanks", "meat", "meat", { groups: ["lamb"] }),
  v("black-pudding", "Black pudding", "meat", "meat", { groups: ["sausage"] }),
  v("mackerel", "Mackerel", "seafood", "seafood", { groups: ["oily-fish", "fish"] }),
  v("trout", "Trout", "seafood", "seafood", { groups: ["oily-fish", "fish"] }),
  v("halibut", "Halibut", "seafood", "seafood", { groups: ["white-fish", "fish"] }),
  v("monkfish", "Monkfish", "seafood", "seafood", { groups: ["white-fish", "fish"] }),
  v("octopus", "Octopus", "seafood", "seafood", { groups: ["shellfish"] }),
  v("smoked-haddock", "Smoked haddock", "seafood", "seafood", { groups: ["white-fish", "fish"] }),
  v("caviar", "Caviar", "seafood", "seafood", {}),

  // Dairy
  v("clotted-cream", "Clotted cream", "dairy", "dairy", {}),
  v("condensed-milk", "Condensed milk", "pantry", "dairy", {}),
  v("evaporated-milk", "Evaporated milk", "pantry", "dairy", { groups: ["milk"] }),
  v("kefir", "Kefir", "dairy", "dairy", { groups: ["yogurt"] }),
  v("coconut-yogurt", "Coconut yogurt", "dairy", "dairy", { groups: ["yogurt"], diet: { vegan: true, dairyFree: true } }),
  v("paneer", "Paneer", "dairy", "cheese", {}),
  v("burrata", "Burrata", "dairy", "cheese", { groups: ["soft-cheese", "any-cheese"] }),
  v("brie", "Brie", "dairy", "cheese", { aliases: ["camembert"], groups: ["soft-cheese", "any-cheese"] }),
  v("manchego", "Manchego", "dairy", "cheese", { groups: ["hard-cheese", "any-cheese"] }),
  v("provolone", "Provolone", "dairy", "cheese", { groups: ["melting-cheese", "any-cheese"] }),
  v("cottage-cheese", "Cottage cheese", "dairy", "cheese", { groups: ["soft-cheese", "any-cheese"] }),
  v("vegan-cheese", "Vegan cheese", "dairy", "cheese", { groups: ["any-cheese"], diet: { vegan: true, dairyFree: true } }),
  v("coconut-cream", "Coconut cream", "pantry", "fruit", {}),

  // Condiments, sauces, pantry
  v("aioli", "Aioli", "condiments", "sauce", { diet: { vegan: false } }),
  v("tartare-sauce", "Tartare sauce", "condiments", "sauce", { diet: { vegan: false } }),
  v("apple-sauce", "Cranberry sauce", "condiments", "sauce", {}),
  v("chutney", "Chutney", "condiments", "sauce", {}),
  v("piccalilli", "Piccalilli", "condiments", "sauce", {}),
  v("ponzu", "Ponzu", "condiments", "sauce", { diet: { vegan: false, vegetarian: false, glutenFree: false } }),
  v("sambal", "Sambal oelek", "condiments", "sauce", { groups: ["chili"] }),
  v("xo-sauce", "XO sauce", "condiments", "sauce", { diet: { vegan: false, vegetarian: false } }),
  v("doubanjiang", "Doubanjiang", "condiments", "sauce", { aliases: ["fermented bean paste"], groups: ["chili"] }),
  v("black-bean-sauce", "Black bean sauce", "condiments", "sauce", { diet: { glutenFree: false } }),
  v("tamarind", "Tamarind paste", "condiments", "sauce", {}),
  v("pomegranate-molasses", "Pomegranate molasses", "condiments", "sauce", {}),
  v("truffle-oil", "Truffle oil", "pantry", "oil", {}),
  v("walnut-oil", "Walnut oil", "pantry", "oil", { diet: { nutFree: false } }),
  v("sherry-vinegar", "Sherry vinegar", "pantry", "vinegar", { groups: ["vinegar"] }),
  v("malt-vinegar", "Malt vinegar", "pantry", "vinegar", { groups: ["vinegar"], diet: { glutenFree: false } }),

  // Baking and sweet
  v("dulce-de-leche", "Dulce de leche", "pantry", "sweetener", { diet: { vegan: false, dairyFree: false } }),
  v("marshmallow", "Marshmallows", "pantry", "sweetener", { diet: { vegan: false, vegetarian: false } }),
  v("white-chocolate", "White chocolate", "baking", "baking", { diet: { vegan: false, dairyFree: false } }),
  v("milk-chocolate", "Milk chocolate", "baking", "baking", { diet: { vegan: false, dairyFree: false } }),
  v("cream-of-tartar", "Cream of tartar", "baking", "baking", {}),
  v("almond-extract", "Almond extract", "baking", "spice", {}),
  v("food-colouring", "Food colouring", "baking", "baking", {}),
  v("sprinkles", "Sprinkles", "baking", "baking", {}),
  v("digestive-biscuit", "Digestive biscuits", "pantry", "baking", { aliases: ["graham crackers"], diet: { glutenFree: false, vegan: false, dairyFree: false } }),
  v("meringue", "Meringue nests", "pantry", "baking", { diet: { vegan: false } }),

  // Drinks
  v("apple-juice", "Apple juice", "drinks", "other", {}),
  v("orange-juice", "Orange juice", "drinks", "other", {}),
  v("cider", "Cider", "drinks", "alcohol", {}),
  v("stout", "Stout", "drinks", "alcohol", { diet: { glutenFree: false } }),
  v("port", "Port", "drinks", "alcohol", {}),
  v("sherry", "Sherry", "drinks", "alcohol", {}),
  v("whisky", "Whisky", "drinks", "alcohol", { diet: { glutenFree: false } }),
  v("vodka", "Vodka", "drinks", "alcohol", {}),
  v("coconut-water", "Coconut water", "drinks", "other", {}),
];

const OTHER: Spec[] = [
  v("water", "Water", "drinks", "other", { staple: true }),
  v("coffee", "Coffee", "drinks", "other", { aliases: ["espresso", "ground coffee"], emoji: "☕" }),
  v("tea", "Tea", "drinks", "other", { aliases: ["black tea", "green tea"] }),
  v("nori", "Nori", "pantry", "other", { aliases: ["seaweed", "seaweed sheets"] }),
  v("nutritional-yeast", "Nutritional yeast", "pantry", "other", {}),
  v("stock-cube", "Stock cube", "pantry", "other", { aliases: ["bouillon cube"], groups: ["stock"] }),
  v("cornichon", "Caperberries", "condiments", "other", {}),
  v("rose-water", "Rose water", "baking", "other", {}),
];

export const INGREDIENTS: Ingredient[] = build([
  ...VEGETABLES,
  ...FRUIT,
  ...HERBS,
  ...SPICES,
  ...GRAINS,
  ...PASTA,
  ...LEGUMES,
  ...MEAT,
  ...SEAFOOD,
  ...DAIRY_EGGS,
  ...NUTS,
  ...OILS,
  ...VINEGARS,
  ...SAUCES,
  ...STOCKS,
  ...SWEET,
  ...BAKING,
  ...ALCOHOL,
  ...EXTRAS,
  ...OTHER,
]);

/** Fast id lookup. */
export const INGREDIENT_BY_ID = new Map<IngredientId, Ingredient>(
  INGREDIENTS.map((i) => [i.id, i]),
);

/** Every ingredient belonging to a given group, e.g. `hard-cheese`. */
export const GROUP_MEMBERS: Map<string, IngredientId[]> = (() => {
  const map = new Map<string, IngredientId[]>();
  for (const ing of INGREDIENTS) {
    for (const g of ing.groups ?? []) {
      const list = map.get(g);
      if (list) list.push(ing.id);
      else map.set(g, [ing.id]);
    }
  }
  return map;
})();

/** Default assumed-on-hand set, seeded from `staple: true`. */
export const DEFAULT_STAPLES: IngredientId[] = INGREDIENTS.filter(
  (i) => i.staple,
).map((i) => i.id);

export function getIngredient(id: IngredientId): Ingredient | undefined {
  return INGREDIENT_BY_ID.get(id);
}

/** Display name for an id, falling back to the raw id for unknown refs. */
export function ingredientName(id: IngredientId): string {
  if (id.startsWith("group:")) {
    const label = id.slice(6).replace(/-/g, " ");
    return `any ${label}`;
  }
  return INGREDIENT_BY_ID.get(id)?.name ?? id;
}

export const AISLE_ORDER: Aisle[] = [
  "produce",
  "meat",
  "seafood",
  "dairy",
  "bakery",
  "frozen",
  "pantry",
  "baking",
  "spices",
  "condiments",
  "drinks",
];

export const AISLE_LABEL: Record<Aisle, string> = {
  produce: "Produce",
  meat: "Meat",
  seafood: "Seafood",
  dairy: "Dairy & chilled",
  bakery: "Bakery",
  frozen: "Frozen",
  pantry: "Pantry",
  baking: "Baking",
  spices: "Spices",
  condiments: "Condiments",
  drinks: "Drinks",
};
