/** Player-facing sentences derived from the active round, not hard-coded per screen. */

const JOIN_WORD = {
  burrito: "burritos",
  bowl: "burrito bowls",
  salad: "salads",
  tacos: "tacos",
  quesadilla: "quesadillas",
};

function joinList(items) {
  if (items.length <= 1) return items[0] || "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

export function dealNote(difficulty, round) {
  return `Random deal · ${difficulty.label} · ${round.label} — tickets dealt from the same constraints. A new deal every run.`;
}

export function nextRoundNote(rounds, index) {
  const next = rounds[index + 1];
  if (!next) return "That was the last round.";
  const prev = rounds[index];
  const added = next.entreeTypes
    .filter((type) => !prev.entreeTypes.includes(type))
    .map((type) => JOIN_WORD[type] || type);
  const secs = Math.round(next.durationMs / 1000);
  let extra = "";
  if (added.length) {
    extra = ` — ${joinList(added)} join`;
    if (next.maxScoops > prev.maxScoops) extra += ", and toppings get heavier";
  } else if (next.maxScoops > prev.maxScoops) {
    extra = " — toppings get heavier";
  }
  return `${next.label}: ${next.targetEntrees} tickets in ${secs}s${extra}.`;
}

export function buildHint(strictOrder, penaltyMs) {
  const cost = (penaltyMs / 1000).toFixed(1);
  if (strictOrder) {
    return `Ingredients in ticket order. Wrong scoop, wrong packaging, out of order, or wrapping early drops ${cost}s. Hit Trash and start this ticket over.`;
  }
  return `Ingredients in any order (must be on the ticket). Wrong scoop, wrong packaging, or wrapping early drops ${cost}s. Hit Trash and start this ticket over.`;
}

export function shareText({ completed, target, accuracyPct }) {
  return `I finished ${completed} of ${target} entrees (${accuracyPct}% accuracy) in Line Rush at The DML Experience!`;
}
