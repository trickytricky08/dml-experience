import { GAME_CONFIG, KEY_MAP, keyCap } from "./config.js";
import { resolveSeed } from "./rng.js";
import { itemGroup, pansInRow } from "./menu.js";
import { createRunDeal, parScoopCount, playerIngredients, takeRound } from "./tickets.js";
import { applyInput, createPlay } from "./rules.js";
import { accuracyRatio, scoreCompletedEntree, scoreRoundBonuses } from "./scoring.js";
import { formatClock, formatInt, formatLockout, formatPct } from "./format.js";
import { buildHint, dealNote, nextRoundNote, shareText } from "./copy.js";

const params = typeof location !== "undefined" ? new URLSearchParams(location.search) : new URLSearchParams();
const requestedDifficulty = params.get("difficulty");

const ui = {
  screen: "title",
  difficultyId: GAME_CONFIG.difficulties[requestedDifficulty]
    ? requestedDifficulty
    : GAME_CONFIG.defaultDifficulty,
  urlSeed: params.has("seed") ? params.get("seed") : undefined,
  best: null,
  run: null,
  round: null,
  shareStatus: "",
  lastFrame: 0,
};

function boot() {
  ui.best = loadBest();
  document.addEventListener("click", onClick);
  window.addEventListener("keydown", onKey, true);
  render();
  requestAnimationFrame(frame);
}

function frame(now) {
  if (!ui.lastFrame) ui.lastFrame = now;
  const dt = Math.min(250, now - ui.lastFrame);
  ui.lastFrame = now;
  if (ui.screen === "playing" && ui.round && !ui.round.ended) {
    ui.round.remainingMs -= dt;
    if (ui.round.remainingMs <= 0) {
      ui.round.remainingMs = 0;
      finishRound("timeout");
    } else {
      if (ui.round.mode === "lockout") {
        ui.round.lockoutMs -= dt;
        if (ui.round.lockoutMs <= 0) endLockout();
      }
      paintClock();
    }
  }
  requestAnimationFrame(frame);
}

function onClick(event) {
  const pan = event.target.closest("[data-pan]");
  if (pan) {
    onAction(pan.dataset.pan);
    return;
  }
  const control = event.target.closest("[data-action]");
  if (!control) return;
  const action = control.dataset.action;
  if (action === "difficulty") {
    ui.difficultyId = control.dataset.difficulty;
    render();
  } else if (action === "play" || action === "again") {
    startRun();
  } else if (action === "continue") {
    continueRun();
  } else if (action === "title") {
    showTitle();
  } else if (action === "share") {
    shareRun();
  }
}

function onKey(event) {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  if (event.key === "Backspace") event.preventDefault();
  const key = event.key.toLowerCase();
  if (key.length === 1 || key === "backspace" || key.startsWith("arrow")) {
    document.documentElement.classList.add("has-keyboard");
  }
  if (ui.screen === "playing") {
    if (event.key === " ") event.preventDefault();
    if (event.repeat) return;
    const pan = KEY_MAP[key];
    if (!pan) return;
    event.preventDefault();
    event.stopPropagation();
    onAction(pan);
    return;
  }
  if (event.repeat) return;
  if (key === "enter") {
    event.preventDefault();
    event.stopPropagation();
    if (ui.screen === "title") startRun();
    else if (ui.screen === "roundEnd") continueRun();
    else if (ui.screen === "gameover") startRun();
  } else if (ui.screen === "title" && (key === "arrowleft" || key === "arrowright")) {
    event.preventDefault();
    const order = ["easy", "normal", "hard"];
    const index = order.indexOf(ui.difficultyId);
    const step = key === "arrowright" ? 1 : -1;
    ui.difficultyId = order[(index + step + order.length) % order.length];
    render();
  }
}

function startRun() {
  const seed = resolveSeed(GAME_CONFIG, ui.urlSeed);
  ui.run = {
    ...createRunDeal(seed, ui.difficultyId),
    roundIndex: 0,
    totalScore: 0,
    totalCompleted: 0,
    totalTarget: GAME_CONFIG.difficulties[ui.difficultyId].rounds.reduce((sum, round) => sum + round.targetEntrees, 0),
    correct: 0,
    mistakes: 0,
  };
  ui.shareStatus = "";
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  beginRound();
}

