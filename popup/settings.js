const PICKER_RESULT_KEY = "data-import-field-picker-result";
const FILE_FIELD_LABEL = PopupBridge.FILE_FIELD_LABEL;

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

function setStatus(message) {
  settingsStatusEl.textContent = message;
}

function scheduleAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(async () => {
    try {
      const nextConfig = readDraftConfig();
      await PopupBridge.saveConfig(nextConfig);
    } catch (error) {
      console.error("AUTO_SAVE_ERROR", error);
    }
  }, 180);
}

function getRoleContainer(role) {
  return role === "source" ? sourceFieldsList : targetFieldsList;
}

function trimValue(value) {
  return String(value || "").trim();
}

function createEmptyMapping(role, index, options = {}) {
  const isFileField = Boolean(options.isFileField);
  const identifierValue = trimValue(options.identifierValue);

  return {
    role,
    index,
    selector: "",
    xpath: "",
    kind: isFileField ? "file" : "",
    valueMode: isFileField ? "file" : "",
    identifierType: isFileField ? "file" : "id-or-name",
    identifierValue,
    label: isFileField ? FILE_FIELD_LABEL : (identifierValue || `Поле ${index + 1}`),
    id: "",
    name: "",
    site: "",
    isFileField,
    fileUrl: ""
  };
}

