import { CUISINE_LABELS, ROUTE_INTENT_LABELS, restaurants } from "./restaurants.js";

export const DEFAULT_FILTERS = Object.freeze({
  routeIntents: ["worth_trip"],
  cuisines: ["yunnan", "hunan"],
  mealScales: ["大吃一顿"],
  spiceLevels: ["很辣", "云南辣", "中辣"],
  travelModes: ["开车", "地铁"],
  vetoedRestaurantIds: [],
});

export const MEAL_SCALE_OPTIONS = ["大吃一顿", "小吃一下"];
export const SPICE_OPTIONS = ["很辣", "云南辣", "中辣", "不辣"];
export const TRAVEL_MODE_OPTIONS = ["开车", "地铁"];

const tierScore = {
  top: 36,
  medium: 24,
  low: 12,
  exception: 4,
};

const eligibilityScore = {
  primary_pool: 18,
  backup_pool: 8,
  exception_pool: -2,
  usually_excluded: -40,
};

const routeIntentBuckets = {
  easy: ["company_nearby"],
  home_route: ["home_route", "home_nearby", "korean_street"],
  worth_trip: ["middle_distance_destination", "city"],
  city_walk: ["city", "home_route"],
  any: [],
};

const routeExperienceTags = new Set(["专门去", "早回", "省事", "家附近"]);

export function toggleArrayValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function buildRecommendations(filters = DEFAULT_FILTERS) {
  return restaurants
    .filter((restaurant) => isEligible(restaurant, filters))
    .map((restaurant) => toRecommendationCard(restaurant, filters))
    .sort((first, second) => second.score - first.score || first.collapsedTitle.localeCompare(second.collapsedTitle, "zh-Hans-CN"));
}

export function getWeightedRandomRecommendation(recommendations, random = Math.random) {
  if (!recommendations.length) {
    return null;
  }

  const weights = recommendations.map((card) => Math.max(1, card.score + 20));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = random() * total;

  for (let index = 0; index < recommendations.length; index += 1) {
    cursor -= weights[index];
    if (cursor <= 0) {
      return recommendations[index];
    }
  }

  return recommendations[recommendations.length - 1];
}

export function formatRecommendationNames(recommendations) {
  return recommendations.map((card) => card.collapsedTitle).join("\n");
}

export function describeFilters(filters) {
  const routeText = summarizeValues(
    getRouteIntents(filters).map((intent) => ROUTE_INTENT_LABELS[intent] ?? intent),
    "路线都可以",
  );
  const cuisineText = filters.cuisines.length
    ? filters.cuisines.map((cuisine) => CUISINE_LABELS[cuisine] ?? cuisine).join(" + ")
    : "菜系都可以";
  const mealText = summarizeValues(getMealScales(filters), "饭局规模都可以");
  const spiceText = summarizeValues(getSpiceLevels(filters), "辣度都可以");
  const travelText = summarizeValues(getTravelModes(filters), "路线两者都看");

  return [
    routeText,
    cuisineText,
    mealText,
    spiceText,
    travelText,
  ];
}

function isEligible(restaurant, filters) {
  if (filters.vetoedRestaurantIds.includes(restaurant.id)) {
    return false;
  }

  if (
    filters.cuisines.length > 0 &&
    !restaurant.identity.cuisineFamilies.some((family) => filters.cuisines.includes(family))
  ) {
    return false;
  }

  const routeIntents = getRouteIntents(filters).filter((intent) => intent !== "any");
  if (
    routeIntents.length > 0 &&
    !routeIntents.some((intent) => (routeIntentBuckets[intent] ?? []).includes(restaurant.location.bucket))
  ) {
    return false;
  }

  const mealScales = getMealScales(filters);
  if (mealScales.length > 0 && !mealScales.includes(getMealScaleLabel(restaurant))) {
    return false;
  }

  const spiceLevels = getSpiceLevels(filters);
  if (
    spiceLevels.length > 0 &&
    !getRestaurantSpiceLabels(restaurant).some((label) => spiceLevels.includes(label))
  ) {
    return false;
  }

  return true;
}

function toRecommendationCard(restaurant, filters) {
  const dishPlan = restaurant.dishes.slice(0, 3);
  const score = scoreRestaurant(restaurant, filters);
  const cuisineText = restaurant.identity.cuisineFamilies
    .map((family) => CUISINE_LABELS[family] ?? restaurant.identity.cuisine)
    .join(" / ");
  const mealScale = getMealScaleLabel(restaurant);
  const spiceLabels = getRestaurantSpiceLabels(restaurant);
  const afterMealText = formatAfterMealOptions(restaurant);
  const routeSummary = buildRouteSummary(restaurant, filters);
  const whyThis = buildWhyThis(restaurant, filters);
  const tradeoffs = restaurant.decision.vetoRisks.map((risk) => `风险：${risk}`);

  return {
    restaurantId: restaurant.id,
    collapsedTitle: restaurant.name,
    collapsedSummary: [
      restaurant.identity.preferenceTier === "top" ? "高偏好" : "低频候选",
      cuisineText,
      spiceLabels.join(" / "),
      restaurant.location.routeVerdict,
      afterMealText,
    ].filter(Boolean).join(" · "),
    cuisineFamilies: restaurant.identity.cuisineFamilies,
    mealScale,
    spiceLabels,
    dishPlan,
    whyThis,
    routeSummary,
    tradeoffs,
    score,
  };
}