function beginRound() {
  const { round, tickets } = takeRound(ui.run, ui.run.roundIndex);
  ui.round = {
    def: round,
    tickets,
    index: 0,
    completed: 0,
    correct: 0,
    mistakes: 0,
    score: 0,
    remainingMs: round.durationMs,
    mode: "play",
    play: createPlay(tickets[0], { strictOrder: ui.run.difficulty.strictOrder }),
    ticketStartedAt: performance.now(),
    lockoutMs: 0,
    ended: false,
    endReason: null,
    bonuses: { perfect: 0, leftover: 0, total: 0 },
  };
  ui.screen = "playing";
  render();
}

function onAction(panId) {
  if (ui.screen !== "playing" || !ui.round || ui.round.ended) return;
  if (ui.round.mode === "lockout") return;
  const round = ui.round;
  const result = applyInput(round.play, panId);
  round.play = result.play;
  const event = result.event;
  if (event.type === "ignored") return;
  if (event.type === "correct") {
    round.correct += 1;
    ui.run.correct += 1;
    if (event.kind === "close") {
      completeTicket();
      return;
    }
  } else if (event.type === "mistake") {
    round.mistakes += 1;
    ui.run.mistakes += 1;
    round.mode = "mistake";
  } else if (event.type === "trash") {
    startLockout();
    return;
  }
  render();
}

function completeTicket() {
  const round = ui.round;
  const ticket = round.tickets[round.index];
  const scored = scoreCompletedEntree(
    parScoopCount(ticket),
    performance.now() - round.ticketStartedAt,
    GAME_CONFIG.scoring,
  );
  round.score += scored.total;
  ui.run.totalScore += scored.total;
  round.completed += 1;
  ui.run.totalCompleted += 1;
  if (round.completed >= round.tickets.length) {
    finishRound("quota");
    return;
  }
  round.index += 1;
  round.mode = "play";
  round.play = createPlay(round.tickets[round.index], { strictOrder: ui.run.difficulty.strictOrder });
  round.ticketStartedAt = performance.now();
  render();
}

function startLockout() {
  const round = ui.round;
  round.mode = "lockout";
  round.lockoutMs = ui.run.difficulty.trashLockoutMs;
  round.play = createPlay(round.tickets[round.index], { strictOrder: ui.run.difficulty.strictOrder });
  render();
}

function endLockout() {
  const round = ui.round;
  if (!round || round.mode !== "lockout" || round.ended) return;
  round.mode = "play";
  round.lockoutMs = 0;
  round.ticketStartedAt = performance.now();
  render();
}

function finishRound(reason) {
  const round = ui.round;
  if (!round || round.ended) return;
  round.ended = true;
  round.endReason = reason;
  round.remainingMs = Math.max(0, round.remainingMs);
  const bonuses = scoreRoundBonuses({
    mistakes: round.mistakes,
    quotaHit: reason === "quota",
    leftoverMs: round.remainingMs,
    scoring: GAME_CONFIG.scoring,
  });
  round.bonuses = bonuses;
  round.score += bonuses.total;
  ui.run.totalScore += bonuses.total;
  ui.screen = "roundEnd";
  render();
}

function continueRun() {
  if (ui.screen !== "roundEnd") return;
  const next = ui.run.roundIndex + 1;
  if (next >= ui.run.difficulty.rounds.length) {
    endGame();
    return;
  }
  ui.run.roundIndex = next;
  beginRound();
}

function endGame() {
  const run = ui.run;
  const ratio = accuracyRatio(run.correct, run.mistakes);
  const prev = loadBest();
  const record = {
    score: run.totalScore,
    completed: run.totalCompleted,
    target: run.totalTarget,
    accuracy: ratio,
  };
  run.accuracy = ratio;
  run.isNewBest = !prev || record.score > prev.score;
  if (run.isNewBest) saveBest(record);
  run.best = run.isNewBest ? record : prev;
  ui.best = loadBest();
  ui.screen = "gameover";
  render();
}

function showTitle() {
  ui.screen = "title";
  ui.best = loadBest();
  ui.shareStatus = "";
  render();
}

async function shareRun() {
  const text = currentShareText();
  try {
    await navigator.clipboard.writeText(text);
    ui.shareStatus = "Copied";
  } catch {
    ui.shareStatus = text;
  }
  render();
}

function currentShareText() {
  return shareText({
    completed: ui.run.totalCompleted,
    target: ui.run.totalTarget,
    accuracyPct: Math.round(ui.run.accuracy * 100),
  });
}

