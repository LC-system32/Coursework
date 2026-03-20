const openSettingsBtn = document.getElementById("openSettingsBtn");
const importBtn = document.getElementById("importBtn");
const statusEl = document.getElementById("status");
const sourceSitePreviewEl = document.getElementById("sourceSitePreview");
const targetSitePreviewEl = document.getElementById("targetSitePreview");
const FILE_FIELD_LABEL = PopupBridge.FILE_FIELD_LABEL;

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

function validateConfigBeforeImport(config) {
  if (!config?.targetSite?.trim()) {
    return "ВАЖЛИВО! У налаштуваннях не вказано сайт-приймач для імпорту.";
  }

  const sourceMappings = Array.isArray(config?.fieldMappings?.source)
    ? config.fieldMappings.source.filter(Boolean)
    : [];
  const targetMappings = Array.isArray(config?.fieldMappings?.target)
    ? config.fieldMappings.target.filter(Boolean)
    : [];

  if (!sourceMappings.length || !targetMappings.length) {
    return "ВАЖЛИВО! Спочатку виберіть поля на обох сайтах у налаштуваннях плагіна.";
  }

  if (sourceMappings.length !== targetMappings.length) {
    return `ВАЖЛИВО! Кількість полів не збігається: з сайту ${sourceMappings.length}, на сайт ${targetMappings.length}. Імпорт не запущено.`;
  }

  const sourceFileCount = sourceMappings.filter((item) => item.isFileField).length;
  const targetFileCount = targetMappings.filter((item) => item.isFileField).length;

  if (sourceFileCount !== targetFileCount) {
    return "ВАЖЛИВО! Поле для файлу повинно бути вибране і на сайті-джерелі, і на сайті-приймачі.";
  }

  if (sourceFileCount > 1 || targetFileCount > 1) {
    return "ВАЖЛИВО! Поле для файлу повинно бути лише одне на кожній стороні.";
  }

  const emptySource = sourceMappings.find((item) => !item.identifierValue && !item.isFileField);
  if (emptySource) {
    return "ВАЖЛИВО! У схемі джерела є поле без id/name. Перевірте налаштування.";
  }

  const emptyTarget = targetMappings.find((item) => !item.identifierValue && !item.isFileField);
  if (emptyTarget) {
    return "ВАЖЛИВО! У схемі приймача є поле без id/name. Перевірте налаштування.";
  }

  return "";
}

async function initPopup() {
  currentConfig = await PopupBridge.loadConfig();
  renderMainPreview(currentConfig);

  setStatus(
    PopupBridge.consumeFlashStatus() ||
    "Схема переносу готова. Натисніть «Імпорт», щоб автоматично зчитати дані, перейти на сайт-приймач і заповнити форму."
  );
}

openSettingsBtn.addEventListener("click", async () => {
  try {
    await PopupBridge.openSettingsPopup();
    window.close();
  } catch (error) {
    console.error("OPEN_SETTINGS_POPUP_ERROR", error);
    setStatus("Не вдалося відкрити вікно налаштувань.");
  }
});

importBtn.addEventListener("click", async () => {
  importBtn.disabled = true;
  setStatus("Перевіряємо схему імпорту...");

  try {
    currentConfig = await PopupBridge.loadConfig();
    renderMainPreview(currentConfig);

    const validationMessage = validateConfigBeforeImport(currentConfig);
    if (validationMessage) {
      setStatus(validationMessage);
      return;
    }

    const activeTab = await PopupBridge.getActiveTab();

    if (!activeTab?.id || !activeTab.url) {
      setStatus("ВАЖЛИВО! Не вдалося знайти активну вкладку з сайтом-джерелом.");
      return;
    }

    setStatus("Зчитуємо дані з активної вкладки і запускаємо повний імпорт...");

    const response = await PopupBridge.ext.runtime.sendMessage({
      type: "RUN_IMPORT_FLOW",
      config: currentConfig,
      sourceTabId: activeTab.id
    });

    if (!response?.ok) {
      setStatus(response?.message || "Імпорт не вдалося запустити.");
      return;
    }

    setStatus("Імпорт запущено. Плагін сам перейде на сайт-приймач і виконає заповнення.");

    window.close();
  } catch (error) {
    console.error("IMPORT_START_ERROR", error);
    setStatus("Імпорт не вдалося запустити. Перевірте активну вкладку та налаштування.");
  } finally {
    importBtn.disabled = false;
  }
});

PopupBridge.ext.runtime.onMessage?.addListener((message) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "IMPORT_FLOW_STATUS") {
    setStatus(message.text);
  }

  if (message.type === "IMPORT_FLOW_ERROR") {
    setStatus(message.text);
    importBtn.disabled = false;
  }

  if (message.type === "IMPORT_FLOW_COMPLETED") {
    setStatus(message.text);
    importBtn.disabled = false;
  }
});

initPopup().catch((error) => {
  console.error("POPUP_INIT_ERROR", error);
  setStatus("Не вдалося завантажити налаштування.");
});