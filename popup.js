const STORAGE_KEY = "gitlabMrFocusMode";

const MODES = {
  off: {
    title: "Выключено",
    description: "Расширение ничего не скрывает."
  },
  focus: {
    title: "Фокус",
    description: "Скрывает generated-файлы из internal/pb/* и Go-тесты *_test.go."
  },
  e2e: {
    title: "Только e2e",
    description: "Скрывает все файлы, кроме тех, что лежат в директории e2e."
  }
};

const tabs = Array.from(document.querySelectorAll(".tab"));
const modeTitle = document.getElementById("mode-title");
const modeDescription = document.getElementById("mode-description");

async function getCurrentMode() {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  return stored[STORAGE_KEY] || "off";
}

async function setCurrentMode(mode) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: mode });
  render(mode);
}

function render(mode) {
  const config = MODES[mode] || MODES.off;

  modeTitle.textContent = config.title;
  modeDescription.textContent = config.description;

  for (const tab of tabs) {
    const active = tab.dataset.mode === mode;
    tab.classList.toggle("is-active", active);
    tab.setAttribute("aria-selected", String(active));
  }
}

for (const tab of tabs) {
  tab.addEventListener("click", () => {
    void setCurrentMode(tab.dataset.mode || "off");
  });
}

void getCurrentMode().then(render);