function getMappingDisplayValue(item, index) {
  const identifierValue = trimValue(item?.identifierValue);
  const id = trimValue(item?.id);
  const name = trimValue(item?.name);
  const label = trimValue(item?.label);

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

function buildMappingsFromValues(role, values) {
  const normalizedValues = Array.isArray(values)
    ? values.map((value) => trimValue(value)).filter(Boolean)
    : [];

  if (!normalizedValues.length) {
    return [createEmptyMapping(role, 0, { isFileField: true, identifierValue: "" })];
  }

  const fileIndex = normalizedValues.lastIndexOf(FILE_FIELD_LABEL);

  return normalizedValues.map((value, index) => {
    const isFileField = fileIndex >= 0
      ? index === fileIndex
      : index === normalizedValues.length - 1;

    return createEmptyMapping(role, index, {
      isFileField,
      identifierValue: isFileField && value === FILE_FIELD_LABEL ? "" : value
    });
  });
}

function normalizeMappingsForRole(role, mappings, fallbackValues = []) {
  const rawList = Array.isArray(mappings)
    ? mappings
        .filter((item) => item && typeof item === "object")
        .map((item) => ({ ...item }))
    : [];

  const sourceList = rawList.length ? rawList : buildMappingsFromValues(role, fallbackValues);
  let fileItem = null;
  const regularItems = [];

  sourceList.forEach((item, index) => {
    const displayValue = getMappingDisplayValue(item, index);
    const hasExplicitFileFlag = Boolean(item.isFileField || trimValue(item.identifierType) === "file");
    const isFileField = hasExplicitFileFlag || (!fileItem && displayValue === FILE_FIELD_LABEL && index === sourceList.length - 1);
    const identifierValue = trimValue(item.identifierValue) || (
      isFileField && displayValue !== FILE_FIELD_LABEL ? displayValue : (!isFileField ? displayValue : "")
    );

    const nextItem = {
      ...createEmptyMapping(role, index, { isFileField, identifierValue }),
      ...item,
      role,
      index,
      isFileField,
      identifierType: isFileField ? "file" : (trimValue(item.identifierType) && trimValue(item.identifierType) !== "file"
        ? trimValue(item.identifierType)
        : "id-or-name"),
      identifierValue,
      label: isFileField
        ? FILE_FIELD_LABEL
        : (trimValue(item.label) || identifierValue || `Поле ${regularItems.length + 1}`),
      id: trimValue(item.id),
      name: trimValue(item.name),
      selector: trimValue(item.selector),
      xpath: trimValue(item.xpath),
      kind: trimValue(item.kind),
      valueMode: trimValue(item.valueMode),
      sample: trimValue(item.sample),
      site: trimValue(item.site),
      fileUrl: trimValue(item.fileUrl),
      tagName: trimValue(item.tagName)
    };

    if (nextItem.isFileField) {
      if (!fileItem) {
        fileItem = nextItem;
      }
      return;
    }

    regularItems.push(nextItem);
  });

  if (!fileItem) {
    const lastFallbackValue = trimValue(fallbackValues[fallbackValues.length - 1]);
    fileItem = createEmptyMapping(role, regularItems.length, {
      isFileField: true,
      identifierValue: lastFallbackValue && lastFallbackValue !== FILE_FIELD_LABEL ? lastFallbackValue : ""
    });
  }

  return [...regularItems, fileItem].map((item, index) => ({
    ...item,
    role,
    index,
    isFileField: Boolean(item.isFileField),
    identifierType: item.isFileField ? "file" : (trimValue(item.identifierType) || "id-or-name"),
    label: item.isFileField ? FILE_FIELD_LABEL : (trimValue(item.label) || trimValue(item.identifierValue) || `Поле ${index + 1}`)
  }));
}

function getRoleMappings(role) {
  fieldMappingsState[role] = normalizeMappingsForRole(role, fieldMappingsState[role]);
  return fieldMappingsState[role];
}

function insertBlankRegularField(role) {
  const mappings = getRoleMappings(role).map((item) => ({ ...item }));
  const insertIndex = Math.max(0, mappings.length - 1);
  mappings.splice(insertIndex, 0, createEmptyMapping(role, insertIndex, { isFileField: false, identifierValue: "" }));
  fieldMappingsState[role] = normalizeMappingsForRole(role, mappings);
  renderFieldList(role);
}

function updateMappingFromInput(role, index, value) {
  const mappings = getRoleMappings(role);
  const mapping = mappings[index] || createEmptyMapping(role, index, { isFileField: false, identifierValue: "" });
  const normalizedValue = trimValue(value);
  const previousValue = trimValue(mapping.identifierValue);
  const changedManually = normalizedValue !== previousValue;

  mapping.role = role;
  mapping.index = index;
  mapping.identifierValue = normalizedValue;
  mapping.label = mapping.isFileField ? FILE_FIELD_LABEL : (normalizedValue || `Поле ${index + 1}`);
  mapping.identifierType = mapping.isFileField ? "file" : "id-or-name";

  if (changedManually) {
    mapping.selector = "";
    mapping.xpath = "";
    mapping.id = normalizedValue;
    mapping.name = normalizedValue;
  }

  fieldMappingsState[role][index] = mapping;
}

function createFieldRow(role, mapping, index) {
  const row = document.createElement("div");
  row.className = "field-row";

  const label = document.createElement("label");
  label.className = "field-card";

  const title = document.createElement("span");
  title.className = "field-card__label";
  title.textContent = mapping.isFileField ? FILE_FIELD_LABEL : `Поле ${index + 1}`;

  const input = document.createElement("input");
  input.type = "text";
  input.value = getMappingDisplayValue(mapping, index);
  input.placeholder = mapping.isFileField ? "id або name поля/лінка для файлу" : "id або name поля";
  input.dataset.fieldInput = "1";
  input.dataset.role = role;
  input.title = mapping.isFileField
    ? "Поле для файлу завжди лишається останнім, але його id/name можна змінювати вручну."
    : "Вкажіть id або name поля.";

  input.addEventListener("input", () => {
    updateMappingFromInput(role, index, input.value);
    scheduleAutoSave();
  });

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "field-remove-button";
  removeBtn.setAttribute("aria-label", mapping.isFileField ? FILE_FIELD_LABEL : `Видалити поле ${index + 1}`);
  removeBtn.textContent = mapping.isFileField ? "🔒" : "×";
  removeBtn.disabled = mapping.isFileField;
  removeBtn.title = mapping.isFileField
    ? "Поле для файлу не можна видалити, але його id/name можна редагувати."
    : `Видалити поле ${index + 1}`;

  removeBtn.addEventListener("click", () => {
    if (mapping.isFileField) {
      return;
    }

    const nextMappings = getRoleMappings(role)
      .filter((_, itemIndex) => itemIndex !== index)
      .map((item) => ({ ...item }));

    fieldMappingsState[role] = normalizeMappingsForRole(role, nextMappings);
    renderFieldList(role);
    scheduleAutoSave();
  });

  label.append(title, input);
  row.append(label, removeBtn);
  return row;
}

function renderFieldList(role) {
  const container = getRoleContainer(role);
  const mappings = getRoleMappings(role);

  container.innerHTML = "";
  mappings.forEach((mapping, index) => {
    container.appendChild(createFieldRow(role, mapping, index));
  });
}

function fillSettingsForm(config) {
  sourceSiteInput.value = config.sourceSite || "";
  targetSiteInput.value = config.targetSite || "";

  fieldMappingsState = {
    source: normalizeMappingsForRole("source", config.fieldMappings?.source, config.sourceFields),
    target: normalizeMappingsForRole("target", config.fieldMappings?.target, config.targetFields)
  };

  renderFieldList("source");
  renderFieldList("target");
}

function getRoleFieldValues(role) {
  return getRoleMappings(role).map((item, index) => getMappingDisplayValue(item, index));
}

function readDraftConfig() {
  fieldMappingsState.source = normalizeMappingsForRole("source", fieldMappingsState.source);
  fieldMappingsState.target = normalizeMappingsForRole("target", fieldMappingsState.target);

  const sourceFields = getRoleFieldValues("source");
  const targetFields = getRoleFieldValues("target");

  return PopupBridge.sanitizeConfig({
    sourceSite: sourceSiteInput.value,
    targetSite: targetSiteInput.value,
    sourceFields,
    targetFields,
    fieldMappings: {
      source: fieldMappingsState.source,
      target: fieldMappingsState.target
    }
  });
}

async function closeSettingsPage() {
  try {
    const closed = await PopupBridge.closeSettingsPopup();

    if (!closed) {
      setStatus("Не вдалося закрити вікно налаштувань.");
    }
  } catch (error) {
    console.error("SETTINGS_WINDOW_CLOSE_ERROR", error);
    setStatus("Не вдалося закрити вікно налаштувань.");
  }
}

async function applyPickerResult(result) {
  if (!result) {
    return;
  }

  fieldMappingsState = {
    source: normalizeMappingsForRole("source", result.source),
    target: normalizeMappingsForRole("target", result.target)
  };

  renderFieldList("source");
  renderFieldList("target");

  const nextConfig = readDraftConfig();
  await PopupBridge.saveConfig(nextConfig);

  setStatus(
    `Вибір завершено. Обрано ${fieldMappingsState.source.length} полів з сайту і ${fieldMappingsState.target.length} полів на сайт.`
  );

  launchFieldPickerBtn.disabled = false;
}

async function hydratePendingPickerResult() {
  if (!PopupBridge.ext.storage?.local) {
    return;
  }

  const stored = await PopupBridge.ext.storage.local.get(PICKER_RESULT_KEY);

  if (stored?.[PICKER_RESULT_KEY]) {
    await applyPickerResult(stored[PICKER_RESULT_KEY]);
    await PopupBridge.ext.storage.local.remove(PICKER_RESULT_KEY);
  }
}

function normalizePickerUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

async function exportCurrentConfig() {
  const config = readDraftConfig();
  const savedConfig = await PopupBridge.saveConfig(config);

  const blob = new Blob([JSON.stringify(savedConfig, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "settings-export.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Файл settings-export.json підготовлено до завантаження.");
}

async function importConfigFromFile(file) {
  const text = await file.text();
  const imported = JSON.parse(text);
  const nextConfig = await PopupBridge.replaceConfigFromImportedJson(imported);
  fillSettingsForm(nextConfig);
  setStatus("Налаштування імпортовано. Поточний конфіг повністю замінено.");
}

async function initSettingsPage() {
  const config = await PopupBridge.loadConfig();
  fillSettingsForm(config);
  sourceSiteInput.focus();
  await hydratePendingPickerResult();

  const flashMessage = PopupBridge.consumeFlashStatus();
  if (flashMessage) {
    setStatus(flashMessage);
  }
}

backBtn.addEventListener("click", () => {
  closeSettingsPage().catch((error) => {
    console.error("CLOSE_SETTINGS_ERROR", error);
  });
});

cancelSettingsBtn.addEventListener("click", () => {
  closeSettingsPage().catch((error) => {
    console.error("CLOSE_SETTINGS_ERROR", error);
  });
});

sourceSiteInput.addEventListener("input", scheduleAutoSave);
targetSiteInput.addEventListener("input", scheduleAutoSave);

addSourceFieldBtn.addEventListener("click", () => {
  insertBlankRegularField("source");
  scheduleAutoSave();
});

addTargetFieldBtn.addEventListener("click", () => {
  insertBlankRegularField("target");
  scheduleAutoSave();
});

exportSettingsBtn.addEventListener("click", async () => {
  try {
    await exportCurrentConfig();
  } catch (error) {
    console.error("EXPORT_SETTINGS_ERROR", error);
    setStatus("Не вдалося експортувати налаштування.");
  }
});

importSettingsBtn.addEventListener("click", () => {
  importSettingsFileInput.value = "";
  setStatus("Оберіть JSON-файл для імпорту у вікно налаштувань.");
  importSettingsFileInput.click();
});

importSettingsFileInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];

  if (!file) {
    setStatus("Імпорт скасовано. Файл не вибрано.");
    return;
  }

  try {
    await importConfigFromFile(file);
  } catch (error) {
    console.error("IMPORT_SETTINGS_ERROR", error);
    setStatus("Не вдалося імпортувати JSON. Перевірте формат файлу.");
  } finally {
    event.target.value = "";
  }
});

