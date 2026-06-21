import {
  DEFAULT_FILTERS,
  buildRecommendations,
  describeFilters,
  getWeightedRandomRecommendation,
  toggleArrayValue,
  toggleExcludedCuisine,
} from "./recommendation.js";
import { CUISINE_LABELS, ROUTE_INTENT_LABELS } from "./restaurants.js";

const app = document.querySelector("#app");

const cuisineOptions = [
  ["yunnan", "云南"],
  ["hunan", "湘菜"],
  ["korean", "韩国街"],
  ["hotpot", "火锅"],
  ["western", "西餐"],
  ["thai", "泰国菜"],
  ["nepalese", "尼泊尔菜"],
  ["chaoshan", "潮汕牛肉锅"],
];

const routeOptions = [
  ["easy", "公司附近省事"],
  ["home_route", "回家顺路"],
  ["worth_trip", "为了好吃专门去"],
  ["city_walk", "进城吃完逛"],
  ["any", "路线都可以"],
];

const travelOptions = [
  ["both", "路线两者都看"],
  ["drive", "只看开车/打车"],
  ["transit", "只看地铁"],
];

const state = {
  filters: cloneFilters(DEFAULT_FILTERS),
  expandedIds: new Set(),
  activeEditor: null,
  randomResult: null,
};

app.addEventListener("click", handleClick);
render();

function render() {
  const recommendations = buildRecommendations(state.filters);

  app.innerHTML = `
    <section class="decision-screen">
      <header class="hero">
        <div>
          <p class="eyebrow">黑黑今日饭局</p>
          <h1>今天吃什么</h1>
        </div>
        <button class="ghost-button" type="button" data-action="reset">重置</button>
      </header>

      ${renderFilters()}
      ${state.activeEditor ? renderEditor(state.activeEditor) : ""}

      <section class="result-section" aria-label="推荐结果">
        <div class="result-heading">
          <div>
            <p class="eyebrow">符合条件</p>
            <h2>${recommendations.length} 家</h2>
          </div>
          <button class="primary-button" type="button" data-action="random" ${recommendations.length ? "" : "disabled"}>
            随机帮我选一家
          </button>
        </div>
        ${recommendations.length ? renderRecommendations(recommendations) : renderEmptyState()}
      </section>
    </section>
    ${state.randomResult ? renderRandomResult(state.randomResult) : ""}
  `;
}

function renderFilters() {
  const filterDescriptions = describeFilters(state.filters);
  const cuisineText = state.filters.cuisines.length
    ? state.filters.cuisines.map((cuisine) => CUISINE_LABELS[cuisine] ?? cuisine).join(" + ")
    : "菜系都可以";
  const excludedText = state.filters.excludedCuisines.length
    ? state.filters.excludedCuisines.map((cuisine) => `不要${CUISINE_LABELS[cuisine] ?? cuisine}`).join(" / ")
    : "无菜系排除";

  return `
    <section class="filter-panel" aria-label="随时可改的条件">
      <div class="filter-summary">
        ${filterDescriptions.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="chip-row">
        <button class="chip" type="button" data-action="edit-filter" data-editor="route">${escapeHtml(ROUTE_INTENT_LABELS[state.filters.routeIntent])}</button>
        <button class="chip" type="button" data-action="edit-filter" data-editor="cuisine">${escapeHtml(cuisineText)}</button>
        <button class="chip chip-danger" type="button" data-action="edit-filter" data-editor="excluded">${escapeHtml(excludedText)}</button>
        <button class="chip ${state.filters.avoidFamiliar ? "chip-active" : ""}" type="button" data-action="toggle" data-key="avoidFamiliar">不要熟脸</button>
        <button class="chip ${state.filters.mealScale === "big_only" ? "chip-active" : ""}" type="button" data-action="toggle-meal">吃大的</button>
        <button class="chip ${state.filters.spiceRequired ? "chip-active" : ""}" type="button" data-action="toggle" data-key="spiceRequired">要辣</button>
        <button class="chip ${state.filters.avoidSmallBites ? "chip-active" : ""}" type="button" data-action="toggle" data-key="avoidSmallBites">不要小吃/米线</button>
        <button class="chip ${state.filters.avoidChains ? "chip-active" : ""}" type="button" data-action="toggle" data-key="avoidChains">不要连锁</button>
        <button class="chip" type="button" data-action="edit-filter" data-editor="travel">${getTravelLabel(state.filters.travelMode)}</button>
      </div>
    </section>
  `;
}

