async function handleImportButtonClick() {
  importBtn.disabled = true;
  setStatus("Перевіряємо схему імпорту...");

  try {
    const importFlowState = await PopupBridge.getImportFlowState();

    if (importFlowState?.inProgress) {
      const message = "ВАЖЛИВО! Попередній імпорт ще не завершено. Дочекайтеся завершення поточного імпорту.";
      setStatus(message);
      showPopupToast(message, "error", 5200);
      return;
    }

    currentConfig = await PopupBridge.loadConfig();
    renderMainPreview(currentConfig);

    const validationMessage = validateConfigBeforeImport(currentConfig);
    if (validationMessage) {
      setStatus(validationMessage);
      showPopupToast(validationMessage, "error", 5200);
      return;
    }

    const sourceTab = await PopupBridge.getSourceTabForImport(currentConfig?.sourceSite);

    if (!sourceTab?.id || !sourceTab.url) {
      const message = "ВАЖЛИВО! Вкладка сайту-джерела зараз не відкрита. Відкрийте сайт-джерело з налаштувань плагіна і повторіть запуск імпорту.";
      setStatus(message);
      showPopupToast(message, "error", 6200);
      return;
    }

    setStatus("Знайдено вкладку джерела. Зчитуємо дані і запускаємо повний імпорт...");

    const response = await PopupBridge.ext.runtime.sendMessage({
      type: "RUN_IMPORT_FLOW",
      config: currentConfig,
      sourceTabId: sourceTab.id
    });

    if (!response?.ok) {
      const message = response?.message || "Імпорт не вдалося запустити.";
      setStatus(message);
      showPopupToast(message, "error", 5600);
      return;
    }

    setStatus("Імпорт запущено. Плагін сам перейде на сайт-приймач і виконає заповнення.");

    window.close();
  } catch (error) {
    console.error("IMPORT_START_ERROR", error);
    const message = "Імпорт не вдалося запустити. Перевірте активну вкладку та налаштування.";
    setStatus(message);
    showPopupToast(message, "error", 5600);
  } finally {
    importBtn.disabled = false;
  }
}
