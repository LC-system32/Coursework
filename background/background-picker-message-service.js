function isUnsupportedBrowserPage(url) {
  return !url ||
    url.startsWith("chrome://") ||
    url.startsWith("devtools://") ||
    url.startsWith("chrome-search://") ||
    url.startsWith("chrome-extension://") ||
    url.startsWith("about:") ||
    url.startsWith("view-source:");
}

async function sendPickerError(sendResponse, reason, message) {
  await notifyExtension({
    type: "FIELD_PICKER_ERROR",
    text: message
  });

  sendResponse({ ok: false, reason, message });
  return true;
}

async function resolvePickerTabs(sourceTabId, targetTabId) {
  let sourceTab;
  let targetTab;

  try {
    sourceTab = await EXT.tabs.get(sourceTabId);
  } catch (error) {
    await writeDebug("start-request:source-tab-failed", {
      sourceTabId,
      error: String(error?.message || error)
    });

    throw new Error("__SOURCE_TAB_UNAVAILABLE__");
  }

  try {
    targetTab = await EXT.tabs.get(targetTabId);
  } catch (error) {
    await writeDebug("start-request:target-tab-failed", {
      targetTabId,
      error: String(error?.message || error)
    });

    throw new Error("__TARGET_TAB_UNAVAILABLE__");
  }

  return { sourceTab, targetTab };
}

async function startFieldPickerSession(message, sender, sendResponse) {
  const configuredSourceSite = normalizeUrl(message.config?.sourceSite);
  const configuredTargetSite = normalizeUrl(message.config?.targetSite);
  const sourceTabId = Number(message.config?.sourceTabId || 0);
  const targetTabId = Number(message.config?.targetTabId || 0);

  await writeDebug("start-request", {
    sourceSiteFromConfig: configuredSourceSite,
    targetSite: configuredTargetSite,
    sourceTabId,
    targetTabId,
    senderTabId: sender?.tab?.id || null
  });

  if (!configuredSourceSite || !configuredTargetSite) {
    return sendPickerError(
      sendResponse,
      "missing-picker-sites",
      "ВАЖЛИВО! Спочатку вкажіть адреси сайту-джерела і сайту-приймача в налаштуваннях."
    );
  }

  if (!sourceTabId || !targetTabId) {
    return sendPickerError(
      sendResponse,
      "missing-picker-tab-id",
      "ВАЖЛИВО! Для вибору полів повинні бути відкриті вкладки сайту-джерела і сайту-приймача."
    );
  }

  let sourceTab;
  let targetTab;

  try {
    ({ sourceTab, targetTab } = await resolvePickerTabs(sourceTabId, targetTabId));
  } catch (error) {
    if (error?.message === "__SOURCE_TAB_UNAVAILABLE__") {
      return sendPickerError(
        sendResponse,
        "bad-source-tab-id",
        "Вкладка джерела більше недоступна. Відкрийте потрібну адресу і спробуйте ще раз."
      );
    }

    if (error?.message === "__TARGET_TAB_UNAVAILABLE__") {
      return sendPickerError(
        sendResponse,
        "bad-target-tab-id",
        "Вкладка приймача більше недоступна. Відкрийте потрібну адресу і спробуйте ще раз."
      );
    }

    throw error;
  }

  await writeDebug("start-request:source-tab-ok", {
    sourceTabId,
    url: sourceTab.url,
    title: sourceTab.title
  });

  await writeDebug("start-request:target-tab-ok", {
    targetTabId,
    url: targetTab.url,
    title: targetTab.title
  });

  if (isUnsupportedBrowserPage(sourceTab.url)) {
    return sendPickerError(
      sendResponse,
      "unsupported-source-tab",
      "Перший етап не можна запускати на службовій сторінці браузера."
    );
  }

  if (isUnsupportedBrowserPage(targetTab.url)) {
    return sendPickerError(
      sendResponse,
      "unsupported-target-tab",
      "Другий етап не можна запускати на службовій сторінці браузера."
    );
  }

  if (!sameSite(sourceTab.url, configuredSourceSite)) {
    return sendPickerError(
      sendResponse,
      "source-site-mismatch",
      "ВАЖЛИВО! Вкладка джерела не відповідає адресі, вказаній у полі «Джерело»."
    );
  }

  if (!sameSite(targetTab.url, configuredTargetSite)) {
    return sendPickerError(
      sendResponse,
      "target-site-mismatch",
      "ВАЖЛИВО! Вкладка приймача не відповідає адресі, вказаній у полі «Приймач»."
    );
  }

  pickerSession = {
    sessionId: `picker-${Date.now()}`,
    sourceSite: configuredSourceSite,
    targetSite: configuredTargetSite,
    sourceFields: [],
    targetFields: [],
    sourceTabId,
    targetTabId,
    phase: "source",
    awaitingResolution: false
  };

  await EXT.storage.local.remove(FIELD_PICKER_RESULT_KEY);
  await activateSourcePhase();

  sendResponse({ ok: true });
  return true;
}

