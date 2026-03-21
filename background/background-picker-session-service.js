function normalizeFieldOrder(list) {
  const items = Array.isArray(list)
    ? list.filter(Boolean).map((item) => ({ ...item }))
    : [];

  const fileItem = items.find((item) => item.isFileField) || null;
  const regularItems = items.filter((item) => !item.isFileField);

  if (fileItem) {
    regularItems.push({
      ...fileItem,
      isFileField: true,
      label: FILE_FIELD_LABEL
    });
  }

  return regularItems.map((item, index) => ({
    ...item,
    index,
    isFileField: Boolean(item.isFileField)
  }));
}

function buildResultPayload() {
  return {
    source: normalizeFieldOrder(pickerSession?.sourceFields || []),
    target: normalizeFieldOrder(pickerSession?.targetFields || [])
  };
}

async function savePickerSessionToStorage() {
  if (!pickerSession) {
    await EXT.storage.local.remove(PICKER_SESSION_KEY);
    return;
  }

  await EXT.storage.local.set({
    [PICKER_SESSION_KEY]: {
      active: true,
      awaitingResolution: Boolean(pickerSession.awaitingResolution),
      phase: pickerSession.phase,
      sessionId: pickerSession.sessionId,
      sourceSite: pickerSession.sourceSite,
      targetSite: pickerSession.targetSite
    }
  });

  await writeDebug("picker-session-saved", {
    phase: pickerSession.phase,
    sessionId: pickerSession.sessionId,
    sourceSite: pickerSession.sourceSite,
    targetSite: pickerSession.targetSite,
    awaitingResolution: pickerSession.awaitingResolution
  });
}

async function clearPickerSessionFromStorage() {
  await EXT.storage.local.remove(PICKER_SESSION_KEY);
  await writeDebug("picker-session-cleared");
}

async function finalizePickerSession() {
  if (!pickerSession) {
    return;
  }

  pickerSession.sourceFields = normalizeFieldOrder(pickerSession.sourceFields);
  pickerSession.targetFields = normalizeFieldOrder(pickerSession.targetFields);

  const payload = buildResultPayload();

  await EXT.storage.local.set({
    [FIELD_PICKER_RESULT_KEY]: payload
  });

  await writeDebug("finalize-session", {
    sourceCount: payload.source.length,
    targetCount: payload.target.length
  });

  pickerSession = null;
  await clearPickerSessionFromStorage();

  await notifyExtension({
    type: "FIELD_PICKER_COMPLETED",
    payload
  });
}

async function activateSourcePhase() {
  if (!pickerSession) {
    return;
  }

  pickerSession.phase = "source";
  pickerSession.awaitingResolution = false;
  await savePickerSessionToStorage();

  try {
    const tab = await EXT.tabs.get(pickerSession.sourceTabId);

    await EXT.tabs.update(tab.id, { active: true });

    if (typeof tab.windowId === "number") {
      await EXT.windows.update(tab.windowId, { focused: true });
    }

    await waitForTabReady(tab.id);

    await writeDebug("activate-source-phase", {
      tabId: tab.id,
      url: tab.url
    });
  } catch (error) {
    await writeDebug("activate-source-phase-failed", {
      error: String(error?.message || error)
    });
  }

  await notifyExtension({
    type: "FIELD_PICKER_STATUS",
    text: "Активовано етап вибору з сайту. Наводьте курсор і клацайте по полях. Поле для файлу вибирайте останнім. ESC завершує етап."
  });
}

async function activateTargetPhase() {
  if (!pickerSession) {
    return;
  }

  pickerSession.phase = "target";
  pickerSession.awaitingResolution = false;
  await savePickerSessionToStorage();

  if (!pickerSession.targetTabId) {
    throw new Error("Не вдалося визначити відкриту вкладку сайту-приймача для вибору полів.");
  }

  const tab = await EXT.tabs.get(pickerSession.targetTabId);

  if (!tab?.id || !tab.url || !sameSite(tab.url, pickerSession.targetSite)) {
    throw new Error("Вкладка сайту-приймача більше не відповідає адресі з налаштувань. Відкрийте потрібну сторінку і запустіть вибір полів ще раз.");
  }

  await EXT.tabs.update(tab.id, { active: true });

  if (typeof tab.windowId === "number") {
    await EXT.windows.update(tab.windowId, { focused: true });
  }

  await waitForTabReady(tab.id);

  await writeDebug("activate-target-phase", {
    tabId: tab.id,
    url: tab.url
  });

  await notifyExtension({
    type: "FIELD_PICKER_STATUS",
    text: "Активовано етап вибору на сайт. Наводьте курсор і клацайте по полях. Поле для файлу вибирайте останнім. ESC завершує етап."
  });
}

function fieldsEqualKey(item) {
  return `${item?.identifierType || ""}:${item?.identifierValue || ""}:${item?.selector || ""}:${item?.xpath || ""}`;
}

async function restartPickerSession() {
  if (!pickerSession) {
    return;
  }

  pickerSession.sourceFields = [];
  pickerSession.targetFields = [];
  pickerSession.awaitingResolution = false;
  pickerSession.sessionId = `picker-${Date.now()}`;

  await EXT.storage.local.remove(FIELD_PICKER_RESULT_KEY);
  await writeDebug("restart-session");

  await activateSourcePhase();
}
