/** mulberry32 plus the seed rules from the config (fresh, fixed, or daily). */

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function freshSeed() {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  }
  return Math.floor(Math.random() * 0x100000000);
}

/**
 * @param {{ rng: { defaultSeed: number|string|null } }} config
 * @param {string|number|null|undefined} override URL or test override. Undefined uses config.
 * @param {Date} [now]
 */
export function resolveSeed(config, override, now = new Date()) {
  const raw = override !== undefined ? override : config.rng.defaultSeed;
  if (raw == null || raw === "") return freshSeed();
  if (raw === "daily") {
    const iso = now.toISOString().slice(0, 10);
    return hashString(`dml.lineRush.daily.${iso}`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return freshSeed();
  return n >>> 0;
}

export function shuffle(list, rng) {
  const arr = list.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
