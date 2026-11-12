import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG } from "../js/config.js";
import { applyInput, createPlay } from "../js/rules.js";
import { createRunDeal, playerIngredients, takeRound } from "../js/tickets.js";

function ticket(packId, ingredientIds) {
  const label = { foil: "Foil", bowl: "Bowl", container: "Container" }[packId];
  return {
    entreeType: "tacos",
    filling: ingredientIds.find((id) => ["chicken", "steak"].includes(id)) || "chicken",
    packaging: { id: packId, label, pan: packId },
    scoops: [
      { id: packId, label, pan: packId, role: "open" },
      ...ingredientIds.map((id) => ({ id, label: id, pan: id })),
      { id: `close-${packId}`, label: `Close ${label}`, pan: packId, role: "close" },
    ],
    autoScoops: [],
  };
}

const TACO = () => ticket("container", ["crispy-corn", "chicken", "tomato"]);

function play(strictOrder, source = TACO()) {
  return createPlay(source, { strictOrder });
}

test("any order accepts ingredients out of ticket order, then the same packaging closes", () => {
  let state = play(false);
  for (const pan of ["container", "tomato", "chicken", "crispy-corn", "container"]) {
    const result = applyInput(state, pan);
    assert.equal(result.event.type, "correct", pan);
    state = result.play;
  }
  assert.equal(state.phase, "closed");
  assert.deepEqual(state.scooped, ["tomato", "chicken", "crispy-corn"]);
  const after = applyInput(state, "lettuce");
  assert.equal(after.event.type, "ignored");
  assert.equal(after.play, state);
});

test("strict order rejects a later ingredient and accepts the listed order", () => {
  let state = play(true);
  let opened = applyInput(state, "container");
  state = opened.play;
  const early = applyInput(state, "tomato");
  assert.equal(early.event.type, "mistake");
  assert.equal(early.event.kind, "out-of-order");
  assert.equal(early.play.phase, "locked");
  assert.deepEqual(early.play.scooped, []);

  const ignored = applyInput(early.play, "chicken");
  assert.equal(ignored.event.type, "ignored");
  assert.equal(ignored.play, early.play);

  const trashed = applyInput(early.play, "trash");
  assert.equal(trashed.event.type, "trash");
  assert.equal(trashed.event.voluntary, false);
  assert.equal(trashed.play.phase, "await-open");
  assert.deepEqual(trashed.play.scooped, []);

  state = trashed.play;
  for (const pan of ["container", "crispy-corn", "chicken", "tomato", "container"]) {
    const result = applyInput(state, pan);
    assert.equal(result.event.type, "correct", pan);
    state = result.play;
  }
  assert.equal(state.phase, "closed");
});

test("wrong packaging locks the line", () => {
  const result = applyInput(play(false), "foil");
  assert.equal(result.event.kind, "wrong-packaging");
  assert.equal(result.play.phase, "locked");
  assert.equal(result.play.lastMistake.panId, "foil");
  const again = applyInput(result.play, "container");
  assert.equal(again.event.type, "ignored");
  const bowl = applyInput(play(false, ticket("bowl", ["white-rice", "chicken"])), "container");
  assert.equal(bowl.event.kind, "wrong-packaging");
});

test("an ingredient before packaging is its own mistake, even if it is off the ticket", () => {
  const before = applyInput(play(false), "chicken");
  assert.equal(before.event.kind, "ingredient-before-packaging");
  const off = applyInput(play(true), "lettuce");
  assert.equal(off.event.kind, "ingredient-before-packaging");
  assert.notEqual(off.event.kind, "off-ticket");
});

test("off-ticket, duplicate, and early close each lock until trash", () => {
  let state = applyInput(play(false), "container").play;

  const off = applyInput(state, "lettuce");
  assert.equal(off.event.kind, "off-ticket");
  assert.equal(applyInput(off.play, "queso").event.type, "ignored");
  state = applyInput(off.play, "trash").play;
  assert.equal(state.phase, "await-open");

  state = applyInput(state, "container").play;
  state = applyInput(state, "chicken").play;
  const dup = applyInput(state, "chicken");
  assert.equal(dup.event.kind, "duplicate");
  assert.deepEqual(dup.play.scooped, ["chicken"]);
  state = applyInput(dup.play, "trash").play;

  state = applyInput(state, "container").play;
  const early = applyInput(state, "container");
  assert.equal(early.event.kind, "early-close");
  assert.equal(early.play.phase, "locked");
  assert.equal(early.play.opened, true);

  state = applyInput(state, "chicken").play;
  const stillEarly = applyInput(state, "container");
  assert.equal(stillEarly.event.kind, "early-close");
});

test("the wrong packaging at the end is not a close, and trash without a mistake is voluntary", () => {
  let state = play(false);
  for (const pan of ["container", "crispy-corn", "chicken", "tomato"]) {
    state = applyInput(state, pan).play;
  }
  const wrong = applyInput(state, "foil");
  assert.equal(wrong.event.kind, "wrong-packaging");
  assert.notEqual(wrong.play.phase, "closed");

  const fresh = applyInput(play(false), "trash");
  assert.equal(fresh.event.type, "trash");
  assert.equal(fresh.event.voluntary, true);
  assert.equal(fresh.event.type === "mistake", false);
  assert.equal(fresh.play.opened, false);
});

test("a generated hard ticket completes only in ticket order", () => {
  const run = createRunDeal(4, "hard");
  const { tickets } = takeRound(run, 0);
  const generated = tickets[0];
  const steps = generated.scoops.map((step) => step.pan);

  let strict = createPlay(generated, { strictOrder: true });
  const open = applyInput(strict, steps[0]);
  strict = open.play;
  const skipped = applyInput(strict, steps[2]);
  assert.equal(skipped.event.kind, "out-of-order");

  let loose = createPlay(generated, { strictOrder: false });
  const reverse = [steps[0], ...steps.slice(1, -1).reverse(), steps[steps.length - 1]];
  for (const pan of reverse) {
    const result = applyInput(loose, pan);
    assert.equal(result.event.type, "correct", `${pan} in ${reverse.join(",")}`);
    loose = result.play;
  }
  assert.equal(loose.phase, "closed");

  let ordered = createPlay(generated, { strictOrder: true });
  for (const pan of steps) {
    const result = applyInput(ordered, pan);
    assert.equal(result.event.type, "correct");
    ordered = result.play;
  }
  assert.equal(ordered.phase, "closed");
  assert.equal(playerIngredients(generated).length > 0, true);
});

test("normal strictOrder is off and hard is on", () => {
  assert.equal(GAME_CONFIG.difficulties.easy.strictOrder, false);
  assert.equal(GAME_CONFIG.difficulties.normal.strictOrder, false);
  assert.equal(GAME_CONFIG.difficulties.hard.strictOrder, true);
});
