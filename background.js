const EXT = globalThis.browser ?? globalThis.chrome;

const FIELD_PICKER_RESULT_KEY = "data-import-field-picker-result";
const FIELD_PICKER_DEBUG_KEY = "data-import-field-picker-debug-log";
const PICKER_SESSION_KEY = "pickerSession";

const FILE_CACHE_TTL_MS = 10 * 60 * 1000;
const FILE_CHUNK_SIZE = 480000;
const FILE_FIELD_LABEL = "Поле для файлу";

let pickerSession = null;
const importFileCache = new Map();

async function writeDebug(step, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    step,
    details
  };

  try {
    console.log("[FIELD_PICKER]", step, details);

    const stored = await EXT.storage.local.get(FIELD_PICKER_DEBUG_KEY);
    const list = Array.isArray(stored?.[FIELD_PICKER_DEBUG_KEY])
      ? stored[FIELD_PICKER_DEBUG_KEY]
      : [];

    list.push(entry);

    await EXT.storage.local.set({
      [FIELD_PICKER_DEBUG_KEY]: list.slice(-100)
    });
  } catch (error) {
    console.error("[FIELD_PICKER][DEBUG_WRITE_FAILED]", error);
  }
}

function cleanupExpiredFileCache() {
  const now = Date.now();

  for (const [cacheKey, item] of importFileCache.entries()) {
    if (!item?.createdAt || now - item.createdAt > FILE_CACHE_TTL_MS) {
      importFileCache.delete(cacheKey);
    }
  }
}

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

  const tab = await findOrCreateWorkingTab(pickerSession.targetSite);
  pickerSession.targetTabId = tab.id;

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

function extractDriveFileId(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  const directPatterns = [
    /\/file\/d\/([a-zA-Z0-9_-]+)/i,
    /\/document\/d\/([a-zA-Z0-9_-]+)/i,
    /\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i,
    /\/presentation\/d\/([a-zA-Z0-9_-]+)/i,
    /\/forms\/d\/([a-zA-Z0-9_-]+)/i,
    /\/d\/([a-zA-Z0-9_-]+)/i,
    /^([a-zA-Z0-9_-]{10,})$/
  ];

  for (const pattern of directPatterns) {
    const match = raw.match(pattern);
    if (match?.[1]) {
      return match[1];
    }
  }

  try {
    const url = new URL(raw);
    const params = url.searchParams;

    return (
      params.get("id") ||
      params.get("fileId") ||
      params.get("docid") ||
      ""
    );
  } catch {
    return "";
  }
}

function normalizeFileReference(fileRef) {
  if (typeof fileRef === "string") {
    const sourceUrl = fileRef.trim();

    return {
      provider: sourceUrl.includes("drive.google.com") || sourceUrl.includes("drive.usercontent.google.com")
        ? "gdrive"
        : "unknown",
      sourceUrl,
      fileId: extractDriveFileId(sourceUrl),
      fileName: "",
      mimeType: "application/pdf"
    };
  }

  const sourceUrl = String(fileRef?.sourceUrl || fileRef?.url || fileRef?.href || "").trim();
  const rawFileId = String(fileRef?.fileId || fileRef?.id || "").trim();
  const fileId = rawFileId || extractDriveFileId(sourceUrl);
  const fileName = String(fileRef?.fileName || fileRef?.name || "").trim();
  const mimeType = String(fileRef?.mimeType || "").trim() || "application/pdf";
  const provider = String(fileRef?.provider || "").trim() || (
    sourceUrl.includes("drive.google.com") || sourceUrl.includes("drive.usercontent.google.com")
      ? "gdrive"
      : "unknown"
  );

  return {
    provider,
    sourceUrl,
    fileId,
    fileName,
    mimeType
  };
}

