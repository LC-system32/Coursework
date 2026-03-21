openSettingsBtn.addEventListener("click", () => {
  handleOpenSettingsClick();
});

importBtn.addEventListener("click", () => {
  handleImportButtonClick();
});

registerPopupRuntimeMessages();

initPopup().catch((error) => {
  console.error("POPUP_INIT_ERROR", error);
  setStatus("Не вдалося завантажити налаштування.");
});
