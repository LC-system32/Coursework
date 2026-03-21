function bindSettingsPageEvents() {
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
      const message = error?.message || "ВАЖЛИВО! Не вдалося імпортувати файл налаштувань. Можливо, файл пошкоджений. Перевірте його вміст і спробуйте ще раз.";
      setStatus(message);
      showPopupToast(message, "error", 5600);
    } finally {
      event.target.value = "";
    }
  });

  launchFieldPickerBtn.addEventListener("click", () => {
    handleLaunchFieldPickerClick();
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
}
