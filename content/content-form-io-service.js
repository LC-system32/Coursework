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
