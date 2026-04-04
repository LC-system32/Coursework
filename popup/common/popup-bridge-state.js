const ext = chrome;
const STORAGE_KEY = "data-import-popup-config";
const FLASH_KEY = "data-import-popup-flash";
const SETTINGS_WINDOW_KEY = "data-import-settings-window-id";
const LAST_BROWSER_TAB_KEY = "data-import-last-browser-tab-id";
const SETTINGS_JSON_URL = ext.runtime.getURL("settings.json");
const SETTINGS_PAGE_URL = ext.runtime.getURL("popup/settings.html");
const FILE_FIELD_LABEL = "";

const DEFAULT_CONFIG = {
  sourceSite: "",
  targetSite: "",
  sourceFields: [FILE_FIELD_LABEL],
  targetFields: [FILE_FIELD_LABEL],
  fieldMappings: {
    source: [],
    target: []
  }
};

let memoryConfigCache = null;
let initPromise = null;
