import { test } from "node:test";
import assert from "node:assert/strict";
import { GAME_CONFIG } from "../js/config.js";
import {
  formatBoardDate,
  leaderboardErrorText,
  maxAchievableScores,
  samePlayerName,
  submitScore,
  validatePlayerName,
} from "../js/leaderboard.js";

test("player names match the server rules", () => {
  assert.equal(validatePlayerName("LineCook").ok, true);
  assert.equal(validatePlayerName("a b").ok, true);
  assert.equal(validatePlayerName("ab_c.d-e").ok, true);
  assert.equal(validatePlayerName("").error, "invalid_name");
  assert.equal(validatePlayerName("this name is too long").error, "invalid_name");
  assert.equal(validatePlayerName("no!").error, "invalid_name");
  assert.equal(validatePlayerName("café").error, "invalid_name");
  assert.equal(leaderboardErrorText("invalid_name"), "Letters, numbers, spaces, _ . - only.");
  assert.equal(leaderboardErrorText("blocked_name"), "Pick a different name.");
  assert.equal(samePlayerName("LineCook", "linecook"), true);
  assert.equal(samePlayerName("Line Cook", "line  cook"), false);
});

test("board dates are a short month and day", () => {
  assert.equal(formatBoardDate("2026-11-11T18:00:00Z"), "Nov 11");
  assert.equal(formatBoardDate("not-a-date"), "");
});

test("a higher score is the only one that would replace a row", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, body: JSON.parse(options.body) });
    return {
      ok: true,
      json: async () => [{ rank: 4, best_score: 1585, improved: true }],
    };
  };
  const result = await submitScore({
    p_name: "LineCook",
    p_difficulty: "hard",
    p_score: 1585,
    p_entrees: 9,
  }, { fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(result.rank, 4);
  assert.equal(result.improved, true);
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/rpc\/submit_score$/);
  assert.equal(calls[0].body.p_difficulty, "hard");
  const blocked = await submitScore({
    p_name: "OkName",
    p_difficulty: "hard",
    p_score: 10,
    p_entrees: 1,
  }, {
    fetchImpl: async () => ({
      ok: false,
      json: async () => ({ message: "blocked_name" }),
    }),
  });
  assert.equal(blocked.error, "blocked_name");
  const local = await submitScore({ p_name: "nope!", p_difficulty: "hard", p_score: 10, p_entrees: 1 }, {
    fetchImpl: async () => { throw new Error("should not post"); },
  });
  assert.equal(local.error, "invalid_name");
});

test("the realistic score ceiling stays under the server cap", () => {
  const scores = maxAchievableScores(GAME_CONFIG);
  for (const id of ["easy", "normal", "hard"]) {
    assert.ok(scores[id].total > 0, id);
    assert.ok(scores[id].total <= 20000, `${id} ${scores[id].total}`);
    assert.equal(scores[id].rounds.length, 3);
  }
  assert.deepEqual({
    easy: scores.easy.total,
    normal: scores.normal.total,
    hard: scores.hard.total,
  }, { easy: 3410, normal: 3275, hard: 3255 });
});
