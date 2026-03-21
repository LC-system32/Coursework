async function writeDebug(step, details = {}) {
  const entry = {
    time: new Date().toISOString(),
    step,
    details
  };

  try {
    console.log("[FIELD_PICKER]", step, details);

    const stored = await EXT.storage.local.get(FIELD_PICKER_DEBUG_KEY);
    const list = Array.isArray(stored?.[FIELD_PICKER_DEBUG_KEY])
      ? stored[FIELD_PICKER_DEBUG_KEY]
      : [];

    list.push(entry);

    await EXT.storage.local.set({
      [FIELD_PICKER_DEBUG_KEY]: list.slice(-100)
    });
  } catch (error) {
    console.error("[FIELD_PICKER][DEBUG_WRITE_FAILED]", error);
  }
}
