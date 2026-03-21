async function initPopup() {
  currentConfig = await PopupBridge.loadConfig();
  renderMainPreview(currentConfig);
  await renderShortcutHint();

  setStatus(
    PopupBridge.consumeFlashStatus() ||
    "Схема переносу готова. Натисніть «Імпорт», щоб автоматично зчитати дані, перейти на сайт-приймач і заповнити форму."
  );
}

async function handleOpenSettingsClick() {
  try {
    await PopupBridge.openSettingsPopup();
    window.close();
  } catch (error) {
    console.error("OPEN_SETTINGS_POPUP_ERROR", error);
    setStatus("Не вдалося відкрити вікно налаштувань.");
  }
}
