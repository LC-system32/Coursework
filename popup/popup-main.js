const { createApp, reactive, h } = Vue;

const popupUiStateProxy = reactive({ ...popupUiDefaults });
setPopupUiStateProxy(popupUiStateProxy);

function renderSettingsIcon() {
  return h(
    "svg",
    { viewBox: "0 0 24 24", "aria-hidden": "true" },
    [
      h("path", {
        d: "M10.33 1.67h3.34l.38 2.47c.57.16 1.12.39 1.65.69l2.08-1.38 2.36 2.36-1.38 2.08c.3.53.53 1.08.69 1.65l2.47.38v3.34l-2.47.38c-.16.57-.39 1.12-.69 1.65l1.38 2.08-2.36 2.36-2.08-1.38c-.53.3-1.08.53-1.65.69l-.38 2.47h-3.34l-.38-2.47a7.77 7.77 0 0 1-1.65-.69l-2.08 1.38-2.36-2.36 1.38-2.08a7.77 7.77 0 0 1-.69-1.65l-2.47-.38V9.92l2.47-.38c.16-.57.39-1.12.69-1.65L3.86 5.81l2.36-2.36 2.08 1.38c.53-.3 1.08-.53 1.65-.69zm1.67 7.33a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z"
      })
    ]
  );
}

function renderArrowIcon() {
  return h(
    "svg",
    { viewBox: "0 0 24 24" },
    [h("path", { d: "M5 12h12m-4-4 4 4-4 4" })]
  );
}

function renderShortcutIcon() {
  return h(
    "svg",
    { viewBox: "0 0 24 24" },
    [
      h("rect", { x: "3", y: "6", width: "18", height: "12", rx: "3", ry: "3" }),
      h("path", { d: "M7 10h1m2 0h1m2 0h4m-8 4h6" })
    ]
  );
}

createApp({
  data() {
    return {
      ui: popupUiStateProxy
    };
  },
  methods: {
    openSettings() {
      handleOpenSettingsClick();
    },
    startImport() {
      handleImportButtonClick();
    }
  },
  mounted() {
    registerPopupRuntimeMessages();

    initPopup().catch((error) => {
      console.error("POPUP_INIT_ERROR", error);
      setStatus("Не вдалося завантажити налаштування.");
    });
  },
  render() {
    return h("main", { class: "popup-shell" }, [
      h("section", { class: "panel" }, [
        h("header", { class: "topbar" }, [
          h("div", { class: "brand" }, [
            h("span", { class: "brand__mark", "aria-hidden": "true" }),
            h("div", { class: "brand__copy" }, [
              h("p", { class: "brand__eyebrow" }, "Data transfer"),
              h("h1", { class: "brand__title" }, "Імпорт даних")
            ])
          ]),
          h(
            "button",
            {
              class: "icon-button",
              type: "button",
              "aria-label": "Відкрити налаштування",
              onClick: this.openSettings
            },
            [renderSettingsIcon()]
          )
        ]),
        h("section", { class: "main-screen" }, [
          h("div", { class: "site-card" }, [
            h("div", null, [
              h("p", { class: "site-card__label", style: { margin: "5pt" } }, "Маршрут імпорту"),
              h(
                "h2",
                { class: "site-card__title", style: { margin: "5pt", fontSize: "15pt" } },
                "Активна схема перенесення"
              )
            ]),
            h("section", { class: "flow-card", "aria-label": "Напрямок імпорту" }, [
              h("div", { class: "site-card" }, [
                h("span", { class: "site-card__label" }, "Звідки"),
                h("strong", { class: "site-card__value" }, this.ui.sourceSitePreview)
              ]),
              h("div", { class: "flow-card__arrow", "aria-hidden": "true" }, [renderArrowIcon()]),
              h("div", { class: "site-card site-card--target" }, [
                h("span", { class: "site-card__label" }, "Куди"),
                h("strong", { class: "site-card__value" }, this.ui.targetSitePreview)
              ])
            ])
          ]),
          h(
            "button",
            {
              class: "primary-button",
              type: "button",
              style: { marginTop: "2%", marginBottom: "2%" },
              disabled: this.ui.importDisabled,
              onClick: this.startImport
            },
            "Імпортувати дані"
          ),
          h("p", { class: "status-line", role: "status", "aria-live": "polite" }, this.ui.statusMessage),
          h("div", { class: "bottom-row" }, [
            h("div", { class: "hint-pill", "aria-label": "Гаряча клавіша" }, [
              h("span", { class: "hint-pill__icon", "aria-hidden": "true" }, [renderShortcutIcon()]),
              h("span", { class: "hint-pill__text" }, this.ui.shortcutHintText)
            ])
          ])
        ])
      ])
    ]);
  }
}).mount("#popupAppRoot");