function scoreRestaurant(restaurant, filters) {
  let score = 0;
  const spiceLabels = getRestaurantSpiceLabels(restaurant);
  const routeIntents = getRouteIntents(filters);

  score += tierScore[restaurant.identity.preferenceTier] ?? 0;
  score += eligibilityScore[restaurant.decision.defaultEligibility] ?? 0;
  score += restaurant.dishes.length * 2;

  if (restaurant.identity.mealScale === "big") {
    score += 10;
  } else {
    score -= 4;
  }

  if (spiceLabels.includes("很辣")) {
    score += 8;
  }

  if (spiceLabels.includes("云南辣")) {
    score += 5;
  }

  if (spiceLabels.includes("中辣")) {
    score += 4;
  }

  if (!restaurant.identity.familiar) {
    score += 14;
  }

  score += Math.min(30, routeScore(restaurant, routeIntents));

  if (routeIntents.includes("worth_trip") && restaurant.location.detour === "major_detour") {
    score -= 8;
  }

  if (!getSpiceLevels(filters).includes("中辣") && restaurant.taste.spiceLevel === "medium") {
    score -= 3;
  }

  if (restaurant.identity.isChain) {
    score -= 12;
  }

  return score;
}

function buildRouteSummary(restaurant, filters) {
  const drive = `开车/打车：公司过去${restaurant.location.driveCompany}，吃完回家${restaurant.location.driveHome}`;
  const transit = `地铁体感：公司过去${restaurant.location.transitCompany}，回家${restaurant.location.transitHome}`;
  const modes = getTravelModes(filters);
  const routeParts = [];

  if (modes.length === 0 || modes.includes("开车")) {
    routeParts.push(drive);
  }

  if (modes.length === 0 || modes.includes("地铁")) {
    routeParts.push(transit);
  }

  return [
    `${routeParts.join("；")}。${restaurant.location.routeVerdict}`,
    formatAfterMealOptions(restaurant, "吃完可以"),
  ].filter(Boolean).join("。");
}

function buildWhyThis(restaurant, filters) {
  const reasons = [];
  const mealScale = getMealScaleLabel(restaurant);
  const spiceLabels = getRestaurantSpiceLabels(restaurant);
  const matchedRoutes = getRouteIntents(filters)
    .filter((intent) => (routeIntentBuckets[intent] ?? []).includes(restaurant.location.bucket))
    .map((intent) => ROUTE_INTENT_LABELS[intent] ?? intent);
  const afterMealText = formatAfterMealOptions(restaurant, "吃完可以");

  if (restaurant.identity.mealScale === "big") {
    reasons.push(`适合${mealScale}`);
  } else {
    reasons.push(`适合${mealScale}`);
  }

  if (spiceLabels.some((label) => label !== "不辣")) {
    reasons.push(`辣度符合：${spiceLabels.join(" / ")}`);
  }

  if (matchedRoutes.length > 0) {
    reasons.push(`符合路线意愿：${matchedRoutes.join(" + ")}`);
  }

  if (afterMealText) {
    reasons.push(afterMealText);
  }

  return reasons.length ? reasons : restaurant.decision.goodWhen;
}

function routeScore(restaurant, routeIntents) {
  if (routeIntents.length === 0 || routeIntents.includes("any")) {
    return 4;
  }

  return routeIntents.reduce((score, intent) => {
    const buckets = routeIntentBuckets[intent] ?? [];
    if (!buckets.includes(restaurant.location.bucket)) {
      return score;
    }

    let nextScore = score + 18;
    if (intent === "city_walk" && getDisplayAfterMealOptions(restaurant).length > 0) {
      nextScore += 8;
    }

    if (intent === "home_route" && restaurant.location.detour === "small_detour") {
      nextScore += 4;
    }

    return nextScore;
  }, 0);
}

function getRouteIntents(filters) {
  return Array.isArray(filters.routeIntents) ? filters.routeIntents : [];
}

function getMealScales(filters) {
  return Array.isArray(filters.mealScales) ? filters.mealScales : [];
}

function getSpiceLevels(filters) {
  return Array.isArray(filters.spiceLevels) ? filters.spiceLevels : [];
}

function getTravelModes(filters) {
  return Array.isArray(filters.travelModes) ? filters.travelModes : [];
}

function getMealScaleLabel(restaurant) {
  return restaurant.identity.mealScale === "big" ? "大吃一顿" : "小吃一下";
}

function getRestaurantSpiceLabels(restaurant) {
  const labels = new Set();

  if (restaurant.taste.spiceLevel === "hot") {
    labels.add("很辣");
  } else if (restaurant.taste.spiceLevel === "medium") {
    labels.add("中辣");
  } else {
    labels.add("不辣");
  }

  if (
    restaurant.taste.spiceLevel !== "none" &&
    restaurant.identity.cuisineFamilies.includes("yunnan")
  ) {
    labels.add("云南辣");
  }

  return [...labels];
}

function formatAfterMealOptions(restaurant, prefix = "吃完可") {
  const options = getDisplayAfterMealOptions(restaurant);
  return options.length ? `${prefix}${options.join("、")}` : "";
}

function getDisplayAfterMealOptions(restaurant) {
  return restaurant.location.afterMealOptions.filter((option) => !routeExperienceTags.has(option));
}

function summarizeValues(values, fallback) {
  if (!values.length) {
    return fallback;
  }

  if (values.length > 2) {
    return `${values.length} 项`;
  }

  return values.join(" + ");
}