function renderEditor(editor) {
  if (editor === "route") {
    return renderOptionEditor(
      "路线意愿",
      routeOptions.map(([value, label]) => ({
        label,
        active: state.filters.routeIntent === value,
        action: "set-route",
        value,
      })),
    );
  }

  if (editor === "travel") {
    return renderOptionEditor(
      "路线算法",
      travelOptions.map(([value, label]) => ({
        label,
        active: state.filters.travelMode === value,
        action: "set-travel",
        value,
      })),
    );
  }

  if (editor === "excluded") {
    return renderOptionEditor(
      "排除菜系",
      cuisineOptions.map(([value, label]) => ({
        label: `不要${label}`,
        active: state.filters.excludedCuisines.includes(value),
        action: "toggle-excluded-cuisine",
        value,
      })),
    );
  }

  return renderOptionEditor(
    "可接受菜系",
    cuisineOptions.map(([value, label]) => ({
      label,
      active: state.filters.cuisines.includes(value),
      disabled: state.filters.excludedCuisines.includes(value),
      action: "toggle-cuisine",
      value,
    })),
  );
}

function renderOptionEditor(title, options) {
  return `
    <section class="editor-panel" aria-label="${escapeHtml(title)}">
      <div class="editor-title">
        <h2>${escapeHtml(title)}</h2>
        <button class="ghost-button" type="button" data-action="close-editor">完成</button>
      </div>
      <div class="option-grid">
        ${options
          .map(
            (option) => `
              <button
                class="option-button ${option.active ? "option-active" : ""}"
                type="button"
                data-action="${option.action}"
                data-value="${escapeHtml(option.value)}"
                ${option.disabled ? "disabled" : ""}
              >
                ${option.active ? "✓ " : ""}${escapeHtml(option.label)}
              </button>
            `,
          )
          .join("")}
      </div>
    </section>
  `;
}

function renderRecommendations(recommendations) {
  return `
    <div class="recommendation-list">
      ${recommendations.map((card) => renderRecommendationCard(card)).join("")}
    </div>
  `;
}

