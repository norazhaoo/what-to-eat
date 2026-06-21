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
