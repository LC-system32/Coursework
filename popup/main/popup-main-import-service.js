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

    const activeTab = await PopupBridge.getActiveTab();

    if (!activeTab?.id || !activeTab.url) {
      const message = "ВАЖЛИВО! Не вдалося знайти активну вкладку з сайтом-джерелом.";
      setStatus(message);
      showPopupToast(message, "error", 5200);
      return;
    }

    setStatus("Зчитуємо дані з активної вкладки і запускаємо повний імпорт...");

    const response = await PopupBridge.ext.runtime.sendMessage({
      type: "RUN_IMPORT_FLOW",
      config: currentConfig,
      sourceTabId: activeTab.id
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
