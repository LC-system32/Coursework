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
