function setFlashStatus(message) {
  localStorage.setItem(FLASH_KEY, message);
}

function consumeFlashStatus() {
  const message = localStorage.getItem(FLASH_KEY);

  if (message) {
    localStorage.removeItem(FLASH_KEY);
  }

  return message;
}
