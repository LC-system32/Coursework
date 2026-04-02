function readFileReferenceFromElement(element) {
  const anchor = element instanceof HTMLAnchorElement
    ? element
    : element?.querySelector?.("a[href]") || element?.closest?.("a[href]");

  const sourceUrl = String(anchor?.href || "").trim();
  const fileId = extractDriveFileId(sourceUrl);

  if (!sourceUrl || !fileId) {
    return null;
  }

  return {
    provider: "gdrive",
    sourceUrl,
    fileId,
    fileName: null,
    mimeType: "application/pdf",
    capturedAt: Date.now()
  };
}

function base64ToFile(base64, fileName, mimeType) {
  const binary = atob(base64);
  const chunkSize = 8192;
  const chunks = [];

  for (let index = 0; index < binary.length; index += chunkSize) {
    const slice = binary.slice(index, index + chunkSize);
    const bytes = new Uint8Array(slice.length);

    for (let byteIndex = 0; byteIndex < slice.length; byteIndex += 1) {
      bytes[byteIndex] = slice.charCodeAt(byteIndex);
    }

    chunks.push(bytes);
  }

  return new File(chunks, fileName || "imported-file.pdf", {
    type: mimeType || "application/pdf"
  });
}

async function safeSendMessageToBackground(payload) {
  try {
    return await ext.runtime.sendMessage(payload);
  } catch (error) {
    if (typeof handleInvalidatedExtensionContext === "function" && handleInvalidatedExtensionContext(error)) {
      return { ok: false, invalidated: true };
    }
    throw error;
  }
}

