importScripts(
  "background/background-constants.js",
  "background/background-debug-service.js",
  "background/background-tab-service.js",
  "background/background-picker-session-service.js",
  "background/background-file-service.js",
  "background/background-import-flow-service.js",
  "background/background-picker-message-service.js",
  "background/background-message-router-service.js",
  "background/background-command-service.js"
);

EXT.runtime.onMessage.addListener(handleRuntimeMessage);
registerQuickImportCommandListener();


async function handleExtensionInstalled(details) {
  if (!details || details.reason !== EXT.runtime.OnInstalledReason.UPDATE) {
    return;
  }

  await reloadTabsAfterExtensionUpdate();
}

EXT.runtime.onInstalled.addListener((details) => {
  handleExtensionInstalled(details).catch((error) => {
    console.error("EXTENSION_INSTALL_HANDLER_ERROR", error);
  });
});