function paintClock() {
  const el = document.getElementById("time-val");
  if (!el || !ui.round) return;
  el.textContent = formatClock(ui.round.remainingMs);
  el.classList.toggle("is-low", ui.round.remainingMs <= 10000 && ui.round.remainingMs > 0);
}

function render() {
  document.documentElement.dataset.screen = ui.screen;
  document.documentElement.dataset.mode = ui.screen === "playing" && ui.round ? ui.round.mode : "";
  const app = document.getElementById("app");
  if (!app) return;
  if (ui.screen === "title") app.innerHTML = renderTitle();
  else if (ui.screen === "playing") app.innerHTML = renderPlay();
  else if (ui.screen === "roundEnd") app.innerHTML = renderRound();
  else app.innerHTML = renderOver();
  if (ui.screen === "playing") requestAnimationFrame(() => scrollLine(ui.round));
}

function renderTitle() {
  const diffs = ["easy", "normal", "hard"].map((id) => {
    const on = id === ui.difficultyId;
    return `<button type="button" class="diff${on ? " is-on" : ""}" data-action="difficulty" data-difficulty="${id}" aria-pressed="${on}">${GAME_CONFIG.difficulties[id].label}</button>`;
  }).join("");
  return `<section class="screen screen-title" data-screen="title">
    <div class="awning" aria-hidden="true"></div>
    <div class="shop-sign">Neighborhood burrito shop</div>
    <div class="title-core">
      <div class="mascot">${mascotSvg()}</div>
      <h1 class="wordmark"><span class="the">The</span>DML Experience</h1>
      <div class="badge">${esc(GAME_CONFIG.modeLabel)}</div>
      <p class="tagline">${esc(GAME_CONFIG.tagline)}</p>
      <div class="diff-pick" role="group" aria-label="Difficulty">${diffs}</div>
      <div class="title-actions">
        <button class="btn" type="button" data-action="play">Play</button>
        <p class="best-line" id="best-line">${bestMarkup(ui.best)}</p>
      </div>
    </div>
  </section>`;
}

function renderPlay() {
  const round = ui.round;
  const run = ui.run;
  const ticket = round.tickets[round.index];
  const upcoming = round.tickets[round.index + 1] || null;
  const play = round.play;
  const wrong = round.mode === "mistake" ? play.lastMistake?.panId : "";
  const cost = formatLockout(run.difficulty.trashLockoutMs);
  const accuracy = formatPct(accuracyRatio(run.correct, run.mistakes));
  return `<section class="screen screen-play" data-screen="play">
    <header class="hud">
      <div class="brand">${esc(GAME_CONFIG.title)} <small>${esc(GAME_CONFIG.modeLabel)}</small></div>
      <div class="hud-stats">
        <div class="stat"><span class="k">Accuracy</span><span class="v" id="accuracy-val">${accuracy}</span></div>
        <div class="stat"><span class="k">Round</span><span class="v">${run.roundIndex + 1} / ${run.difficulty.rounds.length}</span></div>
      </div>
      <div class="goal"><span class="k">Entrées</span><span class="v" id="quota-val">${round.completed} <em>of</em> ${round.tickets.length}</span></div>
      <div class="timer"><span class="k">Time</span><span class="v${round.remainingMs <= 10000 ? " is-low" : ""}" id="time-val">${formatClock(round.remainingMs)}</span></div>
    </header>
    <div class="stage">
      <div class="tickets">
        ${ticketCard(ticket, play, true)}
        ${upcoming ? ticketCard(upcoming, null, false) : emptyNext()}
      </div>
      <p class="deal-note">${esc(dealNote(run.difficulty, round.def))}</p>
      <div class="build-card">
        <h3>${esc(ticket.buildLabel)}</h3>
        <div class="surface ${esc(ticket.surface)}">${round.mode === "lockout" ? "" : pills(play)}</div>
        <p class="build-hint">${esc(buildHint(run.difficulty.strictOrder, run.difficulty.trashLockoutMs))}</p>
        <p id="mistake-callout" class="banner bad" role="alert"${round.mode === "mistake" ? "" : " hidden"}>Mistake, hit Trash</p>
        <p id="lockout-note" class="banner wait"${round.mode === "lockout" ? "" : " hidden"}>Starting this ticket over</p>
      </div>
    </div>
    ${renderLine(wrong, play, cost)}
  </section>`;
}

