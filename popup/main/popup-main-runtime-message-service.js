function registerPopupRuntimeMessages() {
  PopupBridge.ext.runtime.onMessage?.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "IMPORT_FLOW_STATUS") {
      setStatus(message.text);
    }

    if (message.type === "IMPORT_FLOW_ERROR") {
      setStatus(message.text);
      showPopupToast(message.text, "error", 5600);
      importBtn.disabled = false;
    }

    if (message.type === "IMPORT_FLOW_COMPLETED") {
      setStatus(message.text);
      importBtn.disabled = false;
    }
  });
}
