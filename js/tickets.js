/**
 * Random tickets inside a round's constraints.
 * A deal is fixed for the round: trashing restarts the same ticket.
 */

import { GAME_CONFIG, keyForPan } from "./config.js";
import { mulberry32, shuffle } from "./rng.js";
import {
  BEAN_IDS,
  BURRITO_OPTIONAL_IDS,
  ENTREES,
  ITEMS,
  LOOKALIKE_PAIRS,
  PROTEIN_IDS,
  QUESADILLA_ADDON_IDS,
  QUESADILLA_FILLING_IDS,
  QUESADILLA_SIDE_IDS,
  RICE_IDS,
  SALAD_OPTIONAL_IDS,
  TACO_PREMIUM_IDS,
  TACO_TOPPING_IDS,
  ingredientCeiling,
  isOnLine,
  lineIndex,
} from "./menu.js";

export const GUEST_NAMES = [
  "Jules", "Theo", "Mina", "Sam", "Riley", "Noah",
  "Ava", "Leo", "Quinn", "Eden", "Maya", "Omar",
  "Priya", "Luis", "Hana", "Alex",
];

const PACK_META = {
  foil: { id: "foil", label: "Foil" },
  bowl: { id: "bowl", label: "Bowl" },
  container: { id: "container", label: "Container" },
};

export function playerIngredients(ticket) {
  return ticket.scoops.filter((step) => step.role !== "open" && step.role !== "close");
}

export function parScoopCount(ticket) {
  return playerIngredients(ticket).length;
}

export function createRunDeal(seed, difficultyId, config = GAME_CONFIG) {
  const difficulty = config.difficulties[difficultyId];
  const rng = mulberry32(seed);
  const deal = {
    names: shuffle(GUEST_NAMES, rng),
    nameIndex: 0,
    nextId: 1,
  };
  return { seed: seed >>> 0, rng, deal, difficulty, config };
}

export function takeRound(run, roundIndex) {
  const round = run.difficulty.rounds[roundIndex];
  const tickets = dealRoundTickets(round, run.rng, run.deal, run.config);
  return { round, tickets };
}

export function dealRoundTickets(round, rng, deal, config = GAME_CONFIG) {
  const tickets = [];
  for (let i = 0; i < round.targetEntrees; i++) {
    let ticket = null;
    let attempts = 0;
    do {
      ticket = generateTicket(round, rng, tickets, config);
      attempts += 1;
    } while (attempts < 8 && tickets.some((prev) => sameBuild(prev, ticket)));
    ticket.guest = deal.names[deal.nameIndex % deal.names.length];
    deal.nameIndex += 1;
    ticket.id = `t_${deal.nextId}`;
    deal.nextId += 1;
    tickets.push(ticket);
  }
  return tickets;
}

export function generateTicket(round, rng, priorTickets = [], config = GAME_CONFIG) {
  const type = pickType(round, rng, priorTickets);
  const meta = ENTREES[type];
  const protein = pick(proteinBag(round, config), rng);
  const ids = [];

  if (type === "burrito") ids.push("soft-flour");
  if (type === "tacos") ids.push("crispy-corn");

  const riceAndBeans = type === "burrito" || type === "bowl" || type === "salad";
  if (riceAndBeans) {
    const skipRice = round.allowNoRiceOrBeans && rng() < round.noRiceChance;
    if (!skipRice) ids.push(pick(RICE_IDS, rng));
    const skipBeans = round.allowNoRiceOrBeans && rng() < round.noBeansChance;
    if (!skipBeans) ids.push(pick(BEAN_IDS, rng));
  }

  if (protein === "veggie") ids.push("guac");
  else ids.push(protein);

  if (type === "salad" && isOnLine("honey-vin", config)) ids.push("honey-vin");

  if (type === "tacos") {
    const toppings = TACO_TOPPING_IDS.filter((id) => isOnLine(id, config) && !ids.includes(id));
    ids.push(pick(toppings, rng));
  }

  if (type === "quesadilla") {
    const sides = QUESADILLA_SIDE_IDS.filter((id) => isOnLine(id, config) && !ids.includes(id));
    ids.push(pick(sides, rng));
  }

  const chosen = new Set(ids);
  const target = Math.max(ids.length, rollScoopTarget(round, rng, ids.length));
  let slots = Math.max(0, target - ids.length);
  const pool = optionalPool(type, chosen, config);
  const present = new Set(chosen);
  if (type === "quesadilla") present.add("cheese");

  if (round.lookalikes && slots > 0 && pool.length) {
    const boost = lookalikePick(present, pool, rng);
    if (boost && canAdd(type, chosen, boost)) {
      ids.push(boost);
      chosen.add(boost);
      present.add(boost);
      const at = pool.indexOf(boost);
      if (at >= 0) pool.splice(at, 1);
      slots -= 1;
    }
  }

  while (slots > 0 && pool.length) {
    const weights = pool.map((id) => weightOf(id, round));
    if (weights.every((weight) => weight <= 0)) break;
    const index = pickWeighted(weights, rng);
    const id = pool.splice(index, 1)[0];
    if (!canAdd(type, chosen, id)) continue;
    ids.push(id);
    chosen.add(id);
    slots -= 1;
  }

  ids.sort((a, b) => lineIndex(a) - lineIndex(b));

  const pack = PACK_META[meta.packaging];
  const scoops = [
    scoopPack(pack, "open"),
    ...ids.map((id) => scoopItem(id)),
    scoopPack(pack, "close"),
  ];

  const autoScoops = [];
  if (type === "quesadilla") autoScoops.push({ id: "cheese", label: "Cheese", builtin: true });
  if (type === "salad") autoScoops.push({ id: "supergreens", label: "Supergreens", builtin: true });

  return {
    id: "",
    guest: "",
    entreeType: type,
    entreeLabel: meta.label,
    filling: protein,
    packaging: { id: pack.id, label: pack.label, pan: pack.id, key: keyForPan(pack.id) },
    scoops,
    autoScoops,
    buildLabel: meta.buildLabel,
    surface: meta.surface,
  };
}

