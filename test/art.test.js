import { test } from "node:test";
import assert from "node:assert/strict";
import { PAN_ART, layerModel, sceneSvg } from "../js/art.js";
import { ITEM_LIST } from "../js/menu.js";

const LINE_IDS = ["foil", "bowl", "container", ...ITEM_LIST.map((item) => item.id)];

test("every pan on the line has line art", () => {
  for (const id of LINE_IDS) {
    assert.equal(typeof PAN_ART[id], "string", id);
    assert.match(PAN_ART[id], /stroke="#2C1810"/, id);
  }
  assert.equal(new Set(LINE_IDS).size, LINE_IDS.length);
});

test("build layers follow scoops and clear on trash", () => {
  assert.deepEqual(layerModel({ opened: false, packaging: "foil" }), []);
  assert.deepEqual(
    layerModel({
      opened: true,
      packaging: "foil",
      scooped: ["soft-flour", "white-rice", "chicken"],
    }).map((layer) => layer.id),
    ["foil", "soft-flour", "white-rice", "chicken"],
  );
  const salad = layerModel({
    opened: true,
    packaging: "bowl",
    builtinIds: ["supergreens"],
    scooped: ["steak"],
  });
  assert.deepEqual(salad.map((layer) => layer.id), ["bowl", "supergreens", "steak"]);
  const quesadilla = layerModel({
    opened: true,
    packaging: "container",
    builtinIds: ["cheese"],
    scooped: ["fajitas"],
  });
  assert.deepEqual(quesadilla.map((layer) => layer.id), ["container", "cheese", "fajitas"]);
  assert.deepEqual(
    layerModel({ opened: true, packaging: "bowl", scooped: ["chicken"], wrapped: true }).map((layer) => layer.id),
    ["wrap-bowl"],
  );
  assert.deepEqual(layerModel({ opened: false, packaging: "container", scooped: ["crispy-corn"] }), []);
});

test("the scene drawing names each layer", () => {
  const open = layerModel({ opened: true, packaging: "foil", scooped: ["soft-flour", "tomato"] });
  const svg = sceneSvg(open, { ghostId: "cheese", drop: true });
  assert.match(svg, /data-layers="foil soft-flour tomato"/);
  assert.match(svg, /data-layer="soft-flour"/);
  assert.match(svg, /data-layer="tomato"/);
  assert.match(svg, /layer-ghost/);
  const sealed = sceneSvg(layerModel({ opened: true, packaging: "foil", wrapped: true }));
  assert.match(sealed, /data-layer="wrap-foil"/);
  assert.doesNotMatch(sealed, /data-layer="tomato"/);
  const tacos = sceneSvg(layerModel({
    opened: true,
    packaging: "container",
    scooped: ["crispy-corn", "chicken"],
  }));
  assert.equal(tacos.match(/data-layer="crispy-corn"/g).length, 3);
  assert.equal(tacos.match(/data-layer="chicken"/g).length, 3);
});
