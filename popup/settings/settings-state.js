const PICKER_RESULT_KEY = "data-import-field-picker-result";

const settingsUiDefaults = {
  sourceSite: "",
  targetSite: "",
  statusMessage: "Вкажіть сайти, відредагуйте список полів, імпортуйте/експортуйте конфіг або запустіть автоматичний вибір.",
  sourceMappings: [],
  targetMappings: [],
  launchFieldPickerDisabled: false
};

let settingsUiState = settingsUiDefaults;
let sourceSiteInputElement = null;
let autoSaveTimer = null;

const backBtn = null;
const cancelSettingsBtn = null;
const saveSettingsBtn = null;
const addSourceFieldBtn = null;
const addTargetFieldBtn = null;
const exportSettingsBtn = null;
const importSettingsBtn = null;
const sourceFieldsList = null;
const targetFieldsList = null;

function setSettingsUiStateProxy(proxy) {
  settingsUiState = proxy || settingsUiDefaults;
}

function setSourceSiteInputElement(element) {
  sourceSiteInputElement = element || null;
}

const launchFieldPickerBtn = {
  get disabled() {
    return Boolean(settingsUiState.launchFieldPickerDisabled);
  },
  set disabled(value) {
    settingsUiState.launchFieldPickerDisabled = Boolean(value);
  }
};

const settingsStatusEl = {
  get textContent() {
    return settingsUiState.statusMessage;
  },
  set textContent(value) {
    settingsUiState.statusMessage = String(value || "");
  }
};

function focusPrimeInputElement(element) {
  if (!element) {
    return;
  }

  if (typeof element.focus === "function") {
    element.focus();
    return;
  }

  const domNode = element.$el || element;

  if (typeof domNode?.focus === "function") {
    domNode.focus();
    return;
  }

  domNode?.querySelector?.("input")?.focus?.();
}

const sourceSiteInput = {
  get value() {
    return settingsUiState.sourceSite;
  },
  set value(value) {
    settingsUiState.sourceSite = String(value || "");
  },
  focus() {
    focusPrimeInputElement(sourceSiteInputElement);
  }
};

const targetSiteInput = {
  get value() {
    return settingsUiState.targetSite;
  },
  set value(value) {
    settingsUiState.targetSite = String(value || "");
  }
};

const importSettingsFileInput = {
  value: "",
  click() {}
};

let fieldMappingsState = {
  source: [],
  target: []
};