function renderRecommendationCard(card) {
  const isExpanded = state.expandedIds.has(card.restaurantId);

  return `
    <article class="recommendation-card ${isExpanded ? "is-expanded" : ""}">
      <button class="card-toggle" type="button" data-action="toggle-expanded" data-id="${escapeHtml(card.restaurantId)}">
        <span class="toggle-mark">${isExpanded ? "∨" : ">"}</span>
        <span>
          <strong>${escapeHtml(card.collapsedTitle)}</strong>
          <small>${escapeHtml(card.collapsedSummary)}</small>
        </span>
      </button>
      ${
        isExpanded
          ? `
            <div class="card-details">
              <section>
                <h3>点单</h3>
                <p>${card.dishPlan.map(escapeHtml).join(" + ")}</p>
              </section>
              <section>
                <h3>为什么</h3>
                <ul>${card.whyThis.map((reason) => `<li>${escapeHtml(reason)}</li>`).join("")}</ul>
              </section>
              <section>
                <h3>路线</h3>
                <p>${escapeHtml(card.routeSummary)}</p>
              </section>
              <section>
                <h3>风险</h3>
                <ul>${card.tradeoffs.map((risk) => `<li>${escapeHtml(risk)}</li>`).join("")}</ul>
              </section>
              <div class="card-actions">
                <button class="primary-button" type="button" data-action="choose" data-id="${escapeHtml(card.restaurantId)}">想吃</button>
                <button class="danger-button" type="button" data-action="veto" data-id="${escapeHtml(card.restaurantId)}">否决</button>
              </div>
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderEmptyState() {
  return `
    <section class="empty-state">
      <h2>现在没有符合条件的店</h2>
      <p>可以试试放宽一个条件：</p>
      <div class="empty-actions">
        <button class="chip" type="button" data-action="relax" data-relax="familiar">放宽熟脸店</button>
        <button class="chip" type="button" data-action="relax" data-relax="western">允许回家顺路西餐</button>
        <button class="chip" type="button" data-action="relax" data-relax="small">允许小吃/米线</button>
      </div>
    </section>
  `;
}

function renderRandomResult(card) {
  return `
    <div class="modal-backdrop" role="presentation" data-action="close-random">
      <section class="random-sheet" role="dialog" aria-modal="true" aria-label="随机结果">
        <p class="eyebrow">随机结果</p>
        <h2>今天定：${escapeHtml(card.collapsedTitle)}</h2>
        <p class="dish-line">${card.dishPlan.map(escapeHtml).join(" + ")}</p>
        <p>${escapeHtml(card.whyThis[0] ?? card.collapsedSummary)}</p>
        <p class="route-line">${escapeHtml(card.routeSummary)}</p>
        <div class="card-actions">
          <button class="primary-button" type="button" data-action="choose" data-id="${escapeHtml(card.restaurantId)}">就它</button>
          <button class="danger-button" type="button" data-action="veto" data-id="${escapeHtml(card.restaurantId)}">黑黑否决</button>
          <button class="ghost-button" type="button" data-action="random">再随机</button>
        </div>
      </section>
    </div>
  `;
}

function handleClick(event) {
  const target = event.target.closest("[data-action]");
  if (!target) {
    return;
  }

  const { action } = target.dataset;

  if (action === "edit-filter") {
    state.activeEditor = state.activeEditor === target.dataset.editor ? null : target.dataset.editor;
    render();
    return;
  }

  if (action === "close-editor") {
    state.activeEditor = null;
    render();
    return;
  }

  if (action === "set-route") {
    state.filters.routeIntent = target.dataset.value;
    state.activeEditor = null;
    render();
    return;
  }

  if (action === "set-travel") {
    state.filters.travelMode = target.dataset.value;
    state.activeEditor = null;
    render();
    return;
  }

  if (action === "toggle-cuisine") {
    state.filters.cuisines = toggleArrayValue(state.filters.cuisines, target.dataset.value);
    render();
    return;
  }

  if (action === "toggle-excluded-cuisine") {
    state.filters = toggleExcludedCuisine(state.filters, target.dataset.value);
    render();
    return;
  }

  if (action === "toggle") {
    state.filters[target.dataset.key] = !state.filters[target.dataset.key];
    render();
    return;
  }

  if (action === "toggle-meal") {
    state.filters.mealScale = state.filters.mealScale === "big_only" ? "any" : "big_only";
    render();
    return;
  }

  if (action === "toggle-expanded") {
    toggleExpanded(target.dataset.id);
    render();
    return;
  }

  if (action === "random") {
    randomPick();
    render();
    return;
  }

  if (action === "veto") {
    vetoRestaurant(target.dataset.id);
    render();
    return;
  }

  if (action === "choose") {
    chooseRestaurant(target.dataset.id);
    return;
  }

  if (action === "relax") {
    relaxFilter(target.dataset.relax);
    render();
    return;
  }

  if (action === "close-random" && event.target.classList.contains("modal-backdrop")) {
    state.randomResult = null;
    render();
  }

  if (action === "reset") {
    resetState();
    render();
  }
}

function toggleExpanded(id) {
  if (state.expandedIds.has(id)) {
    state.expandedIds.delete(id);
    return;
  }

  state.expandedIds.add(id);
}

function randomPick() {
  const recommendations = buildRecommendations(state.filters);
  state.randomResult = getWeightedRandomRecommendation(recommendations);
}

function vetoRestaurant(id) {
  state.filters.vetoedRestaurantIds = [...new Set([...state.filters.vetoedRestaurantIds, id])];
  state.expandedIds.delete(id);
  if (state.randomResult?.restaurantId === id) {
    state.randomResult = null;
  }
}

function chooseRestaurant(id) {
  const card = buildRecommendations(state.filters).find((item) => item.restaurantId === id) ?? state.randomResult;
  if (!card) {
    return;
  }

  state.randomResult = {
    ...card,
    collapsedTitle: `${card.collapsedTitle}，就它`,
    whyThis: ["已确认。可以出发了。", ...card.whyThis],
  };
  render();
}

function relaxFilter(kind) {
  if (kind === "familiar") {
    state.filters.avoidFamiliar = false;
  }

  if (kind === "western") {
    state.filters.excludedCuisines = state.filters.excludedCuisines.filter((cuisine) => cuisine !== "western");
    state.filters.cuisines = [...new Set([...state.filters.cuisines, "western"])];
    state.filters.spiceRequired = false;
  }

  if (kind === "small") {
    state.filters.avoidSmallBites = false;
    state.filters.mealScale = "any";
  }
}

function resetState() {
  state.filters = cloneFilters(DEFAULT_FILTERS);
  state.expandedIds = new Set();
  state.activeEditor = null;
  state.randomResult = null;
}

function cloneFilters(filters) {
  return {
    ...filters,
    cuisines: [...filters.cuisines],
    excludedCuisines: [...filters.excludedCuisines],
    vetoedRestaurantIds: [...filters.vetoedRestaurantIds],
  };
}

function getTravelLabel(value) {
  return travelOptions.find(([option]) => option === value)?.[1] ?? "路线两者都看";
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
