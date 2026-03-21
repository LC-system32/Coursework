async function focusWindow(windowId) {
  if (!ext.windows?.update || typeof windowId !== "number") {
    return null;
  }

  try {
    return await ext.windows.update(windowId, { focused: true });
  } catch {
    return null;
  }
}

async function getStoredSettingsWindowId() {
  const stored = await ext.storage.local.get(SETTINGS_WINDOW_KEY);
  return typeof stored?.[SETTINGS_WINDOW_KEY] === "number"
    ? stored[SETTINGS_WINDOW_KEY]
    : null;
}

async function setStoredSettingsWindowId(windowId) {
  if (typeof windowId === "number") {
    await ext.storage.local.set({ [SETTINGS_WINDOW_KEY]: windowId });
    return;
  }

  await ext.storage.local.remove(SETTINGS_WINDOW_KEY);
}

async function findExistingSettingsWindow() {
  const storedWindowId = await getStoredSettingsWindowId();

  if (typeof storedWindowId === "number" && ext.windows?.get) {
    try {
      const storedWindow = await ext.windows.get(storedWindowId, { populate: true });
      const hasSettingsTab = storedWindow?.tabs?.some((tab) =>
        typeof tab.url === "string" && tab.url.startsWith(SETTINGS_PAGE_URL)
      );

      if (hasSettingsTab) {
        return storedWindow;
      }
    } catch {
      await setStoredSettingsWindowId(null);
    }
  }

  if (!ext.windows?.getAll) {
    return null;
  }

  const windows = await ext.windows.getAll({ populate: true });

  for (const browserWindow of windows) {
    const hasSettingsTab = browserWindow?.tabs?.some((tab) =>
      typeof tab.url === "string" && tab.url.startsWith(SETTINGS_PAGE_URL)
    );

    if (hasSettingsTab) {
      await setStoredSettingsWindowId(browserWindow.id);
      return browserWindow;
    }
  }

  return null;
}

async function openSettingsPopup() {
  await rememberActiveBrowserTab();

  const existingWindow = await findExistingSettingsWindow();

  if (existingWindow?.id) {
    await focusWindow(existingWindow.id);
    return existingWindow;
  }

  if (!ext.windows?.create) {
    window.open(SETTINGS_PAGE_URL, "_blank", "width=980,height=820");
    return null;
  }

  const createdWindow = await ext.windows.create({
    url: SETTINGS_PAGE_URL,
    type: "popup",
    width: 850,
    height: 700,
    focused: true
  });

  if (typeof createdWindow?.id === "number") {
    await setStoredSettingsWindowId(createdWindow.id);
  }

  return createdWindow;
}

async function closeSettingsPopup() {
  if (ext.windows?.getCurrent && ext.windows?.remove) {
    try {
      const currentWindow = await ext.windows.getCurrent();

      if (typeof currentWindow?.id === "number") {
        await setStoredSettingsWindowId(null);
        await ext.windows.remove(currentWindow.id);
        return true;
      }
    } catch {
      // fallback below
    }
  }

  try {
    window.close();
    return true;
  } catch {
    return false;
  }
}
