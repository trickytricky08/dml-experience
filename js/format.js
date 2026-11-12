/** Clock and point formatting shared by the HUD and the scoring tests. */

export function fullSeconds(ms) {
  return Math.floor(Math.max(0, ms) / 1000);
}

/** Countdown seconds: the current second stays up until it has fully elapsed. */
export function countdownSeconds(ms) {
  if (ms <= 0) return 0;
  return Math.ceil(ms / 1000);
}

export function formatClock(ms) {
  const total = countdownSeconds(ms);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function formatInt(n) {
  return Math.round(n).toLocaleString("en-US");
}

export function formatPct(ratio) {
  return `${Math.round(ratio * 100)}%`;
}

export function formatPenalty(ms) {
  return `-${(ms / 1000).toFixed(1)}s`;
}