function decodeLikelyLatin1AsUtf8(value) {
  const raw = String(value || "");
  if (!raw) {
    return "";
  }

  if (!/[ÐÑ]/.test(raw)) {
    return raw;
  }

  try {
    const bytes = Array.from(raw, (char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`);
    return decodeURIComponent(bytes.join(""));
  } catch {
    return raw;
  }
}

function parseFileNameFromDisposition(value) {
  const raw = String(value || "");

  if (!raw) {
    return "";
  }

  const utfMatch = raw.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) {
    try {
      return decodeLikelyLatin1AsUtf8(decodeURIComponent(utfMatch[1]).replace(/^"|"$/g, ""));
    } catch {
      return decodeLikelyLatin1AsUtf8(utfMatch[1].replace(/^"|"$/g, ""));
    }
  }

  const plainMatch = raw.match(/filename="?([^";]+)"?/i);
  if (plainMatch?.[1]) {
    return decodeLikelyLatin1AsUtf8(plainMatch[1]);
  }

  return "";
}

async function blobToBase64(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(reader.result || "");
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };

    reader.onerror = () => reject(reader.error || new Error("blob-to-base64-failed"));
    reader.readAsDataURL(blob);
  });
}

function decodeDriveDownloadUrl(rawUrl) {
  return String(rawUrl || "")
    .replace(/\\u003d/g, "=")
    .replace(/\\u0026/g, "&")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");
}

async function tryFetchBinary(url) {
  const response = await fetch(url, {
    credentials: "include",
    redirect: "follow"
  });

  if (!response.ok) {
    throw new Error(`download-failed:${response.status}`);
  }

  const contentType = response.headers.get("content-type") || "";
  const disposition = response.headers.get("content-disposition") || "";

  if (/text\/html/i.test(contentType) && !/attachment/i.test(disposition)) {
    const html = await response.text();

    const downloadUrlMatch = html.match(/"downloadUrl":"([^"]+)"/i);
    if (downloadUrlMatch?.[1]) {
      return tryFetchBinary(decodeDriveDownloadUrl(downloadUrlMatch[1]));
    }

    const confirmMatch = html.match(/[?&]confirm=([0-9A-Za-z_-]+)/i);
    if (confirmMatch?.[1]) {
      const retryUrl = `${url}${url.includes("?") ? "&" : "?"}confirm=${confirmMatch[1]}`;
      return tryFetchBinary(retryUrl);
    }

    throw new Error("download-returned-html");
  }

  const blob = await response.blob();

  return {
    blob,
    contentType: blob.type || contentType || "application/octet-stream",
    fileName: parseFileNameFromDisposition(disposition)
  };
}

async function downloadImportFile(fileRef) {
  cleanupExpiredFileCache();

  const normalizedRef = normalizeFileReference(fileRef);
  const sourceUrl = normalizedRef.sourceUrl;
  const fileId = normalizedRef.fileId;

  if (!sourceUrl) {
    throw new Error("missing-file-reference");
  }

  const candidateUrls = [];

  if (fileId) {
    candidateUrls.push(
      `https://drive.usercontent.google.com/download?id=${encodeURIComponent(fileId)}&export=download&confirm=t`,
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}&confirm=t`,
      `https://drive.google.com/uc?export=download&id=${encodeURIComponent(fileId)}`
    );
  }

  candidateUrls.push(sourceUrl);

  const uniqueCandidateUrls = [...new Set(candidateUrls.filter(Boolean))];

  let lastError = null;
  let fileData = null;

  for (const candidateUrl of uniqueCandidateUrls) {
    try {
      fileData = await tryFetchBinary(candidateUrl);

      if (fileData?.blob) {
        break;
      }
    } catch (error) {
      lastError = error;

      await writeDebug("file-download-attempt-failed", {
        candidateUrl,
        error: String(error?.message || error),
        fileId,
        sourceUrl
      });
    }
  }

  if (!fileData?.blob) {
    if (!fileId) {
      throw new Error("missing-file-reference");
    }

    throw lastError || new Error("file-download-failed");
  }

  const base64 = await blobToBase64(fileData.blob);
  const chunks = [];

  for (let index = 0; index < base64.length; index += FILE_CHUNK_SIZE) {
    chunks.push(base64.slice(index, index + FILE_CHUNK_SIZE));
  }

  const inferredFileId = fileId || extractDriveFileId(sourceUrl) || "file";
  const safeName = fileData.fileName || normalizedRef.fileName || `imported-${inferredFileId}.pdf`;
  const cacheKey = `file-cache-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const mimeType = /application\/octet-stream/i.test(fileData.contentType || "")
    ? (safeName.toLowerCase().endsWith(".pdf") ? "application/pdf" : (normalizedRef.mimeType || "application/octet-stream"))
    : (fileData.contentType || normalizedRef.mimeType || "application/pdf");

  importFileCache.set(cacheKey, {
    createdAt: Date.now(),
    fileName: safeName,
    mimeType,
    size: fileData.blob.size,
    chunks
  });

  await writeDebug("file-downloaded", {
    cacheKey,
    fileId: inferredFileId,
    fileName: safeName,
    mimeType,
    size: fileData.blob.size,
    chunkCount: chunks.length,
    sourceUrl
  });

  return {
    ok: true,
    cacheKey,
    fileName: safeName,
    mimeType,
    size: fileData.blob.size,
    chunkCount: chunks.length
  };
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

function validateImportFlowConfig(config) {
  const targetSite = normalizeUrl(config?.targetSite);

  if (!targetSite) {
    return "ВАЖЛИВО! У налаштуваннях не вказано сайт-приймач.";
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

EXT.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    cleanupExpiredFileCache();

    if (!message || typeof message !== "object") {
      sendResponse({ ok: false, reason: "bad-message" });
      return;
    }

    if (message.type === "FIELD_PICKER_GET_DEBUG_LOG") {
      const stored = await EXT.storage.local.get(FIELD_PICKER_DEBUG_KEY);

      sendResponse({
        ok: true,
        log: Array.isArray(stored?.[FIELD_PICKER_DEBUG_KEY])
          ? stored[FIELD_PICKER_DEBUG_KEY]
          : []
      });
      return;
    }

    if (message.type === "FIELD_PICKER_CLEAR_DEBUG_LOG") {
      await EXT.storage.local.remove(FIELD_PICKER_DEBUG_KEY);
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "DOWNLOAD_IMPORT_FILE") {
      try {
        const result = await downloadImportFile(message.fileRef);
        sendResponse(result);
      } catch (error) {
        const normalizedRef = normalizeFileReference(message.fileRef);

        await writeDebug("file-download-failed", {
          error: String(error?.message || error),
          sourceUrl: normalizedRef.sourceUrl,
          fileId: normalizedRef.fileId,
          provider: normalizedRef.provider
        });

        sendResponse({
          ok: false,
          reason: "download-failed",
          message: String(error?.message || error)
        });
      }
      return;
    }

    if (message.type === "GET_IMPORTED_FILE_CHUNK") {
      const cacheItem = importFileCache.get(String(message.cacheKey || ""));
      const chunkIndex = Number(message.chunkIndex || 0);

      if (!cacheItem || !cacheItem.chunks[chunkIndex]) {
        sendResponse({ ok: false, reason: "missing-file-chunk" });
        return;
      }

      sendResponse({
        ok: true,
        chunk: cacheItem.chunks[chunkIndex],
        chunkIndex,
        chunkCount: cacheItem.chunks.length,
        fileName: cacheItem.fileName,
        mimeType: cacheItem.mimeType,
        size: cacheItem.size
      });
      return;
    }

    if (message.type === "CLEAR_IMPORTED_FILE_CACHE") {
      if (message.cacheKey) {
        importFileCache.delete(String(message.cacheKey));
      }

      sendResponse({ ok: true });
      return;
    }

    if (message.type === "RUN_IMPORT_FLOW") {
      const validationMessage = validateImportFlowConfig(message.config);

      if (validationMessage) {
        await notifyImportStatus(validationMessage, "IMPORT_FLOW_ERROR");
        sendResponse({ ok: false, message: validationMessage });
        return;
      }

      const sourceTabId = Number(message.sourceTabId || 0);

      if (!sourceTabId) {
        const errorMessage = "ВАЖЛИВО! Не вдалося визначити вкладку джерела для запуску імпорту.";
        await notifyImportStatus(errorMessage, "IMPORT_FLOW_ERROR");
        sendResponse({ ok: false, message: errorMessage });
        return;
      }

      (async () => {
        try {
          await notifyImportStatus("Зчитуємо дані з полів на сайті-джерелі...");

          const collectResponse = await EXT.tabs.sendMessage(sourceTabId, {
            type: "COLLECT_IMPORT_PAYLOAD",
            config: message.config
          });

          if (!collectResponse?.ok || !collectResponse.payload) {
            throw new Error(collectResponse?.message || "Не вдалося зчитати дані на сайті-джерелі.");
          }

          await writeDebug("import-flow:payload-collected", {
            sourceTabId,
            valueCount: collectResponse.payload.values?.length || 0,
            hasFileRef: Boolean(collectResponse.payload.fileRef)
          });

          await notifyImportStatus("Дані зчитано. Відкриваємо сайт-приймач із налаштувань...");
          const targetTab = await prepareTargetTab(message.config.targetSite);

          await notifyImportStatus("Сайт-приймач відкрито. Заповнюємо форму і завантажуємо файл...");
          const applyResponse = await EXT.tabs.sendMessage(targetTab.id, {
            type: "APPLY_IMPORT_PAYLOAD",
            config: message.config,
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
        }
      })();

      sendResponse({ ok: true });
      return;
    }

    if (message.type === "FIELD_PICKER_START") {
      const configuredTargetSite = normalizeUrl(message.config?.targetSite);
      const sourceTabId = message.config?.sourceTabId;

      await writeDebug("start-request", {
        sourceSiteFromConfig: message.config?.sourceSite || "",
        targetSite: configuredTargetSite,
        sourceTabId,
        senderTabId: sender?.tab?.id || null
      });

      if (!configuredTargetSite) {
        await notifyExtension({
          type: "FIELD_PICKER_ERROR",
          text: "Для другого етапу треба вказати адресу сайту-приймача."
        });

        sendResponse({ ok: false, reason: "empty-target-site" });
        return;
      }

      if (!sourceTabId) {
        await notifyExtension({
          type: "FIELD_PICKER_ERROR",
          text: "Не вдалося визначити вкладку джерела для першого етапу."
        });

        sendResponse({ ok: false, reason: "missing-source-tab-id" });
        return;
      }

      let sourceTab;

      try {
        sourceTab = await EXT.tabs.get(sourceTabId);
      } catch (error) {
        await writeDebug("start-request:source-tab-failed", {
          sourceTabId,
          error: String(error?.message || error)
        });

        await notifyExtension({
          type: "FIELD_PICKER_ERROR",
          text: "Вкладка джерела більше недоступна. Поверніться на сторінку джерела і спробуйте ще раз."
        });

        sendResponse({ ok: false, reason: "bad-source-tab-id" });
        return;
      }

      await writeDebug("start-request:source-tab-ok", {
        sourceTabId,
        url: sourceTab.url,
        title: sourceTab.title
      });

      if (
        !sourceTab.url ||
        sourceTab.url.startsWith("chrome://") ||
        sourceTab.url.startsWith("edge://") ||
        sourceTab.url.startsWith("about:") ||
        sourceTab.url.startsWith("chrome-extension://") ||
        sourceTab.url.startsWith("moz-extension://")
      ) {
        await notifyExtension({
          type: "FIELD_PICKER_ERROR",
          text: "Перший етап не можна запускати на службовій сторінці браузера."
        });

        sendResponse({ ok: false, reason: "unsupported-source-tab" });
        return;
      }

      pickerSession = {
        sessionId: `picker-${Date.now()}`,
        sourceSite: toOriginUrl(sourceTab.url),
        targetSite: configuredTargetSite,
        sourceFields: [],
        targetFields: [],
        sourceTabId,
        targetTabId: null,
        phase: "source",
        awaitingResolution: false
      };

      await EXT.storage.local.remove(FIELD_PICKER_RESULT_KEY);
      await activateSourcePhase();

      sendResponse({ ok: true });
      return;
    }

    if (!pickerSession) {
      sendResponse({ ok: false, reason: "no-session" });
      return;
    }

    if (message.type === "PICKER_SELECT_FIELD") {
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

        sendResponse({ ok: true, count: updatedList.length });
        return;
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

      sendResponse({
        ok: true,
        count: updatedList.length
      });
      return;
    }

    if (message.type === "PICKER_FINISH_PHASE") {
      pickerSession.sourceFields = normalizeFieldOrder(pickerSession.sourceFields);
      pickerSession.targetFields = normalizeFieldOrder(pickerSession.targetFields);

      await writeDebug("phase-finish", {
        phase: pickerSession.phase,
        pageUrl: message.pageUrl || "",
        sourceCount: pickerSession.sourceFields.length,
        targetCount: pickerSession.targetFields.length
      });

      if (pickerSession.phase === "source") {
        await activateTargetPhase();

        sendResponse({
          ok: true,
          nextPhase: "target"
        });
        return;
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
        return;
      }

      await finalizePickerSession();

      sendResponse({
        ok: true,
        completed: true
      });
      return;
    }

    if (message.type === "PICKER_RESOLVE_MISMATCH") {
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

        sendResponse({
          ok: true,
          completed: true
        });
        return;
      }

      await restartPickerSession();

      sendResponse({
        ok: true,
        restarted: true
      });
      return;
    }

    sendResponse({ ok: false, reason: "unknown-message" });
  })().catch(async (error) => {
    await writeDebug("fatal-error", {
      error: String(error?.message || error),
      stack: String(error?.stack || "")
    });

    console.error("FIELD_PICKER_ERROR", error);

    await notifyExtension({
      type: "FIELD_PICKER_ERROR",
      text: "Під час роботи майстра вибору полів сталася помилка."
    });

    sendResponse({ ok: false, reason: "exception" });
  });

  return true;
});