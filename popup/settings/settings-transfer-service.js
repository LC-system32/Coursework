async function exportCurrentConfig() {
  const config = readDraftConfig();
  const savedConfig = await PopupBridge.saveConfig(config);

  const blob = new Blob([JSON.stringify(savedConfig, null, 2)], {
    type: "application/json"
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "settings-export.json";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
  setStatus("Файл settings-export.json підготовлено до завантаження.");
}

function buildImportedJsonErrorMessage(error) {
  const rawMessage = String(error?.message || "").trim();

  if (!rawMessage) {
    return "ВАЖЛИВО! Не вдалося імпортувати файл налаштувань. Можливо, файл пошкоджений. Перевірте його вміст і спробуйте ще раз.";
  }

  if (error instanceof SyntaxError) {
    return `ВАЖЛИВО! Не вдалося імпортувати файл налаштувань: файл містить синтаксичну помилку (${rawMessage}). Можливо, файл пошкоджений. Перевірте його вміст і спробуйте ще раз.`;
  }

  return rawMessage;
}

async function importConfigFromFile(file) {
  const text = await file.text();
  const trimmedText = text.trim();

  if (!trimmedText) {
    throw new Error("ВАЖЛИВО! Не вдалося імпортувати файл налаштувань: файл порожній. Можливо, файл пошкоджений. Перевірте його вміст і спробуйте ще раз.");
  }

  let imported;

  try {
    imported = JSON.parse(trimmedText);
  } catch (error) {
    throw new Error(buildImportedJsonErrorMessage(error));
  }

  if (!imported || typeof imported !== "object" || Array.isArray(imported)) {
    throw new Error("ВАЖЛИВО! Не вдалося імпортувати файл налаштувань: структура JSON некоректна. Кореневий елемент повинен бути об'єктом налаштувань. Можливо, файл пошкоджений. Перевірте його вміст і спробуйте ще раз.");
  }

  const nextConfig = await PopupBridge.replaceConfigFromImportedJson(imported);
  fillSettingsForm(nextConfig);
  setStatus("Налаштування імпортовано. Поточний конфіг повністю замінено.");
}