function renderRound() {
  const round = ui.round;
  const run = ui.run;
  const secs = Math.floor(round.remainingMs / 1000);
  let sub = `Time's up. You packed ${round.completed} of ${round.tickets.length} tickets.`;
  if (round.endReason === "quota") {
    sub = secs > 0
      ? `Quota met with ${secs}s left. You packed ${round.completed} of ${round.tickets.length} tickets.`
      : `Quota met. You packed ${round.completed} of ${round.tickets.length} tickets.`;
  }
  const accuracy = formatPct(accuracyRatio(round.correct, round.mistakes));
  return `<section class="screen overlay" data-screen="round">
    <div class="panel">
      <span class="badge">Round ${run.roundIndex + 1} of ${run.difficulty.rounds.length}</span>
      <h1>Round in the books.</h1>
      <p class="sub">${esc(sub)}</p>
      <div class="stats-grid">
        <div class="stat-tile hero"><div class="k">Entrées completed</div><div class="v">${round.completed} <small>of ${round.tickets.length}</small></div></div>
        <div class="stat-tile"><div class="k">Accuracy</div><div class="v">${accuracy}</div></div>
        <div class="stat-tile"><div class="k">Round score</div><div class="v" id="round-score">${formatInt(round.score)}</div></div>
      </div>
      <p class="run-line">Run total <strong>${formatInt(run.totalScore)}</strong> · ${bestMarkup(ui.best)}</p>
      <div class="ramp-note">${esc(nextRoundNote(run.difficulty.rounds, run.roundIndex))}</div>
      <div class="panel-actions"><button class="btn" type="button" data-action="continue">Continue</button></div>
    </div>
  </section>`;
}

function renderOver() {
  const run = ui.run;
  const accuracy = formatPct(run.accuracy);
  const bestLine = run.isNewBest
    ? `<p class="run-line new-best">New best · <strong>${formatInt(run.totalScore)}</strong></p>`
    : `<p class="run-line">Best <strong>${formatInt(run.best?.score ?? run.totalScore)}</strong></p>`;
  const status = ui.shareStatus
    ? `<p class="share-status">${esc(ui.shareStatus)}</p>`
    : "";
  return `<section class="screen overlay" data-screen="gameover">
    <div class="panel">
      <span class="badge">${esc(GAME_CONFIG.modeLabel)}</span>
      <h1>Lunch rush over.</h1>
      <div class="stats-grid">
        <div class="stat-tile hero"><div class="k">Entrées completed</div><div class="v" id="final-count">${run.totalCompleted} <small>of ${run.totalTarget}</small></div></div>
        <div class="stat-tile"><div class="k">Accuracy</div><div class="v" id="final-accuracy">${accuracy}</div></div>
        <div class="stat-tile"><div class="k">Score</div><div class="v" id="final-score">${formatInt(run.totalScore)}</div></div>
      </div>
      ${bestLine}
      <div class="panel-actions">
        <button class="btn" type="button" data-action="again">Play again</button>
        <button class="btn ghost" type="button" data-action="share" data-share="${esc(currentShareText())}">Share</button>
      </div>
      ${status}
      <p class="seed-line">Seed ${run.seed}</p>
      <button class="text-link" type="button" data-action="title">Title</button>
    </div>
  </section>`;
}

function ticketCard(ticket, play, current) {
  const chips = ticket.scoops.map((step) => {
    const state = current ? chipState(step, play) : "";
    const classes = ["chip"];
    if (step.role === "open" || step.role === "close") classes.push("pack");
    if (step.role === "close") classes.push("finish");
    if (state) classes.push(state);
    return `<span class="${classes.join(" ")}" data-id="${esc(step.id)}" data-pan="${esc(step.pan)}" data-key="${esc(step.key || "")}" data-role="${esc(step.role || "")}">${esc(step.label)}</span>`;
  }).join("");
  const who = current ? "Now serving" : "Up next";
  const peek = [ticket.packaging.label, ...playerIngredients(ticket).slice(0, 5).map((step) => step.label), `Close ${ticket.packaging.label}`].join(" · ");
  return `<article class="ticket ${current ? "current" : "next"}">
    <h2 class="entree">${esc(ticket.entreeLabel)}</h2>
    <div class="who"><span class="guest">${esc(ticket.guest)}</span><span class="num">${who}</span></div>
    <div class="chips">${chips}</div>
    <p class="peek">${esc(peek)}</p>
  </article>`;
}

