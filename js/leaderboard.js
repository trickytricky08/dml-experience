/**
 * Global Top 10. Reads and submits with fetch; the game keeps working if this is down.
 */

import { GAME_CONFIG } from "./config.js";
import { ingredientCeiling } from "./menu.js";
import { scoreCompletedEntree, scoreRoundBonuses } from "./scoring.js";

const NAME_PATTERN = /^[A-Za-z0-9 _.-]{1,12}$/;

export function validatePlayerName(value) {
  const name = String(value ?? "");
  if (!NAME_PATTERN.test(name)) {
    return { ok: false, name, error: "invalid_name" };
  }
  return { ok: true, name, error: "" };
}

export function leaderboardErrorText(code) {
  if (code === "blocked_name") return "Pick a different name.";
  if (code === "invalid_name") return "Letters, numbers, spaces, _ . - only.";
  return "Couldn't save that score.";
}

export function samePlayerName(a, b) {
  return String(a || "").trim().toLowerCase() === String(b || "").trim().toLowerCase();
}

export function formatBoardDate(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function maxTicketScoops(round, config = GAME_CONFIG) {
  let best = 0;
  for (const type of round.entreeTypes) {
    const ceiling = ingredientCeiling(type, { veggie: false, skipRice: false, skipBeans: false }, config);
    if (ceiling > best) best = ceiling;
  }
  return Math.min(round.maxScoops, best);
}

/** Instant clears, fattest legal tickets, perfect accuracy, and the full clock left over. */
export function maxAchievableScores(config = GAME_CONFIG) {
  const scoring = config.scoring;
  const result = {};
  for (const [id, difficulty] of Object.entries(config.difficulties)) {
    let total = 0;
    const rounds = [];
    for (const round of difficulty.rounds) {
      const scoops = maxTicketScoops(round, config);
      const entree = scoreCompletedEntree(scoops, 0, scoring).total;
      const entrees = round.targetEntrees * entree;
      const bonuses = scoreRoundBonuses({
        mistakes: 0,
        correct: 1,
        quotaHit: true,
        leftoverMs: round.durationMs,
        scoring,
      });
      const roundTotal = entrees + bonuses.total;
      total += roundTotal;
      rounds.push({
        id: round.id,
        scoops,
        entree,
        entrees,
        perfect: bonuses.perfect,
        leftover: bonuses.leftover,
        total: roundTotal,
      });
    }
    result[id] = { total, rounds };
  }
  return result;
}

function apiHeaders(config, extra = {}) {
  const key = config.leaderboard.key;
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
    ...extra,
  };
}

export async function fetchTop10(difficulty, { config = GAME_CONFIG, fetchImpl = fetch } = {}) {
  if (!config.leaderboard?.enabled) return { ok: false, error: "disabled", rows: [] };
  const url = `${config.leaderboard.url}/rest/v1/leaderboard_top10?difficulty=eq.${encodeURIComponent(difficulty)}&order=rank.asc`;
  try {
    const response = await fetchImpl(url, { headers: apiHeaders(config) });
    if (!response.ok) return { ok: false, error: "unavailable", rows: [] };
    const rows = await response.json();
    return { ok: true, error: "", rows: Array.isArray(rows) ? rows.slice(0, 10) : [] };
  } catch {
    return { ok: false, error: "unavailable", rows: [] };
  }
}

export async function submitScore(payload, { config = GAME_CONFIG, fetchImpl = fetch } = {}) {
  const nameCheck = validatePlayerName(payload.p_name);
  if (!nameCheck.ok) return { ok: false, error: nameCheck.error };
  if (!config.leaderboard?.enabled) return { ok: false, error: "disabled" };
  const score = Math.round(Number(payload.p_score));
  const entrees = Math.round(Number(payload.p_entrees));
  if (!Number.isInteger(score) || score < 0 || score > 20000) return { ok: false, error: "invalid_score" };
  if (!["easy", "normal", "hard"].includes(payload.p_difficulty)) return { ok: false, error: "invalid_difficulty" };
  try {
    const response = await fetchImpl(`${config.leaderboard.url}/rest/v1/rpc/submit_score`, {
      method: "POST",
      headers: apiHeaders(config, { "Content-Type": "application/json" }),
      body: JSON.stringify({
        p_name: nameCheck.name,
        p_difficulty: payload.p_difficulty,
        p_score: score,
        p_entrees: entrees,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.message || body?.error || "unavailable";
      return { ok: false, error: message };
    }
    const row = Array.isArray(body) ? body[0] : body;
    if (!row || typeof row.rank !== "number") return { ok: false, error: "unavailable" };
    return {
      ok: true,
      error: "",
      rank: row.rank,
      bestScore: row.best_score,
      improved: !!row.improved,
    };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}
