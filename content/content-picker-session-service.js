function isExtensionContextInvalidatedError(error) {
  const message = String(error?.message || error || "");
  return (
    message.includes("Extension context invalidated") ||
    message.includes("context invalidated") ||
    message.includes("Receiving end does not exist") ||
    message.includes("The message port closed before a response was received")
  );
}

function handleInvalidatedExtensionContext(error) {
  if (!isExtensionContextInvalidatedError(error)) {
    return false;
  }

  disablePickerMode();
  return true;
}

async function getStoredValue(key) {
<<<<<<< HEAD
  return await safeStorageLocalGet(key, null);
=======
  try {
    const data = await ext.storage.local.get(key);
    return data?.[key];
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return undefined;
    }
    throw error;
  }
>>>>>>> feat/g-vue
}

async function getPickerSession() {
  return await getStoredValue(PICKER_SESSION_KEY);
}

function disablePickerMode() {
  pickerState.active = false;
  pickerState.phase = null;
  pickerState.sessionId = "";
  setHoverElement(null);
}

function enablePickerMode(session) {
  ensurePickerStyles();

  const phaseChanged = pickerState.phase !== session.phase || pickerState.sessionId !== session.sessionId;

  pickerState.active = true;
  pickerState.phase = session.phase;
  pickerState.sessionId = session.sessionId;

  if (phaseChanged) {
    const sideLabel = session.phase === "target" ? "приймачі" : "джерелі";
    showToast(
      `Режим вибору активний на ${sideLabel}. Наводьте курсор на поле, клацайте ЛКМ і завершуйте етап клавішею Esc. Поле для файлу вибирайте останнім.`,
      "info",
      5200
    );
  }
}

async function syncPickerMode() {
  try {
    const session = await getPickerSession();

<<<<<<< HEAD
  if (extensionContextInvalidated) {
    disablePickerMode();
    return;
  }

  if (!session?.active || session.awaitingResolution || document.hidden) {
=======
    if (!session?.active || session.awaitingResolution || document.hidden) {
      disablePickerMode();
      return;
    }

    const site = session.phase === "target" ? session.targetSite : session.sourceSite;

    if (matchesSite(location.href, site)) {
      enablePickerMode(session);
    } else {
      disablePickerMode();
    }
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return;
    }

    console.error("SYNC_PICKER_MODE_ERROR", error);
>>>>>>> feat/g-vue
    disablePickerMode();
  }
}

async function safeSendRuntimeMessage(payload) {
  try {
    return await ext.runtime.sendMessage(payload);
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return { ok: false, invalidated: true };
    }
    throw error;
  }
}

async function selectField(candidate) {
  const entry = serializeField(candidate);

  if (!entry || entry.error) {
    showToast(entry?.error || "Не вдалося зчитати це поле. Спробуйте інший елемент.", "error", 4200);
    return;
  }

  try {
<<<<<<< HEAD
    const response = await safeRuntimeSendMessage({
=======
    const response = await safeSendRuntimeMessage({
>>>>>>> feat/g-vue
      type: "PICKER_SELECT_FIELD",
      entry,
      pageUrl: location.href
    });

    if (response?.invalidated) {
      return;
    }

    if (!response?.ok) {
      showToast(response?.error || response?.message || "Поле не вдалося додати.", "error");
      return;
    }

    markSelected(candidate);
    showToast(
      entry.isFileField
        ? "Поле для файлу додано. Воно буде останнім у схемі."
        : `Поле додано. Поточна кількість: ${response.count}.`,
      "success"
    );
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return;
    }

    showToast("Помилка під час збереження поля у схемі.", "error");
  }
}

async function finishPickerPhase() {
  try {
<<<<<<< HEAD
    const response = await safeRuntimeSendMessage({
=======
    const response = await safeSendRuntimeMessage({
>>>>>>> feat/g-vue
      type: "PICKER_FINISH_PHASE",
      pageUrl: location.href
    });

    if (response?.invalidated) {
      return;
    }

    if (response?.ok && response.nextPhase === "target") {
      disablePickerMode();
      showToast(
        "Етап джерела завершено. Перейдіть на сайт-приймач і продовжіть вибір полів. Поле для файлу також вибирайте останнім.",
        "success",
        4600
      );
      return;
    }

    if (response?.ok && response.completed) {
      disablePickerMode();
      showToast("Схему полів завершено і збережено.", "success", 4200);
      return;
    }

    if (response?.mismatch) {
      const trimExtra = window.confirm(
        `Кількість полів не збігається: з сайту ${response.sourceCount}, на сайт ${response.targetCount}. ` +
        "Натисніть OK, щоб обрізати зайві поля, або Скасувати, щоб почати вибір спочатку."
      );

<<<<<<< HEAD
      const resolution = await safeRuntimeSendMessage({
=======
      const resolution = await safeSendRuntimeMessage({
>>>>>>> feat/g-vue
        type: "PICKER_RESOLVE_MISMATCH",
        action: trimExtra ? "trim" : "restart"
      });

      if (resolution?.invalidated) {
        return;
      }

      if (!resolution?.ok) {
        showToast(resolution?.error || resolution?.message || "Не вдалося завершити конфлікт кількості полів.", "error");
        return;
      }

      if (resolution.restarted) {
        disablePickerMode();
        showToast(
          "Вибір скинуто без збереження. Поверніться на сайт-джерело і почніть заново.",
          "info",
          4500
        );
        return;
      }

      disablePickerMode();
      showToast("Зайві поля обрізано, схему збережено.", "success", 4200);
      return;
    }

<<<<<<< HEAD
    showToast(response?.error || response?.message || "Етап вибору не вдалося завершити.", "error");
  } catch {
=======
    showToast(response?.error || "Етап вибору не вдалося завершити.", "error");
  } catch (error) {
    if (handleInvalidatedExtensionContext(error)) {
      return;
    }

>>>>>>> feat/g-vue
    showToast("Помилка під час завершення поточного етапу вибору.", "error");
  }
}
