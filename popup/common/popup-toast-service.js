const POPUP_TOAST_EVENT = "data-import-popup-toast";

function showPopupToast(text, tone = "info", duration = 4200) {
  const message = String(text || "").trim();

  if (!message) {
    return;
  }

  window.dispatchEvent(new CustomEvent(POPUP_TOAST_EVENT, {
    detail: {
      text: message,
      tone,
      duration: Number(duration) || 4200
    }
  }));
}