export { ingredientCeiling };

function rollScoopTarget(round, rng, required) {
  const min = round.minScoops;
  const max = round.maxScoops;
  if (required > max) return required;
  const span = max - min + 1;
  return min + Math.floor(rng() * span);
}

function pickType(round, rng, priorTickets) {
  let types = round.entreeTypes.filter((type) => ENTREES[type]);
  if (!types.length) types = ["burrito"];
  const prev = priorTickets.length ? priorTickets[priorTickets.length - 1].entreeType : null;
  if (prev && types.length > 1) {
    const alt = types.filter((type) => type !== prev);
    if (alt.length) types = alt;
  }
  return pick(types, rng);
}

function proteinBag(round, config) {
  const list = PROTEIN_IDS.filter((id) => id !== "brisket" || (round.allowLto && config.line.includeLtoBrisket));
  if (round.allowVeggie) list.push("veggie");
  return list;
}

function optionalPool(type, chosen, config) {
  let list = [];
  if (type === "burrito" || type === "bowl") list = BURRITO_OPTIONAL_IDS;
  else if (type === "salad") list = SALAD_OPTIONAL_IDS;
  else if (type === "tacos") list = [...TACO_TOPPING_IDS, ...TACO_PREMIUM_IDS];
  else if (type === "quesadilla") list = [...QUESADILLA_SIDE_IDS, ...QUESADILLA_FILLING_IDS, ...QUESADILLA_ADDON_IDS];
  return list.filter((id) => isOnLine(id, config) && !chosen.has(id));
}

function canAdd(type, chosen, id) {
  if (chosen.has(id)) return false;
  if (type === "tacos") {
    if (TACO_TOPPING_IDS.includes(id)) {
      let toppings = 0;
      for (const have of chosen) if (TACO_TOPPING_IDS.includes(have)) toppings += 1;
      if (toppings >= 5) return false;
    }
    return TACO_TOPPING_IDS.includes(id) || TACO_PREMIUM_IDS.includes(id);
  }
  if (type === "quesadilla") {
    if (QUESADILLA_SIDE_IDS.includes(id)) {
      let sides = 0;
      for (const have of chosen) if (QUESADILLA_SIDE_IDS.includes(have)) sides += 1;
      if (sides >= 3) return false;
    }
    return QUESADILLA_SIDE_IDS.includes(id) || QUESADILLA_FILLING_IDS.includes(id) || QUESADILLA_ADDON_IDS.includes(id);
  }
  return true;
}

function weightOf(id, round) {
  if (id === "fajitas") return round.fajitaChance;
  if (id === "guac" || id === "queso") return round.premiumChance;
  return 1;
}

function lookalikePick(present, pool, rng) {
  for (const [a, b] of LOOKALIKE_PAIRS) {
    if (present.has(a) && !present.has(b) && pool.includes(b)) return b;
    if (present.has(b) && !present.has(a) && pool.includes(a)) return a;
  }
  const candidates = [];
  for (const [a, b] of LOOKALIKE_PAIRS) {
    if (pool.includes(a) && !present.has(b)) candidates.push(a);
    if (pool.includes(b) && !present.has(a)) candidates.push(b);
  }
  if (!candidates.length) return null;
  return candidates[Math.floor(rng() * candidates.length)];
}

function pickWeighted(weights, rng) {
  let total = 0;
  for (const weight of weights) total += weight;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= weights[i];
    if (roll <= 0) return i;
  }
  return weights.length - 1;
}

function sameBuild(a, b) {
  if (a.entreeType !== b.entreeType || a.filling !== b.filling) return false;
  const sig = (ticket) => playerIngredients(ticket).map((step) => step.id).slice().sort().join(",");
  return sig(a) === sig(b);
}

function pick(list, rng) {
  return list[Math.floor(rng() * list.length)];
}

function scoopItem(id) {
  const item = ITEMS[id];
  return { id, label: item.ticketLabel, pan: id, key: keyForPan(id) };
}

function scoopPack(pack, role) {
  if (role === "open") {
    return { id: pack.id, label: pack.label, pan: pack.id, key: keyForPan(pack.id), role: "open" };
  }
  return {
    id: `close-${pack.id}`,
    label: `Close ${pack.label}`,
    pan: pack.id,
    key: keyForPan(pack.id),
    role: "close",
  };
}
