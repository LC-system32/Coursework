function getPopupToastPalette(tone) {
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

function ensurePopupToastContainer() {
  let container = document.getElementById("popupToastContainer");

  if (container) {
    return container;
  }

  container = document.createElement("div");
  container.id = "popupToastContainer";

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

function showPopupToast(text, tone = "info", duration = 4200) {
  const message = String(text || "").trim();

  if (!message) {
    return;
  }

  const container = ensurePopupToastContainer();
  const palette = getPopupToastPalette(tone);
  const toast = document.createElement("div");
  toast.textContent = message;

  Object.assign(toast.style, {
    width: "fit-content",
    maxWidth: "100%",
    padding: "14px 18px",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.22)",
    background: palette.background,
    color: "#ffffff",
    fontFamily: '"Segoe UI", Arial, sans-serif',
    fontSize: "14px",
    fontWeight: "700",
    lineHeight: "1.45",
    letterSpacing: "0.02em",
    textAlign: "center",
    boxShadow: palette.shadow,
    pointerEvents: "none",
    opacity: "0",
    transform: "translateY(-10px)",
    transition: "opacity 180ms ease, transform 180ms ease"
  });

  container.appendChild(toast);

  const toasts = [...container.children];
  if (toasts.length > 4) {
    toasts.slice(0, toasts.length - 4).forEach((node) => node.remove());
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
