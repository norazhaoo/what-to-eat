import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FILTERS,
  buildRecommendations,
  getWeightedRandomRecommendation,
  toggleArrayValue,
  toggleExcludedCuisine,
} from "../src/recommendation.js";

test("filters out excluded western restaurants while keeping selected Yunnan and Hunan restaurants", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan", "hunan"],
    excludedCuisines: ["western"],
  });

  assert.ok(recommendations.length > 0);
  assert.ok(recommendations.some((card) => card.restaurantId === "yi-zuo-yi-wang"));
  assert.ok(recommendations.every((card) => !card.cuisineFamilies.includes("western")));
});

test("avoid familiar removes top familiar restaurants from the current recommendation group", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan", "hunan"],
    excludedCuisines: ["western"],
    avoidFamiliar: true,
  });

  const ids = recommendations.map((card) => card.restaurantId);
  assert.ok(!ids.includes("tiao-he"));
  assert.ok(!ids.includes("guo-wan-piao-xiang"));
  assert.ok(ids.includes("yi-zuo-yi-wang"));
});

test("vetoed restaurants do not return in the current recommendation group", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan", "hunan"],
    vetoedRestaurantIds: ["yi-zuo-yi-wang"],
  });

  assert.ok(recommendations.every((card) => card.restaurantId !== "yi-zuo-yi-wang"));
});

test("recommendation cards include collapsed and expanded content fields", () => {
  const [card] = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan"],
    avoidFamiliar: true,
  });

  assert.equal(typeof card.collapsedTitle, "string");
  assert.equal(typeof card.collapsedSummary, "string");
  assert.ok(card.collapsedTitle.length > 0);
  assert.ok(card.collapsedSummary.length > 0);
  assert.ok(card.dishPlan.length > 0);
  assert.ok(card.whyThis.length > 0);
  assert.ok(card.routeSummary.length > 0);
  assert.ok(card.tradeoffs.length > 0);
});

test("weighted random only chooses from the current recommendation group", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan"],
    avoidFamiliar: true,
    vetoedRestaurantIds: ["yi-zuo-yi-wang"],
  });

  const allowedIds = new Set(recommendations.map((card) => card.restaurantId));

  for (let i = 0; i < 20; i += 1) {
    const picked = getWeightedRandomRecommendation(recommendations, () => 0.1);
    assert.ok(allowedIds.has(picked.restaurantId));
    assert.notEqual(picked.restaurantId, "yi-zuo-yi-wang");
  }
});

test("filter helpers support multi-select cuisines and explicit exclusion", () => {
  assert.deepEqual(toggleArrayValue(["yunnan"], "hunan"), ["yunnan", "hunan"]);
  assert.deepEqual(toggleArrayValue(["yunnan", "hunan"], "hunan"), ["yunnan"]);

  const filters = toggleExcludedCuisine(
    {
      ...DEFAULT_FILTERS,
      cuisines: ["western", "yunnan"],
      excludedCuisines: [],
    },
    "western",
  );

  assert.deepEqual(filters.cuisines, ["yunnan"]);
  assert.deepEqual(filters.excludedCuisines, ["western"]);
});
