import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SHOTS = "/tmp/dml-shots";
mkdirSync(SHOTS, { recursive: true });

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".woff2": "font/woff2",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith("/")) pathname += "index.html";
    const file = normalize(join(ROOT, pathname));
    if (!file.startsWith(ROOT)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[extname(file)] || "application/octet-stream" });
      res.end(body);
    } catch {
      res.writeHead(404);
      res.end("not found");
    }
  });
  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function readSteps(page) {
  return page.locator(".ticket.current .chip").evaluateAll((chips) => chips.map((chip) => ({
    key: chip.dataset.key,
    pan: chip.dataset.pan,
    role: chip.dataset.role || "",
    label: chip.textContent,
  })));
}

async function pressKey(page, key) {
  const name = key === "backspace" ? "Backspace" : key === "enter" ? "Enter" : key;
  await page.keyboard.press(name);
}

async function tapPan(page, pan) {
  const loc = page.locator(`[data-pan="${pan}"]:visible`).first();
  await loc.scrollIntoViewIfNeeded();
  await loc.click();
}

async function fit(page, label) {
  const result = await page.evaluate(() => {
    const de = document.documentElement;
    const vw = de.clientWidth;
    const vh = de.clientHeight;
    const offenders = [];
    const inWells = (el) => Boolean(el.closest(".wells"));
    for (const el of document.querySelectorAll("body *")) {
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) continue;
      if (inWells(el)) continue;
      if (rect.left < -2 || rect.top < -2 || rect.right > vw + 2 || rect.bottom > vh + 2) {
        offenders.push({
          tag: el.tagName,
          cls: String(el.className).slice(0, 70),
          x: Math.round(rect.left),
          y: Math.round(rect.top),
          r: Math.round(rect.right),
          b: Math.round(rect.bottom),
        });
      }
    }
    return {
      offenders: offenders.slice(0, 8),
      scrollX: de.scrollWidth - de.clientWidth,
      scrollY: de.scrollHeight - de.clientHeight,
      vw,
      vh,
    };
  });
  if (result.scrollX > 1 || result.scrollY > 1 || result.offenders.length) {
    throw new Error(`${label} overflow ${JSON.stringify(result)}`);
  }
}

async function inView(page, selector) {
  const box = await page.locator(selector).first().boundingBox();
  const vp = page.viewportSize();
  assert(box, `missing ${selector}`);
  assert(box.x >= -1 && box.y >= -1 && box.x + box.width <= vp.width + 1 && box.y + box.height <= vp.height + 1,
    `${selector} outside ${JSON.stringify(box)} vp ${vp.width}x${vp.height}`);
}

async function noBrand(page) {
  const text = await page.locator("body").innerText();
  assert(!/chipotle/i.test(text), "brand name rendered");
  assert(!/digital make line/i.test(text), "DML expanded");
  const media = await page.locator("audio, video").count();
  assert(media === 0, "game should stay silent");
}

async function playTicket(page, { reverse = false, tap = false } = {}) {
  const guest = await page.locator(".ticket.current .guest").innerText();
  const steps = await readSteps(page);
  assert(steps.length >= 3, "ticket has no steps");
  const mids = steps.slice(1, -1);
  const order = reverse ? [...mids].reverse() : mids;
  const sequence = [steps[0], ...order, steps[steps.length - 1]];
  for (const step of sequence) {
    if (tap) await tapPan(page, step.pan);
    else await pressKey(page, step.key);
  }
  await page.waitForFunction((previous) => {
    if (document.querySelector("section[data-screen='round']")) return true;
    if (document.querySelector("section[data-screen='gameover']")) return true;
    const now = document.querySelector(".ticket.current .guest");
    return now && now.textContent !== previous;
  }, guest, { timeout: 4000 });
}

async function finishRun(page, { tap = false } = {}) {
  let reverse = !tap;
  const notes = [];
  for (let guard = 0; guard < 14; guard++) {
    if (await page.locator("section[data-screen='gameover']").isVisible()) break;
    if (await page.locator("section[data-screen='round']").isVisible()) {
      notes.push(await page.locator(".ramp-note").innerText());
      if (notes.length === 1) await shot(page, `round-${page.viewportSize().width}`);
      await fit(page, "round end");
      await page.locator("[data-action='continue']").click();
      await page.waitForFunction(() => {
        const screen = document.querySelector("section[data-screen='play'], section[data-screen='gameover']");
        return Boolean(screen);
      });
      reverse = false;
      continue;
    }
    await playTicket(page, { reverse, tap });
    reverse = false;
  }
  assert(await page.locator("section[data-screen='gameover']").isVisible(), "run did not finish");
  return notes;
}

