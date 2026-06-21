import { CUISINE_LABELS, ROUTE_INTENT_LABELS, restaurants } from "./restaurants.js";

export const DEFAULT_FILTERS = Object.freeze({
  routeIntent: "worth_trip",
  cuisines: ["yunnan", "hunan"],
  excludedCuisines: ["western"],
  mealScale: "big_only",
  spiceRequired: true,
  avoidFamiliar: false,
  avoidChains: false,
  avoidSmallBites: true,
  travelMode: "both",
  vetoedRestaurantIds: [],
});

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

export function toggleArrayValue(values, value) {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

export function toggleExcludedCuisine(filters, cuisine) {
  const excludedCuisines = toggleArrayValue(filters.excludedCuisines, cuisine);
  const cuisines = excludedCuisines.includes(cuisine)
    ? filters.cuisines.filter((item) => item !== cuisine)
    : filters.cuisines;

  return {
    ...filters,
    cuisines,
    excludedCuisines,
  };
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

export function describeFilters(filters) {
  const cuisineText = filters.cuisines.length
    ? filters.cuisines.map((cuisine) => CUISINE_LABELS[cuisine] ?? cuisine).join(" + ")
    : "菜系都可以";
  const excludedText = filters.excludedCuisines.length
    ? `排除 ${filters.excludedCuisines.map((cuisine) => CUISINE_LABELS[cuisine] ?? cuisine).join(" / ")}`
    : "无菜系排除";

  return [
    ROUTE_INTENT_LABELS[filters.routeIntent],
    cuisineText,
    excludedText,
    filters.avoidFamiliar ? "不要熟脸" : "熟脸可选",
    filters.mealScale === "big_only" ? "吃大的" : "大小都行",
    filters.spiceRequired ? "要辣" : "辣不强求",
  ];
}

function isEligible(restaurant, filters) {
  if (filters.vetoedRestaurantIds.includes(restaurant.id)) {
    return false;
  }

  if (filters.avoidChains && restaurant.identity.isChain) {
    return false;
  }

  if (filters.avoidSmallBites && restaurant.identity.mealScale === "small") {
    return false;
  }

  if (filters.mealScale === "big_only" && restaurant.identity.mealScale !== "big") {
    return false;
  }

  if (filters.avoidFamiliar && restaurant.identity.familiar) {
    return false;
  }

  if (restaurant.identity.cuisineFamilies.some((family) => filters.excludedCuisines.includes(family))) {
    return false;
  }

  if (
    filters.cuisines.length > 0 &&
    !restaurant.identity.cuisineFamilies.some((family) => filters.cuisines.includes(family))
  ) {
    return false;
  }

  if (filters.spiceRequired && restaurant.taste.spiceLevel === "none") {
    return false;
  }

  return restaurant.decision.defaultEligibility !== "usually_excluded" || filters.avoidSmallBites === false;
}

function toRecommendationCard(restaurant, filters) {
  const dishPlan = restaurant.dishes.slice(0, 3);
  const score = scoreRestaurant(restaurant, filters);
  const cuisineText = restaurant.identity.cuisineFamilies
    .map((family) => CUISINE_LABELS[family] ?? restaurant.identity.cuisine)
    .join(" / ");
  const routeSummary = buildRouteSummary(restaurant, filters);
  const whyThis = buildWhyThis(restaurant, filters);
  const tradeoffs = restaurant.decision.vetoRisks.map((risk) => `风险：${risk}`);

  return {
    restaurantId: restaurant.id,
    collapsedTitle: restaurant.name,
    collapsedSummary: `${restaurant.identity.preferenceTier === "top" ? "高偏好" : "低频候选"} · ${cuisineText} · ${restaurant.location.routeVerdict}`,
    cuisineFamilies: restaurant.identity.cuisineFamilies,
    dishPlan,
    whyThis,
    routeSummary,
    tradeoffs,
    score,
  };
}

function scoreRestaurant(restaurant, filters) {
  let score = 0;
  score += tierScore[restaurant.identity.preferenceTier] ?? 0;
  score += eligibilityScore[restaurant.decision.defaultEligibility] ?? 0;
  score += restaurant.dishes.length * 2;

  if (restaurant.identity.mealScale === "big") {
    score += 10;
  }

  if (restaurant.taste.spiceLevel === "hot") {
    score += 8;
  } else if (restaurant.taste.spiceLevel === "medium") {
    score += 4;
  }

  if (!restaurant.identity.familiar) {
    score += 14;
  }

  if (filters.avoidFamiliar && !restaurant.identity.familiar) {
    score += 12;
  }

  const preferredBuckets = routeIntentBuckets[filters.routeIntent] ?? [];
  if (preferredBuckets.includes(restaurant.location.bucket)) {
    score += 18;
  }

  if (filters.routeIntent === "city_walk" && restaurant.location.afterMealOptions.length > 0) {
    score += 8;
  }

  if (filters.routeIntent === "worth_trip" && restaurant.location.detour === "major_detour") {
    score -= 8;
  }

  if (filters.spiceRequired && restaurant.taste.spiceLevel === "medium") {
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

  if (filters.travelMode === "drive") {
    return `${drive}。${restaurant.location.routeVerdict}`;
  }

  if (filters.travelMode === "transit") {
    return `${transit}。${restaurant.location.routeVerdict}`;
  }

  return `${drive}；${transit}。${restaurant.location.routeVerdict}`;
}

function buildWhyThis(restaurant, filters) {
  const reasons = [];

  if (restaurant.identity.mealScale === "big") {
    reasons.push("是正经吃一顿，不是小吃/米线局");
  }

  if (!restaurant.identity.familiar) {
    reasons.push("不是本轮熟脸 top，适合换一换");
  }

  if (restaurant.taste.spiceLevel !== "none") {
    reasons.push(`满足要辣：${restaurant.taste.spiceStyle}`);
  }

  if ((routeIntentBuckets[filters.routeIntent] ?? []).includes(restaurant.location.bucket)) {
    reasons.push(`符合路线意愿：${ROUTE_INTENT_LABELS[filters.routeIntent]}`);
  }

  return reasons.length ? reasons : restaurant.decision.goodWhen;
}
