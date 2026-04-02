const ext = globalThis.browser ?? globalThis.chrome;
const CONFIG_KEY = "data-import-popup-config";
const PICKER_SESSION_KEY = "pickerSession";
const IMPORT_PAYLOAD_KEY = "data-import-payload";
const TOAST_CONTAINER_ID = "data-import-toast-container";
const PICKER_STYLE_ID = "data-import-picker-style";
const PICKER_HOVER_CLASS = "data-import-picker-hover";
const PICKER_SELECTED_CLASS = "data-import-picker-selected";
const OVERWRITE_DIALOG_ID = "data-import-overwrite-dialog";
const OVERWRITE_DIALOG_TIMER_MS = 75 * 1000;
const FILE_FIELD_LABEL = "Поле для файлу";

const CONTROL_SELECTOR = [
  "input:not([type='hidden']):not([disabled])",
  "textarea:not([disabled])",
  "select:not([disabled])",
  "md-select:not([disabled])",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[contenteditable='plaintext-only']"
].join(", ");

const FILE_UPLOAD_SELECTOR = [
  "input[type='file']",
  "[ngf-select]",
  "[ngf-drop]",
  "upload-file",
  "[name='files']",
  ".dragbox",
  ".dragbox-input"
].join(", ");

const TEXT_TAGS = new Set([
  "SPAN",
  "P",
  "DIV",
  "TD",
  "TH",
  "A",
  "LI",
  "DT",
  "DD",
  "STRONG",
  "B",
  "EM",
  "SMALL",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6"
]);

let pickerState = {
  active: false,
  phase: null,
  sessionId: "",
  hoverElement: null
};

let extensionContextInvalidated = false;
let extensionReloadToastShown = false;

function isExtensionContextInvalidatedError(error) {
  const message = String(error?.message || error || "");
  return message.includes("Extension context invalidated")
    || message.includes("Receiving end does not exist")
    || message.includes("message port closed")
    || message.includes("context invalidated");
}

function handleInvalidatedExtensionContext(error) {
  if (!isExtensionContextInvalidatedError(error)) {
    return false;
  }

  extensionContextInvalidated = true;
  console.warn(
    "Data Import Bridge: extension context invalidated. Refresh this tab after reloading or updating the extension.",
    error
  );

  if (!extensionReloadToastShown && typeof showToast === "function") {
    extensionReloadToastShown = true;
    showToast(
      "Розширення було оновлено або перезавантажено. Оновіть цю вкладку, щоб продовжити роботу.",
      "info",
      6200
    );
  }

  return true;
}

async function safeStorageLocalGet(key, fallbackValue = null) {
  try {
    const data = await ext.storage.local.get(key);
    return data?.[key] ?? fallbackValue;
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return fallbackValue;
    }
    throw error;
  }
}

async function safeStorageLocalSet(payload) {
  try {
    await ext.storage.local.set(payload);
    return { ok: true };
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return { ok: false, invalidated: true, message: "extension-context-invalidated" };
    }
    throw error;
  }
}

async function safeRuntimeSendMessage(message) {
  try {
    return await ext.runtime.sendMessage(message);
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return { ok: false, invalidated: true, message: "extension-context-invalidated" };
    }
    throw error;
  }
}