function emptyNext() {
  return `<article class="ticket next">
    <h2 class="entree">Last ticket</h2>
    <div class="who"><span class="guest">Nobody waiting</span><span class="num">Up next</span></div>
    <p class="peek">Finish this one to clear the round.</p>
  </article>`;
}

function chipState(step, play) {
  const ingredients = playerIngredients(play.ticket);
  const strict = play.strictOrder && (play.phase === "await-open" || play.phase === "building");
  if (step.role === "open") {
    if (play.opened) return "done";
    return strict ? "now" : "";
  }
  if (step.role === "close") {
    if (play.phase === "closed") return "done";
    if (strict && play.opened && play.scooped.length === ingredients.length) return "now";
    return "";
  }
  if (play.scooped.includes(step.id)) return "done";
  if (strict && play.opened && ingredients[play.scooped.length]?.id === step.id) return "now";
  return "";
}

function pills(play) {
  if (!play.opened) {
    return `<span class="scoop ghost">${esc(play.ticket.packaging.label)}?</span>`;
  }
  const parts = [`<span class="scoop pack">${esc(play.ticket.packaging.label)}</span>`];
  for (const auto of play.ticket.autoScoops || []) {
    parts.push(`<span class="scoop builtin" title="Already included">${esc(auto.label)}</span>`);
  }
  const byId = new Map(playerIngredients(play.ticket).map((step) => [step.id, step]));
  for (const id of play.scooped) {
    const step = byId.get(id);
    parts.push(`<span class="scoop ${itemGroup(id)}">${esc(step?.label || id)}</span>`);
  }
  if (play.phase === "building") {
    const next = playerIngredients(play.ticket).find((step) => !play.scooped.includes(step.id));
    const label = next ? `${next.label}?` : `Close ${play.ticket.packaging.label}?`;
    parts.push(`<span class="scoop ghost">${esc(label)}</span>`);
  }
  return parts.join("");
}

function renderLine(wrongId, play, cost) {
  const packButtons = (extraClass) => ["foil", "bowl", "container"].map((id) => {
    const label = id === "foil" ? "Foil" : id === "bowl" ? "Bowl" : "Container";
    const kind = id === "container" ? "box" : id;
    const classes = ["pack-btn", kind];
    if (id === wrongId) classes.push("is-wrong");
    if (play.opened && play.ticket.packaging.id === id) classes.push("is-open");
    return `<button type="button" class="${classes.join(" ")} ${extraClass}" data-pan="${id}" aria-label="${label} (${keyCap(id)})"><span class="key">${keyCap(id)}</span><span class="lbl">${label}</span></button>`;
  }).join("");
  const shellButtons = pansInRow("shell", GAME_CONFIG).map((item) => {
    const classes = ["shell-btn"];
    if (item.id === wrongId) classes.push("is-wrong");
    return `<button type="button" class="${classes.join(" ")}" data-pan="${item.id}" aria-label="${esc(item.panLabel)} (${keyCap(item.id)})"><span class="key">${keyCap(item.id)}</span><span class="lbl">${esc(item.panLabel)}</span></button>`;
  }).join("");
  const row = (name) => pansInRow(name, GAME_CONFIG).map((item) => {
    const classes = ["pan"];
    if (item.id === wrongId) classes.push("is-wrong");
    const lto = item.lto ? `<span class="lto">LTO</span>` : "";
    return `<button type="button" class="${classes.join(" ")}" data-pan="${item.id}" aria-label="${esc(item.panLabel)} (${keyCap(item.id)})"><span class="key">${keyCap(item.id)}</span>${lto}<span class="food ${item.food}"></span><span class="lbl">${esc(item.panLabel)}</span></button>`;
  }).join("");
  const trashClass = "trash-bin";
  return `<div class="line-wrap">
    <div class="line">
      <div class="glass" aria-hidden="true"></div>
      <div class="phone-base-bar" aria-label="Packaging">${packButtons("")}</div>
      <div class="phone-shell-bar" aria-label="Shells">${shellButtons}</div>
      <div class="pack-col" aria-label="Packaging">${packButtons("")}</div>
      <div class="shells" aria-label="Shells"><div class="station">Shells</div>${shellButtons}</div>
      <div class="wells-clip">
        <div class="wells">
          <div class="row hot">${row("hot")}</div>
          <div class="row cold">${row("cold")}</div>
        </div>
        <div class="line-fade" aria-hidden="true"></div>
      </div>
      <button type="button" class="${trashClass}" data-pan="trash" aria-label="Trash, ${cost}">
        <span class="key">${keyCap("trash")}</span>
        <svg viewBox="0 0 32 32" aria-hidden="true"><path d="M7 12h18M13 8h6v3H13z" fill="none" stroke="#F3E6D0" stroke-width="2" stroke-linecap="round"/><rect x="9" y="12" width="14" height="14" rx="2" fill="none" stroke="#F3E6D0" stroke-width="2"/><path d="M13 16v7M19 16v7" stroke="#F3E6D0" stroke-width="2" stroke-linecap="round"/></svg>
        <span class="lbl">Trash</span>
        <span class="sub">${cost}</span>
      </button>
    </div>
    <div class="phone-actions">
      <button type="button" class="phone-trash" data-pan="trash">Trash <span class="cost">costs ${cost} · restarts this ticket</span></button>
    </div>
  </div>`;
}

