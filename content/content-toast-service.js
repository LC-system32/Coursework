function getToastColors(tone) {
  if (tone === "error") {
    return {
      background: "linear-gradient(90deg, #d75454 0%, #c94242 55%, #b53131 100%)",
      shadow: "0 18px 34px rgba(160, 43, 43, 0.22)"
    };
  }

  if (tone === "success") {
    return {
      background: "linear-gradient(90deg, #2f84d5 0%, #2791cf 54%, #0eb5e7 100%)",
      shadow: "0 18px 34px rgba(20, 93, 173, 0.24)"
    };
  }

  return {
    background: "linear-gradient(90deg, #2f84d5 0%, #277bcf 54%, #1668be 100%)",
    shadow: "0 18px 34px rgba(20, 93, 173, 0.24)"
  };
}

function ensureToastContainer() {
  let container = document.getElementById(TOAST_CONTAINER_ID);

  if (container) {
    return container;
  }

  container = document.createElement("div");
  container.id = TOAST_CONTAINER_ID;

  Object.assign(container.style, {
    position: "fixed",
    top: "18px",
    left: "50%",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    width: "min(92vw, 560px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "10px",
    pointerEvents: "none"
  });

  document.documentElement.appendChild(container);
  return container;
}

function showToast(text, tone = "info", duration = 3200) {
  const container = ensureToastContainer();
  const colors = getToastColors(tone);
  const toast = document.createElement("div");
  toast.textContent = text;

  Object.assign(toast.style, {
    width: "fit-content",
    maxWidth: "100%",
    padding: "14px 18px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: colors.background,
    color: "#ffffff",
    fontFamily: "\"Segoe UI\", Arial, sans-serif",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: "1.45",
    letterSpacing: "0.02em",
    textAlign: "center",
    boxShadow: colors.shadow,
    pointerEvents: "none",
    opacity: "0",
    transform: "translateY(-10px)",
    transition: "opacity 180ms ease, transform 180ms ease"
  });

  container.appendChild(toast);

  const toasts = [...container.children];
  if (toasts.length > 5) {
    toasts.slice(0, toasts.length - 5).forEach((node) => node.remove());
  }

  requestAnimationFrame(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  });

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(-10px)";
    window.setTimeout(() => {
      toast.remove();
      if (!container.children.length) {
        container.remove();
      }
    }, 220);
  }, duration);
}

function showImportStep(text, duration = 3000) {
  showToast(text, "info", duration);
}

function removeOverwriteDialog() {
  document.getElementById(OVERWRITE_DIALOG_ID)?.remove();
}

