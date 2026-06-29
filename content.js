const STORAGE_KEY = "gitlabMrFocusMode";
const ROOT_ENABLED_CLASS = "mr-focus-enabled";
const HIDDEN_CLASS = "mr-focus-hidden";
const STYLE_ID = "mr-focus-style";

const CONTAINER_SELECTORS = [
  "[data-file-container]",
  ".diff-file",
  ".file-holder",
  ".mr-file",
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
      display: none !important;
    }
  `;
  document.head.appendChild(style);
}

function normalizePath(value) {
  return (value || "").trim().replace(/^\.\//, "");
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

function shouldHideFile(path, mode) {
  if (!path || mode === "off") {
    return false;
  }

  if (mode === "focus") {
    return /(^|\/)internal\/pb\//.test(path) || /_test\.go$/i.test(path);
  }

  if (mode === "e2e") {
    return !/(^|\/)e2e(\/|$)/.test(path);
  }

  return false;
}

function applyMode(mode) {
  if (!isGitLabMrPage()) {
    return;
  }

  ensureStyle();

  document.documentElement.classList.toggle(ROOT_ENABLED_CLASS, mode !== "off");
  document.documentElement.dataset.mrFocusMode = mode;

  const containers = document.querySelectorAll(CONTAINER_SELECTORS.join(", "));
  for (const container of containers) {
    const path = getFilePath(container);
    const hidden = shouldHideFile(path, mode);
    container.classList.toggle(HIDDEN_CLASS, hidden);
  }
}

function setupObserver() {
  if (observer) {
    return;
  }

  observer = new MutationObserver(() => {
    void loadAndApplyMode();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function loadAndApplyMode() {
  if (!isGitLabMrPage()) {
    return;
  }

  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const mode = stored[STORAGE_KEY] || "off";
  applyMode(mode);
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "sync" || !changes[STORAGE_KEY]) {
    return;
  }

  applyMode(changes[STORAGE_KEY].newValue || "off");
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    setupObserver();
    void loadAndApplyMode();
  }, { once: true });
} else {
  setupObserver();
  void loadAndApplyMode();
}
