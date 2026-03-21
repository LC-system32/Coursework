const openSettingsBtn = document.getElementById("openSettingsBtn");
const importBtn = document.getElementById("importBtn");
const statusEl = document.getElementById("status");
const sourceSitePreviewEl = document.getElementById("sourceSitePreview");
const targetSitePreviewEl = document.getElementById("targetSitePreview");
const shortcutHintTextEl = document.getElementById("shortcutHintText");
let currentConfig = null;

function renderMainPreview(config) {
  sourceSitePreviewEl.textContent = PopupBridge.formatSiteLabel(config.sourceSite);
  targetSitePreviewEl.textContent = PopupBridge.formatSiteLabel(config.targetSite);
}

function setStatus(message) {
  statusEl.textContent = message;
}

function getMappings(role) {
  const list = Array.isArray(currentConfig?.fieldMappings?.[role])
    ? currentConfig.fieldMappings[role]
    : [];

  return list.filter(Boolean);
}