function formatOverwriteCountdown(remainingMs) {
  const totalSeconds = Math.max(0, Math.ceil(Number(remainingMs || 0) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function buildOverwriteConflictRow(conflict) {
  const row = document.createElement("div");
  Object.assign(row.style, {
    padding: "12px 14px",
    borderRadius: "14px",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    display: "grid",
    gap: "6px"
  });

  const title = document.createElement("div");
  title.textContent = conflict?.label || "Поле";
  Object.assign(title.style, {
    color: "#ffffff",
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: "1.35"
  });

  const currentValue = document.createElement("div");
  currentValue.textContent = `Поточне значення: ${conflict?.currentValue || "—"}`;
  Object.assign(currentValue.style, {
    color: "rgba(255,255,255,0.88)",
    fontSize: "13px",
    lineHeight: "1.45"
  });

  const nextValue = document.createElement("div");
  nextValue.textContent = `Нове значення: ${conflict?.nextValue || "—"}`;
  Object.assign(nextValue.style, {
    color: "rgba(255,255,255,0.72)",
    fontSize: "12px",
    lineHeight: "1.45"
  });

  if (normalizeWhitespace(conflict?.currentValue || "") === normalizeWhitespace(conflict?.nextValue || "")) {
    const equalMark = document.createElement("div");
    equalMark.textContent = "Значення вже присутнє у полі.";
    Object.assign(equalMark.style, {
      color: "#9ed0ff",
      fontSize: "12px",
      lineHeight: "1.4",
      fontWeight: "600"
    });
    row.append(title, currentValue, nextValue, equalMark);
    return row;
  }

  row.append(title, currentValue, nextValue);
  return row;
}

function showOverwriteConfirmationDialog(conflicts, options = {}) {
  const items = Array.isArray(conflicts) ? conflicts.filter(Boolean) : [];
  const timeoutMs = Math.max(60000, Math.min(90000, Number(options.timeoutMs || OVERWRITE_DIALOG_TIMER_MS)));

  if (!items.length) {
    return Promise.resolve("overwrite");
  }

  removeOverwriteDialog();

  return new Promise((resolve) => {
    const startedAt = Date.now();
    const overlay = document.createElement("div");
    overlay.id = OVERWRITE_DIALOG_ID;

    Object.assign(overlay.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483646",
      background: "rgba(15, 23, 42, 0.34)",
      display: "flex",
      alignItems: "flex-start",
      justifyContent: "center",
      padding: "20px 16px 16px",
      boxSizing: "border-box"
    });

    const panel = document.createElement("section");
    Object.assign(panel.style, {
      width: "min(96vw, 720px)",
      maxHeight: "min(78vh, 760px)",
      overflow: "hidden",
      borderRadius: "22px",
      border: "1px solid rgba(255,255,255,0.14)",
      background: "linear-gradient(180deg, rgba(15,23,42,0.96) 0%, rgba(30,41,59,0.96) 100%)",
      boxShadow: "0 28px 70px rgba(15, 23, 42, 0.42)",
      color: "#ffffff",
      fontFamily: "\"Segoe UI\", Arial, sans-serif",
      display: "grid",
      gridTemplateRows: "auto auto minmax(0, 1fr) auto"
    });

    const header = document.createElement("div");
    Object.assign(header.style, {
      padding: "20px 22px 12px",
      display: "grid",
      gap: "8px",
      borderBottom: "1px solid rgba(255,255,255,0.08)"
    });

    const badge = document.createElement("div");
    badge.textContent = "Потрібне підтвердження";
    Object.assign(badge.style, {
      color: "#9ed0ff",
      fontSize: "12px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textTransform: "uppercase"
    });

    const title = document.createElement("div");
    title.textContent = "У цільовій формі вже є заповнені поля";
    Object.assign(title.style, {
      fontSize: "22px",
      fontWeight: "800",
      lineHeight: "1.25"
    });

    const description = document.createElement("div");
    description.textContent = "Плагін знайшов значення у полях форми. Оберіть одну з дій: дозволити перезапис або зупинити імпорт без зміни поточних значень.";
    Object.assign(description.style, {
      color: "rgba(255,255,255,0.82)",
      fontSize: "14px",
      lineHeight: "1.55"
    });

    const meta = document.createElement("div");
    Object.assign(meta.style, {
      padding: "14px 22px",
      display: "flex",
      flexWrap: "wrap",
      gap: "12px",
      alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.08)"
    });

    const countChip = document.createElement("div");
    countChip.textContent = `Полів із наявним значенням: ${items.length}`;
    Object.assign(countChip.style, {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "rgba(59,130,246,0.18)",
      border: "1px solid rgba(96,165,250,0.24)",
      color: "#dbeafe",
      fontSize: "13px",
      fontWeight: "700"
    });

    const timerChip = document.createElement("div");
    Object.assign(timerChip.style, {
      padding: "8px 12px",
      borderRadius: "999px",
      background: "rgba(239,68,68,0.16)",
      border: "1px solid rgba(248,113,113,0.24)",
      color: "#fecaca",
      fontSize: "13px",
      fontWeight: "700"
    });

    const list = document.createElement("div");
    Object.assign(list.style, {
      padding: "18px 22px",
      display: "grid",
      gap: "10px",
      overflowY: "auto"
    });

    items.slice(0, 12).forEach((conflict) => list.appendChild(buildOverwriteConflictRow(conflict)));

    if (items.length > 12) {
      const more = document.createElement("div");
      more.textContent = `Ще полів: ${items.length - 12}.`;
      Object.assign(more.style, {
        color: "rgba(255,255,255,0.72)",
        fontSize: "13px",
        lineHeight: "1.45",
        padding: "2px 2px 0"
      });
      list.appendChild(more);
    }

    const actions = document.createElement("div");
    Object.assign(actions.style, {
      padding: "18px 22px 22px",
      display: "grid",
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      gap: "12px",
      borderTop: "1px solid rgba(255,255,255,0.08)"
    });

    const cancelButton = document.createElement("button");
    cancelButton.type = "button";
    cancelButton.textContent = "Скасувати імпорт";
    Object.assign(cancelButton.style, {
      minHeight: "48px",
      borderRadius: "14px",
      border: "1px solid rgba(255,255,255,0.16)",
      background: "rgba(255,255,255,0.05)",
      color: "#ffffff",
      fontSize: "14px",
      fontWeight: "700",
      cursor: "pointer"
    });

    const confirmButton = document.createElement("button");
    confirmButton.type = "button";
    confirmButton.textContent = "Перезаписати поля";
    Object.assign(confirmButton.style, {
      minHeight: "48px",
      borderRadius: "14px",
      border: "1px solid rgba(59,130,246,0.28)",
      background: "linear-gradient(90deg, #2563eb 0%, #1d4ed8 100%)",
      color: "#ffffff",
      fontSize: "14px",
      fontWeight: "800",
      cursor: "pointer",
      boxShadow: "0 16px 32px rgba(37, 99, 235, 0.28)"
    });

    let finished = false;
    let timerId = 0;
    let intervalId = 0;

    const cleanup = () => {
      window.clearTimeout(timerId);
      window.clearInterval(intervalId);
      window.removeEventListener("keydown", onKeyDown, true);
      overlay.remove();
    };

    const finish = (decision) => {
      if (finished) {
        return;
      }

      finished = true;
      cleanup();
      resolve(decision);
    };

    const updateTimer = () => {
      const elapsed = Date.now() - startedAt;
      const remaining = Math.max(0, timeoutMs - elapsed);
      timerChip.textContent = `Автоскасування через ${formatOverwriteCountdown(remaining)}`;
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        finish("cancel");
      }
    };

    cancelButton.addEventListener("click", () => finish("cancel"));
    confirmButton.addEventListener("click", () => finish("overwrite"));

    window.addEventListener("keydown", onKeyDown, true);

    updateTimer();
    intervalId = window.setInterval(updateTimer, 1000);
    timerId = window.setTimeout(() => finish("timeout"), timeoutMs);

    header.append(badge, title, description);
    meta.append(countChip, timerChip);
    actions.append(cancelButton, confirmButton);
    panel.append(header, meta, list, actions);
    overlay.appendChild(panel);
    document.documentElement.appendChild(overlay);
    confirmButton.focus();
  });
}


function ensurePickerStyles() {
  if (document.getElementById(PICKER_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = PICKER_STYLE_ID;
  style.textContent = `
    .${PICKER_HOVER_CLASS} {
      outline: 3px solid rgba(47, 132, 213, 0.95) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 6px rgba(47, 132, 213, 0.18) !important;
      cursor: crosshair !important;
    }

    .${PICKER_SELECTED_CLASS} {
      outline: 3px solid rgba(46, 156, 112, 0.95) !important;
      outline-offset: 2px !important;
      box-shadow: 0 0 0 6px rgba(46, 156, 112, 0.18) !important;
    }
  `;

  document.documentElement.appendChild(style);
}
