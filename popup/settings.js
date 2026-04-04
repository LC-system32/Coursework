const { createApp, reactive, h, Transition, Teleport } = Vue;

const PV = globalThis.PrimeVue;
const settingsUiStateProxy = reactive({ ...settingsUiDefaults });
setSettingsUiStateProxy(settingsUiStateProxy);

const shellBorder = "1px solid rgba(96, 165, 250, 0.16)";
const surfaceBorder = "1px solid rgba(148, 163, 184, 0.14)";

const titleColor = "#f8fafc";
const textColor = "rgba(226, 232, 240, 0.92)";
const mutedTextColor = "rgba(148, 163, 184, 0.78)";
const softBlueText = "#7dd3fc";

const shellBackground =
  "radial-gradient(circle at top left, rgba(37,99,235,0.24) 0%, rgba(37,99,235,0) 34%)," +
  "radial-gradient(circle at top right, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0) 28%)," +
  "linear-gradient(180deg, #071120 0%, #09162a 38%, #050d19 100%)";

const surfaceBackground =
  "linear-gradient(180deg, rgba(9,19,36,0.96) 0%, rgba(6,14,28,0.98) 100%)";

const surfaceBackgroundAlt =
  "linear-gradient(180deg, rgba(8,24,44,0.90) 0%, rgba(6,16,32,0.96) 100%)";

const heroBackground =
  "linear-gradient(135deg, rgba(10,22,44,0.98) 0%, rgba(8,18,36,0.98) 52%, rgba(5,14,28,1) 100%)";

const primaryGradient =
  "linear-gradient(135deg, #2563eb 0%, #1d4ed8 48%, #38bdf8 100%)";

const shellShadow = "0 24px 56px rgba(2, 8, 23, 0.52)";
const surfaceShadow = "0 14px 30px rgba(2, 8, 23, 0.34)";
const primaryShadow = "0 14px 34px rgba(37, 99, 235, 0.34)";

const reduceMotion =
  globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;

function resolvePrimeInputElement(element) {
  if (!element) {
    return null;
  }

  if (element.$el) {
    return element.$el.querySelector?.("input") || element.$el;
  }

  return element.querySelector?.("input") || element;
}

function bindSourceInputRef(element) {
  const inputEl = resolvePrimeInputElement(element);

  if (typeof setSourceSiteInputElement === "function") {
    setSourceSiteInputElement(inputEl || null);
    return;
  }

  globalThis.sourceSiteInput = inputEl || null;
}

function bindTargetInputRef(element) {
  const inputEl = resolvePrimeInputElement(element);

  if (typeof setTargetSiteInputElement === "function") {
    setTargetSiteInputElement(inputEl || null);
    return;
  }

  globalThis.targetSiteInput = inputEl || null;
}

function getStatusSeverity(message) {
  const text = String(message || "").toLowerCase();

  if (
    text.includes("важливо") ||
    text.includes("не вдалося") ||
    text.includes("помил") ||
    text.includes("не можуть")
  ) {
    return "error";
  }

  if (
    text.includes("вибір") ||
    text.includes("запущено") ||
    text.includes("оберіть") ||
    text.includes("зачекайте")
  ) {
    return "warn";
  }

  if (
    text.includes("збережено") ||
    text.includes("імпортовано") ||
    text.includes("оновлено") ||
    text.includes("завершено")
  ) {
    return "success";
  }

  return "info";
}

function getToastSeverity(tone) {
  if (tone === "error") {
    return "error";
  }

  if (tone === "success") {
    return "success";
  }

  if (tone === "warn" || tone === "warning") {
    return "warn";
  }

  return "info";
}

