import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG } from "../js/config.js";
import { ENTREES, PROTEIN_IDS, QUESADILLA_SIDE_IDS, TACO_TOPPING_IDS, ingredientCeiling, lineIndex } from "../js/menu.js";
import {
  GUEST_NAMES,
  createRunDeal,
  dealRoundTickets,
  parScoopCount,
  playerIngredients,
  takeRound,
} from "../js/tickets.js";

const CONFIG = GAME_CONFIG;

function idsOf(ticket) {
  return playerIngredients(ticket).map((step) => step.id);
}

function dealAll(seed, difficultyId) {
  const run = createRunDeal(seed, difficultyId, CONFIG);
  return run.difficulty.rounds.map((_, index) => takeRound(run, index));
}

function everyTicket(callback) {
  for (const difficultyId of ["easy", "normal", "hard"]) {
    for (let seed = 1; seed <= 40; seed++) {
      const rounds = dealAll(seed, difficultyId);
      for (const { round, tickets } of rounds) {
        assert.equal(tickets.length, round.targetEntrees);
        for (const ticket of tickets) callback(ticket, round, difficultyId, seed);
      }
    }
  }
}

test("ceilings match the legal maximums", () => {
  assert.equal(ingredientCeiling("burrito", { veggie: false }, CONFIG), 14);
  assert.equal(ingredientCeiling("burrito", { veggie: true }, CONFIG), 13);
  assert.equal(ingredientCeiling("bowl", { veggie: false, skipRice: true, skipBeans: true }, CONFIG), 11);
  assert.equal(ingredientCeiling("salad", { veggie: false }, CONFIG), 13);
  assert.equal(ingredientCeiling("salad", { veggie: true, skipRice: true, skipBeans: true }, CONFIG), 10);
  assert.equal(ingredientCeiling("tacos", { veggie: false }, CONFIG), 9);
  assert.equal(ingredientCeiling("tacos", { veggie: true }, CONFIG), 8);
  assert.equal(ingredientCeiling("quesadilla", { veggie: false }, CONFIG), 7);
  assert.equal(ingredientCeiling("quesadilla", { veggie: true }, CONFIG), 6);
});

test("every generated ticket is a legal build", () => {
  const seen = {
    veggie: false,
    brisket: false,
    noRice: false,
    tacoRice: false,
    quesadilla: false,
  };

  everyTicket((ticket, round) => {
    const ids = idsOf(ticket);
    const idSet = new Set(ids);
    assert.equal(idSet.size, ids.length, `duplicate scoops on ${ticket.entreeType}`);

    const open = ticket.scoops[0];
    const close = ticket.scoops[ticket.scoops.length - 1];
    assert.equal(open.role, "open");
    assert.equal(close.role, "close");
    assert.equal(open.pan, ticket.packaging.id);
    assert.equal(close.id, "wrap");
    assert.equal(close.pan, "wrap");
    assert.equal(close.label, "Wrap");
    assert.equal(close.key, "enter");
    assert.equal(open.pan, ENTREES[ticket.entreeType].packaging);
    assert.notEqual(close.pan, ticket.packaging.id);
    assert.equal(ticket.scoops.filter((step) => step.role === "open" || step.role === "close").length, 2);

    for (let i = 1; i < ids.length; i++) {
      assert.ok(lineIndex(ids[i - 1]) < lineIndex(ids[i]), `order ${ids.join(",")}`);
    }

    const meats = ids.filter((id) => PROTEIN_IDS.includes(id));
    if (ticket.filling === "veggie") {
      seen.veggie = true;
      assert.equal(meats.length, 0);
      assert.ok(ids.includes("guac"));
      assert.equal(round.allowVeggie, true);
    } else {
      assert.deepEqual(meats, [ticket.filling]);
      assert.ok(PROTEIN_IDS.includes(ticket.filling));
      if (ticket.filling === "brisket") {
        seen.brisket = true;
        assert.equal(round.allowLto, true);
      }
    }
    if (!round.allowVeggie) assert.notEqual(ticket.filling, "veggie");
    if (!round.allowLto) assert.notEqual(ticket.filling, "brisket");

    const rice = ids.filter((id) => id === "white-rice" || id === "brown-rice");
    const beans = ids.filter((id) => id === "black-beans" || id === "pinto-beans");
    const base = ticket.entreeType === "burrito" || ticket.entreeType === "bowl" || ticket.entreeType === "salad";

    if (ticket.entreeType === "burrito") {
      assert.equal(ids[0], "soft-flour");
      assert.equal(ticket.packaging.id, "foil");
      assert.ok(!ids.includes("crispy-corn"));
      assert.ok(!ids.includes("honey-vin"));
      assert.equal(ids.filter((id) => id === "soft-flour").length, 1);
    }
    if (ticket.entreeType === "bowl") {
      assert.equal(ticket.packaging.id, "bowl");
      assert.ok(!ids.includes("soft-flour"));
      assert.ok(!ids.includes("crispy-corn"));
      assert.ok(!ids.includes("honey-vin"));
    }
    if (ticket.entreeType === "tacos") {
      assert.equal(ids[0], "crispy-corn");
      assert.equal(ticket.packaging.id, "container");
      assert.ok(!ids.includes("soft-flour"));
      assert.ok(!ids.includes("honey-vin"));
      const toppings = ids.filter((id) => TACO_TOPPING_IDS.includes(id));
      assert.ok(toppings.length >= 1 && toppings.length <= 5, toppings.join(","));
      if (rice.length) seen.tacoRice = true;
    }
    if (ticket.entreeType === "salad") {
      assert.equal(ticket.packaging.id, "bowl");
      assert.ok(ids.includes("honey-vin"));
      assert.ok(!ids.includes("lettuce"));
      assert.ok(!ids.includes("soft-flour") && !ids.includes("crispy-corn"));
      assert.deepEqual(ticket.autoScoops.map((scoop) => scoop.id), ["supergreens"]);
    }
    if (ticket.entreeType === "quesadilla") {
      seen.quesadilla = true;
      assert.equal(ticket.packaging.id, "container");
      assert.ok(!ids.includes("cheese"));
      assert.ok(!ids.includes("lettuce"));
      assert.ok(!ids.includes("soft-flour") && !ids.includes("crispy-corn"));
      assert.deepEqual(ticket.autoScoops.map((scoop) => scoop.id), ["cheese"]);
      const sides = ids.filter((id) => QUESADILLA_SIDE_IDS.includes(id));
      assert.ok(sides.length >= 1 && sides.length <= 3, sides.join(","));
    } else if (ticket.entreeType !== "salad") {
      assert.deepEqual(ticket.autoScoops, []);
    }

    if (base) {
      assert.ok(rice.length <= 1);
      assert.ok(beans.length <= 1);
      if (!round.allowNoRiceOrBeans) {
        assert.equal(rice.length, 1);
        assert.equal(beans.length, 1);
      } else if (rice.length === 0 || beans.length === 0) {
        seen.noRice = true;
      }
    }

    const n = parScoopCount(ticket);
    const ceiling = ingredientCeiling(ticket.entreeType, {
      veggie: ticket.filling === "veggie",
      skipRice: base && rice.length === 0,
      skipBeans: base && beans.length === 0,
    }, CONFIG);
    assert.ok(n <= ceiling, `${ticket.entreeType} n=${n} ceiling=${ceiling}`);
    assert.ok(n <= round.maxScoops, `${ticket.entreeType} n=${n} max=${round.maxScoops}`);
    assert.ok(n >= Math.min(round.minScoops, ceiling));
    if (n < round.minScoops) assert.equal(n, ceiling);

    assert.equal(ticket.scoops.filter((step) => !step.role).length, n);
    assert.ok(GUEST_NAMES.includes(ticket.guest));
    assert.match(ticket.id, /^t_\d+$/);
  });

  assert.equal(seen.veggie, true);
  assert.equal(seen.brisket, true);
  assert.equal(seen.noRice, true);
  assert.equal(seen.tacoRice, true);
  assert.equal(seen.quesadilla, true);
});

