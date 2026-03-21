function splitMappedEntries(entries) {
  const list = Array.isArray(entries) ? entries.filter(Boolean) : [];
  return {
    regularEntries: list.filter((entry) => !entry.isFileField),
    fileEntry: list.find((entry) => entry.isFileField) || null
  };
}

function missingLabels(entries, elements) {
  return entries
    .map((entry, index) => ({ entry, element: elements[index] }))
    .filter((item) => !item.element)
    .map((item) => item.entry.identifierValue || item.entry.label || "Поле");
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForDocumentComplete(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (document.readyState === "complete") {
      return true;
    }

    await wait(120);
  }

  return document.readyState === "complete";
}

async function waitForDocumentReady(timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    if (document.readyState === "interactive" || document.readyState === "complete") {
      return true;
    }

    await wait(120);
  }

  return document.readyState === "interactive" || document.readyState === "complete";
}

async function waitForRegularTargetElements(entries, timeoutMs = 1000) {
  if (!entries.length) {
    return [];
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const elements = entries.map((entry) => findElementByEntry(entry));
    if (elements.every(Boolean)) {
      return elements;
    }

    await wait(150);
  }

  return entries.map((entry) => findElementByEntry(entry));
}

async function waitForTargetPageReady(fileEntry, needFile, timeoutMs = 15000) {
  await waitForDocumentReady(Math.min(timeoutMs, 5000));

  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const shellReady = document.readyState === "interactive" || document.readyState === "complete";
    const fileReady = !needFile || Boolean(
      resolveUploadTargetElement(findElementByEntry(fileEntry)) ||
      findNativeFileInput(document.body) ||
      findDropZone(document.body)
    );

    if (shellReady && fileReady) {
      await waitForDomQuiet(2500, 350);
      return true;
    }

    await wait(150);
  }

  return false;
}

async function collectImportPayload(configFromMessage) {
  const config = await getSyncedConfig(configFromMessage);

  if (!config?.sourceSite) {
    return { ok: false, message: "ВАЖЛИВО! У налаштуваннях не вказано сайт-джерело." };
  }

  if (!matchesSite(location.href, config.sourceSite)) {
    return { ok: false, message: "ВАЖЛИВО! Імпорт треба запускати на сторінці джерела, вказаній у налаштуваннях." };
  }

  const sourceSelectors = Array.isArray(config.fieldMappings?.source)
    ? config.fieldMappings.source
    : [];

  if (!sourceSelectors.length) {
    return { ok: false, message: "ВАЖЛИВО! Для сайту-джерела не налаштовано жодного поля." };
  }

  const { regularEntries, fileEntry } = splitMappedEntries(sourceSelectors);
  const sourceElements = regularEntries.map((entry) => findElementByEntry(entry));
  const missingRegular = missingLabels(regularEntries, sourceElements);

  if (missingRegular.length) {
    return {
      ok: false,
      message: `ВАЖЛИВО! На сайті-джерелі не знайдено поля: ${missingRegular.join(", ")}.`
    };
  }

  showImportStep("Зчитуємо значення полів із сайту-джерела.", 2800);

  const values = regularEntries.map((entry, index) => ({
    label: entry.identifierValue || entry.label,
    value: readValueFromElement(sourceElements[index], entry)
  }));

  let fileRef = null;

  if (fileEntry) {
    const fileElement = findElementByEntry(fileEntry);
    if (!fileElement) {
      return { ok: false, message: "ВАЖЛИВО! На сайті-джерелі не знайдено поле для файлу." };
    }

    fileRef = readFileReferenceFromElement(fileElement);
    if (!fileRef) {
      return { ok: false, message: "ВАЖЛИВО! Із поля для файлу не вдалося зчитати посилання на Google Drive." };
    }
  }


  return {
    ok: true,
    payload: {
      sourceSite: config.sourceSite,
      targetSite: config.targetSite,
      values,
      fileRef,
      createdAt: Date.now()
    }
  };
}

async function waitForDomQuiet(timeoutMs = 12000, quietWindowMs = 1800) {
  const root = document.body || document.documentElement;

  if (!root) {
    await wait(Math.min(timeoutMs, quietWindowMs));
    return;
  }

  let lastMutationAt = Date.now();

  const observer = new MutationObserver(() => {
    lastMutationAt = Date.now();
  });

  observer.observe(root, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true
  });

  const deadline = Date.now() + timeoutMs;

  try {
    while (Date.now() <= deadline) {
      if (Date.now() - lastMutationAt >= quietWindowMs) {
        break;
      }

      await wait(250);
    }
  } finally {
    observer.disconnect();
  }
}

async function waitForPostUploadFieldsReady(entries, timeoutMs = 15000) {
  if (!entries.length) {
    await waitForDomQuiet(Math.min(timeoutMs, 8000), 1200);
    return [];
  }

  const deadline = Date.now() + timeoutMs;

  while (Date.now() <= deadline) {
    const elements = entries.map((entry) => findElementByEntry(entry));
    const allPresent = elements.every(Boolean);

    if (allPresent) {
      await waitForDomQuiet(Math.min(3000, Math.max(2000, timeoutMs)), 400);

      const refreshedElements = entries.map((entry) => findElementByEntry(entry));
      if (refreshedElements.every(Boolean)) {
        return refreshedElements;
      }
    }

    await wait(180);
  }

  return entries.map((entry) => findElementByEntry(entry));
}

