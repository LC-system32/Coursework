bindSettingsPageEvents();
registerSettingsRuntimeMessages();

initSettingsPage().catch((error) => {
  console.error("SETTINGS_INIT_ERROR", error);
  setStatus("Не вдалося завантажити налаштування.");
});
