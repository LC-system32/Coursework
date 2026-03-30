function createFieldRow(role, mapping, index) {
  return {
    role,
    mapping,
    index,
    title: mapping.isFileField ? FILE_FIELD_LABEL : `Поле ${index + 1}`,
    value: getMappingDisplayValue(mapping, index),
    placeholder: mapping.isFileField ? "id або name поля/лінка для файлу" : "id або name поля",
    isLocked: Boolean(mapping.isFileField)
  };
}

function syncRoleMappingsToUi(role) {
  const normalized = getRoleMappings(role).map((item) => ({ ...item }));

  if (role === "source") {
    settingsUiState.sourceMappings = normalized;
    return;
  }

  settingsUiState.targetMappings = normalized;
}

function renderFieldList(role) {
  syncRoleMappingsToUi(role);
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
