/** Point rules. Packaging open/close and built-in scoops are not part of scoopCount. */

export function parMsFor(scoopCount, scoring) {
  return scoring.parBaseMs + scoring.parMsPerScoop * scoopCount;
}

export function scoreCompletedEntree(scoopCount, elapsedMs, scoring) {
  const parMs = parMsFor(scoopCount, scoring);
  const speed = fullSecondsUnder(parMs - elapsedMs) * scoring.speedBonusPerSecUnderPar;
  return {
    parMs,
    base: scoring.perEntree,
    speed,
    total: scoring.perEntree + speed,
  };
}

export function scoreRoundBonuses({ mistakes, correct = 0, quotaHit, leftoverMs, scoring }) {
  const perfect = mistakes === 0 && correct > 0 ? scoring.accuracyPerfectBonus : 0;
  const leftover = quotaHit ? fullSecondsUnder(leftoverMs) * scoring.leftoverSecBonus : 0;
  return { perfect, leftover, total: perfect + leftover };
}

export function accuracyRatio(correct, mistakes) {
  const denom = correct + mistakes;
  if (denom <= 0) return 1;
  return correct / denom;
}

function fullSecondsUnder(ms) {
  if (ms <= 0) return 0;
  return Math.floor(ms / 1000);
}
