document.addEventListener("mousemove", (event) => {
  if (!pickerState.active) {
    return;
  }

  setHoverElement(resolveFieldCandidate(event));
}, true);

document.addEventListener("mouseleave", () => {
  if (pickerState.active) {
    setHoverElement(null);
  }
}, true);

document.addEventListener("click", async (event) => {
  if (!pickerState.active || event.button !== 0) {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();

  const candidate = resolveFieldCandidate(event);

  if (!candidate) {
    showToast("Це не поле. Виберіть текстовий елемент або елемент введення.", "error");
    return;
  }

  await selectField(candidate);
}, true);

document.addEventListener("keydown", async (event) => {
  if (!pickerState.active || event.key !== "Escape") {
    return;
  }

  event.preventDefault();
  event.stopImmediatePropagation();
  await finishPickerPhase();
}, true);

window.addEventListener("focus", () => {
  syncPickerMode();
});

document.addEventListener("visibilitychange", () => {
  syncPickerMode();
});

ext.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName === "local" && changes[PICKER_SESSION_KEY]) {
    syncPickerMode();
  }
});

ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message?.type === "START_IMPORT") {
      const config = await getSyncedConfig(message.config);
      const collectResult = await collectImportPayload(config);
      if (!collectResult.ok) {
        showToast(collectResult.message, "error", 5200);
        sendResponse(collectResult);
        return;
      }

      await ext.storage.local.set({
        [IMPORT_PAYLOAD_KEY]: collectResult.payload
      });

      sendResponse(collectResult);
      return;
    }

    if (message?.type === "COLLECT_IMPORT_PAYLOAD") {
      const result = await collectImportPayload(message.config);
      if (!result.ok) {
        showToast(result.message, "error", 5200);
      }
      sendResponse(result);
      return;
    }

    if (message?.type === "APPLY_IMPORT_PAYLOAD") {
      const result = await applyImportPayload(message.config, message.payload);
      showToast(result.message, result.ok ? "success" : "error", 5600);
      sendResponse(result);
      return;
    }

    if (message?.type === "SHOW_EXTENSION_TOAST") {
      showToast(message.text || "", message.tone || "info", Number(message.duration || 4200));
      sendResponse({ ok: true });
      return;
    }

    sendResponse({ ok: false, reason: "unknown-message" });
  })().catch((error) => {
    console.error("CONTENT_MESSAGE_ERROR", error);
    sendResponse({ ok: false, message: String(error?.message || error) });
  });

  return true;
});

syncPickerMode();
