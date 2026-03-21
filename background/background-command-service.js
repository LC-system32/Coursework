function registerQuickImportCommandListener() {
  EXT.commands?.onCommand?.addListener((command, tab) => {
    (async () => {
      if (command !== QUICK_IMPORT_COMMAND_NAME) {
        return;
      }

      const sourceTab = await resolveCommandSourceTab(tab);
      const config = await loadStoredImportConfig();
      const response = await startImportFlow(config, sourceTab?.id);

      if (!response?.ok) {
        await sendToastToTab(sourceTab?.id, response?.message || "Імпорт не вдалося запустити.", "error", 5600);
        return;
      }

      await sendToastToTab(
        sourceTab?.id,
        "Імпорт запущено. Плагін зчитає дані, перейде на сайт-приймач і виконає заповнення автоматично.",
        "info",
        4200
      );
    })().catch(async (error) => {
      const sourceTab = await resolveCommandSourceTab(tab);
      await sendToastToTab(
        sourceTab?.id,
        String(error?.message || "Імпорт не вдалося запустити."),
        "error",
        5600
      );
    });
  });
}