test("back-to-back tickets avoid repeating the entrée type", () => {
  for (const difficultyId of ["easy", "normal", "hard"]) {
    for (let seed = 1; seed <= 25; seed++) {
      for (const { round, tickets } of dealAll(seed, difficultyId)) {
        if (round.entreeTypes.length < 2) continue;
        for (let i = 1; i < tickets.length; i++) {
          assert.notEqual(tickets[i].entreeType, tickets[i - 1].entreeType);
        }
      }
    }
  }
});

test("a full run uses each guest once and the same seed replays", () => {
  for (const difficultyId of ["easy", "normal", "hard"]) {
    const first = signatureRun(1, difficultyId);
    const second = signatureRun(1, difficultyId);
    assert.deepEqual(first, second);
    const guests = first.map((row) => row.guest);
    assert.equal(new Set(guests).size, guests.length);
  }
  const a = signatureRun(1, "normal").map((row) => row.scoops).join("|");
  const b = signatureRun(2, "normal").map((row) => row.scoops).join("|");
  assert.notEqual(a, b);
});

test("seed 1 normal deal stays fixed", () => {
  const sig = signatureRun(1, "normal").map((row) => `${row.guest}:${row.type}:${row.scoops}`);
  assert.deepEqual(sig, SEED_ONE_NORMAL);
});

function signatureRun(seed, difficultyId) {
  return dealAll(seed, difficultyId).flatMap(({ tickets }) => tickets.map((ticket) => ({
    guest: ticket.guest,
    type: ticket.entreeType,
    scoops: idsOf(ticket).join("+"),
  })));
}

const SEED_ONE_NORMAL = [
  "Riley:burrito:soft-flour+white-rice+black-beans+barbacoa+tomato+corn",
  "Luis:bowl:brown-rice+pinto-beans+barbacoa+corn+cheese",
  "Theo:bowl:white-rice+pinto-beans+sofritas+corn+sour-cream+queso+lettuce",
  "Hana:burrito:soft-flour+white-rice+black-beans+steak+red+queso",
  "Noah:bowl:white-rice+pinto-beans+steak+tomato+corn+red+sour-cream+lettuce",
  "Mina:salad:brown-rice+pinto-beans+fajitas+corn+green+red+sour-cream+cheese+guac+honey-vin",
  "Quinn:quesadilla:white-rice+brown-rice+pinto-beans+sofritas+fajitas+guac+queso",
  "Alex:burrito:soft-flour+white-rice+black-beans+brisket+fajitas+tomato+corn+red+sour-cream+cheese",
];

test("dealRoundTickets does not reshuffle names ahead of the run helper", () => {
  const run = createRunDeal(5, "easy", CONFIG);
  const { tickets } = takeRound(run, 0);
  assert.equal(tickets.length, 2);
  assert.notEqual(tickets[0].guest, tickets[1].guest);
});
