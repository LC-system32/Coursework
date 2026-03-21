function registerSettingsRuntimeMessages() {
  PopupBridge.ext.runtime.onMessage?.addListener((message) => {
    if (!message || typeof message !== "object") {
      return;
    }

    if (message.type === "FIELD_PICKER_COMPLETED") {
      applyPickerResult(message.payload).catch((error) => {
        console.error("APPLY_PICKER_RESULT_ERROR", error);
      });
    }

    if (message.type === "FIELD_PICKER_STATUS") {
      setStatus(message.text);
    }

    if (message.type === "FIELD_PICKER_ERROR") {
      launchFieldPickerBtn.disabled = false;
      setStatus(message.text);
      showPopupToast(message.text, "error", 5600);
    }
  });
}
