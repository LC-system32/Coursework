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
