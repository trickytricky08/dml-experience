import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG, KEY_MAP } from "../js/config.js";
import { buildHint, dealNote, nextRoundNote, shareText } from "../js/copy.js";
import { countdownSeconds, formatClock, fullSeconds } from "../js/format.js";
import { hashString, resolveSeed } from "../js/rng.js";
import { accuracyRatio, scoreCompletedEntree, scoreRoundBonuses } from "../js/scoring.js";

const scoring = GAME_CONFIG.scoring;

test("difficulty table, keys, and scoring constants match the preset", () => {
  assert.equal(GAME_CONFIG.defaultDifficulty, "normal");
  assert.equal(GAME_CONFIG.storageBestKey, "dml.lineRush.best.v3");
  assert.equal(GAME_CONFIG.difficulties.easy.trashLockoutMs, 2000);
  assert.equal(GAME_CONFIG.difficulties.normal.trashLockoutMs, 2500);
  assert.equal(GAME_CONFIG.difficulties.hard.trashLockoutMs, 3000);
  assert.equal(GAME_CONFIG.line.includeKidsMeals, false);
  assert.equal(GAME_CONFIG.line.includeLtoBrisket, true);

  const normal = GAME_CONFIG.difficulties.normal.rounds;
  assert.equal(normal.length, 3);
  assert.deepEqual(normal.map((round) => round.targetEntrees), [2, 3, 3]);
  assert.deepEqual(normal.map((round) => round.durationMs), [60000, 60000, 70000]);
  assert.deepEqual(normal[0].entreeTypes, ["burrito", "bowl"]);
  assert.deepEqual(normal[1].entreeTypes, ["burrito", "bowl", "tacos"]);
  assert.deepEqual(normal[2].entreeTypes, ["burrito", "bowl", "tacos", "salad", "quesadilla"]);
  assert.equal(normal[0].minScoops, 5);
  assert.equal(normal[0].maxScoops, 6);
  assert.equal(normal[1].lookalikes, true);
  assert.equal(normal[1].allowLto, true);
  assert.equal(normal[2].allowVeggie, true);
  assert.equal(normal[2].allowNoRiceOrBeans, true);

  const hard = GAME_CONFIG.difficulties.hard.rounds;
  assert.equal(hard[0].durationMs, 50000);
  assert.equal(hard[0].targetEntrees, 3);
  assert.equal(hard[2].minScoops, 9);
  assert.equal(hard[2].maxScoops, 12);
  assert.deepEqual(GAME_CONFIG.difficulties.easy.rounds.map((round) => round.targetEntrees), [2, 2, 3]);

  assert.equal(KEY_MAP["1"], "foil");
  assert.equal(KEY_MAP["2"], "bowl");
  assert.equal(KEY_MAP["3"], "container");
  assert.equal(KEY_MAP["4"], "soft-flour");
  assert.equal(KEY_MAP["5"], "crispy-corn");
  assert.equal(KEY_MAP.q, "white-rice");
  assert.equal(KEY_MAP.t, "brisket");
  assert.equal(KEY_MAP.l, "honey-vin");
  assert.equal(KEY_MAP.backspace, "trash");
  assert.equal(scoring.perEntree, 100);
  assert.equal(scoring.speedBonusPerSecUnderPar, 5);
  assert.equal(scoring.parBaseMs, 2000);
  assert.equal(scoring.parMsPerScoop, 1100);
  assert.equal(scoring.accuracyPerfectBonus, 50);
  assert.equal(scoring.leftoverSecBonus, 10);
});

test("entrée score pays 100 plus full seconds under par", () => {
  const five = 2000 + 1100 * 5;
  assert.deepEqual(scoreCompletedEntree(5, five, scoring), { parMs: five, base: 100, speed: 0, total: 100 });
  assert.equal(scoreCompletedEntree(5, five - 1500, scoring).speed, 5);
  assert.equal(scoreCompletedEntree(5, five - 999, scoring).speed, 0);
  assert.equal(scoreCompletedEntree(5, 0, scoring).speed, fullSeconds(five) * 5);
  assert.equal(scoreCompletedEntree(5, five + 4000, scoring).total, 100);
});

test("round bonuses: perfect accuracy and leftover seconds only when the quota is met", () => {
  const clean = scoreRoundBonuses({ mistakes: 0, quotaHit: true, leftoverMs: 3500, scoring });
  assert.deepEqual(clean, { perfect: 50, leftover: 30, total: 80 });
  const missed = scoreRoundBonuses({ mistakes: 2, quotaHit: true, leftoverMs: 3500, scoring });
  assert.equal(missed.perfect, 0);
  assert.equal(missed.leftover, 30);
  const slow = scoreRoundBonuses({ mistakes: 0, quotaHit: false, leftoverMs: 9000, scoring });
  assert.equal(slow.leftover, 0);
  assert.equal(slow.perfect, 50);
  assert.equal(scoreRoundBonuses({ mistakes: 0, quotaHit: true, leftoverMs: 999, scoring }).leftover, 0);
});

test("accuracy and the share sentence", () => {
  assert.equal(accuracyRatio(0, 0), 1);
  assert.equal(accuracyRatio(22, 3), 22 / 25);
  assert.equal(accuracyRatio(0, 2), 0);
  assert.equal(
    shareText({ completed: 7, target: 8, accuracyPct: 88 }),
    "I finished 7 of 8 entrees (88% accuracy) in Line Rush at The DML Experience!",
  );
});

test("countdown, hints, and the round-3 heads-up", () => {
  assert.equal(formatClock(60000), "1:00");
  assert.equal(formatClock(59000), "0:59");
  assert.equal(formatClock(100), "0:01");
  assert.equal(formatClock(0), "0:00");
  assert.equal(countdownSeconds(59999), 60);
  assert.equal(fullSeconds(3500), 3);

  const rounds = GAME_CONFIG.difficulties.normal.rounds;
  assert.equal(
    nextRoundNote(rounds, 1),
    "Round 3: 3 tickets in 70s — salads and quesadillas join, and toppings get heavier.",
  );
  assert.equal(nextRoundNote(rounds, 2), "That was the last round.");
  assert.match(dealNote(GAME_CONFIG.difficulties.normal, rounds[1]), /Normal/);
  assert.match(buildHint(false, 2500), /any order/);
  assert.match(buildHint(false, 2500), /2\.5s/);
  assert.match(buildHint(true, 3000), /ticket order/);
  assert.match(buildHint(true, 3000), /out of order/);
});

test("seeds: fixed, daily, and distinct days", () => {
  const day = new Date("2026-11-12T15:00:00Z");
  const next = new Date("2026-11-13T01:00:00Z");
  assert.equal(resolveSeed(GAME_CONFIG, "42"), 42);
  assert.equal(resolveSeed(GAME_CONFIG, 0), 0);
  const daily = resolveSeed(GAME_CONFIG, "daily", day);
  assert.equal(daily, resolveSeed(GAME_CONFIG, "daily", day));
  assert.equal(daily, hashString("dml.lineRush.daily.2026-11-12"));
  assert.notEqual(daily, resolveSeed(GAME_CONFIG, "daily", next));
  assert.equal(typeof resolveSeed(GAME_CONFIG, undefined), "number");
});