launchFieldPickerBtn.addEventListener("click", async () => {
  const draftConfig = readDraftConfig();

  draftConfig.sourceSite = normalizePickerUrl(draftConfig.sourceSite);
  draftConfig.targetSite = normalizePickerUrl(draftConfig.targetSite);

  await PopupBridge.saveConfig(draftConfig);

  launchFieldPickerBtn.disabled = true;
  setStatus(
    "Майстер вибору запущено. Спочатку виберіть поля «з сайту», потім поля «на сайт». Поле для файлу вибирайте останнім на обох сайтах."
  );

  try {
    const sourceTab = await PopupBridge.getSourceTabForPicker();

    if (!sourceTab?.id || !sourceTab.url) {
      throw new Error("no-source-tab");
    }

    const response = await PopupBridge.ext.runtime.sendMessage({
      type: "FIELD_PICKER_START",
      config: {
        sourceSite: draftConfig.sourceSite,
        targetSite: draftConfig.targetSite,
        sourceTabId: sourceTab.id
      }
    });

    if (!response?.ok) {
      throw new Error(response?.reason || "start-failed");
    }
  } catch (error) {
    console.error("FIELD_PICKER_START_ERROR", error);
    launchFieldPickerBtn.disabled = false;
    setStatus("Не вдалося запустити режим вибору. Спочатку активуйте вкладку з сайтом-джерелом.");
  }
});

