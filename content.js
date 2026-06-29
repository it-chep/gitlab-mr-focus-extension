const STORAGE_KEY = "gitlabMrFocusFilters";
const LEGACY_STORAGE_KEY = "gitlabMrFocusMode";
const REMOVE_GAPS_ACTION_KEY = "gitlabMrFocusRemoveGapsAction";
const ROOT_ENABLED_CLASS = "mr-focus-enabled";
const HIDDEN_CLASS = "mr-focus-hidden";
const STYLE_ID = "mr-focus-style";
const FILTER_ORDER = ["e2e", "pb", "test", "mocks"];

const FILE_CONTAINER_SELECTORS = [
  "[data-file-container]",
  ".diff-file",
  ".file-holder",
  ".mr-file"
];

const FALLBACK_CONTAINER_SELECTORS = [
  ".diff-grid-row"
];

const PATH_SELECTORS = [
  "[data-file-path]",
  "[data-path]",
  "[data-qa-file-name]",
  ".file-title-name",
  ".file-header-content a",
  ".diff-file-header a",
  "a[href*='#diff-content-']",
  "a[title]"
];

let observer;
let currentFilters = [];
let extensionContextAlive = true;

function isGitLabMrPage() {
  return /\/(?:-\/)?merge_requests\/\d+/.test(window.location.pathname);
}

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .${HIDDEN_CLASS} {
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
}