async function fetchFileFromBackground(fileRef) {
<<<<<<< HEAD
  const download = await safeRuntimeSendMessage({
=======
  const download = await safeSendMessageToBackground({
>>>>>>> feat/g-vue
    type: "DOWNLOAD_IMPORT_FILE",
    fileRef
  });

  if (download?.invalidated) {
    throw new Error("extension-context-invalidated");
  }

  if (!download?.ok || !download.cacheKey || !download.chunkCount) {
    throw new Error(download?.message || download?.reason || "download-import-file-failed");
  }

  let base64 = "";

  for (let chunkIndex = 0; chunkIndex < download.chunkCount; chunkIndex += 1) {
<<<<<<< HEAD
    const chunkResponse = await safeRuntimeSendMessage({
=======
    const chunkResponse = await safeSendMessageToBackground({
>>>>>>> feat/g-vue
      type: "GET_IMPORTED_FILE_CHUNK",
      cacheKey: download.cacheKey,
      chunkIndex
    });

    if (chunkResponse?.invalidated) {
      throw new Error("extension-context-invalidated");
    }

    if (!chunkResponse?.ok) {
<<<<<<< HEAD
      await safeRuntimeSendMessage({
=======
      await safeSendMessageToBackground({
>>>>>>> feat/g-vue
        type: "CLEAR_IMPORTED_FILE_CACHE",
        cacheKey: download.cacheKey
      });
      throw new Error(chunkResponse?.reason || "import-file-chunk-failed");
    }

    base64 += chunkResponse.chunk || "";
  }

<<<<<<< HEAD
  await safeRuntimeSendMessage({
=======
  await safeSendMessageToBackground({
>>>>>>> feat/g-vue
    type: "CLEAR_IMPORTED_FILE_CACHE",
    cacheKey: download.cacheKey
  });

  return base64ToFile(base64, download.fileName, download.mimeType);
}

function resolveUploadTargetElement(element) {
  if (!(element instanceof Element)) {
    return null;
  }

  return findUploadLikeElement(element) || element;
}

function getAllFileInputs() {
  return [...document.querySelectorAll("input[type='file']")]
    .filter((element) => element instanceof HTMLInputElement);
}

function scoreFileInputCandidate(input, anchorElement) {
  if (!(input instanceof HTMLInputElement)) {
    return -1;
  }

  let score = 0;
  const name = normalizeWhitespace(input.getAttribute("name") || "").toLowerCase();
  const accept = normalizeWhitespace(input.getAttribute("accept") || "").toLowerCase();
  const form = input.closest("form");

  if (name === "files") score += 100;
  if (accept.includes("pdf")) score += 25;
  if (form?.querySelector("[name='files'], [ngf-select], [ngf-drop], upload-file, .dragbox, .dragbox-input")) {
    score += 30;
  }
  if (
    anchorElement instanceof Element &&
    (
      anchorElement.contains(input) ||
      input.closest("upload-file, form, .dragbox, .dragbox-input") ===
      anchorElement.closest("upload-file, form, .dragbox, .dragbox-input")
    )
  ) {
    score += 50;
  }

  const rect = input.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    score += 10;
  }

  return score;
}

function findNativeFileInput(element) {
  const anchorElement = element instanceof Element ? element : null;

  if (anchorElement instanceof HTMLInputElement && anchorElement.type === "file") {
    return anchorElement;
  }

  const candidates = [];

  if (anchorElement) {
    candidates.push(...anchorElement.querySelectorAll("input[type='file']"));

    const anchorForm = anchorElement.closest("form");
    if (anchorForm) {
      candidates.push(...anchorForm.querySelectorAll("input[type='file']"));
    }
  }

  candidates.push(...getAllFileInputs());

  const uniqueCandidates = [...new Set(candidates)]
    .filter((candidate) => candidate instanceof HTMLInputElement);

  if (!uniqueCandidates.length) {
    return null;
  }

  uniqueCandidates.sort((left, right) => {
    return scoreFileInputCandidate(right, anchorElement) - scoreFileInputCandidate(left, anchorElement);
  });

  return uniqueCandidates[0] || null;
}

function buildSyntheticFileList(file) {
  return {
    0: file,
    length: 1,
    item(index) {
      return index === 0 ? file : null;
    }
  };
}

function buildDataTransferWithFile(file) {
  if (typeof DataTransfer === "function") {
    try {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      return dataTransfer;
    } catch {
      // continue with fallbacks
    }
  }

  try {
    const clipboardEvent = new ClipboardEvent("");
    const clipboardData = clipboardEvent.clipboardData;
    if (clipboardData?.items) {
      clipboardData.items.add(file);
      return clipboardData;
    }
  } catch {
    // ignore
  }

  const files = buildSyntheticFileList(file);
  return {
    files,
    items: [{ kind: "file", type: file.type, getAsFile: () => file }],
    types: ["Files"]
  };
}

function createFileEvent(eventName, dataTransfer) {
  if (typeof DragEvent === "function") {
    try {
      return new DragEvent(eventName, {
        bubbles: true,
        cancelable: true,
        dataTransfer
      });
    } catch {
      // continue
    }
  }

  const event = new Event(eventName, {
    bubbles: true,
    cancelable: true
  });

  try {
    Object.defineProperty(event, "dataTransfer", {
      configurable: true,
      enumerable: true,
      writable: false,
      value: dataTransfer
    });
  } catch {
    event.dataTransfer = dataTransfer;
  }

  return event;
}

function hasAttachedFile(input, file) {
  if (!(input instanceof HTMLInputElement) || input.type !== "file") {
    return false;
  }

  const files = input.files;
  if (!files || !files.length) {
    return false;
  }

  return [...files].some((candidate) => {
    return candidate?.name === file.name && candidate?.size === file.size;
  });
}

function attachFileToInput(input, file) {
  if (!(input instanceof HTMLInputElement) || input.type !== "file") {
    return false;
  }

  const dataTransfer = buildDataTransferWithFile(file);
  if (!dataTransfer?.files?.length) {
    return false;
  }

  try {
    input.focus();
  } catch { }

  try {
    const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
    if (descriptor?.set) {
      descriptor.set.call(input, dataTransfer.files);
    } else {
      input.files = dataTransfer.files;
    }

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.dispatchEvent(new Event("blur", { bubbles: true }));
    return hasAttachedFile(input, file);
  } catch {
    return false;
  }
}

function dispatchDropWithFile(element, file) {
  if (!(element instanceof Element)) {
    return false;
  }

  const dataTransfer = buildDataTransferWithFile(file);
  if (!dataTransfer?.files?.length) {
    return false;
  }

  try {
    ["dragenter", "dragover", "drop"].forEach((eventName) => {
      element.dispatchEvent(createFileEvent(eventName, dataTransfer));
    });

    return true;
  } catch {
    return false;
  }
}

function normalizeFileNameForMatch(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function getFileSignalNames(file) {
  const fullName = normalizeFileNameForMatch(file?.name || "");
  const baseName = normalizeFileNameForMatch(fullName.replace(/\.[^.]+$/, ""));
  return [...new Set([fullName, baseName].filter(Boolean))];
}

function getUploadObservationRoot(element) {
  if (!(element instanceof Element)) {
    return document.body || document.documentElement || null;
  }

  return element.closest("upload-file, form, .dragbox, .dragbox-input, [ngf-drop], [ngf-select]") ||
    element.parentElement ||
    document.body ||
    document.documentElement ||
    element;
}

function elementContainsFileSignal(element, file) {
  if (!(element instanceof Element)) {
    return false;
  }

  const text = normalizeFileNameForMatch(element.innerText || element.textContent || "");
  if (!text) {
    return false;
  }

  return getFileSignalNames(file).some((name) => text.includes(name));
}

function isBusyUploadIndicator(element) {
  if (!(element instanceof Element) || !isVisible(element)) {
    return false;
  }

  if (element.matches('[role="progressbar"], progress, [aria-busy="true"]')) {
    return true;
  }

  const className = normalizeFileNameForMatch(
    typeof element.className === "string" ? element.className : ""
  );

  if (/(spinner|loading|loader|progress|busy|upload)/i.test(className)) {
    return true;
  }

  const text = normalizeFileNameForMatch(element.innerText || element.textContent || "");
  return /(uploading|loading|please wait|завантаж|обробля)/i.test(text);
}

function hasActiveUploadIndicators(root) {
  if (!(root instanceof Element)) {
    return false;
  }

  if (isBusyUploadIndicator(root)) {
    return true;
  }

  const selector = [
    '[role="progressbar"]',
    'progress',
    '[aria-busy="true"]',
    '.spinner',
    '.loading',
    '.loader',
    '.progress',
    '.progress-bar',
    '.busy',
    '.uploading',
    '.is-uploading'
  ].join(', ');

  return [...root.querySelectorAll(selector)].some((element) => isBusyUploadIndicator(element));
}

async function waitForFileUploadSettlement(targetElement, file, timeoutMs = 45000) {
  const currentTarget = resolveUploadTargetElement(targetElement) || targetElement || document.body;
  const observationRoot = getUploadObservationRoot(currentTarget);

  if (!(observationRoot instanceof Element)) {
    await wait(1200);
    return false;
  }

  let lastMutationAt = Date.now();
  let sawFileSignal = false;

  const observer = new MutationObserver(() => {
    lastMutationAt = Date.now();
  });

  observer.observe(observationRoot, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true
  });

  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() <= deadline) {
      const liveTarget = resolveUploadTargetElement(targetElement) || currentTarget;
      const nativeInput = findNativeFileInput(liveTarget || observationRoot);
      const inputHasFile = Boolean(nativeInput && hasAttachedFile(nativeInput, file));
      const fileNameVisible = elementContainsFileSignal(observationRoot, file);
      const busy = hasActiveUploadIndicators(observationRoot);

      if (inputHasFile || fileNameVisible) {
        sawFileSignal = true;
      }

      if (sawFileSignal && !busy && Date.now() - lastMutationAt >= 1200) {
        return true;
      }

      await wait(250);
    }
  } finally {
    observer.disconnect();
  }

  return sawFileSignal;
}

function getDropZoneCandidates(element) {
  if (!(element instanceof Element)) {
    return [];
  }

  const selector = "[ngf-drop], [ngf-select], .dragbox-input, .dragbox, upload-file, [name='files']";
  const candidates = [];

  if (element.matches(selector)) {
    candidates.push(element);
  }

  candidates.push(...element.querySelectorAll(selector));

  const closestCandidate = element.closest(selector);
  if (closestCandidate) {
    candidates.push(closestCandidate);
  }

  candidates.push(...document.querySelectorAll(selector));

  return [...new Set(candidates)].filter((candidate) => candidate instanceof Element);
}

function findDropZone(element) {
  return getDropZoneCandidates(element)[0] || null;
}

async function waitForUploadTargetElement(entry, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const targetElement = findElementByEntry(entry);
    const resolvedTarget = resolveUploadTargetElement(targetElement);
    const nativeFileInput = findNativeFileInput(resolvedTarget);
    const dropZone = findDropZone(resolvedTarget || targetElement || document.body);

    if (resolvedTarget || nativeFileInput || dropZone) {
      return resolvedTarget || nativeFileInput || dropZone || null;
    }

    await wait(150);
  }

  return findElementByEntry(entry);
}

async function uploadImportedFileToTarget(targetElement, file) {
  const uploadTarget = resolveUploadTargetElement(targetElement) || targetElement || document.body;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const currentTarget = resolveUploadTargetElement(targetElement) || uploadTarget;

    const inputCandidates = [];
    const bestInput = findNativeFileInput(currentTarget);
    if (bestInput) {
      inputCandidates.push(bestInput);
    }
    inputCandidates.push(...getAllFileInputs());

    for (const input of [...new Set(inputCandidates)]) {
      const attached = attachFileToInput(input, file);
      if (!attached) {
        continue;
      }

      const settled = await waitForFileUploadSettlement(currentTarget || input, file, 45000);
      if (settled) {
        return true;
      }
    }

    const dropCandidates = getDropZoneCandidates(currentTarget || document.body);
    for (const dropCandidate of dropCandidates) {
      const dropped = dispatchDropWithFile(dropCandidate, file);
      if (!dropped) {
        continue;
      }

      const settled = await waitForFileUploadSettlement(dropCandidate, file, 45000);
      if (settled) {
        return true;
      }
    }

    await wait(300);
  }

  return false;
}
