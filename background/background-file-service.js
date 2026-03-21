function cleanupExpiredFileCache() {
  const now = Date.now();

  for (const [cacheKey, item] of importFileCache.entries()) {
    if (!item?.createdAt || now - item.createdAt > FILE_CACHE_TTL_MS) {
      importFileCache.delete(cacheKey);
    }
  }
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
