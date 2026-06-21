import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("index wires the app shell and mobile recommendation controls", async () => {
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /id="app"/);
  assert.match(html, /src="src\/app\.js"/);
  assert.match(html, /今天吃什么/);
});

test("app source includes collapsed recommendation, filter, random, veto, and empty states", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(app, /renderFilters/);
  assert.match(app, /renderRecommendations/);
  assert.match(app, /toggleExpanded/);
  assert.match(app, /randomPick/);
  assert.match(app, /vetoRestaurant/);
  assert.match(app, /放宽/);
});

test("app filters are multi-select and omit removed filter copy", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");
  const recommendation = await readFile(new URL("../src/recommendation.js", import.meta.url), "utf8");
  const source = `${app}\n${recommendation}`;

  assert.match(app, /Nora决定/);
  assert.match(source, /大吃一顿/);
  assert.match(source, /小吃一下/);
  assert.match(source, /云南辣/);
  assert.match(app, /toggle-filter-option/);

  assert.doesNotMatch(source, /DECISION_MODE/);
  assert.doesNotMatch(source, /decisionModes/);
  assert.doesNotMatch(source, /黑黑放弃，Nora全权决定/);
  assert.doesNotMatch(app, /决策模式/);
  assert.doesNotMatch(app, /Nora 直接决定/);
  assert.doesNotMatch(app, /isNoraDecisionMode/);
  assert.doesNotMatch(app, /不要熟脸/);
  assert.doesNotMatch(app, /不要连锁/);
  assert.doesNotMatch(app, /不要小吃\/米线/);
  assert.doesNotMatch(app, /排除菜系/);
  assert.doesNotMatch(app, /无菜系排除/);
  assert.doesNotMatch(app, /不要西餐/);
  assert.doesNotMatch(app, /允许西餐/);
  assert.doesNotMatch(app, /toggle-excluded-cuisine/);
  assert.doesNotMatch(app, /excludedCuisines/);
  assert.doesNotMatch(app, /吃大的/);
  assert.doesNotMatch(app, /set-route/);
  assert.doesNotMatch(app, /set-travel/);
  assert.doesNotMatch(app, /toggle-meal/);
  assert.doesNotMatch(app, /spiceRequired/);
  assert.doesNotMatch(app, /avoidFamiliar/);
  assert.doesNotMatch(app, /avoidChains/);
  assert.doesNotMatch(app, /avoidSmallBites/);
});

test("app renders recommendation name copy block outside the random modal", async () => {
  const app = await readFile(new URL("../src/app.js", import.meta.url), "utf8");

  assert.match(app, /renderCopyBlock/);
  assert.match(app, /给黑黑复制/);
  assert.match(app, /一键复制/);
  assert.match(app, /copy-recommendations/);
  assert.match(app, /formatRecommendationNames/);

  assert.doesNotMatch(app, /nora-decide/);
  assert.doesNotMatch(app, /noraDecided/);
  assert.doesNotMatch(app, /Nora已经拍板/);
});
