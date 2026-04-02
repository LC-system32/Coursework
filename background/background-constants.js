const EXT = globalThis.browser ?? globalThis.chrome;

const FIELD_PICKER_RESULT_KEY = "data-import-field-picker-result";
const FIELD_PICKER_DEBUG_KEY = "data-import-field-picker-debug-log";
const PICKER_SESSION_KEY = "pickerSession";
const BACKGROUND_PICKER_SESSION_KEY = "data-import-background-picker-session";
const IMPORT_FILE_CACHE_PREFIX = "data-import-file-cache:";

const FILE_CACHE_TTL_MS = 10 * 60 * 1000;
const FILE_CHUNK_SIZE = 480000;
const FILE_FIELD_LABEL = "Поле для файлу";
const POPUP_CONFIG_STORAGE_KEY = "data-import-popup-config";
const QUICK_IMPORT_COMMAND_NAME = "run-direct-import";
const IMPORT_FLOW_LOCK_KEY = "data-import-active-import-flow";
const IMPORT_FLOW_LOCK_TTL_MS = 3 * 60 * 1000;

let pickerSession = null;
const importFileCache = new Map();

let activeImportFlow = null;

function getBackgroundSessionArea() {
  return EXT.storage?.session || EXT.storage?.local || null;
}

async function getBackgroundSessionValue(key) {
  const area = getBackgroundSessionArea();
  if (!area) {
    return undefined;
  }

  const stored = await area.get(key);
  return stored?.[key];
}

async function setBackgroundSessionValue(key, value) {
  const area = getBackgroundSessionArea();
  if (!area) {
    return;
  }

  await area.set({ [key]: value });
}

async function removeBackgroundSessionValue(key) {
  const area = getBackgroundSessionArea();
  if (!area) {
    return;
  }

  await area.remove(key);
}

function buildImportFileCacheStorageKey(cacheKey) {
  return `${IMPORT_FILE_CACHE_PREFIX}${String(cacheKey || "")}`;
}

async function getCachedImportFile(cacheKey) {
  const normalizedKey = String(cacheKey || "");
  if (!normalizedKey) {
    return null;
  }

  if (importFileCache.has(normalizedKey)) {
    return importFileCache.get(normalizedKey) || null;
  }

  const stored = await getBackgroundSessionValue(buildImportFileCacheStorageKey(normalizedKey));
  if (stored) {
    importFileCache.set(normalizedKey, stored);
    return stored;
  }

  return null;
}

async function setCachedImportFile(cacheKey, value) {
  const normalizedKey = String(cacheKey || "");
  if (!normalizedKey || !value) {
    return;
  }

  importFileCache.set(normalizedKey, value);
  await setBackgroundSessionValue(buildImportFileCacheStorageKey(normalizedKey), value);
}

async function deleteCachedImportFile(cacheKey) {
  const normalizedKey = String(cacheKey || "");
  if (!normalizedKey) {
    return;
  }

  importFileCache.delete(normalizedKey);
  await removeBackgroundSessionValue(buildImportFileCacheStorageKey(normalizedKey));
}

const CONTENT_SCRIPT_FILES = [
  "content/content-constants.js",
  "content/content-toast-service.js",
  "content/content-picker-dom-service.js",
  "content/content-picker-session-service.js",
  "content/content-form-io-service.js",
  "content/content-file-transfer-service.js",
  "content/content-import-flow-service.js",
  "content/content.js"
];
