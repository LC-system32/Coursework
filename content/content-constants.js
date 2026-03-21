const ext = globalThis.browser ?? globalThis.chrome;
const CONFIG_KEY = "data-import-popup-config";
const PICKER_SESSION_KEY = "pickerSession";
const IMPORT_PAYLOAD_KEY = "data-import-payload";
const TOAST_CONTAINER_ID = "data-import-toast-container";
const PICKER_STYLE_ID = "data-import-picker-style";
const PICKER_HOVER_CLASS = "data-import-picker-hover";
const PICKER_SELECTED_CLASS = "data-import-picker-selected";
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
