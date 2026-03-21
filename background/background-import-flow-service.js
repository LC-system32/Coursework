async function readImportFlowLock() {
  const stored = await EXT.storage.local.get(IMPORT_FLOW_LOCK_KEY);
  const lock = stored?.[IMPORT_FLOW_LOCK_KEY];

  if (!lock || typeof lock !== "object") {
    return null;
  }

  const startedAt = Number(lock.startedAt || 0);
  if (!startedAt || Date.now() - startedAt > IMPORT_FLOW_LOCK_TTL_MS) {
    await clearImportFlowLock();
    return null;
  }

  return lock;
}

async function isImportFlowInProgress() {
  const storedLock = await readImportFlowLock();
  return Boolean(activeImportFlow?.inProgress || storedLock?.inProgress);
}

async function setImportFlowLock(lock) {
  activeImportFlow = lock;
  await EXT.storage.local.set({
    [IMPORT_FLOW_LOCK_KEY]: {
      inProgress: true,
      startedAt: Number(lock?.startedAt || Date.now()),
      sourceTabId: Number(lock?.sourceTabId || 0)
    }
  });
}

async function clearImportFlowLock() {
  activeImportFlow = null;
  await EXT.storage.local.remove(IMPORT_FLOW_LOCK_KEY);
}

function normalizeImportSiteForCompare(value) {
  const raw = normalizeUrl(value);

  if (!raw) {
    return "";
  }

  try {
    const url = new URL(raw);
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    const normalizedSearch = url.search || "";
    return `${url.origin}${normalizedPath}${normalizedSearch}`;
  } catch {
    return raw.replace(/\/+$/, "");
  }
}

function validateImportFlowConfig(config) {
  const sourceSite = normalizeUrl(config?.sourceSite);
  const targetSite = normalizeUrl(config?.targetSite);

  if (!sourceSite) {
    return "ВАЖЛИВО! У налаштуваннях не вказано сайт-джерело.";
  }

  if (!targetSite) {
    return "ВАЖЛИВО! У налаштуваннях не вказано сайт-приймач.";
  }

  if (normalizeImportSiteForCompare(sourceSite) === normalizeImportSiteForCompare(targetSite)) {
    return "ВАЖЛИВО! Сайт-джерело і сайт-приймач не можуть бути однаковими. Імпорт не запущено.";
  }

  const sourceMappings = Array.isArray(config?.fieldMappings?.source)
    ? config.fieldMappings.source.filter(Boolean)
    : [];

  const targetMappings = Array.isArray(config?.fieldMappings?.target)
    ? config.fieldMappings.target.filter(Boolean)
    : [];

  if (!sourceMappings.length || !targetMappings.length) {
    return "ВАЖЛИВО! Спочатку виберіть поля на обох сайтах у налаштуваннях плагіна.";
  }

  if (sourceMappings.length !== targetMappings.length) {
    return `ВАЖЛИВО! Кількість полів не збігається: з сайту ${sourceMappings.length}, на сайт ${targetMappings.length}. Імпорт не запущено.`;
  }

  return "";
}

async function notifyImportStatus(text, finalType = "IMPORT_FLOW_STATUS") {
  await notifyExtension({
    type: finalType,
    text
  });
}


async function sendToastToTab(tabId, text, tone = "info", duration = 4200) {
  const normalizedTabId = Number(tabId || 0);

  if (!normalizedTabId || !text) {
    return;
  }

  try {
    await EXT.tabs.sendMessage(normalizedTabId, {
      type: "SHOW_EXTENSION_TOAST",
      text,
      tone,
      duration
    });
  } catch {
    // content script may be unavailable on this tab
  }
}

async function loadStoredImportConfig() {
  const stored = await EXT.storage.local.get(POPUP_CONFIG_STORAGE_KEY);
  return stored?.[POPUP_CONFIG_STORAGE_KEY] || null;
}

async function resolveCommandSourceTab(commandTab) {
  if (commandTab?.id && typeof commandTab.url === "string") {
    return commandTab;
  }

  const tabs = await EXT.tabs.query({ active: true, currentWindow: true });
  return tabs[0] || null;
}

async function startImportFlow(config, sourceTabId) {
  if (await isImportFlowInProgress()) {
    const lockMessage = "ВАЖЛИВО! Попередній імпорт ще не завершено. Дочекайтеся завершення поточного імпорту.";
    await notifyImportStatus(lockMessage, "IMPORT_FLOW_ERROR");
    return { ok: false, message: lockMessage };
  }

  const validationMessage = validateImportFlowConfig(config);

  if (validationMessage) {
    await notifyImportStatus(validationMessage, "IMPORT_FLOW_ERROR");
    return { ok: false, message: validationMessage };
  }

  const normalizedSourceTabId = Number(sourceTabId || 0);

  if (!normalizedSourceTabId) {
    const errorMessage = "ВАЖЛИВО! Не вдалося визначити вкладку джерела для запуску імпорту.";
    await notifyImportStatus(errorMessage, "IMPORT_FLOW_ERROR");
    return { ok: false, message: errorMessage };
  }

  await setImportFlowLock({
    inProgress: true,
    startedAt: Date.now(),
    sourceTabId: normalizedSourceTabId
  });

  (async () => {
    try {
      await notifyImportStatus("Зчитуємо дані з полів на сайті-джерелі...");

      const collectResponse = await EXT.tabs.sendMessage(normalizedSourceTabId, {
        type: "COLLECT_IMPORT_PAYLOAD",
        config
      });

      if (!collectResponse?.ok || !collectResponse.payload) {
        throw new Error(collectResponse?.message || "Не вдалося зчитати дані на сайті-джерелі.");
      }

      await writeDebug("import-flow:payload-collected", {
        sourceTabId: normalizedSourceTabId,
        valueCount: collectResponse.payload.values?.length || 0,
        hasFileRef: Boolean(collectResponse.payload.fileRef)
      });

      await notifyImportStatus("Дані зчитано. Відкриваємо сайт-приймач із налаштувань...");
      const targetTab = await prepareTargetTab(config.targetSite);

      await notifyImportStatus("Сайт-приймач відкрито. Заповнюємо форму і завантажуємо файл...");
      const applyResponse = await EXT.tabs.sendMessage(targetTab.id, {
        type: "APPLY_IMPORT_PAYLOAD",
        config,
        payload: collectResponse.payload
      });

      if (!applyResponse?.ok) {
        throw new Error(applyResponse?.message || "Не вдалося заповнити форму на сайті-приймачі.");
      }

      await writeDebug("import-flow:completed", {
        targetTabId: targetTab.id,
        filledCount: applyResponse.filledCount || 0,
        fileUploaded: Boolean(applyResponse.fileUploaded)
      });

      await notifyImportStatus(
        applyResponse.message || "Імпорт завершено успішно.",
        "IMPORT_FLOW_COMPLETED"
      );
    } catch (error) {
      await writeDebug("import-flow:error", {
        error: String(error?.message || error)
      });

      await notifyImportStatus(
        String(error?.message || "Під час автоматичного імпорту сталася помилка."),
        "IMPORT_FLOW_ERROR"
      );
    } finally {
      await clearImportFlowLock();
    }
  })();

  return { ok: true };
}
