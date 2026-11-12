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
