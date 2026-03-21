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