function getStatusBoxStyle(severity) {
  if (severity === "success") {
    return {
      border: "1px solid rgba(52, 211, 153, 0.28)",
      background:
        "linear-gradient(180deg, rgba(6, 36, 28, 0.94) 0%, rgba(6, 28, 22, 0.98) 100%)",
      color: "#86efac"
    };
  }

  if (severity === "warn") {
    return {
      border: "1px solid rgba(250, 204, 21, 0.26)",
      background:
        "linear-gradient(180deg, rgba(44, 32, 6, 0.94) 0%, rgba(34, 24, 6, 0.98) 100%)",
      color: "#fde68a"
    };
  }

  if (severity === "error") {
    return {
      border: "1px solid rgba(248, 113, 113, 0.26)",
      background:
        "linear-gradient(180deg, rgba(46, 10, 16, 0.94) 0%, rgba(32, 8, 12, 0.98) 100%)",
      color: "#fca5a5"
    };
  }

  return {
    border: "1px solid rgba(56, 189, 248, 0.24)",
    background:
      "linear-gradient(180deg, rgba(7, 30, 44, 0.94) 0%, rgba(6, 22, 34, 0.98) 100%)",
    color: "#7dd3fc"
  };
}

function getMotionDelay(el) {
  return Number(el?.dataset?.motionDelay || 0);
}

function getMotionDistance(el) {
  return Number(el?.dataset?.motionDistance || 14);
}

function motionBeforeEnter(el) {
  const distance = getMotionDistance(el);

  el.style.opacity = "0";
  el.style.transform = `translate3d(0, -${distance}px, 0)`;
  el.style.willChange = "transform, opacity";
  el.style.backfaceVisibility = "hidden";
}

function motionEnter(el, done) {
  const delay = getMotionDelay(el);
  const distance = getMotionDistance(el);
  const duration = reduceMotion ? 1 : 320;

  if (typeof el.animate === "function" && !reduceMotion) {
    const animation = el.animate(
      [
        {
          opacity: 0,
          transform: `translate3d(0, -${distance}px, 0)`
        },
        {
          opacity: 1,
          transform: "translate3d(0, 0, 0)"
        }
      ],
      {
        duration,
        delay,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        fill: "forwards"
      }
    );

    animation.onfinish = () => {
      el.style.opacity = "1";
      el.style.transform = "translate3d(0, 0, 0)";
      el.style.willChange = "";
      done();
    };

    animation.oncancel = () => {
      el.style.opacity = "1";
      el.style.transform = "translate3d(0, 0, 0)";
      el.style.willChange = "";
      done();
    };

    return;
  }

  window.setTimeout(() => {
    el.style.transition =
      "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), opacity 280ms ease";
    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translate3d(0, 0, 0)";
    });
  }, delay);

  window.setTimeout(() => {
    el.style.willChange = "";
    done();
  }, delay + duration + 40);
}

function motionLeave(el, done) {
  if (reduceMotion) {
    done();
    return;
  }

  if (typeof el.animate === "function") {
    const animation = el.animate(
      [
        {
          opacity: 1,
          transform: "translate3d(0, 0, 0)"
        },
        {
          opacity: 0,
          transform: "translate3d(0, -8px, 0)"
        }
      ],
      {
        duration: 160,
        easing: "ease-out",
        fill: "forwards"
      }
    );

    animation.onfinish = done;
    animation.oncancel = done;
    return;
  }

  el.style.transition = "transform 160ms ease, opacity 140ms ease";
  el.style.opacity = "0";
  el.style.transform = "translate3d(0, -8px, 0)";

  window.setTimeout(done, 180);
}

function renderMotionItem(key, delay, child, distance = 14) {
  return h(
    Transition,
    {
      css: false,
      appear: true,
      onBeforeEnter: motionBeforeEnter,
      onEnter: motionEnter,
      onLeave: motionLeave
    },
    {
      default: () =>
        h(
          "div",
          {
            key,
            "data-motion-delay": String(delay),
            "data-motion-distance": String(distance),
            style: {
              width: "100%"
            }
          },
          [child]
        )
    }
  );
}

