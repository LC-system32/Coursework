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
