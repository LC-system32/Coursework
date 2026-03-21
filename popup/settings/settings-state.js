const PICKER_RESULT_KEY = "data-import-field-picker-result";
const backBtn = document.getElementById("backBtn");
const cancelSettingsBtn = document.getElementById("cancelSettingsBtn");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const launchFieldPickerBtn = document.getElementById("launchFieldPickerBtn");
const addSourceFieldBtn = document.getElementById("addSourceFieldBtn");
const addTargetFieldBtn = document.getElementById("addTargetFieldBtn");
const exportSettingsBtn = document.getElementById("exportSettingsBtn");
const importSettingsBtn = document.getElementById("importSettingsBtn");
const importSettingsFileInput = document.getElementById("importSettingsFileInput");
const settingsStatusEl = document.getElementById("settingsStatus");

const sourceSiteInput = document.getElementById("sourceSiteInput");
const targetSiteInput = document.getElementById("targetSiteInput");
const sourceFieldsList = document.getElementById("sourceFieldsList");
const targetFieldsList = document.getElementById("targetFieldsList");

let fieldMappingsState = {
  source: [],
  target: []
};

let autoSaveTimer = null;
