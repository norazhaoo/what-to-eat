import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_FILTERS,
  buildRecommendations,
  describeFilters,
  formatRecommendationNames,
  getWeightedRandomRecommendation,
  toggleArrayValue,
} from "../src/recommendation.js";

test("selected cuisines keep recommendations in that cuisine set", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan", "hunan"],
  });

  assert.ok(recommendations.length > 0);
  assert.ok(recommendations.some((card) => card.restaurantId === "yi-zuo-yi-wang"));
  assert.ok(recommendations.every((card) => !card.cuisineFamilies.includes("western")));
});

test("route, meal scale, spice, and travel filters accept multiple selected values", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    routeIntents: ["home_route", "city_walk"],
    cuisines: ["yunnan", "korean"],
    mealScales: ["大吃一顿"],
    spiceLevels: ["很辣", "云南辣", "中辣"],
    travelModes: ["开车", "地铁"],
  });

  const ids = recommendations.map((card) => card.restaurantId);
  assert.ok(ids.includes("kaoroucun"));
  assert.ok(ids.includes("yi-zuo-yi-wang"));
});

test("meal scale uses Chinese copy and can include small-bite restaurants", () => {
  const bigMealRecommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan"],
    mealScales: ["大吃一顿"],
    spiceLevels: ["很辣", "云南辣", "中辣"],
  });

  assert.ok(bigMealRecommendations.every((card) => card.mealScale === "大吃一顿"));

  const smallMealRecommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    routeIntents: ["city_walk"],
    cuisines: ["yunnan"],
    mealScales: ["小吃一下"],
    spiceLevels: ["很辣", "云南辣", "中辣"],
  });

  assert.ok(smallMealRecommendations.some((card) => card.restaurantId === "fen-ba"));
  assert.ok(smallMealRecommendations.every((card) => card.mealScale === "小吃一下"));
});

test("spice filters use Chinese labels and can isolate not-spicy options", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    routeIntents: ["home_route", "city_walk"],
    cuisines: ["western", "nepalese", "chaoshan"],
    mealScales: ["大吃一顿"],
    spiceLevels: ["不辣"],
  });

  assert.ok(recommendations.length > 0);
  assert.ok(recommendations.every((card) => card.spiceLabels.includes("不辣")));
  assert.ok(recommendations.every((card) => !card.collapsedSummary.includes("hot")));
});

test("Korean street recommendations surface after-meal biking context", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    routeIntents: ["home_route"],
    cuisines: ["korean"],
    mealScales: ["大吃一顿"],
    spiceLevels: ["中辣"],
  });

  const koreanCard = recommendations.find((card) => card.restaurantId === "kaoroucun");

  assert.ok(koreanCard);
  assert.match(koreanCard.collapsedSummary, /骑车回家/);
  assert.match(koreanCard.routeSummary, /骑车回家/);
  assert.ok(koreanCard.whyThis.some((reason) => reason.includes("骑车回家")));
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
  });

  assert.equal(typeof card.collapsedTitle, "string");
  assert.equal(typeof card.collapsedSummary, "string");
  assert.ok(card.collapsedTitle.length > 0);
  assert.ok(card.collapsedSummary.length > 0);
  assert.ok(card.dishPlan.length > 0);
  assert.ok(card.whyThis.length > 0);
  assert.ok(card.routeSummary.length > 0);
  assert.ok(card.tradeoffs.length > 0);
  assert.ok(["大吃一顿", "小吃一下"].includes(card.mealScale));
  assert.ok(card.spiceLabels.length > 0);
});

test("weighted random only chooses from the current recommendation group", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    cuisines: ["yunnan"],
    vetoedRestaurantIds: ["yi-zuo-yi-wang"],
  });

  const allowedIds = new Set(recommendations.map((card) => card.restaurantId));

  for (let i = 0; i < 20; i += 1) {
    const picked = getWeightedRandomRecommendation(recommendations, () => 0.1);
    assert.ok(allowedIds.has(picked.restaurantId));
    assert.notEqual(picked.restaurantId, "yi-zuo-yi-wang");
  }
});

test("formats current recommendation names as one-click copy text", () => {
  const recommendations = buildRecommendations({
    ...DEFAULT_FILTERS,
    routeIntents: ["home_route"],
    cuisines: ["korean"],
    mealScales: ["大吃一顿"],
    spiceLevels: ["中辣"],
  });

  const copyText = formatRecommendationNames(recommendations);
  const lines = copyText.split("\n");

  assert.deepEqual(lines, ["烤肉村多素拌韩国料理", "王猪蹄艺拌"]);
  assert.ok(lines.every((line) => line.length > 0));
});

test("filter state only uses selected cuisines without a separate exclusion list", () => {
  assert.equal(Object.hasOwn(DEFAULT_FILTERS, "excludedCuisines"), false);
  assert.equal(Object.hasOwn(DEFAULT_FILTERS, "decisionModes"), false);
  assert.deepEqual(toggleArrayValue(["yunnan"], "hunan"), ["yunnan", "hunan"]);
  assert.deepEqual(toggleArrayValue(["yunnan", "hunan"], "hunan"), ["yunnan"]);
});