async function mistake(page, { tap = false, pan, key, kind, shotName }) {
  const done = await page.locator(".ticket.current .chip.done").count();
  if (tap) await tapPan(page, pan);
  else await pressKey(page, key);
  await page.locator("#mistake-callout").waitFor({ state: "visible" });
  const callout = (await page.locator("#mistake-callout").innerText()).trim();
  assert(callout === "Mistake, hit Trash", `${kind} callout was ${callout}`);
  const wrong = await page.locator(".is-wrong:visible").count();
  assert(wrong > 0, `${kind} did not flash a control`);
  if (shotName) await shot(page, shotName);
  if (tap) {
    const other = page.locator(".pan:visible").first();
    if (await other.count()) await other.click({ force: true }).catch(() => {});
  } else {
    await pressKey(page, "z");
  }
  assert(await page.locator(".ticket.current .chip.done").count() === done, `${kind} was not locked`);
  if (tap) await tapPan(page, "trash");
  else await pressKey(page, "backspace");
  await page.locator("#lockout-note").waitFor({ state: "visible" });
  await page.locator("#lockout-note").waitFor({ state: "hidden", timeout: 4500 });
  assert(await page.locator("#mistake-callout").isHidden(), `${kind} callout stuck`);
  assert(await page.locator(".ticket.current .chip.done").count() === 0, `${kind} did not restart`);
}