saveSettingsBtn.addEventListener("click", async () => {
  try {
    const nextConfig = readDraftConfig();
    await PopupBridge.saveConfig(nextConfig);
    PopupBridge.setFlashStatus("Налаштування збережено. Схема імпорту оновлена.");
    setStatus("Налаштування збережено.");
    closeSettingsPage().catch((error) => {
      console.error("CLOSE_SETTINGS_ERROR", error);
    });
  } catch (error) {
    console.error("SETTINGS_SAVE_ERROR", error);
    setStatus("Не вдалося зберегти налаштування.");
  }
});

PopupBridge.ext.runtime.onMessage?.addListener((message) => {
  if (!message || typeof message !== "object") {
    return;
  }

  if (message.type === "FIELD_PICKER_COMPLETED") {
    applyPickerResult(message.payload).catch((error) => {
      console.error("APPLY_PICKER_RESULT_ERROR", error);
    });
  }

  if (message.type === "FIELD_PICKER_STATUS") {
    setStatus(message.text);
  }

  if (message.type === "FIELD_PICKER_ERROR") {
    launchFieldPickerBtn.disabled = false;
    setStatus(message.text);
  }
});

initSettingsPage().catch((error) => {
  console.error("SETTINGS_INIT_ERROR", error);
  setStatus("Не вдалося завантажити налаштування.");
});
