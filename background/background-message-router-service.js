function respondWithFileChunk(message, sendResponse) {
  const cacheItem = importFileCache.get(String(message.cacheKey || ""));
  const chunkIndex = Number(message.chunkIndex || 0);

  if (!cacheItem || !cacheItem.chunks[chunkIndex]) {
    sendResponse({ ok: false, reason: "missing-file-chunk" });
    return true;
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

  return true;
}

async function handleDebugLogMessage(message, sendResponse) {
  if (message.type === "FIELD_PICKER_GET_DEBUG_LOG") {
    const stored = await EXT.storage.local.get(FIELD_PICKER_DEBUG_KEY);

    sendResponse({
      ok: true,
      log: Array.isArray(stored?.[FIELD_PICKER_DEBUG_KEY])
        ? stored[FIELD_PICKER_DEBUG_KEY]
        : []
    });
    return true;
  }

  if (message.type === "FIELD_PICKER_CLEAR_DEBUG_LOG") {
    await EXT.storage.local.remove(FIELD_PICKER_DEBUG_KEY);
    sendResponse({ ok: true });
    return true;
  }

  return false;
}

async function handleImportFileMessage(message, sendResponse) {
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

    return true;
  }

  if (message.type === "GET_IMPORTED_FILE_CHUNK") {
    return respondWithFileChunk(message, sendResponse);
  }

  if (message.type === "CLEAR_IMPORTED_FILE_CACHE") {
    if (message.cacheKey) {
      importFileCache.delete(String(message.cacheKey));
    }

    sendResponse({ ok: true });
    return true;
  }

  return false;
}

async function handleImportFlowMessage(message, sendResponse) {
  if (message.type === "FORCE_FINISH_IMPORT_FLOW") {
    await forceFinishImportFlow(String(message.reason || "external-finish"));
    sendResponse({ ok: true });
    return true;
  }

  if (message.type === "GET_IMPORT_FLOW_STATE") {
    const inProgress = await isImportFlowInProgress();
    const lock = inProgress ? (await readImportFlowLock()) || activeImportFlow : null;

    sendResponse({
      ok: true,
      inProgress,
      startedAt: Number(lock?.startedAt || 0),
      sourceTabId: Number(lock?.sourceTabId || 0)
    });
    return true;
  }

  if (message.type === "RUN_IMPORT_FLOW") {
    const response = await startImportFlow(message.config, message.sourceTabId);
    sendResponse(response);
    return true;
  }

  return false;
}

async function handleRuntimeMessageDispatch(message, sender, sendResponse) {
  cleanupExpiredFileCache();

  if (!message || typeof message !== "object") {
    sendResponse({ ok: false, reason: "bad-message" });
    return;
  }

  if (await handleDebugLogMessage(message, sendResponse)) {
    return;
  }

  if (await handleImportFileMessage(message, sendResponse)) {
    return;
  }

  if (await handleImportFlowMessage(message, sendResponse)) {
    return;
  }

  if (await handleFieldPickerMessage(message, sender, sendResponse)) {
    return;
  }

  sendResponse({ ok: false, reason: "unknown-message" });
}

function handleRuntimeMessage(message, sender, sendResponse) {
  (async () => {
    await handleRuntimeMessageDispatch(message, sender, sendResponse);
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
}
