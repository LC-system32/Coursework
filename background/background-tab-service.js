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

async function notifyExtension(message) {
  try {
    await EXT.runtime.sendMessage(message);
  } catch {
    // popup/settings may be closed
  }
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
