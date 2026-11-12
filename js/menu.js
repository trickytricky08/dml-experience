/**
 * In-game line. Names here are the ones printed on pans and tickets.
 * Packaging is a control, not a pan. Veggie is a protein swap, not a pan.
 */

export const PROTEIN_IDS = ["chicken", "steak", "barbacoa", "carnitas", "sofritas", "brisket"];
export const RICE_IDS = ["white-rice", "brown-rice"];
export const BEAN_IDS = ["black-beans", "pinto-beans"];

export const BURRITO_OPTIONAL_IDS = [
  "fajitas", "tomato", "corn", "green", "red",
  "sour-cream", "cheese", "guac", "queso", "lettuce",
];

export const SALAD_OPTIONAL_IDS = [
  "fajitas", "tomato", "corn", "green", "red",
  "sour-cream", "cheese", "guac", "queso",
];

export const TACO_TOPPING_IDS = [
  "black-beans", "pinto-beans", "white-rice", "brown-rice",
  "tomato", "corn", "green", "red",
  "sour-cream", "cheese", "lettuce", "fajitas",
];

export const TACO_PREMIUM_IDS = ["guac", "queso"];

export const QUESADILLA_SIDE_IDS = [
  "black-beans", "pinto-beans", "white-rice", "brown-rice",
  "tomato", "corn", "green", "red",
  "sour-cream", "honey-vin",
];

export const QUESADILLA_FILLING_IDS = ["fajitas"];
export const QUESADILLA_ADDON_IDS = ["queso", "guac"];

export const LOOKALIKE_PAIRS = [
  ["white-rice", "brown-rice"],
  ["green", "red"],
  ["steak", "barbacoa"],
  ["cheese", "queso"],
  ["lettuce", "honey-vin"],
];

export const ENTREES = {
  burrito: { id: "burrito", label: "Burrito", packaging: "foil", buildLabel: "On the foil", surface: "foil" },
  bowl: { id: "bowl", label: "Burrito Bowl", packaging: "bowl", buildLabel: "In the bowl", surface: "bowl" },
  salad: { id: "salad", label: "Salad", packaging: "bowl", buildLabel: "In the bowl", surface: "salad" },
  tacos: { id: "tacos", label: "Tacos", packaging: "container", buildLabel: "The tacos", surface: "tacos" },
  quesadilla: { id: "quesadilla", label: "Quesadilla", packaging: "container", buildLabel: "On the press", surface: "press" },
};

export const PACKAGING = [
  { id: "foil", label: "Foil", kind: "foil" },
  { id: "bowl", label: "Bowl", kind: "bowl" },
  { id: "container", label: "Container", kind: "box" },
];

export const ITEM_LIST = [
  { id: "soft-flour", ticketLabel: "Soft flour", panLabel: "Soft Flour", group: "shell", food: "f-flour", row: "shell" },
  { id: "crispy-corn", ticketLabel: "Taco shells", panLabel: "Taco Shells", group: "shell", food: "f-taco-shell", row: "shell" },
  { id: "white-rice", ticketLabel: "White rice", panLabel: "White Rice", group: "rice", food: "f-white", row: "hot" },
  { id: "brown-rice", ticketLabel: "Brown rice", panLabel: "Brown Rice", group: "rice", food: "f-brown", row: "hot" },
  { id: "black-beans", ticketLabel: "Black beans", panLabel: "Black Beans", group: "beans", food: "f-black", row: "hot" },
  { id: "pinto-beans", ticketLabel: "Pinto beans", panLabel: "Pinto Beans", group: "beans", food: "f-pinto", row: "hot" },
  { id: "chicken", ticketLabel: "Chicken", panLabel: "Chicken", group: "protein", food: "f-chicken", row: "hot" },
  { id: "steak", ticketLabel: "Steak", panLabel: "Steak", group: "protein", food: "f-steak", row: "hot" },
  { id: "barbacoa", ticketLabel: "Barbacoa", panLabel: "Barbacoa", group: "protein", food: "f-barb", row: "hot" },
  { id: "carnitas", ticketLabel: "Carnitas", panLabel: "Carnitas", group: "protein", food: "f-carn", row: "hot" },
  { id: "sofritas", ticketLabel: "Sofritas", panLabel: "Sofritas", group: "protein", food: "f-sofr", row: "hot" },
  { id: "brisket", ticketLabel: "Brisket", panLabel: "Brisket", group: "protein", food: "f-brisk", row: "hot", lto: true },
  { id: "fajitas", ticketLabel: "Fajitas", panLabel: "Fajitas", group: "top", food: "f-fajita", row: "hot" },
  { id: "tomato", ticketLabel: "Fresh tomato", panLabel: "Tomato", group: "salsa", food: "f-tomato", row: "cold" },
  { id: "corn", ticketLabel: "Corn", panLabel: "Corn", group: "salsa", food: "f-corn", row: "cold" },
  { id: "green", ticketLabel: "Green", panLabel: "Green", group: "salsa", food: "f-green", row: "cold" },
  { id: "red", ticketLabel: "Red", panLabel: "Red", group: "salsa", food: "f-red", row: "cold" },
  { id: "sour-cream", ticketLabel: "Sour cream", panLabel: "Sour Cream", group: "top", food: "f-cream", row: "cold" },
  { id: "cheese", ticketLabel: "Cheese", panLabel: "Cheese", group: "top", food: "f-cheese", row: "cold" },
  { id: "guac", ticketLabel: "Guac", panLabel: "Guac", group: "top", food: "f-guac", row: "cold" },
  { id: "queso", ticketLabel: "Queso", panLabel: "Queso", group: "top", food: "f-queso", row: "cold" },
  { id: "lettuce", ticketLabel: "Lettuce", panLabel: "Lettuce", group: "top", food: "f-lettuce", row: "cold" },
  { id: "honey-vin", ticketLabel: "Honey vinaigrette", panLabel: "Honey Vin", group: "top", food: "f-vin", row: "cold" },
];

