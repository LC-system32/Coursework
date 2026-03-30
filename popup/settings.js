const { createApp, reactive, h } = Vue;

const settingsUiStateProxy = reactive({ ...settingsUiDefaults });
setSettingsUiStateProxy(settingsUiStateProxy);

function renderBackIcon() {
  return h(
    "svg",
    { viewBox: "0 0 24 24", "aria-hidden": "true" },
    [h("path", { d: "M15 18 9 12l6-6" })]
  );
}

createApp({
  data() {
    return {
      ui: settingsUiStateProxy,
      fileFieldTitle: FILE_FIELD_LABEL,
      importFileInputEl: null
    };
  },
  methods: {
    getDisplayValue(mapping, index) {
      return getMappingDisplayValue(mapping, index);
    },
    handleSiteInput(role, value) {
      if (role === "source") {
        sourceSiteInput.value = value;
      } else {
        targetSiteInput.value = value;
      }

      scheduleAutoSave();
    },
    handleMappingInput(role, index, value) {
      updateMappingFromInput(role, index, value);
      renderFieldList(role);
      scheduleAutoSave();
    },
    handleAddField(role) {
      insertBlankRegularField(role);
      scheduleAutoSave();
    },
    handleRemoveField(role, index) {
      const mapping = getRoleMappings(role)[index];

      if (mapping?.isFileField) {
        return;
      }

      removeFieldByIndex(role, index);
      scheduleAutoSave();
    },
    async handleLaunchPicker() {
      await handleLaunchFieldPickerClick();
    },
    async handleExport() {
      try {
        await exportCurrentConfig();
      } catch (error) {
        console.error("EXPORT_SETTINGS_ERROR", error);
        setStatus("Не вдалося експортувати налаштування.");
      }
    },
    triggerImportFile() {
      if (!this.importFileInputEl) {
        return;
      }

      this.importFileInputEl.value = "";
      setStatus("Оберіть JSON-файл для імпорту у вікно налаштувань.");
      this.importFileInputEl.click();
    },
    async handleImportFileChange(event) {
      const file = event?.target?.files?.[0];

      if (!file) {
        setStatus("Імпорт скасовано. Файл не вибрано.");
        return;
      }

      try {
        await importConfigFromFile(file);
      } catch (error) {
        const message = error?.message || "ВАЖЛИВО! Не вдалося імпортувати файл налаштувань. Можливо, файл пошкоджений. Перевірте його вміст і спробуйте ще раз.";
        setStatus(message);
        showPopupToast(message, "error", 5600);
      } finally {
        event.target.value = "";
      }
    },
    async handleSave() {
      try {
        const nextConfig = readDraftConfig();
        await PopupBridge.saveConfig(nextConfig);
        PopupBridge.setFlashStatus("Налаштування збережено. Схема імпорту оновлена.");
        setStatus("Налаштування збережено.");
        await closeSettingsPage();
      } catch (error) {
        console.error("SETTINGS_SAVE_ERROR", error);
        setStatus("Не вдалося зберегти налаштування.");
      }
    },
    async handleClose() {
      try {
        await closeSettingsPage();
      } catch (error) {
        console.error("CLOSE_SETTINGS_ERROR", error);
      }
    },
    renderFieldRow(role, mapping, index) {
      const title = mapping.isFileField ? this.fileFieldTitle : `Поле ${index + 1}`;
      const buttonTitle = mapping.isFileField
        ? "Поле для файлу не можна видалити, але його id/name можна редагувати."
        : `Видалити поле ${index + 1}`;
      const inputTitle = mapping.isFileField
        ? "Поле для файлу завжди лишається останнім, але його id/name можна змінювати вручну."
        : "Вкажіть id або name поля.";

      return h("div", { class: "field-row", key: `${role}-${index}` }, [
        h("label", { class: "field-card" }, [
          h("span", { class: "field-card__label" }, title),
          h("input", {
            type: "text",
            value: this.getDisplayValue(mapping, index),
            placeholder: mapping.isFileField ? "id або name поля/лінка для файлу" : "id або name поля",
            title: inputTitle,
            onInput: (event) => this.handleMappingInput(role, index, event.target.value)
          })
        ]),
        h(
          "button",
          {
            type: "button",
            class: "field-remove-button",
            "aria-label": title,
            title: buttonTitle,
            disabled: Boolean(mapping.isFileField),
            onClick: () => this.handleRemoveField(role, index)
          },
          mapping.isFileField ? "🔒" : "×"
        )
      ]);
    },
    renderColumn(role, siteLabel, siteValue, sitePlaceholder, mappings, isTarget = false) {
      const columnClass = isTarget ? "settings-column settings-column--target" : "settings-column";

      return h("article", { class: columnClass }, [
        h("header", { class: "settings-column__head" }, [
          h("span", { class: "settings-column__badge" }, siteLabel),
          h("label", { class: "site-input" }, [
            h("span", { class: "site-input__label" }, role === "source" ? "Джерело" : "Приймач"),
            h("input", {
              type: "text",
              placeholder: sitePlaceholder,
              value: siteValue,
              ref: role === "source"
                ? (element) => setSourceSiteInputElement(element || null)
                : null,
              onInput: (event) => this.handleSiteInput(role, event.target.value)
            })
          ])
        ]),
        h("div", { class: "field-stack" }, mappings.map((mapping, index) => this.renderFieldRow(role, mapping, index))),
        h(
          "button",
          {
            class: "secondary-button field-list-action",
            type: "button",
            onClick: () => this.handleAddField(role)
          },
          "Додати поле"
        )
      ]);
    }
  },
  mounted() {
    bindSettingsPageEvents();
    registerSettingsRuntimeMessages();

    initSettingsPage().catch((error) => {
      console.error("SETTINGS_INIT_ERROR", error);
      setStatus("Не вдалося завантажити налаштування.");
    });
  },
  render() {
    return h("main", { class: "popup-shell settings-shell" }, [
      h("section", { class: "panel settings-panel" }, [
        h("header", { class: "topbar topbar--settings" }, [
          h(
            "button",
            {
              class: "icon-button icon-button--soft",
              type: "button",
              "aria-label": "Назад",
              onClick: this.handleClose
            },
            [renderBackIcon()]
          ),
          h("div", { class: "topbar__center" }, [
            h("p", { class: "brand__eyebrow" }, "Schema editor"),
            h("h1", { class: "brand__title brand__title--settings" }, "Налаштування")
          ]),
          h("span", { class: "topbar__spacer", "aria-hidden": "true" })
        ]),
        h("section", { class: "settings-screen" }, [
          h("div", { class: "settings-scroll" }, [
            h("section", { class: "settings-transfer-card", "aria-label": "Імпорт та експорт налаштувань" }, [
              h("div", { class: "settings-transfer-card__copy" }, [
                h("h2", { class: "settings-transfer-card__title" }, "Керування конфігурацією"),
                h(
                  "p",
                  { class: "settings-transfer-card__text" },
                  "У цьому розділі виконується налаштування схеми перенесення даних, а також імпорт і експорт конфігурації плагіна. Вибір полів дозволяє встановити відповідність між полями сторінки-джерела та сторінки-приймача."
                )
              ]),
              h(
                "button",
                {
                  class: "primary-button settings-transfer-card__actions-picker-card__button",
                  type: "button",
                  disabled: this.ui.launchFieldPickerDisabled,
                  onClick: this.handleLaunchPicker
                },
                "Вибрати поля на сторінках"
              ),
              h("div", { class: "settings-transfer-card__actions" }, [
                h("button", { class: "secondary-button", type: "button", onClick: this.handleExport }, "Експорт JSON"),
                h("button", { class: "secondary-button", type: "button", onClick: this.triggerImportFile }, "Імпорт JSON"),
                h("input", {
                  type: "file",
                  accept: "application/json,.json",
                  hidden: true,
                  ref: (element) => {
                    this.importFileInputEl = element || null;
                  },
                  onChange: this.handleImportFileChange
                })
              ])
            ]),
            h(
              "span",
              {
                class: "settings-column__badge",
                style: { fontSize: "13px", display: "flex", width: "fit-content", margin: "0 auto 15px" }
              },
              "Схема конфігурації зіставлення полів джерела та приймача"
            ),
            h("section", { class: "settings-grid", "aria-label": "Колонки налаштувань" }, [
              this.renderColumn(
                "source",
                "З сайту",
                this.ui.sourceSite,
                "https://source-site.ua",
                this.ui.sourceMappings,
                false
              ),
              this.renderColumn(
                "target",
                "На сайт",
                this.ui.targetSite,
                "https://target-site.ua",
                this.ui.targetMappings,
                true
              )
            ])
          ]),
          h("p", { class: "settings-status", role: "status", "aria-live": "polite" }, this.ui.statusMessage),
          h("div", { class: "settings-actions" }, [
            h("button", { class: "secondary-button", type: "button", onClick: this.handleClose }, "Скасувати"),
            h(
              "button",
              { class: "primary-button primary-button--compact", type: "button", onClick: this.handleSave },
              "Зберегти"
            )
          ])
        ])
      ])
    ]);
  }
}).mount("#settingsAppRoot");
