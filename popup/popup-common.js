const PopupBridge = (() => {
  const ext = globalThis.browser ?? globalThis.chrome;
  const STORAGE_KEY = "data-import-popup-config";
  const FLASH_KEY = "data-import-popup-flash";
  const SETTINGS_WINDOW_KEY = "data-import-settings-window-id";
  const LAST_BROWSER_TAB_KEY = "data-import-last-browser-tab-id";
  const SETTINGS_JSON_URL = ext.runtime.getURL("settings.json");
  const SETTINGS_PAGE_URL = ext.runtime.getURL("popup/settings.html");
  const FILE_FIELD_LABEL = "Поле для файлу";

  const DEFAULT_CONFIG = {
    sourceSite: "https://strikeplagiarism.com",
    targetSite: "https://cabinet.vucdc.edu.ua",
    sourceFields: ["Тема роботи", "Студент", "Керівник", "Група", FILE_FIELD_LABEL],
    targetFields: ["Назва теми", "ПІБ студента", "ПІБ керівника", "Шифр групи", FILE_FIELD_LABEL],
    fieldMappings: {
      source: [],
      target: []
    }
  };

  let memoryConfigCache = null;
  let initPromise = null;

  function cloneDefaults() {
    return {
      sourceSite: DEFAULT_CONFIG.sourceSite,
      targetSite: DEFAULT_CONFIG.targetSite,
      sourceFields: [...DEFAULT_CONFIG.sourceFields],
      targetFields: [...DEFAULT_CONFIG.targetFields],
      fieldMappings: {
        source: [],
        target: []
      }
    };
  }

  function normalizeFieldList(fields) {
    return Array.isArray(fields)
      ? fields
        .map((value) => typeof value === "string" ? value.trim() : "")
        .filter(Boolean)
      : [];
  }

  function ensureLegacyFileFieldLast(fields) {
    const cleaned = normalizeFieldList(fields);
    const regularItems = cleaned.filter((value) => value !== FILE_FIELD_LABEL);

    if (cleaned.includes(FILE_FIELD_LABEL)) {
      regularItems.push(FILE_FIELD_LABEL);
    }

    return regularItems;
  }

  function sanitizeFieldArray(fields, fallback) {
    const normalized = ensureLegacyFileFieldLast(fields);
    return normalized.length ? normalized : ensureLegacyFileFieldLast(fallback);
  }

  function getMappingDisplayValue(item, index) {
    const identifierValue = typeof item?.identifierValue === "string" ? item.identifierValue.trim() : "";
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const label = typeof item?.label === "string" ? item.label.trim() : "";

    if (identifierValue) {
      return identifierValue;
    }

    if (id) {
      return id;
    }

    if (name) {
      return name;
    }

    if (item?.isFileField) {
      return FILE_FIELD_LABEL;
    }

    return label || `Поле ${index + 1}`;
  }

  function sanitizeMappings(items, role, fieldLabels = []) {
    if (!Array.isArray(items)) {
      return [];
    }

    const prepared = items
      .filter((item) => item && typeof item === "object")
      .map((item, index) => {
        const fieldLabel = typeof fieldLabels[index] === "string" ? fieldLabels[index].trim() : "";
        const identifierType = typeof item.identifierType === "string" ? item.identifierType.trim() : "";
        const id = typeof item.id === "string" ? item.id.trim() : "";
        const name = typeof item.name === "string" ? item.name.trim() : "";
        const rawIdentifierValue = typeof item.identifierValue === "string" ? item.identifierValue.trim() : "";
        const isFileField = Boolean(
          item.isFileField ||
          identifierType === "file" ||
          fieldLabel === FILE_FIELD_LABEL
        );
        const normalizedIdentifierValue = isFileField && rawIdentifierValue === FILE_FIELD_LABEL
          ? ""
          : rawIdentifierValue;
        const identifierValue = normalizedIdentifierValue || id || name || (
          isFileField && fieldLabel !== FILE_FIELD_LABEL ? fieldLabel : ""
        );
        const label = isFileField
          ? FILE_FIELD_LABEL
          : (typeof item.label === "string" && item.label.trim()
            ? item.label.trim()
            : identifierValue || fieldLabel || `Поле ${index + 1}`);

        return {
          role,
          index,
          selector: typeof item.selector === "string" ? item.selector.trim() : "",
          label,
          tagName: typeof item.tagName === "string" ? item.tagName.trim() : "",
          kind: typeof item.kind === "string" ? item.kind.trim() : "",
          valueMode: typeof item.valueMode === "string" ? item.valueMode.trim() : "",
          sample: typeof item.sample === "string" ? item.sample.trim() : "",
          xpath: typeof item.xpath === "string" ? item.xpath.trim() : "",
          identifierType: isFileField ? "file" : identifierType,
          identifierValue,
          id,
          name,
          site: typeof item.site === "string" ? item.site.trim() : "",
          fileUrl: typeof item.fileUrl === "string" ? item.fileUrl.trim() : "",
          isFileField
        };
      })
      .filter((item) => item.isFileField || item.selector || item.xpath || item.identifierValue || item.id || item.name);

    const fileItem = prepared.find((item) => item.isFileField) || null;
    const regularItems = prepared.filter((item) => !item.isFileField);

    if (fileItem) {
      regularItems.push({
        ...fileItem,
        label: FILE_FIELD_LABEL,
        identifierType: "file",
        identifierValue: fileItem.identifierValue || fileItem.id || fileItem.name || "",
        isFileField: true
      });
    }

    return regularItems.map((item, index) => ({
      ...item,
      role,
      index,
      isFileField: Boolean(item.isFileField)
    }));
  }

  function deriveFieldListFromMappings(mappings, fallback) {
    if (Array.isArray(mappings) && mappings.length) {
      return mappings.map((item, index) => getMappingDisplayValue(item, index));
    }

    return sanitizeFieldArray(fallback, []);
  }

  function sanitizeConfig(value) {
    const base = cloneDefaults();

    if (!value || typeof value !== "object") {
      return base;
    }

    const sourceFieldInputs = sanitizeFieldArray(value.sourceFields, base.sourceFields);
    const targetFieldInputs = sanitizeFieldArray(value.targetFields, base.targetFields);
    const sourceMappings = sanitizeMappings(value.fieldMappings?.source, "source", sourceFieldInputs);
    const targetMappings = sanitizeMappings(value.fieldMappings?.target, "target", targetFieldInputs);

    return {
      sourceSite: typeof value.sourceSite === "string" && value.sourceSite.trim()
        ? value.sourceSite.trim()
        : base.sourceSite,
      targetSite: typeof value.targetSite === "string" && value.targetSite.trim()
        ? value.targetSite.trim()
        : base.targetSite,
      sourceFields: deriveFieldListFromMappings(sourceMappings, sourceFieldInputs),
      targetFields: deriveFieldListFromMappings(targetMappings, targetFieldInputs),
      fieldMappings: {
        source: sourceMappings,
        target: targetMappings
      }
    };
  }

  function isMeaningfulConfig(value) {
    if (!value || typeof value !== "object") {
      return false;
    }

    const hasSites =
      (typeof value.sourceSite === "string" && value.sourceSite.trim()) ||
      (typeof value.targetSite === "string" && value.targetSite.trim());

    const hasFields =
      (Array.isArray(value.sourceFields) && value.sourceFields.some((item) => String(item || "").trim())) ||
      (Array.isArray(value.targetFields) && value.targetFields.some((item) => String(item || "").trim()));

    const hasMappings =
      (Array.isArray(value.fieldMappings?.source) && value.fieldMappings.source.length > 0) ||
      (Array.isArray(value.fieldMappings?.target) && value.fieldMappings.target.length > 0);

    return Boolean(hasSites || hasFields || hasMappings);
  }

  async function readBundledSettingsFile() {
    try {
      const response = await fetch(SETTINGS_JSON_URL, { cache: "no-store" });

      if (!response.ok) {
        return null;
      }

      const text = await response.text();
      const trimmed = text.trim();

      if (!trimmed) {
        return null;
      }

      const parsed = JSON.parse(trimmed);

      if (!isMeaningfulConfig(parsed)) {
        return null;
      }

      return sanitizeConfig(parsed);
    } catch {
      return null;
    }
  }

  async function initializeConfig() {
    if (memoryConfigCache) {
      return memoryConfigCache;
    }

    if (initPromise) {
      return initPromise;
    }

    initPromise = (async () => {
      const stored = await ext.storage.local.get(STORAGE_KEY);

      if (stored?.[STORAGE_KEY]) {
        memoryConfigCache = sanitizeConfig(stored[STORAGE_KEY]);
        return memoryConfigCache;
      }

      const fileConfig = await readBundledSettingsFile();

      if (fileConfig) {
        memoryConfigCache = fileConfig;
        await ext.storage.local.set({ [STORAGE_KEY]: memoryConfigCache });
        return memoryConfigCache;
      }

      memoryConfigCache = cloneDefaults();
      await ext.storage.local.set({ [STORAGE_KEY]: memoryConfigCache });
      return memoryConfigCache;
    })();

    try {
      return await initPromise;
    } finally {
      initPromise = null;
    }
  }

  async function loadConfig() {
    return initializeConfig();
  }

  async function saveConfig(config) {
    const nextConfig = sanitizeConfig(config);
    memoryConfigCache = nextConfig;
    await ext.storage.local.set({ [STORAGE_KEY]: nextConfig });
    return nextConfig;
  }

  async function replaceConfigFromImportedJson(importedConfig) {
    const nextConfig = sanitizeConfig(importedConfig);
    memoryConfigCache = nextConfig;
    await ext.storage.local.set({ [STORAGE_KEY]: nextConfig });
    return nextConfig;
  }

  function formatSiteLabel(value) {
    if (!value) {
      return "Не вказано";
    }

    try {
      const url = new URL(value);
      return url.host || value;
    } catch {
      return value.replace(/^https?:\/\//, "");
    }
  }

  function isUsableBrowserTab(tab) {
    if (!tab?.id || typeof tab.url !== "string") {
      return false;
    }

    return !(
      tab.url.startsWith("about:") ||
      tab.url.startsWith("moz-extension://") ||
      tab.url.startsWith("chrome-extension://")
    );
  }

  async function getActiveTab() {
    const tabs = await ext.tabs.query({ active: true, currentWindow: true });
    return tabs[0];
  }

  async function rememberActiveBrowserTab() {
    const tab = await getActiveTab();

    if (!isUsableBrowserTab(tab)) {
      return null;
    }

    await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: tab.id });
    return tab;
  }

  async function getStoredBrowserTab() {
    const stored = await ext.storage.local.get(LAST_BROWSER_TAB_KEY);
    const tabId = stored?.[LAST_BROWSER_TAB_KEY];

    if (typeof tabId !== "number") {
      return null;
    }

    try {
      const tab = await ext.tabs.get(tabId);
      return isUsableBrowserTab(tab) ? tab : null;
    } catch {
      await ext.storage.local.remove(LAST_BROWSER_TAB_KEY);
      return null;
    }
  }

  async function findBestBrowserTab() {
    const storedTab = await getStoredBrowserTab();

    if (storedTab) {
      return storedTab;
    }

    if (!ext.windows?.getAll) {
      return null;
    }

    const windows = await ext.windows.getAll({ populate: true });
    const normalWindows = windows
      .filter((browserWindow) => browserWindow?.type === "normal")
      .sort((left, right) => Number(Boolean(right.focused)) - Number(Boolean(left.focused)));

    for (const browserWindow of normalWindows) {
      const activeTab = browserWindow.tabs?.find((tab) => tab.active && isUsableBrowserTab(tab));

      if (activeTab) {
        await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: activeTab.id });
        return activeTab;
      }
    }

    return null;
  }

  async function getSourceTabForPicker() {
    const currentTab = await getActiveTab();

    if (isUsableBrowserTab(currentTab)) {
      await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: currentTab.id });
      return currentTab;
    }

    return findBestBrowserTab();
  }

  async function focusWindow(windowId) {
    if (!ext.windows?.update || typeof windowId !== "number") {
      return null;
    }

    try {
      return await ext.windows.update(windowId, { focused: true });
    } catch {
      return null;
    }
  }

  async function getStoredSettingsWindowId() {
    const stored = await ext.storage.local.get(SETTINGS_WINDOW_KEY);
    return typeof stored?.[SETTINGS_WINDOW_KEY] === "number"
      ? stored[SETTINGS_WINDOW_KEY]
      : null;
  }

  async function setStoredSettingsWindowId(windowId) {
    if (typeof windowId === "number") {
      await ext.storage.local.set({ [SETTINGS_WINDOW_KEY]: windowId });
      return;
    }

    await ext.storage.local.remove(SETTINGS_WINDOW_KEY);
  }

  async function findExistingSettingsWindow() {
    const storedWindowId = await getStoredSettingsWindowId();

    if (typeof storedWindowId === "number" && ext.windows?.get) {
      try {
        const storedWindow = await ext.windows.get(storedWindowId, { populate: true });
        const hasSettingsTab = storedWindow?.tabs?.some((tab) =>
          typeof tab.url === "string" && tab.url.startsWith(SETTINGS_PAGE_URL)
        );

        if (hasSettingsTab) {
          return storedWindow;
        }
      } catch {
        await setStoredSettingsWindowId(null);
      }
    }

    if (!ext.windows?.getAll) {
      return null;
    }

    const windows = await ext.windows.getAll({ populate: true });

    for (const browserWindow of windows) {
      const hasSettingsTab = browserWindow?.tabs?.some((tab) =>
        typeof tab.url === "string" && tab.url.startsWith(SETTINGS_PAGE_URL)
      );

      if (hasSettingsTab) {
        await setStoredSettingsWindowId(browserWindow.id);
        return browserWindow;
      }
    }

    return null;
  }

  async function openSettingsPopup() {
    await rememberActiveBrowserTab();

    const existingWindow = await findExistingSettingsWindow();

    if (existingWindow?.id) {
      await focusWindow(existingWindow.id);
      return existingWindow;
    }

    if (!ext.windows?.create) {
      window.open(SETTINGS_PAGE_URL, "_blank", "width=980,height=820");
      return null;
    }

    const createdWindow = await ext.windows.create({
      url: SETTINGS_PAGE_URL,
      type: "popup",
      width: 850,
      height: 700,
      focused: true
    });

    if (typeof createdWindow?.id === "number") {
      await setStoredSettingsWindowId(createdWindow.id);
    }

    return createdWindow;
  }

  async function closeSettingsPopup() {
    if (ext.windows?.getCurrent && ext.windows?.remove) {
      try {
        const currentWindow = await ext.windows.getCurrent();

        if (typeof currentWindow?.id === "number") {
          await setStoredSettingsWindowId(null);
          await ext.windows.remove(currentWindow.id);
          return true;
        }
      } catch {
        // fallback below
      }
    }

    try {
      window.close();
      return true;
    } catch {
      return false;
    }
  }

  function setFlashStatus(message) {
    localStorage.setItem(FLASH_KEY, message);
  }

  function consumeFlashStatus() {
    const message = localStorage.getItem(FLASH_KEY);

    if (message) {
      localStorage.removeItem(FLASH_KEY);
    }

    return message;
  }

  return {
    ext,
    FILE_FIELD_LABEL,
    loadConfig,
    saveConfig,
    replaceConfigFromImportedJson,
    sanitizeConfig,
    formatSiteLabel,
    getActiveTab,
    getSourceTabForPicker,
    openSettingsPopup,
    closeSettingsPopup,
    setFlashStatus,
    consumeFlashStatus
  };
})();
