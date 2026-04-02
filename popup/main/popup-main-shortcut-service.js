async function renderShortcutHint() {
  const shortcutLabel = await PopupBridge.getCommandShortcut("run-direct-import", "Ctrl+Shift+F");
  popupUiState.shortcutHintText = `Швидкий запуск: ${shortcutLabel}`;
}
