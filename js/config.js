/**
 * Every tunable for Line Rush lives here: durations, quotas, ramp, scoring, keys.
 * Screens read this module; they do not hard-code round lengths or mistake penalties.
 */

/** @typedef {"burrito"|"bowl"|"salad"|"tacos"|"quesadilla"} EntreeType */
/** @typedef {"easy"|"normal"|"hard"} DifficultyId */

export const KEY_MAP = {
  "1": "foil",
  "2": "bowl",
  "3": "container",
  "4": "soft-flour",
  "5": "crispy-corn",
  q: "white-rice",
  w: "brown-rice",
  e: "black-beans",
  r: "pinto-beans",
  a: "chicken",
  s: "steak",
  d: "barbacoa",
  f: "carnitas",
  g: "sofritas",
  t: "brisket",
  h: "fajitas",
  z: "tomato",
  x: "corn",
  c: "green",
  v: "red",
  b: "sour-cream",
  n: "cheese",
  m: "guac",
  j: "queso",
  k: "lettuce",
  l: "honey-vin",
  backspace: "trash",
  enter: "wrap",
};

const EASY_ROUNDS = [
  { id: "r1", label: "Round 1", durationMs: 75000, targetEntrees: 2, entreeTypes: ["burrito", "bowl"], minScoops: 4, maxScoops: 5, lookalikes: false, allowLto: false, allowVeggie: false, allowNoRiceOrBeans: false, noRiceChance: 0, noBeansChance: 0, fajitaChance: 0.45, premiumChance: 0.25 },
  { id: "r2", label: "Round 2", durationMs: 75000, targetEntrees: 2, entreeTypes: ["burrito", "bowl", "tacos"], minScoops: 5, maxScoops: 7, lookalikes: false, allowLto: false, allowVeggie: false, allowNoRiceOrBeans: false, noRiceChance: 0, noBeansChance: 0, fajitaChance: 0.45, premiumChance: 0.25 },
  { id: "r3", label: "Round 3", durationMs: 75000, targetEntrees: 3, entreeTypes: ["burrito", "bowl", "tacos", "salad"], minScoops: 6, maxScoops: 8, lookalikes: true, allowLto: false, allowVeggie: false, allowNoRiceOrBeans: false, noRiceChance: 0, noBeansChance: 0, fajitaChance: 0.45, premiumChance: 0.25 },
];

const NORMAL_ROUNDS = [
  { id: "r1", label: "Round 1", durationMs: 60000, targetEntrees: 2, entreeTypes: ["burrito", "bowl"], minScoops: 5, maxScoops: 6, lookalikes: false, allowLto: false, allowVeggie: false, allowNoRiceOrBeans: false, noRiceChance: 0, noBeansChance: 0, fajitaChance: 0.45, premiumChance: 0.25 },
  { id: "r2", label: "Round 2", durationMs: 60000, targetEntrees: 3, entreeTypes: ["burrito", "bowl", "tacos"], minScoops: 6, maxScoops: 8, lookalikes: true, allowLto: true, allowVeggie: false, allowNoRiceOrBeans: false, noRiceChance: 0, noBeansChance: 0, fajitaChance: 0.45, premiumChance: 0.25 },
  { id: "r3", label: "Round 3", durationMs: 70000, targetEntrees: 3, entreeTypes: ["burrito", "bowl", "tacos", "salad", "quesadilla"], minScoops: 8, maxScoops: 10, lookalikes: true, allowLto: true, allowVeggie: true, allowNoRiceOrBeans: true, noRiceChance: 0.15, noBeansChance: 0.15, fajitaChance: 0.45, premiumChance: 0.25 },
];

const HARD_ROUNDS = [
  { id: "r1", label: "Round 1", durationMs: 50000, targetEntrees: 3, entreeTypes: ["burrito", "bowl"], minScoops: 6, maxScoops: 7, lookalikes: true, allowLto: true, allowVeggie: false, allowNoRiceOrBeans: false, noRiceChance: 0, noBeansChance: 0, fajitaChance: 0.45, premiumChance: 0.25 },
  { id: "r2", label: "Round 2", durationMs: 55000, targetEntrees: 3, entreeTypes: ["burrito", "bowl", "tacos", "salad"], minScoops: 8, maxScoops: 10, lookalikes: true, allowLto: true, allowVeggie: true, allowNoRiceOrBeans: true, noRiceChance: 0.15, noBeansChance: 0.15, fajitaChance: 0.45, premiumChance: 0.25 },
  { id: "r3", label: "Round 3", durationMs: 60000, targetEntrees: 3, entreeTypes: ["burrito", "bowl", "tacos", "salad", "quesadilla"], minScoops: 9, maxScoops: 12, lookalikes: true, allowLto: true, allowVeggie: true, allowNoRiceOrBeans: true, noRiceChance: 0.2, noBeansChance: 0.2, fajitaChance: 0.45, premiumChance: 0.25 },
];

export const GAME_CONFIG = {
  version: 3,
  modeId: "lineRush",
  title: "The DML Experience",
  modeLabel: "Line Rush",
  tagline: "Build every order before peak lunch wins.",
  silent: true,
  defaultDifficulty: "normal",
  storageBestKey: "dml.lineRush.best.v3",
  storageNameKey: "dml.lineRush.name.v1",

  leaderboard: {
    enabled: true,
    url: "https://mrfpyfnyyvnahacdvskf.supabase.co",
    key: "sb_publishable_yYD00bQ-0nzUyZjrZGmwMQ_G4Z5OSg0",
  },

  line: {
    includeLtoBrisket: true,
    includeVinaigrette: true,
    includeCatalogOnlyProteins: false,
    includeCilantroLimeSauce: false,
    includeKidsMeals: false,
    includeFamilyMeals: false,
  },

  scoring: {
    perEntree: 100,
    speedBonusPerSecUnderPar: 5,
    parBaseMs: 2000,
    parMsPerScoop: 1100,
    accuracyPerfectBonus: 50,
    leftoverSecBonus: 10,
  },

  rng: {
    defaultSeed: null,
    algorithm: "mulberry32",
  },

  difficulties: {
    easy: { id: "easy", label: "Easy", mistakePenaltyMs: 2000, strictOrder: false, showNextHint: true, rounds: EASY_ROUNDS },
    normal: { id: "normal", label: "Normal", mistakePenaltyMs: 2500, strictOrder: false, showNextHint: false, rounds: NORMAL_ROUNDS },
    hard: { id: "hard", label: "Hard", mistakePenaltyMs: 3000, strictOrder: true, showNextHint: false, rounds: HARD_ROUNDS },
  },
};

export function keyForPan(panId) {
  for (const [key, id] of Object.entries(KEY_MAP)) {
    if (id === panId) return key;
  }
  return "";
}

export function keyCap(panId) {
  const key = keyForPan(panId);
  if (!key) return "";
  if (key === "backspace") return "Bksp";
  if (key === "enter") return "Enter";
  return key.length === 1 ? key.toUpperCase() : key;
}