async function fillRegularTargetFields(entries, values, preResolvedElements = null) {
  const elements = Array.isArray(preResolvedElements) && preResolvedElements.length === entries.length
    ? preResolvedElements
    : await waitForRegularTargetElements(entries, 8000);
  const missingRegular = missingLabels(entries, elements);

  if (missingRegular.length) {
    return {
      ok: false,
      message: `ВАЖЛИВО! На сайті-приймачі не знайдено поля: ${missingRegular.join(", ")}.`
    };
  }

  let filledCount = 0;

  for (let index = 0; index < entries.length; index += 1) {
    const expectedValue = String(values[index]?.value || "");
    const element = elements[index];

    if (await setControlValue(element, expectedValue)) {
      filledCount += 1;
    }
  }

  return {
    ok: true,
    filledCount
  };
}

async function applyImportPayload(configFromMessage, payloadFromMessage) {
  const config = await getSyncedConfig(configFromMessage);
  const payload = payloadFromMessage || null;

  if (!config?.targetSite) {
    return { ok: false, message: "ВАЖЛИВО! У налаштуваннях не вказано сайт-приймач." };
  }

  if (!matchesSite(location.href, config.targetSite)) {
    return { ok: false, message: "ВАЖЛИВО! Поточна вкладка не відповідає сайту-приймачу з налаштувань." };
  }

  if (!payload?.values?.length && !payload?.fileRef) {
    return { ok: false, message: "ВАЖЛИВО! Немає підготовлених даних для імпорту." };
  }

  const targetSelectors = Array.isArray(config.fieldMappings?.target)
    ? config.fieldMappings.target
    : [];

  if (!targetSelectors.length) {
    return { ok: false, message: "ВАЖЛИВО! Для сайту-приймача не налаштовано жодного поля." };
  }

  const { regularEntries, fileEntry } = splitMappedEntries(targetSelectors);
  let fileUploaded = false;

  const pageReady = await waitForTargetPageReady(
    fileEntry,
    Boolean(payload.fileRef),
    15000
  );

  if (!pageReady) {
    return {
      ok: false,
      message: "ВАЖЛИВО! Сторінка-приймач ще не завершила повне завантаження або потрібні поля ще не з'явилися."
    };
  }

  if (payload.fileRef) {
    showImportStep("Починаємо завантаження файла з Google Drive.", 3200);
    if (!fileEntry) {
      return { ok: false, message: "ВАЖЛИВО! У схемі приймача немає поля для файлу." };
    }

    const targetFileElement = await waitForUploadTargetElement(fileEntry, 20000);
    if (!targetFileElement) {
      return { ok: false, message: "ВАЖЛИВО! На сайті-приймачі не знайдено поле для файлу." };
    }

    let importedFile;

    try {
      importedFile = await fetchFileFromBackground(payload.fileRef);
    } catch (error) {
      return {
        ok: false,
        message: `ВАЖЛИВО! Не вдалося скачати файл з Google Drive. Імпорт зупинено. ${String(error?.message || error)}`
      };
    }

    if (!(importedFile instanceof File) || !importedFile.size) {
      return {
        ok: false,
        message: "ВАЖЛИВО! Не вдалося підготувати файл для імпорту. Імпорт зупинено."
      };
    }

    showImportStep("Файл завантажено. Імпортуємо файл.", 3600);
    fileUploaded = await uploadImportedFileToTarget(targetFileElement, importedFile);

    if (!fileUploaded) {
      return {
        ok: false,
        message: "ВАЖЛИВО! Файл завантажено з Google Drive, але не вдалося автоматично передати його у форму сайту-приймача."
      };
    }

    showToast("Файл успішно імпортовано у форму.", "success", 3600);
    await waitForDocumentReady(12000);
  }


  const readyRegularElements = payload.fileRef
    ? await waitForPostUploadFieldsReady(regularEntries, 45000)
    : await waitForRegularTargetElements(regularEntries, 8000);

  if (!regularEntries.length) {
    return {
      ok: true,
      filledCount: 0,
      fileUploaded,
      message: "Імпорт завершено. Файл успішно передано у форму."
    };
  }

  const fillResult = await fillRegularTargetFields(regularEntries, payload.values || [], readyRegularElements);
  if (!fillResult.ok) {
    return fillResult;
  }

  if (!fillResult.filledCount && !fileUploaded) {
    return { ok: false, message: "ВАЖЛИВО! Не вдалося заповнити жодне поле на сайті-приймачі." };
  }

  return {
    ok: true,
    filledCount: fillResult.filledCount,
    fileUploaded,
    message: fileUploaded
      ? `Імпорт завершено. Заповнено ${fillResult.filledCount} полів.`
      : `Імпорт завершено. Заповнено ${fillResult.filledCount} полів.`
  };
}
