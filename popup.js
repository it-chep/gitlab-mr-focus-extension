const STORAGE_KEY = "gitlabMrFocusFilters";
const LEGACY_STORAGE_KEY = "gitlabMrFocusMode";
const FILTER_ORDER = ["e2e", "pb", "test", "mocks"];

const FILTER_TITLES = {
  e2e: "Скрыть e2e",
  pb: "internal/pb/*",
  test: "*_test.go",
  mocks: "mocks"
};

const selectAll = document.getElementById("select-all");
const checkboxes = Array.from(document.querySelectorAll(".filter-checkbox"));
const filterCheckboxes = checkboxes.filter((checkbox) => checkbox.dataset.filter);
const selectionTitle = document.getElementById("selection-title");
const selectionDescription = document.getElementById("selection-description");

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

async function getCurrentFilters() {
  const stored = await chrome.storage.sync.get([STORAGE_KEY, LEGACY_STORAGE_KEY]);
  const filters = normalizeFilters(stored[STORAGE_KEY]);

  if (filters.length > 0 || Array.isArray(stored[STORAGE_KEY])) {
    return filters;
  }

  return migrateLegacyMode(stored[LEGACY_STORAGE_KEY]);
}

async function setCurrentFilters(filters) {
  const normalized = normalizeFilters(filters);
  await chrome.storage.sync.set({
    [STORAGE_KEY]: normalized,
    [LEGACY_STORAGE_KEY]: normalized.length === 0 ? "off" : "custom"
  });
  render(normalized);
}

function render(filters) {
  const normalized = normalizeFilters(filters);

  for (const checkbox of filterCheckboxes) {
    checkbox.checked = normalized.includes(checkbox.dataset.filter || "");
  }

  selectAll.checked = normalized.length === FILTER_ORDER.length;
  selectAll.indeterminate = normalized.length > 0 && normalized.length < FILTER_ORDER.length;

  if (normalized.length === 0) {
    selectionTitle.textContent = "Ничего не скрывается";
    selectionDescription.textContent = "Все файлы в Merge Request остаются видимыми.";
    return;
  }

  const labels = normalized.map((filter) => FILTER_TITLES[filter]);
  selectionTitle.textContent = `Активно: ${labels.join(", ")}`;
  selectionDescription.textContent = "Фильтры можно комбинировать в любом наборе.";
}

selectAll.addEventListener("change", () => {
  void setCurrentFilters(selectAll.checked ? FILTER_ORDER : []);
});

for (const checkbox of filterCheckboxes) {
  checkbox.addEventListener("change", () => {
    const filters = filterCheckboxes
      .filter((item) => item.checked)
      .map((item) => item.dataset.filter || "");
    void setCurrentFilters(filters);
  });
}

void getCurrentFilters().then(render);
