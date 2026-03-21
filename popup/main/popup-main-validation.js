function normalizeImportSiteForCompareOnPopup(value) {
  const raw = String(value || "").trim();

  if (!raw) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;

  try {
    const url = new URL(withProtocol);
    const normalizedPath = url.pathname.replace(/\/+$/, "") || "/";
    const normalizedSearch = url.search || "";
    return `${url.origin}${normalizedPath}${normalizedSearch}`;
  } catch {
    return withProtocol.replace(/\/+$/, "");
  }
}

function validateConfigBeforeImport(config) {
  if (!config?.sourceSite?.trim()) {
    return "ВАЖЛИВО! У налаштуваннях не вказано сайт-джерело для імпорту.";
  }

  if (!config?.targetSite?.trim()) {
    return "ВАЖЛИВО! У налаштуваннях не вказано сайт-приймач для імпорту.";
  }

  if (
    normalizeImportSiteForCompareOnPopup(config.sourceSite) ===
    normalizeImportSiteForCompareOnPopup(config.targetSite)
  ) {
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

  const sourceFileCount = sourceMappings.filter((item) => item.isFileField).length;
  const targetFileCount = targetMappings.filter((item) => item.isFileField).length;

  if (sourceFileCount !== targetFileCount) {
    return "ВАЖЛИВО! Поле для файлу повинно бути вибране і на сайті-джерелі, і на сайті-приймачі.";
  }

  if (sourceFileCount > 1 || targetFileCount > 1) {
    return "ВАЖЛИВО! Поле для файлу повинно бути лише одне на кожній стороні.";
  }

  const emptySource = sourceMappings.find((item) => !item.identifierValue && !item.isFileField);
  if (emptySource) {
    return "ВАЖЛИВО! У схемі джерела є поле без id/name. Перевірте налаштування.";
  }

  const emptyTarget = targetMappings.find((item) => !item.identifierValue && !item.isFileField);
  if (emptyTarget) {
    return "ВАЖЛИВО! У схемі приймача є поле без id/name. Перевірте налаштування.";
  }

  return "";
}
