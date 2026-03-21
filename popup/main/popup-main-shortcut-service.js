async function renderShortcutHint() {
  if (!shortcutHintTextEl) {
    return;
  }

  const shortcutLabel = await PopupBridge.getCommandShortcut("run-direct-import", "Ctrl+Shift+F");
  shortcutHintTextEl.textContent = `Швидкий запуск: ${shortcutLabel}`;
}