function renderToastStack(toasts, closeToast) {
  if (!toasts.length) {
    return null;
  }

  return h(
    "div",
    {
      style: {
        position: "fixed",
        top: "16px",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: "2147483647",
        width: "min(92vw, 760px)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        pointerEvents: "none"
      }
    },
    toasts.map((toast) =>
      h(
        PV.Message,
        {
          key: toast.id,
          severity: toast.severity,
          closable: true,
          onClose: () => closeToast(toast.id),
          style: {
            pointerEvents: "auto",
            borderRadius: "14px",
            border: "1px solid rgba(96, 165, 250, 0.18)",
            background:
              "linear-gradient(180deg, rgba(9,19,36,0.96) 0%, rgba(6,14,28,0.98) 100%)",
            color: textColor,
            boxShadow: "0 16px 36px rgba(2, 8, 23, 0.42)"
          }
        },
        {
          default: () => toast.text
        }
      )
    )
  );
}

function renderBackdropDecor() {
  return h("div", {
    style: {
      position: "absolute",
      inset: "0",
      overflow: "hidden",
      pointerEvents: "none",
      borderRadius: "24px"
    }
  }, [
    h("div", {
      style: {
        position: "absolute",
        top: "-72px",
        left: "-58px",
        width: "220px",
        height: "220px",
        borderRadius: "999px",
        background:
          "radial-gradient(circle, rgba(37,99,235,0.36), rgba(37,99,235,0))",
        filter: "blur(18px)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        top: "12px",
        right: "-68px",
        width: "200px",
        height: "200px",
        borderRadius: "999px",
        background:
          "radial-gradient(circle, rgba(56,189,248,0.22), rgba(56,189,248,0))",
        filter: "blur(18px)"
      }
    }),
    h("div", {
      style: {
        position: "absolute",
        bottom: "-56px",
        right: "24px",
        width: "180px",
        height: "180px",
        borderRadius: "999px",
        background:
          "radial-gradient(circle, rgba(29,78,216,0.18), rgba(29,78,216,0))",
        filter: "blur(16px)"
      }
    })
  ]);
}

function renderMetricCard(label, value, helper) {
  return h(
    "div",
    {
      style: {
        minWidth: "0",
        flex: "1 1 220px",
        padding: "16px 18px",
        borderRadius: "18px",
        border: surfaceBorder,
        background: surfaceBackground,
        boxShadow: surfaceShadow
      }
    },
    [
      h(
        "div",
        {
          style: {
            fontSize: "11px",
            textTransform: "uppercase",
            color: mutedTextColor,
            fontWeight: "700"
          }
        },
        label
      ),
      h(
        "div",
        {
          style: {
            display: "flex",
            alignItems: "baseline",
          }
        },
        [
          h(
            "span",
            {
              style: {
                fontSize: "28px",
                lineHeight: "1",
                fontWeight: "800",
                color: titleColor
              }
            },
            value
          )
        ]
      ),
      helper
        ? h(
          "div",
          {
            style: {
              fontSize: "12px",
              color: mutedTextColor
            }
          },
          helper
        )
        : null
    ]
  );
}

function renderSectionHeader(title, description) {
  return h(
    "div",
    {
      style: {
        display: "flex",
        flexDirection: "column",
      }
    },
    [
      h(
        "h2",
        {
          style: {
            margin: "0",
            fontSize: "26px",
            color: titleColor
          }
        },
        title
      ),
      h(
        "p",
        {
          style: {
            margin: "0",
            fontSize: "14px",
            color: mutedTextColor,
            maxWidth: "760px",
          }
        },
        description
      )
    ]
  );
}

function renderSettingsHero() {
}

