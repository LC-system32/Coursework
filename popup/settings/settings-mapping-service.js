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
