const popupUiDefaults = {
  sourceSitePreview: "Не вказано",
  targetSitePreview: "Не вказано",
  statusMessage: "Схема переносу готова. Запустіть імпорт з активної вкладки.",
  shortcutHintText: "Швидкий запуск: Ctrl + Shift + F",
  importDisabled: false
};

let popupUiState = popupUiDefaults;
let currentConfig = null;

function setPopupUiStateProxy(proxy) {
  popupUiState = proxy || popupUiDefaults;
}

const importBtn = {
  get disabled() {
    return Boolean(popupUiState.importDisabled);
  },
  set disabled(value) {
    popupUiState.importDisabled = Boolean(value);
  }
};

function renderMainPreview(config) {
  popupUiState.sourceSitePreview = PopupBridge.formatSiteLabel(config?.sourceSite);
  popupUiState.targetSitePreview = PopupBridge.formatSiteLabel(config?.targetSite);
}

function setStatus(message) {
  popupUiState.statusMessage = String(message || "").trim();
}

function getMappings(role) {
  const list = Array.isArray(currentConfig?.fieldMappings?.[role])
    ? currentConfig.fieldMappings[role]
    : [];

  return list.filter(Boolean);
}
