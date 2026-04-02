
function normalizeBrowserSiteUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

function matchesConfiguredSite(tabUrl, siteUrl) {
  try {
    const tab = new URL(tabUrl);
    const site = new URL(normalizeBrowserSiteUrl(siteUrl));

    if (tab.origin !== site.origin) {
      return false;
    }

    const sitePath = site.pathname === "/" ? "" : site.pathname.replace(/\/+$/, "");
    return !sitePath || tab.pathname.startsWith(sitePath);
  } catch {
    return false;
  }
}

async function findOpenTabBySite(siteUrl) {
  const normalizedSite = normalizeBrowserSiteUrl(siteUrl);

  if (!normalizedSite) {
    return null;
  }

  const tabs = await ext.tabs.query({});
  const matchingTabs = tabs.filter((tab) => isUsableBrowserTab(tab) && matchesConfiguredSite(tab.url, normalizedSite));

  if (!matchingTabs.length) {
    return null;
  }

  const activeTab = matchingTabs.find((tab) => tab.active);
  return activeTab || matchingTabs[0];
}

function formatSiteLabel(value) {
  if (!value) {
    return "Не вказано";
  }

  try {
    const url = new URL(value);
    return url.host || value;
  } catch {
    return value.replace(/^https?:\/\//, "");
  }
}

function isUsableBrowserTab(tab) {
  if (!tab?.id || typeof tab.url !== "string") {
    return false;
  }

  return !(
    tab.url.startsWith("about:") ||
    tab.url.startsWith("moz-extension://") ||
    tab.url.startsWith("chrome-extension://")
  );
}

async function getActiveTab() {
  const tabs = await ext.tabs.query({ active: true, currentWindow: true });
  return tabs[0];
}

async function rememberActiveBrowserTab() {
  const tab = await getActiveTab();

  if (!isUsableBrowserTab(tab)) {
    return null;
  }

  await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: tab.id });
  return tab;
}

async function getStoredBrowserTab() {
  const stored = await ext.storage.local.get(LAST_BROWSER_TAB_KEY);
  const tabId = stored?.[LAST_BROWSER_TAB_KEY];

  if (typeof tabId !== "number") {
    return null;
  }

  try {
    const tab = await ext.tabs.get(tabId);
    return isUsableBrowserTab(tab) ? tab : null;
  } catch {
    await ext.storage.local.remove(LAST_BROWSER_TAB_KEY);
    return null;
  }
}

async function findBestBrowserTab() {
  const storedTab = await getStoredBrowserTab();

  if (storedTab) {
    return storedTab;
  }

  if (!ext.windows?.getAll) {
    return null;
  }

  const windows = await ext.windows.getAll({ populate: true });
  const normalWindows = windows
    .filter((browserWindow) => browserWindow?.type === "normal")
    .sort((left, right) => Number(Boolean(right.focused)) - Number(Boolean(left.focused)));

  for (const browserWindow of normalWindows) {
    const activeTab = browserWindow.tabs?.find((tab) => tab.active && isUsableBrowserTab(tab));

    if (activeTab) {
      await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: activeTab.id });
      return activeTab;
    }
  }

  return null;
}

async function getSourceTabForPicker() {
  const currentTab = await getActiveTab();

  if (isUsableBrowserTab(currentTab)) {
    await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: currentTab.id });
    return currentTab;
  }

  return findBestBrowserTab();
}



async function getSourceTabForImport(siteUrl) {
  const matchedTab = await findOpenTabBySite(siteUrl);

  if (matchedTab && isUsableBrowserTab(matchedTab)) {
    await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: matchedTab.id });
    return matchedTab;
  }

  const activeTab = await getActiveTab();

  if (isUsableBrowserTab(activeTab) && matchesConfiguredSite(activeTab.url, siteUrl)) {
    await ext.storage.local.set({ [LAST_BROWSER_TAB_KEY]: activeTab.id });
    return activeTab;
  }

  return null;
}

function formatShortcutForDisplay(shortcut) {
  const raw = String(shortcut || "").trim();

  if (!raw) {
    return "Не призначено";
  }

  return raw
    .replace(/\+/g, " + ")
    .replace(/\s+/g, " ")
    .trim();
}

async function getCommandShortcut(commandName, fallbackShortcut = "") {
  if (!ext.commands?.getAll) {
    return formatShortcutForDisplay(fallbackShortcut);
  }

  try {
    const commands = await ext.commands.getAll();
    const matched = Array.isArray(commands)
      ? commands.find((command) => command?.name === commandName)
      : null;

    return formatShortcutForDisplay(matched?.shortcut || fallbackShortcut);
  } catch {
    return formatShortcutForDisplay(fallbackShortcut);
  }
}

async function getImportFlowState() {
  try {
    const response = await ext.runtime.sendMessage({
      type: "GET_IMPORT_FLOW_STATE"
    });

    return response && typeof response === "object"
      ? response
      : { ok: false, inProgress: false };
  } catch {
    return { ok: false, inProgress: false };
  }
}