export const LINE_ORDER = ITEM_LIST.map((item) => item.id);
export const ITEMS = Object.fromEntries(ITEM_LIST.map((item) => [item.id, item]));
const ORDER_INDEX = new Map(LINE_ORDER.map((id, index) => [id, index]));

export function lineIndex(id) {
  return ORDER_INDEX.has(id) ? ORDER_INDEX.get(id) : 999;
}

export function isOnLine(id, config) {
  if (id === "brisket" && !config.line.includeLtoBrisket) return false;
  if (id === "honey-vin" && !config.line.includeVinaigrette) return false;
  return true;
}

export function pansInRow(row, config) {
  return ITEM_LIST.filter((item) => item.row === row && isOnLine(item.id, config));
}

export function itemGroup(id) {
  return ITEMS[id]?.group || "top";
}

export function legalIngredientIds(type) {
  if (type === "burrito") return ["soft-flour", ...RICE_IDS, ...BEAN_IDS, ...PROTEIN_IDS, ...BURRITO_OPTIONAL_IDS];
  if (type === "bowl") return [...RICE_IDS, ...BEAN_IDS, ...PROTEIN_IDS, ...BURRITO_OPTIONAL_IDS];
  if (type === "salad") return [...RICE_IDS, ...BEAN_IDS, ...PROTEIN_IDS, "honey-vin", ...SALAD_OPTIONAL_IDS];
  if (type === "tacos") return ["crispy-corn", ...TACO_TOPPING_IDS, ...PROTEIN_IDS, ...TACO_PREMIUM_IDS];
  if (type === "quesadilla") return ["soft-flour", ...PROTEIN_IDS, ...QUESADILLA_SIDE_IDS, ...QUESADILLA_FILLING_IDS, ...QUESADILLA_ADDON_IDS];
  return [];
}

/** Upper bound on player ingredient scoops for a protein choice and rice/bean skips. */
export function ingredientCeiling(type, opts = {}, config) {
  const veggie = !!opts.veggie;
  const skipRice = !!opts.skipRice;
  const skipBeans = !!opts.skipBeans;
  const on = (id) => isOnLine(id, config);

  if (type === "burrito" || type === "bowl" || type === "salad") {
    let n = type === "burrito" ? 1 : 0;
    if (!skipRice) n += 1;
    if (!skipBeans) n += 1;
    n += 1;
    if (type === "salad" && on("honey-vin")) n += 1;
    const base = type === "salad" ? SALAD_OPTIONAL_IDS : BURRITO_OPTIONAL_IDS;
    for (const id of base) {
      if (!on(id)) continue;
      if (veggie && id === "guac") continue;
      n += 1;
    }
    return n;
  }

  if (type === "tacos") {
    const cap = Math.min(5, TACO_TOPPING_IDS.filter(on).length);
    const premiums = TACO_PREMIUM_IDS.filter((id) => on(id) && !(veggie && id === "guac")).length;
    return 1 + 1 + cap + premiums;
  }

  if (type === "quesadilla") {
    const sides = Math.min(3, QUESADILLA_SIDE_IDS.filter(on).length);
    const fillings = QUESADILLA_FILLING_IDS.filter(on).length;
    const addons = QUESADILLA_ADDON_IDS.filter((id) => on(id) && !(veggie && id === "guac")).length;
    return 2 + sides + fillings + addons;
  }

  return 0;
}
