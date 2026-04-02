function normalizeUrl(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  if (/^https?:\/\//i.test(raw)) {
    return raw;
  }

  return `https://${raw}`;
}

function toOriginUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}/`;
  } catch {
    return rawUrl;
  }
}

function sameSite(tabUrl, wantedUrl) {
  try {
    const tab = new URL(tabUrl);
    const wanted = new URL(wantedUrl);
    return tab.origin === wanted.origin;
  } catch {
    return typeof tabUrl === "string" &&
      typeof wantedUrl === "string" &&
      tabUrl.startsWith(wantedUrl);
  }
}


function matchesConfiguredSiteInBackground(tabUrl, siteUrl) {
  try {
    const tab = new URL(tabUrl);
    const site = new URL(normalizeUrl(siteUrl));

    if (tab.origin !== site.origin) {
      return false;
    }

    const sitePath = site.pathname === "/" ? "" : site.pathname.replace(/\/+$/, "");
    return !sitePath || tab.pathname.startsWith(sitePath);
  } catch {
    return false;
  }
}

async function findOpenTabByConfiguredSite(siteUrl) {
  const normalizedSite = normalizeUrl(siteUrl);

  if (!normalizedSite) {
    return null;
  }

  const tabs = await EXT.tabs.query({});
  const matchingTabs = tabs.filter((tab) => tab.id && tab.url && matchesConfiguredSiteInBackground(tab.url, normalizedSite));

  if (!matchingTabs.length) {
    return null;
  }

  const activeMatch = matchingTabs.find((tab) => tab.active);
  return activeMatch || matchingTabs[0];
}

async function notifyExtension(message) {
  try {
    await EXT.runtime.sendMessage(message);
  } catch {
    // popup/settings may be closed
  }
}


async function pingContentReceiver(tabId) {
  try {
    await EXT.tabs.sendMessage(tabId, {
      type: "PING_CONTENT_SCRIPT"
    });

    return true;
  } catch {
    return false;
  }
}

function isInjectableTabUrl(tabUrl) {
  try {
    const url = new URL(tabUrl);
    return /^https?:$/i.test(url.protocol);
  } catch {
    return false;
  }
}

async function ensureTabHostPermission(tabId, context = "unknown") {
  const tab = await EXT.tabs.get(tabId);
  const tabUrl = String(tab?.url || "");

  if (!isInjectableTabUrl(tabUrl)) {
    await writeDebug("host-permission:unsupported-url", {
      tabId,
      context,
      url: tabUrl
    });
    return false;
  }

  await writeDebug("host-permission:manifest-assumed", {
    tabId,
    context,
    url: tabUrl
  });

  return true;
}

async function injectContentScripts(tabId) {
  if (!EXT.scripting?.executeScript) {
    return false;
  }

  await EXT.scripting.executeScript({
    target: { tabId },
    files: CONTENT_SCRIPT_FILES
  });

  return true;
}

async function ensureContentReceiver(tabId, context = "unknown") {
  const normalizedTabId = Number(tabId || 0);

  if (!normalizedTabId) {
    return false;
  }

  if (await pingContentReceiver(normalizedTabId)) {
    await writeDebug("receiver-ready", {
      tabId: normalizedTabId,
      context,
      strategy: "ping"
    });
    return true;
  }

  await writeDebug("ensure-injected:start", {
    tabId: normalizedTabId,
    context
  });

  const permissionReady = await ensureTabHostPermission(normalizedTabId, context);

  if (!permissionReady) {
    await writeDebug("ensure-injected:permission-denied", {
      tabId: normalizedTabId,
      context
    });
    return false;
  }

  try {
    const injected = await injectContentScripts(normalizedTabId);

    await writeDebug("ensure-injected:script-executed", {
      tabId: normalizedTabId,
      context,
      injected
    });
  } catch (error) {
    await writeDebug("ensure-injected:script-failed", {
      tabId: normalizedTabId,
      context,
      error: String(error?.message || error)
    });

    return false;
  }

  await new Promise((resolve) => setTimeout(resolve, 180));

  if (await pingContentReceiver(normalizedTabId)) {
    await writeDebug("ensure-injected:ping-after-ok", {
      tabId: normalizedTabId,
      context
    });
    return true;
  }

  await writeDebug("ensure-injected:ping-after-failed", {
    tabId: normalizedTabId,
    context
  });

  return false;
}

async function waitForTabReady(tabId) {
  const tab = await EXT.tabs.get(tabId);

  if (tab.status === "complete") {
    await writeDebug("tab-ready-immediate", { tabId, url: tab.url });
    return;
  }

  await writeDebug("tab-wait-start", {
    tabId,
    status: tab.status,
    url: tab.url
  });

  await new Promise((resolve) => {
    const listener = (updatedTabId, info) => {
      if (updatedTabId === tabId && info.status === "complete") {
        EXT.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };

    EXT.tabs.onUpdated.addListener(listener);
  });

  await writeDebug("tab-wait-complete", { tabId });
}

async function findOrCreateWorkingTab(siteUrl) {
  const tabs = await EXT.tabs.query({});
  const existingTab = tabs.find((tab) => tab.id && tab.url && sameSite(tab.url, siteUrl));

  if (existingTab?.id) {
    await EXT.tabs.update(existingTab.id, { active: true });

    if (typeof existingTab.windowId === "number") {
      await EXT.windows.update(existingTab.windowId, { focused: true });
    }

    await writeDebug("find-or-create:existing", {
      tabId: existingTab.id,
      url: existingTab.url
    });

    return existingTab;
  }

  const createdTab = await EXT.tabs.create({
    url: siteUrl,
    active: true
  });

  await writeDebug("find-or-create:created", {
    tabId: createdTab.id,
    url: createdTab.url
  });

  return createdTab;
}

async function prepareTargetTab(siteUrl) {
  const normalizedTarget = normalizeUrl(siteUrl);
  const tabs = await EXT.tabs.query({});
  const existingTab = tabs.find((tab) => tab.id && tab.url && sameSite(tab.url, normalizedTarget));

  if (existingTab?.id) {
    const needsNavigation = existingTab.url !== normalizedTarget;
    const updatedTab = await EXT.tabs.update(
      existingTab.id,
      needsNavigation
        ? { url: normalizedTarget, active: true }
        : { active: true }
    );

    if (typeof updatedTab?.windowId === "number") {
      await EXT.windows.update(updatedTab.windowId, { focused: true });
    }

    await waitForTabReady(updatedTab.id);

    await writeDebug("prepare-target-tab:existing", {
      tabId: updatedTab.id,
      url: normalizedTarget,
      navigated: needsNavigation
    });

    return updatedTab;
  }

  const createdTab = await EXT.tabs.create({
    url: normalizedTarget,
    active: true
  });

  if (typeof createdTab?.windowId === "number") {
    await EXT.windows.update(createdTab.windowId, { focused: true });
  }

  await waitForTabReady(createdTab.id);

  await writeDebug("prepare-target-tab:created", {
    tabId: createdTab.id,
    url: normalizedTarget
  });

  return createdTab;
}