createApp({
  data() {
    return {
      ui: settingsUiStateProxy,
      fileFieldTitle: FILE_FIELD_LABEL || "Поле для файлу",
      importFileInputEl: null,
      toasts: [],
      toastSeq: 0,
      toastListener: null
    };
  },

  computed: {
    sourceCount() {
      return Array.isArray(this.ui.sourceMappings) ? this.ui.sourceMappings.length : 0;
    },

    targetCount() {
      return Array.isArray(this.ui.targetMappings) ? this.ui.targetMappings.length : 0;
    },

    countsAreBalanced() {
      return this.sourceCount === this.targetCount;
    },

    balanceText() {
      if (!this.sourceCount && !this.targetCount) {
        return "Схему ще не налаштовано.";
      }

      if (this.countsAreBalanced) {
        return "Кількість полів джерела та приймача збігається. Імпорт може бути запущений після збереження.";
      }

      return "Кількість полів не збігається. Вирівняйте обидва списки перед запуском імпорту.";
    },

    routeText() {
      const from = this.ui.sourceSite || "Сайт-джерело ще не вказано";
      const to = this.ui.targetSite || "Сайт-приймач ще не вказано";
      return `${from} → ${to}`;
    }
  },

  methods: {
    addToast(payload) {
      const toast = {
        id: ++this.toastSeq,
        text: String(payload?.text || "").trim(),
        severity: getToastSeverity(payload?.tone)
      };

      if (!toast.text) {
        return;
      }

      this.toasts = [...this.toasts.slice(-3), toast];

      window.setTimeout(() => {
        this.closeToast(toast.id);
      }, Number(payload?.duration) || 4200);
    },

    closeToast(id) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
    },

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
        const message =
          error?.message ||
          "ВАЖЛИВО! Не вдалося імпортувати файл налаштувань. Можливо, файл пошкоджений. Перевірте його вміст і спробуйте ще раз.";
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

      return h(
        PV.Card,
        {
          key: `${role}-${index}`,
          style: {
            width: "100%",
            borderRadius: "18px",
            border: surfaceBorder,
            background: mapping.isFileField
              ? "linear-gradient(180deg, rgba(8,24,44,0.90) 0%, rgba(6,16,32,0.96) 100%)"
              : surfaceBackground,
            boxShadow: surfaceShadow
          }
        },
        {
          content: () =>
            h(
              "div",
              {
                style: {
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: "12px",
                  alignItems: "end"
                }
              },
              [
                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px"
                    }
                  },
                  [
                    h(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap"
                        }
                      },
                      [
                        h(
                          "div",
                          {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px"
                            }
                          },
                          [
                            h(
                              "strong",
                              {
                                style: {
                                  fontSize: "15px",
                                  color: titleColor
                                }
                              },
                              title
                            ),
                            h(
                              "span",
                              {
                                style: {
                                  fontSize: "12px",
                                  color: mutedTextColor,
                                  lineHeight: "1.5"
                                }
                              },
                              mapping.isFileField
                                ? "Завжди останній елемент у списку. Редагується тільки значення id або name."
                                : "Поле можна редагувати вручну як id або name і змінювати в будь-який момент."
                            )
                          ]
                        )
                      ]
                    ),
                    h(PV.InputText, {
                      modelValue: this.getDisplayValue(mapping, index),
                      placeholder: mapping.isFileField
                        ? "id або name поля/лінка для файлу"
                        : "id або name поля",
                      title: inputTitle,
                      fluid: true,
                      onInput: (event) => this.handleMappingInput(role, index, event.target.value),
                      style: {
                        minHeight: "46px"
                      }
                    })
                  ]
                ),
                h(PV.Button, {
                  label: mapping.isFileField ? "Захищено" : "Видалити",
                  severity: mapping.isFileField ? "secondary" : "danger",
                  variant: mapping.isFileField ? "outlined" : "text",
                  disabled: Boolean(mapping.isFileField),
                  title: buttonTitle,
                  onClick: () => this.handleRemoveField(role, index),
                  style: {
                    minHeight: "46px",
                    borderRadius: "14px"
                  }
                })
              ]
            )
        }
      );
    },

    renderColumn(role, siteLabel, siteValue, sitePlaceholder, mappings, isTarget = false) {
      const title = isTarget ? "На сайт" : "З сайту";

      return h(
        PV.Card,
        {
          style: {
            flex: "1 1 320px",
            minWidth: "320px",
            borderRadius: "22px",
            border: surfaceBorder,
            background: surfaceBackground,
            boxShadow: surfaceShadow
          }
        },
        {
          content: () =>
            h(
              "div",
              {
                style: {
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px"
                }
              },
              [
                h(
                  "div",
                  {
                    style: {
                      borderRadius: "18px",
                      padding: "18px",
                      border: "1px solid rgba(56, 189, 248, 0.16)",
                      background: isTarget
                        ? "linear-gradient(180deg, rgba(8,24,44,0.90) 0%, rgba(6,16,32,0.96) 100%)"
                        : "linear-gradient(180deg, rgba(9,19,36,0.88) 0%, rgba(6,14,28,0.94) 100%)"
                    }
                  },
                  [
                    h(
                      "div",
                      {
                        style: {
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          flexWrap: "wrap",
                          marginBottom: "12px"
                        }
                      },
                      [
                        h(
                          "div",
                          {
                            style: {
                              display: "flex",
                              flexDirection: "column",
                              gap: "4px"
                            }
                          },
                          [
                            h(
                              "div",
                              {
                                style: {
                                  fontSize: "11px",
                                  letterSpacing: ".12em",
                                  textTransform: "uppercase",
                                  color: softBlueText,
                                  fontWeight: "700"
                                }
                              },
                              title
                            ),
                            h(
                              "strong",
                              {
                                style: {
                                  fontSize: "20px",
                                  color: titleColor
                                }
                              },
                              siteLabel
                            )
                          ]
                        )
                      ]
                    ),
                    h(PV.InputText, {
                      modelValue: siteValue,
                      placeholder: sitePlaceholder,
                      fluid: true,
                      ref: role === "source" ? bindSourceInputRef : bindTargetInputRef,
                      onInput: (event) => this.handleSiteInput(role, event.target.value),
                      style: {
                        minHeight: "48px"
                      }
                    })
                  ]
                ),

                h(
                  "div",
                  {
                    style: {
                      display: "flex",
                      flexDirection: "column",
                      gap: "12px"
                    }
                  },
                  mappings.map((mapping, index) => this.renderFieldRow(role, mapping, index))
                ),

                h(PV.Button, {
                  label: "Додати поле",
                  severity: "secondary",
                  variant: "outlined",
                  fluid: true,
                  onClick: () => this.handleAddField(role),
                  style: {
                    minHeight: "48px",
                    borderRadius: "14px",
                    borderColor: "rgba(148,163,184,0.20)",
                    background: "rgba(255,255,255,0.02)",
                    color: "#e2e8f0"
                  }
                })
              ]
            )
        }
      );
    }
  },

  mounted() {
    document.documentElement.classList.add("app-dark");
    this.toastListener = (event) => this.addToast(event.detail || {});
    window.addEventListener(POPUP_TOAST_EVENT, this.toastListener);

    bindSettingsPageEvents();
    registerSettingsRuntimeMessages();

    initSettingsPage().catch((error) => {
      console.error("SETTINGS_INIT_ERROR", error);
      setStatus("Не вдалося завантажити налаштування.");
    });
  },

  beforeUnmount() {
    if (this.toastListener) {
      window.removeEventListener(POPUP_TOAST_EVENT, this.toastListener);
    }
  },

  render() {
    const statusSeverity = getStatusSeverity(this.ui.statusMessage);
    const statusBoxStyle = getStatusBoxStyle(statusSeverity);

    return h(
      "div",
      {
        style: {
          position: "relative",
          maxWidth: "1320px",
          margin: "0 auto"
        }
      },
      [
        renderToastStack(this.toasts, this.closeToast),

        h(
          PV.Card,
          {
            style: {
              position: "relative",
              overflow: "hidden",
              borderRadius: "24px",
              border: shellBorder,
              background: shellBackground,
              boxShadow: shellShadow
            }
          },
          {
            content: () =>
              h(
                "div",
                {
                  style: {
                    display: "flex",
                    flexDirection: "column", paddingBottom: "104px"
                  }
                },
                [
                  renderBackdropDecor(),

                  h(
                    "div",
                    {
                      style: {
                        position: "relative",
                        zIndex: "1",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px"
                      }
                    },
                    [
                      renderMotionItem(
                        "settings-hero-grid",
                        0,
                        h(
                          "div",
                          {
                            style: {
                              display: "grid",
                              gridTemplateColumns: "minmax(0, 1.35fr) minmax(300px, 0.85fr)",
                              gap: "16px",
                              alignItems: "stretch"
                            }
                          },
                          [
                            renderSettingsHero(
                              this.routeText,
                              this.countsAreBalanced,
                              this.ui.launchFieldPickerDisabled,
                              this.handleClose
                            )
                          ]
                        ),
                        18
                      ),
                      renderMotionItem(
                        "settings-tools",
                        110,
                        h(
                          PV.Card,
                          {
                            style: {
                              borderRadius: "22px",
                              border: surfaceBorder,
                              background: surfaceBackground,
                              boxShadow: surfaceShadow
                            }
                          },
                          {
                            content: () =>
                              h(
                                "div",
                                {
                                  style: {
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "16px",
                                    width: "100%"
                                  }
                                },
                                [
                                  h(
                                    "div",
                                    {
                                      style: {
                                        display: "grid",
                                        gridTemplateColumns: "minmax(0, 1.05fr) minmax(320px, 0.95fr)",
                                        gap: "16px",
                                        alignItems: "stretch",
                                        width: "100%"
                                      }
                                    },
                                    [
                                      h(
                                        "div",
                                        {
                                          style: {
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "10px",
                                            minWidth: "0"
                                          }
                                        },
                                        [
                                          renderSectionHeader(
                                            "Керування конфігурацією",
                                            "Експортуйте конфіг у JSON, імпортуйте налаштування з іншого ПК або запускайте автоматичний вибір полів без ручного копіювання селекторів."
                                          )
                                        ]
                                      ),

                                      h(
                                        "div",
                                        {
                                          style: {
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: "10px",
                                            width: "100%",
                                            alignSelf: "stretch"
                                          }
                                        },
                                        [
                                          h(PV.Button, {
                                            label: "Експорт JSON",
                                            severity: "secondary",
                                            variant: "outlined",
                                            onClick: this.handleExport,
                                            fluid: true,
                                            style: {
                                              width: "100%",
                                              minHeight: "52px",
                                              borderRadius: "14px",
                                              borderColor: "rgba(148,163,184,0.20)",
                                              background: "rgba(255,255,255,0.02)",
                                              color: "#e2e8f0"
                                            }
                                          }),

                                          h(PV.Button, {
                                            label: "Імпорт JSON",
                                            severity: "secondary",
                                            variant: "outlined",
                                            onClick: this.triggerImportFile,
                                            fluid: true,
                                            style: {
                                              width: "100%",
                                              minHeight: "52px",
                                              borderRadius: "14px",
                                              borderColor: "rgba(148,163,184,0.20)",
                                              background: "rgba(255,255,255,0.02)",
                                              color: "#e2e8f0"
                                            }
                                          }),

                                          h("input", {
                                            type: "file",
                                            accept: "application/json,.json",
                                            style: { display: "none" },
                                            ref: (element) => {
                                              this.importFileInputEl = element || null;
                                            },
                                            onChange: this.handleImportFileChange
                                          })
                                        ]
                                      )
                                    ]
                                  ),

                                  h(
                                    "div",
                                    {
                                      style: {
                                        width: "100%"
                                      }
                                    },
                                    [
                                      h(PV.Button, {
                                        label: "Вибрати поля на сторінках",
                                        disabled: this.ui.launchFieldPickerDisabled,
                                        onClick: this.handleLaunchPicker,
                                        fluid: true,
                                        style: {
                                          color: "#e2e8f0",
                                          fontSize: "15px",
                                          width: "100%",
                                          minHeight: "54px",
                                          borderRadius: "14px",
                                          background: primaryGradient,
                                          border: "none",
                                          boxShadow: primaryShadow
                                        }
                                      })
                                    ]
                                  )
                                ]
                              )
                          }
                        ),
                        14
                      ),
                      renderMotionItem(
                        "settings-columns",
                        160,
                        h(
                          "div",
                          {
                            style: {
                              display: "flex",
                              gap: "16px",
                              flexWrap: "wrap",
                              alignItems: "stretch"
                            }
                          },
                          [
                            this.renderColumn(
                              "source",
                              "Сайт-джерело",
                              this.ui.sourceSite,
                              "https://source-site.ua",
                              this.ui.sourceMappings,
                              false
                            ),
                            this.renderColumn(
                              "target",
                              "Сайт-приймач",
                              this.ui.targetSite,
                              "https://target-site.ua",
                              this.ui.targetMappings,
                              true
                            )
                          ]
                        ),
                        16
                      ),

                      this.ui.statusMessage
                        ? renderMotionItem(
                          "settings-status",
                          220,
                          h(
                            PV.Message,
                            {
                              severity: statusSeverity,
                              closable: false,
                              style: {
                                borderRadius: "16px",
                                ...statusBoxStyle
                              }
                            },
                            {
                              default: () => this.ui.statusMessage
                            }
                          ),
                          12
                        )
                        : null,

                      h(
                        Teleport,
                        { to: "body" },
                        [
                          h(
                            "div",
                            {
                              style: {
                                position: "fixed",
                                left: "50%",
                                bottom: "12px",
                                transform: "translateX(-50%)",
                                width: "min(1320px, calc(100vw - 24px))",
                                zIndex: "2147483000",
                                pointerEvents: "none"
                              }
                            },
                            [
                              h(
                                PV.Card,
                                {
                                  style: {
                                    pointerEvents: "auto",
                                    borderRadius: "22px",
                                    border: surfaceBorder,
                                    background: surfaceBackground,
                                    boxShadow: shellShadow,
                                    backdropFilter: "blur(16px)"
                                  }
                                },
                                {
                                  content: () =>
                                    h(
                                      "div",
                                      {
                                        style: {
                                          display: "flex",
                                          gap: "12px",
                                          width: "100%",
                                          alignItems: "stretch"
                                        }
                                      },
                                      [
                                        h(
                                          "div",
                                          {
                                            style: {
                                              flex: "1 1 0",
                                              minWidth: "0"
                                            }
                                          },
                                          [
                                            h(PV.Button, {
                                              label: "Скасувати",
                                              severity: "secondary",
                                              variant: "outlined",
                                              onClick: this.handleClose,
                                              fluid: true,
                                              style: {
                                                width: "100%",
                                                minHeight: "50px",
                                                borderRadius: "14px",
                                                borderColor: "rgba(148,163,184,0.20)",
                                                background: "rgba(255,255,255,0.02)",
                                                color: "#e2e8f0"
                                              }
                                            })
                                          ]
                                        ),

                                        h(
                                          "div",
                                          {
                                            style: {
                                              flex: "1 1 0",
                                              minWidth: "0"
                                            }
                                          },
                                          [
                                            h(PV.Button, {
                                              label: "Зберегти",
                                              onClick: this.handleSave,
                                              fluid: true,
                                              style: {
                                                width: "100%",
                                                minHeight: "50px",
                                                borderRadius: "14px",
                                                color: "#ffffff",
                                                background: primaryGradient,
                                                border: "none",
                                                boxShadow: primaryShadow
                                              }
                                            })
                                          ]
                                        )
                                      ]
                                    )
                                }
                              )
                            ]
                          )
                        ]
                      )
                    ]
                  )
                ]
              )
          }
        )
      ]
    );
  }
})
  .use(PV.Config, {
    theme: {
      preset: PrimeUIX.Themes.Aura,
      options: {
        darkModeSelector: ".app-dark",
        cssLayer: false
      }
    }
  })
  .mount("#settingsAppRoot");