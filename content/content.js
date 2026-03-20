(() => {
  const ext = globalThis.browser ?? globalThis.chrome;
  const CONFIG_KEY = "data-import-popup-config";
  const PICKER_SESSION_KEY = "pickerSession";
  const IMPORT_PAYLOAD_KEY = "data-import-payload";
  const TOAST_CONTAINER_ID = "data-import-toast-container";
  const PICKER_STYLE_ID = "data-import-picker-style";
  const PICKER_HOVER_CLASS = "data-import-picker-hover";
  const PICKER_SELECTED_CLASS = "data-import-picker-selected";
  const FILE_FIELD_LABEL = "Поле для файлу";

  const CONTROL_SELECTOR = [
    "input:not([type='hidden']):not([disabled])",
    "textarea:not([disabled])",
    "select:not([disabled])",
    "md-select:not([disabled])",
    "[contenteditable='']",
    "[contenteditable='true']",
    "[contenteditable='plaintext-only']"
  ].join(", ");

  const FILE_UPLOAD_SELECTOR = [
    "input[type='file']",
    "[ngf-select]",
    "[ngf-drop]",
    "upload-file",
    "[name='files']",
    ".dragbox",
    ".dragbox-input"
  ].join(", ");

  const TEXT_TAGS = new Set([
    "SPAN",
    "P",
    "DIV",
    "TD",
    "TH",
    "A",
    "LI",
    "DT",
    "DD",
    "STRONG",
    "B",
    "EM",
    "SMALL",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6"
  ]);

  let pickerState = {
    active: false,
    phase: null,
    sessionId: "",
    hoverElement: null
  };

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

  function matchesSite(pageUrl, siteUrl) {
    try {
      const page = new URL(pageUrl);
      const site = new URL(siteUrl);

      if (page.origin !== site.origin) {
        return false;
      }

      const sitePath = site.pathname === "/" ? "" : site.pathname.replace(/\/+$/, "");
      return !sitePath || page.pathname.startsWith(sitePath);
    } catch {
      return false;
    }
  }

  function isVisible(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();

    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number(style.opacity) !== 0 &&
      rect.width >= 8 &&
      rect.height >= 8;
  }

  function normalizeWhitespace(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function getElementText(element) {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      return normalizeWhitespace(element.value || element.placeholder || "");
    }

    if (element instanceof HTMLSelectElement) {
      const selectedOption = element.selectedOptions?.[0];
      return normalizeWhitespace(selectedOption?.textContent || element.value || "");
    }

    if (resolveMdSelectElement(element)) {
      return readMdSelectText(element);
    }

    return normalizeWhitespace(element.innerText || element.textContent || "");
  }

  function isTextField(element) {
    if (!(element instanceof Element) || element.matches(CONTROL_SELECTOR)) {
      return false;
    }

    if (!TEXT_TAGS.has(element.tagName) || !isVisible(element)) {
      return false;
    }

    const text = getElementText(element);
    if (!text) {
      return false;
    }

    const rect = element.getBoundingClientRect();

    if (rect.width > window.innerWidth * 0.96 && rect.height > 120) {
      return false;
    }

    if (element.querySelector(CONTROL_SELECTOR)) {
      return false;
    }

    return true;
  }

  function getPathElements(event) {
    return event.composedPath().filter((node) => node instanceof Element);
  }

  function isGoogleDriveFileLink(element) {
    if (!(element instanceof HTMLAnchorElement)) {
      return false;
    }

    const href = String(element.href || "").trim();
    return /drive\.google\.com\/.+\/d\//i.test(href) || /drive\.google\.com\/uc\?/i.test(href);
  }

  function findUploadLikeElement(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    if (element.matches("input[type='file']") || element.matches("[ngf-select]") || element.matches("[ngf-drop]")) {
      return element;
    }

    const ownName = normalizeWhitespace(element.getAttribute("name") || "");
    if (ownName.toLowerCase() === "files") {
      return element;
    }

    if (element.matches("upload-file") || element.matches(".dragbox") || element.matches(".dragbox-input")) {
      return element;
    }

    return element.closest(FILE_UPLOAD_SELECTOR);
  }

  function resolveFieldCandidate(event) {
    const path = getPathElements(event);

    for (const element of path) {
      const uploadCandidate = findUploadLikeElement(element);
      if (uploadCandidate && isVisible(uploadCandidate)) {
        return uploadCandidate;
      }
    }

    for (const element of path) {
      if (element.matches("label") && element.control && isVisible(element.control)) {
        return element.control;
      }

      if (element.matches(CONTROL_SELECTOR) && isVisible(element)) {
        return element;
      }

      if (isGoogleDriveFileLink(element)) {
        return element;
      }

      if (isTextField(element)) {
        return element;
      }
    }

    return null;
  }

  function setHoverElement(nextElement) {
    if (pickerState.hoverElement === nextElement) {
      return;
    }

    if (pickerState.hoverElement) {
      pickerState.hoverElement.classList.remove(PICKER_HOVER_CLASS);
    }

    pickerState.hoverElement = nextElement;

    if (pickerState.hoverElement) {
      pickerState.hoverElement.classList.add(PICKER_HOVER_CLASS);
    }
  }

  function markSelected(element) {
    element.classList.add(PICKER_SELECTED_CLASS);

    window.setTimeout(() => {
      element.classList.remove(PICKER_SELECTED_CLASS);
    }, 900);
  }

  function cssEscape(value) {
    if (globalThis.CSS?.escape) {
      return globalThis.CSS.escape(value);
    }

    return String(value).replace(/["\\]/g, "\\$&");
  }

  function isUniqueSelector(selector, element) {
    try {
      const matches = document.querySelectorAll(selector);
      return matches.length === 1 && matches[0] === element;
    } catch {
      return false;
    }
  }

  function buildUniqueSelector(element) {
    if (element.id) {
      const idSelector = `#${cssEscape(element.id)}`;
      if (isUniqueSelector(idSelector, element)) {
        return idSelector;
      }
    }

    const preferredAttributes = [
      ["name", element.getAttribute("name")],
      ["data-testid", element.getAttribute("data-testid")],
      ["data-test", element.getAttribute("data-test")],
      ["aria-label", element.getAttribute("aria-label")],
      ["placeholder", element.getAttribute("placeholder")]
    ];

    for (const [attr, rawValue] of preferredAttributes) {
      const value = normalizeWhitespace(rawValue || "");
      if (!value) continue;

      const selector = `${element.localName}[${attr}="${cssEscape(value)}"]`;
      if (isUniqueSelector(selector, element)) {
        return selector;
      }
    }

    const parts = [];
    let node = element;

    while (node && node.nodeType === Node.ELEMENT_NODE && node !== document.documentElement) {
      let part = node.localName;

      if (node.id) {
        part = `#${cssEscape(node.id)}`;
        parts.unshift(part);
        const joined = parts.join(" > ");
        if (isUniqueSelector(joined, element)) {
          return joined;
        }
        break;
      }

      const stableClasses = [...node.classList]
        .filter((className) => className && className.length < 40 && !/\d{3,}/.test(className))
        .slice(0, 2);

      if (stableClasses.length) {
        part += stableClasses.map((className) => `.${cssEscape(className)}`).join("");
      }

      const siblings = node.parentElement
        ? [...node.parentElement.children].filter((sibling) => sibling.localName === node.localName)
        : [];

      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(node) + 1})`;
      }

      parts.unshift(part);
      const joined = parts.join(" > ");

      if (isUniqueSelector(joined, element)) {
        return joined;
      }

      node = node.parentElement;
    }

    return parts.join(" > ");
  }

  function buildXPath(element) {
    const segments = [];
    let node = element;

    while (node && node.nodeType === Node.ELEMENT_NODE) {
      let index = 1;
      let sibling = node.previousElementSibling;

      while (sibling) {
        if (sibling.localName === node.localName) {
          index += 1;
        }
        sibling = sibling.previousElementSibling;
      }

      segments.unshift(`${node.localName}[${index}]`);
      node = node.parentElement;
    }

    return `/${segments.join("/")}`;
  }

  function getPreferredIdentifier(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    const id = normalizeWhitespace(element.id || "");
    if (id) {
      return {
        type: "id",
        value: id
      };
    }

    const name = normalizeWhitespace(element.getAttribute("name") || "");
    if (name) {
      return {
        type: "name",
        value: name
      };
    }

    return null;
  }

  function extractDriveFileId(value) {
    const raw = String(value || "").trim();
    if (!raw) {
      return "";
    }

    const pathMatch = raw.match(/\/d\/([a-zA-Z0-9_-]+)/);
    if (pathMatch?.[1]) {
      return pathMatch[1];
    }

    try {
      const url = new URL(raw);
      return url.searchParams.get("id") || "";
    } catch {
      return "";
    }
  }

  function inferIsFileField(element) {
    if (!(element instanceof Element)) {
      return false;
    }

    if (element instanceof HTMLInputElement && element.type === "file") {
      return true;
    }

    if (isGoogleDriveFileLink(element)) {
      return true;
    }

    if (element.matches("[ngf-select], [ngf-drop], upload-file, .dragbox, .dragbox-input")) {
      return true;
    }

    const ownName = normalizeWhitespace(element.getAttribute("name") || "").toLowerCase();
    if (ownName === "files") {
      return true;
    }

    return Boolean(element.closest(FILE_UPLOAD_SELECTOR));
  }

  function deriveElementLabel(element) {
    if (inferIsFileField(element)) {
      return FILE_FIELD_LABEL;
    }

    const identifier = getPreferredIdentifier(element);
    if (identifier?.value) {
      return identifier.value;
    }

    if (element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement) {
      const labelText = normalizeWhitespace(
        [...(element.labels || [])]
          .map((label) => label.innerText || label.textContent || "")
          .join(" ")
      );

      return labelText ||
        normalizeWhitespace(element.getAttribute("aria-label") || "") ||
        normalizeWhitespace(element.getAttribute("placeholder") || "") ||
        "Поле";
    }

    return normalizeWhitespace(element.getAttribute("aria-label") || "") ||
      normalizeWhitespace(element.getAttribute("title") || "") ||
      getElementText(element).slice(0, 80) ||
      "Поле";
  }

  function getKind(element) {
    if (inferIsFileField(element)) {
      return "file";
    }

    if (element instanceof HTMLTextAreaElement) {
      return "textarea";
    }

    if (element instanceof HTMLSelectElement || resolveMdSelectElement(element)) {
      return "select";
    }

    if (element instanceof HTMLInputElement) {
      return "input";
    }

    if (element.isContentEditable) {
      return "contenteditable";
    }

    return "text";
  }

  function getValueMode(element) {
    if (inferIsFileField(element)) {
      return "file";
    }

    return element instanceof HTMLInputElement ||
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement ||
      Boolean(resolveMdSelectElement(element))
      ? "value"
      : "text";
  }

  function serializeField(element) {
    const identifier = getPreferredIdentifier(element);

    if (!identifier?.value) {
      return {
        error: "У вибраного поля немає id або name. Виберіть інше поле або додайте один із цих атрибутів."
      };
    }

    const selector = buildUniqueSelector(element);
    const xpath = buildXPath(element);
    const isFileField = inferIsFileField(element);
    const fileUrl = isFileField && element instanceof HTMLAnchorElement ? String(element.href || "").trim() : "";

    return {
      label: isFileField ? FILE_FIELD_LABEL : identifier.value,
      selector,
      xpath,
      kind: getKind(element),
      valueMode: getValueMode(element),
      sample: getElementText(element).slice(0, 140),
      site: location.href,
      identifierType: identifier.type,
      identifierValue: identifier.value,
      id: normalizeWhitespace(element.id || ""),
      name: normalizeWhitespace(element.getAttribute("name") || ""),
      isFileField,
      fileUrl
    };
  }

  async function getStoredValue(key) {
    const data = await ext.storage.local.get(key);
    return data?.[key];
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
      const response = await ext.runtime.sendMessage({
        type: "PICKER_SELECT_FIELD",
        entry,
        pageUrl: location.href
      });

      if (!response?.ok) {
        showToast(response?.error || "Поле не вдалося додати.", "error");
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
      const response = await ext.runtime.sendMessage({
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

        const resolution = await ext.runtime.sendMessage({
          type: "PICKER_RESOLVE_MISMATCH",
          action: trimExtra ? "trim" : "restart"
        });

        if (!resolution?.ok) {
          showToast(resolution?.error || "Не вдалося завершити конфлікт кількості полів.", "error");
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

      showToast(response?.error || "Етап вибору не вдалося завершити.", "error");
    } catch {
      showToast("Помилка під час завершення поточного етапу вибору.", "error");
    }
  }

  function findElementByXPath(xpath) {
    try {
      const result = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.FIRST_ORDERED_NODE_TYPE,
        null
      );

      return result.singleNodeValue instanceof Element
        ? result.singleNodeValue
        : null;
    } catch {
      return null;
    }
  }

  function findElementByEntry(entry) {
    const primaryValue = normalizeWhitespace(
      entry?.identifierValue || entry?.id || entry?.name || ""
    );

    if (primaryValue) {
      const byId = document.getElementById(primaryValue);
      if (byId) {
        return byId;
      }

      try {
        const byName = document.querySelector(`[name="${cssEscape(primaryValue)}"]`);
        if (byName) {
          return byName;
        }
      } catch {
        // ignore invalid selector and continue with fallbacks
      }
    }

    if (entry?.id && entry.id !== primaryValue) {
      const byStoredId = document.getElementById(entry.id);
      if (byStoredId) {
        return byStoredId;
      }
    }

    if (entry?.name && entry.name !== primaryValue) {
      try {
        const byStoredName = document.querySelector(`[name="${cssEscape(entry.name)}"]`);
        if (byStoredName) {
          return byStoredName;
        }
      } catch {
        // ignore invalid selector and continue with fallbacks
      }
    }

    if (entry?.selector) {
      try {
        const bySelector = document.querySelector(entry.selector);
        if (bySelector) {
          return bySelector;
        }
      } catch {
        // Ignore broken selector and try XPath below.
      }
    }

    if (entry?.xpath) {
      return findElementByXPath(entry.xpath);
    }

    return null;
  }

  function readValueFromElement(element, entry) {
    if (!element) {
      return "";
    }

    if (entry.valueMode === "value") {
      if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        return element.value;
      }

      if (element instanceof HTMLSelectElement) {
        return element.value || element.selectedOptions?.[0]?.textContent || "";
      }

      if (resolveMdSelectElement(element)) {
        return readMdSelectText(element);
      }
    }

    return normalizeWhitespace(element.innerText || element.textContent || "");
  }

  function resolveMdSelectElement(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    if (element.matches("md-select")) {
      return element;
    }

    return element.closest("md-select");
  }

  function readMdSelectText(element) {
    const mdSelect = resolveMdSelectElement(element);
    if (!mdSelect) {
      return "";
    }

    const preferred = mdSelect.querySelector(".md-select-value .md-text, .md-select-value span:not(.md-select-icon)");
    return normalizeWhitespace(preferred?.textContent || mdSelect.getAttribute("aria-label") || mdSelect.textContent || "");
  }

  async function waitForMdSelectOptions(timeoutMs = 3000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const options = [...document.querySelectorAll("md-option, [role='option']")]
        .filter((option) => option instanceof Element && isVisible(option));

      if (options.length) {
        return options;
      }

      await wait(100);
    }

    return [];
  }

  async function setMdSelectValue(element, value) {
    const mdSelect = resolveMdSelectElement(element);
    const expectedValue = normalizeWhitespace(value || "");

    if (!mdSelect) {
      return false;
    }

    if (!expectedValue) {
      return true;
    }

    try {
      mdSelect.focus();
    } catch { }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        mdSelect.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      } catch { }

      try {
        mdSelect.click();
      } catch { }

      const options = await waitForMdSelectOptions(2500);
      if (!options.length) {
        continue;
      }

      const match = options.find((option) => {
        const optionText = normalizeWhitespace(option.textContent || "");
        const optionValue = normalizeWhitespace(option.getAttribute("value") || "");
        const ariaLabel = normalizeWhitespace(option.getAttribute("aria-label") || "");

        return optionText === expectedValue || optionValue === expectedValue || ariaLabel === expectedValue;
      });

      const option = match || options.find((candidate) => {
        const optionText = normalizeWhitespace(candidate.textContent || "");
        return optionText.toLowerCase() === expectedValue.toLowerCase();
      });

      if (!option) {
        try {
          document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
        } catch { }
        return false;
      }

      try {
        option.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true }));
      } catch { }

      try {
        option.click();
      } catch { }

      option.dispatchEvent(new Event("click", { bubbles: true, cancelable: true }));
      mdSelect.dispatchEvent(new Event("input", { bubbles: true }));
      mdSelect.dispatchEvent(new Event("change", { bubbles: true }));
      mdSelect.dispatchEvent(new Event("blur", { bubbles: true }));

      await wait(150);

      const currentText = readMdSelectText(mdSelect);
      if (
        normalizeWhitespace(currentText) === expectedValue ||
        normalizeWhitespace(currentText).toLowerCase() === expectedValue.toLowerCase()
      ) {
        return true;
      }
    }

    return false;
  }

  function getNativeValueSetter(element) {
    if (!element) {
      return null;
    }

    const prototype = element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : element instanceof HTMLSelectElement
        ? HTMLSelectElement.prototype
        : element instanceof HTMLInputElement
          ? HTMLInputElement.prototype
          : null;

    if (!prototype) {
      return null;
    }

    return Object.getOwnPropertyDescriptor(prototype, "value")?.set || null;
  }

  function setNativeElementValue(element, nextValue) {
    const setter = getNativeValueSetter(element);

    if (setter) {
      setter.call(element, nextValue);
      return true;
    }

    try {
      element.value = nextValue;
      return true;
    } catch {
      return false;
    }
  }

  function readCurrentControlValue(element) {
    if (!element) {
      return "";
    }

    if (resolveMdSelectElement(element)) {
      return readMdSelectText(element);
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
      return normalizeWhitespace(element.value || "");
    }

    if (element.isContentEditable) {
      return normalizeWhitespace(element.textContent || "");
    }

    return normalizeWhitespace(element.textContent || "");
  }

  function valuesMatch(expectedValue, actualValue) {
    return normalizeWhitespace(expectedValue || "") === normalizeWhitespace(actualValue || "");
  }

  async function setControlValue(element, value) {
    const nativeValue = value == null ? "" : String(value);

    if (resolveMdSelectElement(element)) {
      return await setMdSelectValue(element, nativeValue);
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      element.focus();
      setNativeElementValue(element, nativeValue);
      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: nativeValue
      }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }

    if (element instanceof HTMLSelectElement) {
      const option = [...element.options].find((item) => {
        return item.value === nativeValue ||
          normalizeWhitespace(item.textContent || "") === normalizeWhitespace(nativeValue);
      });

      if (option) {
        setNativeElementValue(element, option.value);
      } else if (nativeValue) {
        setNativeElementValue(element, nativeValue);
      }

      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }

    if (element.isContentEditable) {
      element.focus();
      element.textContent = nativeValue;
      element.dispatchEvent(new InputEvent("input", {
        bubbles: true,
        cancelable: true,
        data: nativeValue
      }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
      element.dispatchEvent(new Event("blur", { bubbles: true }));
      return true;
    }

    if (element instanceof Element) {
      element.textContent = nativeValue;
      return true;
    }

    return false;
  }

  async function getSyncedConfig(fallbackConfig) {
    const storedConfig = await getStoredValue(CONFIG_KEY);
    return storedConfig || fallbackConfig || null;
  }

  function readFileReferenceFromElement(element) {
    const anchor = element instanceof HTMLAnchorElement
      ? element
      : element?.querySelector?.("a[href]") || element?.closest?.("a[href]");

    const sourceUrl = String(anchor?.href || "").trim();
    const fileId = extractDriveFileId(sourceUrl);

    if (!sourceUrl || !fileId) {
      return null;
    }

    return {
      provider: "gdrive",
      sourceUrl,
      fileId,
      fileName: null,
      mimeType: "application/pdf",
      capturedAt: Date.now()
    };
  }

  function base64ToFile(base64, fileName, mimeType) {
    const binary = atob(base64);
    const chunkSize = 8192;
    const chunks = [];

    for (let index = 0; index < binary.length; index += chunkSize) {
      const slice = binary.slice(index, index + chunkSize);
      const bytes = new Uint8Array(slice.length);

      for (let byteIndex = 0; byteIndex < slice.length; byteIndex += 1) {
        bytes[byteIndex] = slice.charCodeAt(byteIndex);
      }

      chunks.push(bytes);
    }

    return new File(chunks, fileName || "imported-file.pdf", {
      type: mimeType || "application/pdf"
    });
  }

  async function fetchFileFromBackground(fileRef) {
    const download = await ext.runtime.sendMessage({
      type: "DOWNLOAD_IMPORT_FILE",
      fileRef
    });

    if (!download?.ok || !download.cacheKey || !download.chunkCount) {
      throw new Error(download?.message || download?.reason || "download-import-file-failed");
    }

    let base64 = "";

    for (let chunkIndex = 0; chunkIndex < download.chunkCount; chunkIndex += 1) {
      const chunkResponse = await ext.runtime.sendMessage({
        type: "GET_IMPORTED_FILE_CHUNK",
        cacheKey: download.cacheKey,
        chunkIndex
      });

      if (!chunkResponse?.ok) {
        await ext.runtime.sendMessage({
          type: "CLEAR_IMPORTED_FILE_CACHE",
          cacheKey: download.cacheKey
        });
        throw new Error(chunkResponse?.reason || "import-file-chunk-failed");
      }

      base64 += chunkResponse.chunk || "";
    }

    await ext.runtime.sendMessage({
      type: "CLEAR_IMPORTED_FILE_CACHE",
      cacheKey: download.cacheKey
    });

    return base64ToFile(base64, download.fileName, download.mimeType);
  }

  function resolveUploadTargetElement(element) {
    if (!(element instanceof Element)) {
      return null;
    }

    return findUploadLikeElement(element) || element;
  }

  function getAllFileInputs() {
    return [...document.querySelectorAll("input[type='file']")]
      .filter((element) => element instanceof HTMLInputElement);
  }

  function scoreFileInputCandidate(input, anchorElement) {
    if (!(input instanceof HTMLInputElement)) {
      return -1;
    }

    let score = 0;
    const name = normalizeWhitespace(input.getAttribute("name") || "").toLowerCase();
    const accept = normalizeWhitespace(input.getAttribute("accept") || "").toLowerCase();
    const form = input.closest("form");

    if (name === "files") score += 100;
    if (accept.includes("pdf")) score += 25;
    if (form?.querySelector("[name='files'], [ngf-select], [ngf-drop], upload-file, .dragbox, .dragbox-input")) {
      score += 30;
    }
    if (
      anchorElement instanceof Element &&
      (
        anchorElement.contains(input) ||
        input.closest("upload-file, form, .dragbox, .dragbox-input") ===
        anchorElement.closest("upload-file, form, .dragbox, .dragbox-input")
      )
    ) {
      score += 50;
    }

    const rect = input.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      score += 10;
    }

    return score;
  }

  function findNativeFileInput(element) {
    const anchorElement = element instanceof Element ? element : null;

    if (anchorElement instanceof HTMLInputElement && anchorElement.type === "file") {
      return anchorElement;
    }

    const candidates = [];

    if (anchorElement) {
      candidates.push(...anchorElement.querySelectorAll("input[type='file']"));

      const anchorForm = anchorElement.closest("form");
      if (anchorForm) {
        candidates.push(...anchorForm.querySelectorAll("input[type='file']"));
      }
    }

    candidates.push(...getAllFileInputs());

    const uniqueCandidates = [...new Set(candidates)]
      .filter((candidate) => candidate instanceof HTMLInputElement);

    if (!uniqueCandidates.length) {
      return null;
    }

    uniqueCandidates.sort((left, right) => {
      return scoreFileInputCandidate(right, anchorElement) - scoreFileInputCandidate(left, anchorElement);
    });

    return uniqueCandidates[0] || null;
  }

  function buildSyntheticFileList(file) {
    return {
      0: file,
      length: 1,
      item(index) {
        return index === 0 ? file : null;
      }
    };
  }

  function buildDataTransferWithFile(file) {
    if (typeof DataTransfer === "function") {
      try {
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        return dataTransfer;
      } catch {
        // continue with fallbacks
      }
    }

    try {
      const clipboardEvent = new ClipboardEvent("");
      const clipboardData = clipboardEvent.clipboardData;
      if (clipboardData?.items) {
        clipboardData.items.add(file);
        return clipboardData;
      }
    } catch {
      // ignore
    }

    const files = buildSyntheticFileList(file);
    return {
      files,
      items: [{ kind: "file", type: file.type, getAsFile: () => file }],
      types: ["Files"]
    };
  }

  function createFileEvent(eventName, dataTransfer) {
    if (typeof DragEvent === "function") {
      try {
        return new DragEvent(eventName, {
          bubbles: true,
          cancelable: true,
          dataTransfer
        });
      } catch {
        // continue
      }
    }

    const event = new Event(eventName, {
      bubbles: true,
      cancelable: true
    });

    try {
      Object.defineProperty(event, "dataTransfer", {
        configurable: true,
        enumerable: true,
        writable: false,
        value: dataTransfer
      });
    } catch {
      event.dataTransfer = dataTransfer;
    }

    return event;
  }

  function hasAttachedFile(input, file) {
    if (!(input instanceof HTMLInputElement) || input.type !== "file") {
      return false;
    }

    const files = input.files;
    if (!files || !files.length) {
      return false;
    }

    return [...files].some((candidate) => {
      return candidate?.name === file.name && candidate?.size === file.size;
    });
  }

  function attachFileToInput(input, file) {
    if (!(input instanceof HTMLInputElement) || input.type !== "file") {
      return false;
    }

    const dataTransfer = buildDataTransferWithFile(file);
    if (!dataTransfer?.files?.length) {
      return false;
    }

    try {
      input.focus();
      input.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    } catch { }

    try {
      const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "files");
      if (descriptor?.set) {
        descriptor.set.call(input, dataTransfer.files);
      } else {
        input.files = dataTransfer.files;
      }

      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("blur", { bubbles: true }));
      return hasAttachedFile(input, file);
    } catch {
      return false;
    }
  }

  function dispatchDropWithFile(element, file) {
    if (!(element instanceof Element)) {
      return false;
    }

    const dataTransfer = buildDataTransferWithFile(file);
    if (!dataTransfer?.files?.length) {
      return false;
    }

    try {
      ["dragenter", "dragover", "drop"].forEach((eventName) => {
        element.dispatchEvent(createFileEvent(eventName, dataTransfer));
      });

      return true;
    } catch {
      return false;
    }
  }

  function normalizeFileNameForMatch(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");
  }

  function getFileSignalNames(file) {
    const fullName = normalizeFileNameForMatch(file?.name || "");
    const baseName = normalizeFileNameForMatch(fullName.replace(/\.[^.]+$/, ""));
    return [...new Set([fullName, baseName].filter(Boolean))];
  }

  function getUploadObservationRoot(element) {
    if (!(element instanceof Element)) {
      return document.body || document.documentElement || null;
    }

    return element.closest("upload-file, form, .dragbox, .dragbox-input, [ngf-drop], [ngf-select]") ||
      element.parentElement ||
      document.body ||
      document.documentElement ||
      element;
  }

  function elementContainsFileSignal(element, file) {
    if (!(element instanceof Element)) {
      return false;
    }

    const text = normalizeFileNameForMatch(element.innerText || element.textContent || "");
    if (!text) {
      return false;
    }

    return getFileSignalNames(file).some((name) => text.includes(name));
  }

  function isBusyUploadIndicator(element) {
    if (!(element instanceof Element) || !isVisible(element)) {
      return false;
    }

    if (element.matches('[role="progressbar"], progress, [aria-busy="true"]')) {
      return true;
    }

    const className = normalizeFileNameForMatch(
      typeof element.className === "string" ? element.className : ""
    );

    if (/(spinner|loading|loader|progress|busy|upload)/i.test(className)) {
      return true;
    }

    const text = normalizeFileNameForMatch(element.innerText || element.textContent || "");
    return /(uploading|loading|please wait|завантаж|обробля)/i.test(text);
  }

  function hasActiveUploadIndicators(root) {
    if (!(root instanceof Element)) {
      return false;
    }

    if (isBusyUploadIndicator(root)) {
      return true;
    }

    const selector = [
      '[role="progressbar"]',
      'progress',
      '[aria-busy="true"]',
      '.spinner',
      '.loading',
      '.loader',
      '.progress',
      '.progress-bar',
      '.busy',
      '.uploading',
      '.is-uploading'
    ].join(', ');

    return [...root.querySelectorAll(selector)].some((element) => isBusyUploadIndicator(element));
  }

  async function waitForFileUploadSettlement(targetElement, file, timeoutMs = 45000) {
    const currentTarget = resolveUploadTargetElement(targetElement) || targetElement || document.body;
    const observationRoot = getUploadObservationRoot(currentTarget);

    if (!(observationRoot instanceof Element)) {
      await wait(1200);
      return false;
    }

    let lastMutationAt = Date.now();
    let sawFileSignal = false;

    const observer = new MutationObserver(() => {
      lastMutationAt = Date.now();
    });

    observer.observe(observationRoot, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true
    });

    const deadline = Date.now() + timeoutMs;

    try {
      while (Date.now() <= deadline) {
        const liveTarget = resolveUploadTargetElement(targetElement) || currentTarget;
        const nativeInput = findNativeFileInput(liveTarget || observationRoot);
        const inputHasFile = Boolean(nativeInput && hasAttachedFile(nativeInput, file));
        const fileNameVisible = elementContainsFileSignal(observationRoot, file);
        const busy = hasActiveUploadIndicators(observationRoot);

        if (inputHasFile || fileNameVisible) {
          sawFileSignal = true;
        }

        if (sawFileSignal && !busy && Date.now() - lastMutationAt >= 1200) {
          return true;
        }

        await wait(250);
      }
    } finally {
      observer.disconnect();
    }

    return sawFileSignal;
  }

  function getDropZoneCandidates(element) {
    if (!(element instanceof Element)) {
      return [];
    }

    const selector = "[ngf-drop], [ngf-select], .dragbox-input, .dragbox, upload-file, [name='files']";
    const candidates = [];

    if (element.matches(selector)) {
      candidates.push(element);
    }

    candidates.push(...element.querySelectorAll(selector));

    const closestCandidate = element.closest(selector);
    if (closestCandidate) {
      candidates.push(closestCandidate);
    }

    candidates.push(...document.querySelectorAll(selector));

    return [...new Set(candidates)].filter((candidate) => candidate instanceof Element);
  }

  function findDropZone(element) {
    return getDropZoneCandidates(element)[0] || null;
  }

  async function waitForUploadTargetElement(entry, timeoutMs = 8000) {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() <= deadline) {
      const targetElement = findElementByEntry(entry);
      const resolvedTarget = resolveUploadTargetElement(targetElement);
      const nativeFileInput = findNativeFileInput(resolvedTarget);
      const dropZone = findDropZone(resolvedTarget || targetElement || document.body);

      if (resolvedTarget || nativeFileInput || dropZone) {
        return resolvedTarget || nativeFileInput || dropZone || null;
      }

      await wait(150);
    }

    return findElementByEntry(entry);
  }

  async function uploadImportedFileToTarget(targetElement, file) {
    const uploadTarget = resolveUploadTargetElement(targetElement) || targetElement || document.body;

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const currentTarget = resolveUploadTargetElement(targetElement) || uploadTarget;

      const inputCandidates = [];
      const bestInput = findNativeFileInput(currentTarget);
      if (bestInput) {
        inputCandidates.push(bestInput);
      }
      inputCandidates.push(...getAllFileInputs());

      for (const input of [...new Set(inputCandidates)]) {
        const attached = attachFileToInput(input, file);
        if (!attached) {
          continue;
        }

        const settled = await waitForFileUploadSettlement(currentTarget || input, file, 45000);
        if (settled) {
          return true;
        }
      }

      const dropCandidates = getDropZoneCandidates(currentTarget || document.body);
      for (const dropCandidate of dropCandidates) {
        try {
          dropCandidate.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        } catch { }

        const dropped = dispatchDropWithFile(dropCandidate, file);
        if (!dropped) {
          continue;
        }

        const settled = await waitForFileUploadSettlement(dropCandidate, file, 45000);
        if (settled) {
          return true;
        }
      }

      await wait(300);
    }

    return false;
  }

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

      const importedFile = await fetchFileFromBackground(payload.fileRef);
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

  document.addEventListener("mousemove", (event) => {
    if (!pickerState.active) {
      return;
    }

    setHoverElement(resolveFieldCandidate(event));
  }, true);

  document.addEventListener("mouseleave", () => {
    if (pickerState.active) {
      setHoverElement(null);
    }
  }, true);

  document.addEventListener("click", async (event) => {
    if (!pickerState.active || event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    const candidate = resolveFieldCandidate(event);

    if (!candidate) {
      showToast("Це не поле. Виберіть текстовий елемент або елемент введення.", "error");
      return;
    }

    await selectField(candidate);
  }, true);

  document.addEventListener("keydown", async (event) => {
    if (!pickerState.active || event.key !== "Escape") {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    await finishPickerPhase();
  }, true);

  window.addEventListener("focus", () => {
    syncPickerMode();
  });

  document.addEventListener("visibilitychange", () => {
    syncPickerMode();
  });

  ext.storage?.onChanged?.addListener((changes, areaName) => {
    if (areaName === "local" && changes[PICKER_SESSION_KEY]) {
      syncPickerMode();
    }
  });

  ext.runtime.onMessage.addListener((message, sender, sendResponse) => {
    (async () => {
      if (message?.type === "START_IMPORT") {
        const config = await getSyncedConfig(message.config);
        const collectResult = await collectImportPayload(config);
        if (!collectResult.ok) {
          showToast(collectResult.message, "error", 5200);
          sendResponse(collectResult);
          return;
        }

        await ext.storage.local.set({
          [IMPORT_PAYLOAD_KEY]: collectResult.payload
        });

        sendResponse(collectResult);
        return;
      }

      if (message?.type === "COLLECT_IMPORT_PAYLOAD") {
        const result = await collectImportPayload(message.config);
        if (!result.ok) {
          showToast(result.message, "error", 5200);
        }
        sendResponse(result);
        return;
      }

      if (message?.type === "APPLY_IMPORT_PAYLOAD") {
        const result = await applyImportPayload(message.config, message.payload);
        showToast(result.message, result.ok ? "success" : "error", 5600);
        sendResponse(result);
        return;
      }

      sendResponse({ ok: false, reason: "unknown-message" });
    })().catch((error) => {
      console.error("CONTENT_MESSAGE_ERROR", error);
      sendResponse({ ok: false, message: String(error?.message || error) });
    });

    return true;
  });

  syncPickerMode();
})();