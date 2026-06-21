import {
  DEFAULT_FILTERS,
  MEAL_SCALE_OPTIONS,
  SPICE_OPTIONS,
  TRAVEL_MODE_OPTIONS,
  buildRecommendations,
  describeFilters,
  formatRecommendationNames,
  getWeightedRandomRecommendation,
  toggleArrayValue,
} from "./recommendation.js";
import { CUISINE_LABELS } from "./restaurants.js";

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
];

const mealOptions = MEAL_SCALE_OPTIONS.map((label) => [label, label]);
const spiceOptions = SPICE_OPTIONS.map((label) => [label, label]);
const travelOptions = TRAVEL_MODE_OPTIONS.map((label) => [label, label]);

const state = {
  filters: cloneFilters(DEFAULT_FILTERS),
  expandedIds: new Set(),
  activeEditor: null,
  randomResult: null,
  copyStatus: null,
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
  const routeText = summarizeSelectedOptions(routeOptions, state.filters.routeIntents, "路线都可以");
  const cuisineText = summarizeSelectedOptions(cuisineOptions, state.filters.cuisines, "菜系都可以");
  const mealText = summarizeSelectedOptions(mealOptions, state.filters.mealScales, "饭局规模都可以");
  const spiceText = summarizeSelectedOptions(spiceOptions, state.filters.spiceLevels, "辣度都可以");
  const travelText = summarizeSelectedOptions(travelOptions, state.filters.travelModes, "路线两者都看");

  return `
    <section class="filter-panel" aria-label="随时可改的条件">
      <div class="filter-summary">
        ${filterDescriptions.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}
      </div>
      <div class="chip-row">
        <button class="chip" type="button" data-action="edit-filter" data-editor="route">${escapeHtml(routeText)}</button>
        <button class="chip" type="button" data-action="edit-filter" data-editor="cuisine">${escapeHtml(cuisineText)}</button>
        <button class="chip" type="button" data-action="edit-filter" data-editor="meal">${escapeHtml(mealText)}</button>
        <button class="chip" type="button" data-action="edit-filter" data-editor="spice">${escapeHtml(spiceText)}</button>
        <button class="chip" type="button" data-action="edit-filter" data-editor="travel">${escapeHtml(travelText)}</button>
      </div>
    </section>
  `;
}

function renderEditor(editor) {
  if (editor === "route") {
    return renderOptionEditor("路线意愿", buildFilterOptions("routeIntents", routeOptions));
  }

  if (editor === "travel") {
    return renderOptionEditor("路线算法", buildFilterOptions("travelModes", travelOptions));
  }

  if (editor === "meal") {
    return renderOptionEditor("饭局规模", buildFilterOptions("mealScales", mealOptions));
  }

  if (editor === "spice") {
    return renderOptionEditor("辣度", buildFilterOptions("spiceLevels", spiceOptions));
  }

  return renderOptionEditor(
    "可接受菜系",
    cuisineOptions.map(([value, label]) => ({
      label,
      active: state.filters.cuisines.includes(value),
      action: "toggle-cuisine",
      value,
    })),
  );
}

