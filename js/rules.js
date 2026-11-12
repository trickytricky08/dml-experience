/**
 * Ticket rules. Packaging opens the entrée. Wrap seals it.
 * Easy / Normal: any remaining ticket ingredient, once.
 * Hard: ticket order. A mistake locks the line until Trash.
 */

import { playerIngredients } from "./tickets.js";

const PACK_IDS = new Set(["foil", "bowl", "container"]);

export function createPlay(ticket, { strictOrder = false } = {}) {
  return {
    ticket,
    strictOrder: !!strictOrder,
    phase: "await-open",
    opened: false,
    scooped: [],
    correct: 0,
    mistakes: 0,
    lastMistake: null,
  };
}

export function applyInput(play, panId) {
  if (play.phase === "closed") return { play, event: { type: "ignored" } };

  if (play.phase === "locked") {
    if (panId !== "trash") return { play, event: { type: "ignored", reason: "locked" } };
    return { play: resetPlay(play), event: { type: "trash", voluntary: false } };
  }

  if (panId === "trash") {
    return { play: resetPlay(play), event: { type: "trash", voluntary: true } };
  }

  const packId = play.ticket.packaging.id;
  const ingredients = playerIngredients(play.ticket);

  if (panId === "wrap") {
    if (!play.opened) return mistake(play, "wrap-before-packaging", panId);
    if (play.scooped.length < ingredients.length) return mistake(play, "early-wrap", panId);
    return {
      play: { ...play, phase: "closed", correct: play.correct + 1 },
      event: { type: "correct", kind: "wrap", id: "wrap" },
    };
  }

  if (play.phase === "await-open") {
    if (PACK_IDS.has(panId)) {
      if (panId !== packId) return mistake(play, "wrong-packaging", panId);
      return {
        play: { ...play, phase: "building", opened: true, correct: play.correct + 1 },
        event: { type: "correct", kind: "open", id: packId },
      };
    }
    return mistake(play, "ingredient-before-packaging", panId);
  }

  if (PACK_IDS.has(panId)) {
    if (panId !== packId) return mistake(play, "wrong-packaging", panId);
    return mistake(play, "duplicate", panId);
  }

  const step = ingredients.find((item) => item.pan === panId);
  if (!step) return mistake(play, "off-ticket", panId);
  if (play.scooped.includes(step.id)) return mistake(play, "duplicate", panId);

  if (play.strictOrder) {
    const next = ingredients[play.scooped.length];
    if (!next || step.id !== next.id) return mistake(play, "out-of-order", panId);
  }

  return {
    play: {
      ...play,
      scooped: [...play.scooped, step.id],
      correct: play.correct + 1,
    },
    event: { type: "correct", kind: "scoop", id: step.id },
  };
}

function mistake(play, kind, panId) {
  return {
    play: {
      ...play,
      phase: "locked",
      mistakes: play.mistakes + 1,
      lastMistake: { kind, panId },
    },
    event: { type: "mistake", kind, panId },
  };
}

function resetPlay(play) {
  return {
    ...play,
    phase: "await-open",
    opened: false,
    scooped: [],
    lastMistake: null,
  };
}
