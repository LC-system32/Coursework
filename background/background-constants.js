const EXT = globalThis.browser ?? globalThis.chrome;

const FIELD_PICKER_RESULT_KEY = "data-import-field-picker-result";
const FIELD_PICKER_DEBUG_KEY = "data-import-field-picker-debug-log";
const PICKER_SESSION_KEY = "pickerSession";

const FILE_CACHE_TTL_MS = 10 * 60 * 1000;
const FILE_CHUNK_SIZE = 480000;
const FILE_FIELD_LABEL = "Поле для файлу";
const POPUP_CONFIG_STORAGE_KEY = "data-import-popup-config";
const QUICK_IMPORT_COMMAND_NAME = "run-direct-import";
const IMPORT_FLOW_LOCK_KEY = "data-import-active-import-flow";
const IMPORT_FLOW_LOCK_TTL_MS = 15 * 60 * 1000;

let pickerSession = null;
const importFileCache = new Map();

let activeImportFlow = null;