async function shot(page, name) {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

const server = await startServer();
const { port } = server.address();
const browser = await chromium.launch({
  channel: "chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const errors = [];

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await desktop.grantPermissions(["clipboard-read", "clipboard-write"]);
  const page = await desktop.newPage();
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });

  await page.goto(`http://127.0.0.1:${port}/`);
  await page.locator("section[data-screen='title']").waitFor();
  assert((await page.locator(".diff.is-on").innerText()) === "Normal", "default difficulty");
  const underPicker = await page.evaluate(() => {
    const pick = document.querySelector(".diff-pick");
    return pick?.nextElementSibling?.className || "";
  });
  assert(underPicker.includes("title-actions"), `unexpected node under picker: ${underPicker}`);
  await noBrand(page);
  await fit(page, "desktop title");
  await shot(page, "desktop-title");

  await page.goto(`http://127.0.0.1:${port}/?difficulty=easy`);
  await page.locator("[data-action='play']").click();
  await page.locator(".scoop.ghost").first().waitFor();
  assert((await page.locator(".scoop.ghost").count()) > 0, "easy should show the next hint");
  await page.goto(`http://127.0.0.1:${port}/?seed=1&difficulty=normal`);
  await page.locator("[data-action='play']").click();
  await page.locator("section[data-screen='play']").waitFor();
  assert((await page.locator(".scoop.ghost").count()) === 0, "normal should start with an empty build area");
  await fit(page, "desktop play");
  await inView(page, "#time-val");
  await inView(page, "#quota-val");
  await inView(page, "[data-pan='foil']:visible");
  await inView(page, "[data-pan='trash']:visible");
  await inView(page, "[data-pan='wrap']:visible");
  await inView(page, "[data-action='home']");
  await inView(page, "[data-pan='white-rice']:visible");
  await shot(page, "desktop-play");

  const notes = await finishRun(page, { tap: false });
  assert(notes.length === 3, `expected 3 round notes, got ${notes.join(" | ")}`);
  assert(notes[0].includes("tacos") && notes[0].includes("60s"), notes[0]);
  assert(notes[1].includes("salads and quesadillas") && notes[1].includes("70s"), notes[1]);
  assert(notes[2].includes("last round"), notes[2]);
  await fit(page, "desktop game over");
  await shot(page, "desktop-over");
  const count = await page.locator("#final-count").innerText();
  assert(count.replace(/\s+/g, " ").includes("8 of 8"), count);
  assert((await page.locator("#final-accuracy").innerText()) === "100%", "desktop accuracy");
  const score = Number((await page.locator("#final-score").innerText()).replace(/,/g, ""));
  assert(score >= 800, `score ${score}`);
  const share = await page.locator("[data-action='share']").getAttribute("data-share");
  assert(share === "I finished 8 of 8 entrees (100% accuracy) in Line Rush at The DML Experience!", share);
  await page.locator("[data-action='share']").click();
  await page.locator(".share-status").waitFor();

  await page.goto(`http://127.0.0.1:${port}/`);
  const best = await page.locator("#best-line").innerText();
  assert(best.includes(String(score)) || best.includes(score.toLocaleString("en-US")), `best line ${best}`);
  await desktop.close();

  const mistakes = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const desk = await mistakes.newPage();
  desk.on("pageerror", (err) => errors.push(`mistake ${err.message}`));
  await desk.goto(`http://127.0.0.1:${port}/?seed=7&difficulty=normal`);
  await desk.locator("[data-action='play']").click();
  await desk.locator("section[data-screen='play']").waitFor();
  const steps = await readSteps(desk);
  const openKey = steps[0].key;
  const wrongPack = ["1", "2", "3"].find((key) => key !== openKey);
  const used = new Set(steps.map((step) => step.key));
  const offKey = ["l", "k", "t", "g", "h"].find((key) => !used.has(key));
  assert(offKey, "could not find an off-ticket key");

  await mistake(desk, { key: "enter", kind: "wrap before packaging" });

  const clock = await desk.locator("#time-val").innerText();
  await mistake(desk, { key: steps[1].key, kind: "ingredient before packaging" });
  await desk.waitForFunction((prev) => document.querySelector("#time-val").textContent !== prev, clock, { timeout: 2500 });

  await mistake(desk, { key: wrongPack, kind: "wrong packaging", shotName: "desktop-mistake" });
  await shot(desk, "desktop-play-reset");

  await pressKey(desk, openKey);
  await pressKey(desk, steps[1].key);
  await mistake(desk, { key: steps[1].key, kind: "duplicate" });

  await pressKey(desk, openKey);
  await mistake(desk, { key: openKey, kind: "packaging pressed again" });

  await pressKey(desk, openKey);
  await mistake(desk, { key: "enter", kind: "early wrap" });

  await pressKey(desk, openKey);
  await pressKey(desk, steps[1].key);
  await mistake(desk, { key: offKey, kind: "off-ticket" });

  await desk.goto(`http://127.0.0.1:${port}/?seed=3&difficulty=hard`);
  await desk.locator("[data-action='play']").click();
  const hardSteps = await readSteps(desk);
  assert(hardSteps.length >= 4, "hard ticket too short");
  await pressKey(desk, hardSteps[0].key);
  await mistake(desk, { key: hardSteps[2].key, kind: "out of order" });
  for (const step of hardSteps) await pressKey(desk, step.key);
  await desk.waitForFunction(() => /1/.test(document.querySelector("#quota-val")?.textContent || ""));
  const quota = (await desk.locator("#quota-val").innerText()).replace(/\s+/g, " ");
  assert(quota.includes("1 of 3"), quota);

  const beforePause = await desk.locator("#time-val").innerText();
  await desk.keyboard.press("Escape");
  await desk.locator("#quit-confirm").waitFor();
  await desk.waitForTimeout(1300);
  assert((await desk.locator("#time-val").innerText()) === beforePause, "clock ran during Home confirm");
  await desk.keyboard.press("Enter");
  assert(await desk.locator("#quit-confirm").isVisible(), "Enter wrapped during confirm");
  await desk.locator("[data-action='keep']").click();
  await desk.locator("#quit-confirm").waitFor({ state: "hidden" });
  await desk.waitForFunction((prev) => document.querySelector("#time-val").textContent !== prev, beforePause, { timeout: 2500 });
  await desk.locator("[data-action='home']").click();
  await desk.locator("#quit-confirm").waitFor();
  await shot(desk, "desktop-quit");
  await desk.locator("[data-action='quit']").click();
  await desk.locator("section[data-screen='title']").waitFor();
  const stored = await desk.evaluate(() => localStorage.getItem("dml.lineRush.best.v3"));
  assert(stored === null, `quit saved a best: ${stored}`);
  await mistakes.close();

  const phone = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const hand = await phone.newPage();
  hand.on("pageerror", (err) => errors.push(`phone ${err.message}`));
  await hand.goto(`http://127.0.0.1:${port}/?seed=11&difficulty=normal`);
  await hand.locator("section[data-screen='title']").waitFor();
  await noBrand(hand);
  await fit(hand, "phone title");
  await inView(hand, "[data-action='play']");
  await shot(hand, "phone-title");
  await hand.locator("[data-action='play']").click();
  await hand.locator("section[data-screen='play']").waitFor();
  assert((await hand.locator(".scoop.ghost").count()) === 0, "phone normal shows a next hint");
  await fit(hand, "phone play");
  await inView(hand, "[data-pan='foil']:visible");
  await inView(hand, "[data-pan='container']:visible");
  await inView(hand, "[data-pan='soft-flour']:visible");
  await inView(hand, "[data-pan='crispy-corn']:visible");
  await inView(hand, "[data-pan='wrap']:visible");
  await inView(hand, ".phone-trash");
  await inView(hand, "[data-action='home']");
  await inView(hand, "#time-val");
  await inView(hand, ".ticket.current");
  await shot(hand, "phone-play");

  const phoneNotes = await finishRun(hand, { tap: true });
  assert(phoneNotes.length === 3, phoneNotes.join(" | "));
  await fit(hand, "phone game over");
  await inView(hand, "[data-action='again']");
  await shot(hand, "phone-over");
  const phoneCount = (await hand.locator("#final-count").innerText()).replace(/\s+/g, " ");
  assert(phoneCount.includes("8 of 8"), phoneCount);
  assert((await hand.locator("#final-accuracy").innerText()) === "100%", "phone accuracy");

  await hand.goto(`http://127.0.0.1:${port}/?seed=11&difficulty=normal`);
  const phoneBestBefore = await hand.evaluate(() => localStorage.getItem("dml.lineRush.best.v3"));
  await hand.locator("[data-action='play']").click();
  await hand.locator("[data-action='home']").click();
  await hand.locator("#quit-confirm").waitFor();
  await fit(hand, "phone confirm");
  await hand.locator("[data-action='keep']").click();
  await hand.locator("#quit-confirm").waitFor({ state: "hidden" });
  assert(await hand.locator("section[data-screen='play']").isVisible(), "keep playing left the line");
  await hand.locator("[data-action='home']").click();
  await hand.locator("[data-action='quit']").click();
  await hand.locator("section[data-screen='title']").waitFor();
  const phoneStored = await hand.evaluate(() => localStorage.getItem("dml.lineRush.best.v3"));
  assert(phoneStored === phoneBestBefore, `phone quit changed the best: ${phoneStored}`);

  await hand.locator("[data-action='play']").click();
  const phoneSteps = await readSteps(hand);
  await mistake(hand, { tap: true, pan: "wrap", kind: "phone wrap before packaging" });
  await tapPan(hand, phoneSteps[0].pan);
  await mistake(hand, { tap: true, pan: "wrap", kind: "phone early wrap", shotName: "phone-mistake" });
  await mistake(hand, { tap: true, pan: phoneSteps[1].pan, kind: "phone ingredient before packaging" });
  await shot(hand, "phone-after-trash");
  await phone.close();

  const failed = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const failPage = await failed.newPage();
  failPage.on("pageerror", (err) => errors.push(`fail ${err.message}`));
  await failPage.goto(`http://127.0.0.1:${port}/?seed=4&difficulty=normal`);
  await failPage.locator("[data-action='play']").click();
  await failPage.locator("section[data-screen='gameover']").waitFor({ timeout: 70000 });
  const failedText = await failPage.locator("#failed-round").innerText();
  assert(failedText.includes("Round 1") && failedText.includes("failed") && failedText.includes("0 of 2"), failedText);
  assert((await failPage.locator("#final-score").innerText()) === "0", "untouched round scored points");
  assert((await failPage.locator("[data-action='continue']").count()) === 0, "failed round offered continue");
  await fit(failPage, "failed game over");
  await shot(failPage, "desktop-failed");
  await failed.close();

  assert(errors.length === 0, `page errors:\n${errors.join("\n")}`);
  console.log("e2e ok");
} finally {
  await browser.close();
  server.close();
}
