async function handleLaunchFieldPickerClick() {
  const draftConfig = readDraftConfig();

  draftConfig.sourceSite = normalizePickerUrl(draftConfig.sourceSite);
  draftConfig.targetSite = normalizePickerUrl(draftConfig.targetSite);

  if (!draftConfig.sourceSite || !draftConfig.targetSite) {
    const message = "ВАЖЛИВО! Спочатку вкажіть адреси сайту-джерела і сайту-приймача в налаштуваннях, а потім запускайте вибір полів на сторінках.";
    setStatus(message);
    showPopupToast(message, "error", 5600);
    return;
  }

  if (
    PopupBridge.normalizeBrowserSiteUrl(draftConfig.sourceSite) ===
    PopupBridge.normalizeBrowserSiteUrl(draftConfig.targetSite)
  ) {
    const message = "ВАЖЛИВО! Сайт-джерело і сайт-приймач для вибору полів не можуть бути однаковими.";
    setStatus(message);
    showPopupToast(message, "error", 5600);
    return;
  }

  const sourceTab = await PopupBridge.findOpenTabBySite(draftConfig.sourceSite);
  const targetTab = await PopupBridge.findOpenTabBySite(draftConfig.targetSite);

  if (!sourceTab?.id || !targetTab?.id) {
    const missingRoles = [];

    if (!sourceTab?.id) {
      missingRoles.push(`джерело (${PopupBridge.formatSiteLabel(draftConfig.sourceSite)})`);
    }

    if (!targetTab?.id) {
      missingRoles.push(`приймач (${PopupBridge.formatSiteLabel(draftConfig.targetSite)})`);
    }

    const message = `ВАЖЛИВО! Не відкрито вкладку для: ${missingRoles.join(" і ")}. Спочатку відкрийте ці адреси у вкладках браузера, а потім запускайте вибір полів.`;
    setStatus(message);
    showPopupToast(message, "error", 6200);
    return;
  }

  await PopupBridge.saveConfig(draftConfig);

  launchFieldPickerBtn.disabled = true;
  setStatus(
    "Майстер вибору запущено. Спочатку виберіть поля «з сайту», потім поля «на сайт». Поле для файлу вибирайте останнім на обох сайтах."
  );

  try {
    const response = await PopupBridge.ext.runtime.sendMessage({
      type: "FIELD_PICKER_START",
      config: {
        sourceSite: draftConfig.sourceSite,
        targetSite: draftConfig.targetSite,
        sourceTabId: sourceTab.id,
        targetTabId: targetTab.id
      }
    });

    if (!response?.ok) {
      throw new Error(response?.message || response?.reason || "start-failed");
    }
  } catch (error) {
    console.error("FIELD_PICKER_START_ERROR", error);
    launchFieldPickerBtn.disabled = false;
    const message = error?.message && error.message !== "start-failed"
      ? String(error.message)
      : "Не вдалося запустити режим вибору. Перевірте, що вкладки джерела і приймача відкриті саме за вказаними адресами.";
    setStatus(message);
    showPopupToast(message, "error", 5600);
  }
}