function scrollLine(round) {
  if (!round) return;
  const wells = document.querySelector(".wells");
  if (!wells || wells.scrollWidth <= wells.clientWidth + 8) return;
  const next = playerIngredients(round.play.ticket).find((step) => !round.play.scooped.includes(step.id));
  if (!next) return;
  const el = wells.querySelector(`[data-pan="${next.pan}"]`);
  if (!el) return;
  const parent = wells.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  const delta = box.left - parent.left - (wells.clientWidth - box.width) / 2;
  wells.scrollLeft += delta;
}

function bestMarkup(best) {
  if (!best || typeof best.score !== "number") return "Best <strong>—</strong>";
  const score = formatInt(best.score);
  if (typeof best.completed === "number" && typeof best.target === "number") {
    return `Best <strong>${score}</strong> · ${best.completed} of ${best.target} entrées`;
  }
  return `Best <strong>${score}</strong>`;
}

function loadBest() {
  try {
    const raw = localStorage.getItem(GAME_CONFIG.storageBestKey);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.score !== "number") return null;
    return data;
  } catch {
    return null;
  }
}

function saveBest(record) {
  try {
    localStorage.setItem(GAME_CONFIG.storageBestKey, JSON.stringify(record));
  } catch {
    /* private mode */
  }
}

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function mascotSvg() {
  return `<svg viewBox="0 0 180 180" role="img" aria-label="Shop mascot">
    <ellipse cx="90" cy="168" rx="48" ry="8" fill="rgba(44,24,16,0.18)"/>
    <rect x="42" y="38" width="96" height="122" rx="48" fill="#C9A056"/>
    <rect x="48" y="44" width="84" height="110" rx="42" fill="#E2C278"/>
    <path d="M60 58c12 10 48 10 60 0" fill="none" stroke="#C9A056" stroke-width="3" stroke-linecap="round"/>
    <path d="M58 78c14 9 50 9 64 0" fill="none" stroke="#C9A056" stroke-width="3" stroke-linecap="round"/>
    <path d="M58 98c14 9 50 9 64 0" fill="none" stroke="#C9A056" stroke-width="3" stroke-linecap="round"/>
    <rect x="40" y="28" width="100" height="26" rx="8" fill="#7A1F2B"/>
    <rect x="40" y="36" width="100" height="10" fill="#5C161F"/>
    <circle cx="70" cy="28" r="7" fill="#C4A35A"/>
    <circle cx="110" cy="28" r="7" fill="#C4A35A"/>
    <circle cx="68" cy="88" r="7.5" fill="#2C1810"/>
    <circle cx="112" cy="88" r="7.5" fill="#2C1810"/>
    <circle cx="70.5" cy="86" r="2.4" fill="#F6EDE0"/>
    <circle cx="114.5" cy="86" r="2.4" fill="#F6EDE0"/>
    <ellipse cx="66" cy="98" rx="7" ry="4" fill="#C45C4A" opacity="0.55"/>
    <ellipse cx="114" cy="98" rx="7" ry="4" fill="#C45C4A" opacity="0.55"/>
    <path d="M80 108c6 8 14 8 20 0" fill="none" stroke="#2C1810" stroke-width="3.5" stroke-linecap="round"/>
    <path d="M86 48c6-18 10-28 10-38" fill="none" stroke="#5A8F3C" stroke-width="4" stroke-linecap="round"/>
    <circle cx="96" cy="10" r="5" fill="#7A1F2B"/>
  </svg>`;
}

if (typeof document !== "undefined") boot();
