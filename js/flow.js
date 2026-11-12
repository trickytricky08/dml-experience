/** Round advance and the Home confirm. Quit never writes a best. */

export function screenAfterRound(reason) {
  if (reason === "timeout") return "gameover";
  return "roundEnd";
}

export function homeChoice(choice) {
  if (choice === "quit") return { screen: "title", saveBest: false };
  return { screen: "playing", saveBest: false };
}

export function clockPaused(confirmOpen) {
  return !!confirmOpen;
}

/** Time lost when an action resolves. Trash never deducts; the mistake already did. */
export function clockDeltaForAction(eventType, { voluntary = false, penaltyMs = 0 } = {}) {
  if (eventType === "mistake") return penaltyMs;
  if (eventType === "trash") return voluntary ? 0 : 0;
  return 0;
}

/** Subtract a mistake penalty from the round clock. Zero ends the round. */
export function deductMistakeTime(remainingMs, penaltyMs) {
  const remaining = Math.max(0, remainingMs - penaltyMs);
  return { remainingMs: remaining, timedOut: remaining === 0 };
}
