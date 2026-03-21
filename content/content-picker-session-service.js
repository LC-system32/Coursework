async function getStoredValue(key) {
  return await safeStorageLocalGet(key, null);
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
  const session = await getPickerSession();

  if (extensionContextInvalidated) {
    disablePickerMode();
    return;
  }

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
}

async function selectField(candidate) {
  const entry = serializeField(candidate);

  if (!entry || entry.error) {
    showToast(entry?.error || "Не вдалося зчитати це поле. Спробуйте інший елемент.", "error", 4200);
    return;
  }

  try {
    const response = await safeRuntimeSendMessage({
      type: "PICKER_SELECT_FIELD",
      entry,
      pageUrl: location.href
    });

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
  } catch {
    showToast("Помилка під час збереження поля у схемі.", "error");
  }
}

async function finishPickerPhase() {
  try {
    const response = await safeRuntimeSendMessage({
      type: "PICKER_FINISH_PHASE",
      pageUrl: location.href
    });

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

      const resolution = await safeRuntimeSendMessage({
        type: "PICKER_RESOLVE_MISMATCH",
        action: trimExtra ? "trim" : "restart"
      });

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

    showToast(response?.error || response?.message || "Етап вибору не вдалося завершити.", "error");
  } catch {
    showToast("Помилка під час завершення поточного етапу вибору.", "error");
  }
}