async function handlePickerSelectFieldMessage(message, sendResponse) {
  await loadPickerSessionFromStorage();
  const phase = pickerSession.phase === "target" ? "target" : "source";
  const list = phase === "source"
    ? pickerSession.sourceFields
    : pickerSession.targetFields;

  const nextEntry = {
    ...message.entry,
    isFileField: Boolean(message.entry?.isFileField)
  };

  if (nextEntry.isFileField) {
    const regularItems = list.filter((item) => !item.isFileField);
    const existingFileItem = list.find((item) => item.isFileField);

    const mergedFileItem = {
      ...(existingFileItem || {}),
      ...nextEntry,
      label: FILE_FIELD_LABEL,
      isFileField: true
    };

    if (existingFileItem) {
      regularItems.push(mergedFileItem);

      if (phase === "source") {
        pickerSession.sourceFields = normalizeFieldOrder(regularItems);
      } else {
        pickerSession.targetFields = normalizeFieldOrder(regularItems);
      }
    } else {
      list.push(mergedFileItem);

      if (phase === "source") {
        pickerSession.sourceFields = normalizeFieldOrder(list);
      } else {
        pickerSession.targetFields = normalizeFieldOrder(list);
      }
    }

    await writeDebug("file-field-added", {
      phase,
      label: mergedFileItem.label,
      identifierType: mergedFileItem.identifierType || "",
      identifierValue: mergedFileItem.identifierValue || ""
    });

    const updatedList = phase === "source"
      ? pickerSession.sourceFields
      : pickerSession.targetFields;

    await savePickerSessionToStorage();

    sendResponse({ ok: true, count: updatedList.length });
    return true;
  }

  const key = fieldsEqualKey(nextEntry);
  const exists = list.some((item) => fieldsEqualKey(item) === key);

  if (!exists && (nextEntry.selector || nextEntry.xpath || nextEntry.identifierValue)) {
    list.push(nextEntry);

    if (phase === "source") {
      pickerSession.sourceFields = normalizeFieldOrder(list);
    } else {
      pickerSession.targetFields = normalizeFieldOrder(list);
    }
  }

  const updatedList = phase === "source"
    ? pickerSession.sourceFields
    : pickerSession.targetFields;

  await writeDebug("field-added", {
    phase,
    count: updatedList.length,
    label: nextEntry.label || "",
    selector: nextEntry.selector || "",
    xpath: nextEntry.xpath || "",
    isFileField: false
  });

  await savePickerSessionToStorage();

  sendResponse({ ok: true, count: updatedList.length });
  return true;
}

async function handlePickerFinishPhaseMessage(message, sendResponse) {
  await loadPickerSessionFromStorage();
  pickerSession.sourceFields = normalizeFieldOrder(pickerSession.sourceFields);
  pickerSession.targetFields = normalizeFieldOrder(pickerSession.targetFields);

  await writeDebug("phase-finish", {
    phase: pickerSession.phase,
    pageUrl: message.pageUrl || "",
    sourceCount: pickerSession.sourceFields.length,
    targetCount: pickerSession.targetFields.length
  });

  if (pickerSession.phase === "source") {
    try {
      await activateTargetPhase();
    } catch (error) {
      const text = String(error?.message || "Не вдалося перейти до етапу вибору на сайті-приймачі.");
      await notifyExtension({
        type: "FIELD_PICKER_ERROR",
        text
      });
      sendResponse({
        ok: false,
        reason: "activate-target-failed",
        message: text
      });
      return true;
    }

    sendResponse({ ok: true, nextPhase: "target" });
    return true;
  }

  const sourceCount = pickerSession.sourceFields.length;
  const targetCount = pickerSession.targetFields.length;

  if (sourceCount !== targetCount) {
    pickerSession.awaitingResolution = true;
    await savePickerSessionToStorage();

    sendResponse({
      ok: true,
      mismatch: true,
      sourceCount,
      targetCount
    });
    return true;
  }

  await finalizePickerSession();

  sendResponse({ ok: true, completed: true });
  return true;
}

async function handlePickerResolveMismatchMessage(message, sendResponse) {
  await loadPickerSessionFromStorage();
  await writeDebug("mismatch-decision", {
    action: message.action,
    sourceCount: pickerSession.sourceFields.length,
    targetCount: pickerSession.targetFields.length
  });

  if (message.action === "trim") {
    const nextLength = Math.min(
      pickerSession.sourceFields.length,
      pickerSession.targetFields.length
    );

    pickerSession.sourceFields = normalizeFieldOrder(
      pickerSession.sourceFields.slice(0, nextLength)
    );
    pickerSession.targetFields = normalizeFieldOrder(
      pickerSession.targetFields.slice(0, nextLength)
    );
    pickerSession.awaitingResolution = false;

    await finalizePickerSession();

    sendResponse({ ok: true, completed: true });
    return true;
  }

  await savePickerSessionToStorage();
  await restartPickerSession();

  sendResponse({ ok: true, restarted: true });
  return true;
}

async function handleFieldPickerMessage(message, sender, sendResponse) {
  if (message.type === "FIELD_PICKER_START") {
    return startFieldPickerSession(message, sender, sendResponse);
  }

  await loadPickerSessionFromStorage();

  if (!pickerSession) {
    sendResponse({ ok: false, reason: "no-session" });
    return true;
  }

  if (message.type === "PICKER_SELECT_FIELD") {
    return handlePickerSelectFieldMessage(message, sendResponse);
  }

  if (message.type === "PICKER_FINISH_PHASE") {
    return handlePickerFinishPhaseMessage(message, sendResponse);
  }

  if (message.type === "PICKER_RESOLVE_MISMATCH") {
    return handlePickerResolveMismatchMessage(message, sendResponse);
  }

  return false;
}