function normalizePath(value) {
  const normalized = (value || "").trim().replace(/^\.\//, "");
  if (!normalized) {
    return "";
  }

  const singleSpaced = normalized.replace(/\s+/g, " ");
  const exactPathMatch = singleSpaced.match(/^\S+$/);
  if (exactPathMatch && looksLikePath(singleSpaced)) {
    return singleSpaced;
  }

  const compact = singleSpaced.replace(/\s+/g, "");
  const embeddedPathMatch = compact.match(
    /([a-z0-9_./-]+\.[a-z0-9]{1,8})(?=$|deleted|renamed|copied|mode|\d|->)/i
  );
  if (embeddedPathMatch) {
    return embeddedPathMatch[1];
  }

  return compact;
}

function readPathFromElement(element) {
  const attrCandidates = [
    element.getAttribute("data-file-path"),
    element.getAttribute("data-path"),
    element.getAttribute("data-qa-file-name"),
    element.getAttribute("title"),
    element.textContent
  ];

  for (const candidate of attrCandidates) {
    const normalized = normalizePath(candidate);
    if (looksLikePath(normalized)) {
      return normalized;
    }
  }

  return "";
}

function looksLikePath(value) {
  return Boolean(value) && (value.includes("/") || /\.[a-z0-9]+$/i.test(value));
}

function findHideTarget(element) {
  if (!element) {
    return null;
  }

  return element.closest(FILE_CONTAINER_SELECTORS.join(", ")) ||
    element.closest(FALLBACK_CONTAINER_SELECTORS.join(", "));
}

function getFilePath(container) {
  const containerPath = readPathFromElement(container);
  if (containerPath) {
    return containerPath;
  }

  for (const selector of PATH_SELECTORS) {
    const candidate = container.querySelector(selector);
    if (!candidate) {
      continue;
    }

    const path = readPathFromElement(candidate);
    if (path) {
      return path;
    }
  }

  return "";
}

function collectFileContainers() {
  const candidates = document.querySelectorAll(PATH_SELECTORS.join(", "));
  const uniqueContainers = new Set();

  for (const candidate of candidates) {
    const path = readPathFromElement(candidate);
    if (!path) {
      continue;
    }

    const target = findHideTarget(candidate);
    if (target) {
      uniqueContainers.add(target);
    }
  }

  if (uniqueContainers.size > 0) {
    return Array.from(uniqueContainers);
  }

  return Array.from(document.querySelectorAll(FILE_CONTAINER_SELECTORS.join(", ")));
}

function collectContainersFromNode(node, uniqueContainers) {
  if (!(node instanceof Element)) {
    return;
  }

  const ownTarget = findHideTarget(node);
  if (ownTarget) {
    uniqueContainers.add(ownTarget);
  }

  const pathNodes = [];
  if (PATH_SELECTORS.some((selector) => node.matches(selector))) {
    pathNodes.push(node);
  }

  for (const selector of PATH_SELECTORS) {
    const nestedNodes = node.querySelectorAll(selector);
    for (const nestedNode of nestedNodes) {
      pathNodes.push(nestedNode);
    }
  }

  for (const pathNode of pathNodes) {
    const path = readPathFromElement(pathNode);
    if (!path) {
      continue;
    }

    const target = findHideTarget(pathNode);
    if (target) {
      uniqueContainers.add(target);
    }
  }
}

function migrateLegacyMode(mode) {
  if (mode === "focus") {
    return ["pb", "test"];
  }

  return [];
}

function normalizeFilters(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return FILTER_ORDER.filter((filter) => value.includes(filter));
}

function shouldHideFile(path, filters) {
  if (!path || filters.length === 0) {
    return false;
  }

  if (filters.includes("e2e") && /(^|\/)e2e(\/|$)/.test(path)) {
    return true;
  }

  if (filters.includes("pb") && /(^|\/)internal\/pb\//.test(path)) {
    return true;
  }

  if (filters.includes("test") && /_test\.go$/i.test(path)) {
    return true;
  }

  return filters.includes("mocks") && (
    /(^|\/)mocks(\/|$)/i.test(path) ||
    /(?:^|\/)[^/]*_mocks?\.go$/i.test(path)
  );
}

function applyFiltersToContainers(containers, filters) {
  for (const container of containers) {
    const path = getFilePath(container);
    const hidden = shouldHideFile(path, filters);
    container.classList.toggle(HIDDEN_CLASS, hidden);
  }
}

function removeHiddenContainers() {
  const hiddenNodes = document.querySelectorAll(`.${HIDDEN_CLASS}`);
  const containers = new Set();
  const itemViews = new Set();

  for (const node of hiddenNodes) {
    const itemView = node.closest(".vue-recycle-scroller__item-view");
    if (itemView) {
      itemViews.add(itemView);
    }

    const target = findHideTarget(node) || node;
    containers.add(target);
  }

  for (const container of containers) {
    if (container instanceof Element) {
      container.remove();
    }
  }

  cleanupEmptyRecycleScrollerItems(itemViews);
}

function isIgnorableRecycleScrollerChild(element) {
  if (!element) {
    return true;
  }

  if (element.classList.contains(HIDDEN_CLASS)) {
    return true;
  }

  return element.classList.contains("gl-mb-5") && element.childElementCount === 0;
}

function cleanupEmptyRecycleScrollerItems(itemViews) {
  for (const itemView of itemViews) {
    const childElements = Array.from(itemView.children);
    if (childElements.length === 0) {
      itemView.remove();
      continue;
    }

    if (childElements.every((child) => isIgnorableRecycleScrollerChild(child))) {
      itemView.remove();
    }
  }
}

function applyFilters(filters) {
  if (!isGitLabMrPage()) {
    return;
  }

  ensureStyle();
  currentFilters = filters;

  document.documentElement.classList.toggle(ROOT_ENABLED_CLASS, filters.length > 0);
  document.documentElement.dataset.mrFocusMode = filters.length === 0 ? "off" : "custom";

  applyFiltersToContainers(collectFileContainers(), filters);
}

function handleMutations(mutations) {
  if (!isGitLabMrPage() || currentFilters.length === 0) {
    return;
  }

  const containers = new Set();
  for (const mutation of mutations) {
    for (const node of mutation.addedNodes) {
      collectContainersFromNode(node, containers);
    }
  }

  if (containers.size === 0) {
    return;
  }

  applyFiltersToContainers(containers, currentFilters);
}

function setupObserver() {
  if (observer) {
    return;
  }

  observer = new MutationObserver((mutations) => {
    handleMutations(mutations);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

function isExtensionContextInvalidated(error) {
  return error instanceof Error && /Extension context invalidated/i.test(error.message);
}

function teardownObserver() {
  if (!observer) {
    return;
  }

  observer.disconnect();
  observer = undefined;
}

async function readStorage(keys) {
  if (!extensionContextAlive) {
    return null;
  }

  try {
    return await chrome.storage.sync.get(keys);
  } catch (error) {
    if (isExtensionContextInvalidated(error)) {
      extensionContextAlive = false;
      teardownObserver();
      return null;
    }

    throw error;
  }
}

async function loadAndApplyFilters() {
  if (!isGitLabMrPage() || !extensionContextAlive) {
    return;
  }

  const stored = await readStorage([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  if (!stored) {
    return;
  }

  const filters = normalizeFilters(stored[STORAGE_KEY]);
  applyFilters(filters.length > 0 || Array.isArray(stored[STORAGE_KEY])
    ? filters
    : migrateLegacyMode(stored[LEGACY_STORAGE_KEY]));
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    areaName !== "sync" ||
    (!changes[STORAGE_KEY] && !changes[LEGACY_STORAGE_KEY] && !changes[REMOVE_GAPS_ACTION_KEY])
  ) {
    return;
  }

  const nextFilters = normalizeFilters(changes[STORAGE_KEY]?.newValue);
  if (changes[STORAGE_KEY]) {
    applyFilters(nextFilters);
    return;
  }

  if (changes[REMOVE_GAPS_ACTION_KEY]) {
    removeHiddenContainers();
    return;
  }

  applyFilters(migrateLegacyMode(changes[LEGACY_STORAGE_KEY]?.newValue));
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupObserver();
    void loadAndApplyFilters();
  }, { once: true });
} else {
  setupObserver();
  void loadAndApplyFilters();
}