function buildFilterOptions(filterKey, options) {
  return options.map(([value, label]) => ({
    label,
    active: state.filters[filterKey].includes(value),
    action: "toggle-filter-option",
    key: filterKey,
    value,
  }));
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
                ${option.key ? `data-key="${escapeHtml(option.key)}"` : ""}
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
      ${renderCopyBlock(recommendations)}
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

function renderCopyBlock(recommendations) {
  const copyText = formatRecommendationNames(recommendations);
  const statusText = state.copyStatus === "copied" ? "已复制，可以直接发给黑黑" : "";
  const failureText = state.copyStatus === "failed" ? "复制被浏览器拦住了，已选中名单" : "";

  return `
    <section class="copy-block" aria-label="给黑黑复制">
      <div class="copy-heading">
        <div>
          <p class="eyebrow">Nora决定</p>
          <h3>给黑黑复制</h3>
        </div>
        <button class="primary-button" type="button" data-action="copy-recommendations">
          一键复制
        </button>
      </div>
      <pre class="copy-text">${escapeHtml(copyText)}</pre>
      ${statusText ? `<p class="copy-status" role="status">${escapeHtml(statusText)}</p>` : ""}
      ${failureText ? `<p class="copy-status copy-error" role="status">${escapeHtml(failureText)}</p>` : ""}
    </section>
  `;
}

function renderEmptyState() {
  return `
    <section class="empty-state">
      <h2>现在没有符合条件的店</h2>
      <p>可以试试放宽一个条件：</p>
      <div class="empty-actions">
        <button class="chip" type="button" data-action="relax" data-relax="route">路线都看看</button>
        <button class="chip" type="button" data-action="relax" data-relax="cuisine">菜系都看看</button>
        <button class="chip" type="button" data-action="relax" data-relax="small">加入小吃一下</button>
        <button class="chip" type="button" data-action="relax" data-relax="spice">接受不辣</button>
      </div>
    </section>
  `;
}

function renderRandomResult(card) {
  return `
    <div class="modal-backdrop" role="presentation" data-action="close-random">
      <section class="random-sheet" role="dialog" aria-modal="true" aria-label="随机结果">
        <p class="eyebrow">随机结果</p>
        <h2>今天抽到：${escapeHtml(card.collapsedTitle)}</h2>
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

  if (action === "toggle-cuisine") {
    state.filters.cuisines = toggleArrayValue(state.filters.cuisines, target.dataset.value);
    state.copyStatus = null;
    render();
    return;
  }

  if (action === "toggle-filter-option") {
    const filterKey = target.dataset.key;
    state.filters[filterKey] = toggleArrayValue(state.filters[filterKey], target.dataset.value);
    state.copyStatus = null;
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

  if (action === "copy-recommendations") {
    copyRecommendations();
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
  state.copyStatus = null;
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
  if (kind === "route") {
    state.filters.routeIntents = [];
  }

  if (kind === "cuisine") {
    state.filters.cuisines = [];
  }

  if (kind === "small") {
    state.filters.mealScales = [...new Set([...state.filters.mealScales, "小吃一下"])];
  }

  if (kind === "spice") {
    state.filters.spiceLevels = [...new Set([...state.filters.spiceLevels, "不辣"])];
  }

  state.copyStatus = null;
}

function resetState() {
  state.filters = cloneFilters(DEFAULT_FILTERS);
  state.expandedIds = new Set();
  state.activeEditor = null;
  state.randomResult = null;
  state.copyStatus = null;
}

async function copyRecommendations() {
  const recommendations = buildRecommendations(state.filters);
  const copyText = formatRecommendationNames(recommendations);

  try {
    await writeClipboardText(copyText);
    state.copyStatus = "copied";
    render();
  } catch {
    state.copyStatus = "failed";
    render();
    selectCopyBlockText();
  }
}

async function writeClipboardText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      copyWithCommand(text);
      return;
    }
  }

  copyWithCommand(text);
}

function copyWithCommand(text) {
  const copyHandler = (event) => {
    event.clipboardData?.setData("text/plain", text);
    event.preventDefault();
  };
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  document.addEventListener("copy", copyHandler);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);
  const didCopy = document.execCommand("copy");
  document.removeEventListener("copy", copyHandler);
  textarea.remove();

  if (!didCopy) {
    throw new Error("copy failed");
  }
}

function selectCopyBlockText() {
  const copyTextElement = document.querySelector(".copy-text");
  if (!copyTextElement) {
    return;
  }

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNodeContents(copyTextElement);
  selection?.removeAllRanges();
  selection?.addRange(range);
}

function cloneFilters(filters) {
  return {
    ...filters,
    routeIntents: [...filters.routeIntents],
    cuisines: [...filters.cuisines],
    mealScales: [...filters.mealScales],
    spiceLevels: [...filters.spiceLevels],
    travelModes: [...filters.travelModes],
    vetoedRestaurantIds: [...filters.vetoedRestaurantIds],
  };
}

function summarizeSelectedOptions(options, selectedValues, fallback) {
  const labels = selectedValues.map((value) => options.find(([option]) => option === value)?.[1] ?? value);

  if (!labels.length) {
    return fallback;
  }

  if (labels.length > 2) {
    return `${labels.slice(0, 2).join(" + ")} +${labels.length - 2}`;
  }

  return labels.join(" + ");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
