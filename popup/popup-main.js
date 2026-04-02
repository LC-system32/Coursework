const { createApp, reactive, h, Transition } = Vue;

const PV = globalThis.PrimeVue;
const popupUiStateProxy = reactive({ ...popupUiDefaults });
setPopupUiStateProxy(popupUiStateProxy);

const shellBorder = "1px solid rgba(96, 165, 250, 0.16)";
const surfaceBorder = "1px solid rgba(148, 163, 184, 0.14)";

const titleColor = "#f8fafc";
const textColor = "rgba(226, 232, 240, 0.92)";
const mutedTextColor = "rgba(148, 163, 184, 0.78)";

const shellBackground =
  "radial-gradient(circle at top left, rgba(37,99,235,0.24) 0%, rgba(37,99,235,0) 34%)," +
  "radial-gradient(circle at top right, rgba(56,189,248,0.18) 0%, rgba(56,189,248,0) 28%)," +
  "linear-gradient(180deg, #071120 0%, #09162a 38%, #050d19 100%)";

const surfaceBackground =
  "linear-gradient(180deg, rgba(9,19,36,0.96) 0%, rgba(6,14,28,0.98) 100%)";

const primaryGradient =
  "linear-gradient(135deg, #2563eb 0%, #1d4ed8 48%, #38bdf8 100%)";

const shellShadow = "0 24px 56px rgba(2, 8, 23, 0.52)";
const surfaceShadow = "0 14px 30px rgba(2, 8, 23, 0.34)";
const primaryShadow = "0 14px 34px rgba(37, 99, 235, 0.34)";

function getStatusSeverity(message) {
  const text = String(message || "").toLowerCase();

  if (
    text.includes("важливо") ||
    text.includes("не вдалося") ||
    text.includes("помил") ||
    text.includes("не може")
  ) {
    return "error";
  }

  if (
    text.includes("перевір") ||
    text.includes("очіку") ||
    text.includes("зчитуємо") ||
    text.includes("запущено")
  ) {
    return "warn";
  }

  if (
    text.includes("готов") ||
    text.includes("збереж") ||
    text.includes("заверш") ||
    text.includes("оновлен")
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
  return Number(el?.dataset?.motionDistance || 18);
}

function motionBeforeEnter(el) {
  const distance = getMotionDistance(el);
  el.style.opacity = "0";
  el.style.transform = `translateY(-${distance}px) scale(0.985)`;
  el.style.filter = "blur(8px)";
  el.style.willChange = "transform, opacity, filter";
}

function motionEnter(el, done) {
  const delay = getMotionDelay(el);
  const duration = 480;

  window.setTimeout(() => {
    el.style.transition =
      "transform 480ms cubic-bezier(0.22, 1, 0.36, 1), " +
      "opacity 420ms ease, " +
      "filter 420ms ease";

    requestAnimationFrame(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0) scale(1)";
      el.style.filter = "blur(0)";
    });
  }, delay);

  window.setTimeout(() => {
    el.style.willChange = "";
    done();
  }, delay + duration + 40);
}

function motionLeave(el, done) {
  el.style.willChange = "transform, opacity, filter";
  el.style.transition =
    "transform 220ms ease, opacity 180ms ease, filter 180ms ease";
  el.style.opacity = "0";
  el.style.transform = "translateY(-10px) scale(0.985)";
  el.style.filter = "blur(6px)";

  window.setTimeout(() => {
    el.style.willChange = "";
    done();
  }, 240);
}

function renderMotionItem(key, delay, child, distance = 18) {
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
        width: "min(92vw, 560px)",
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

function renderRouteHeroCard(sourceValue, targetValue, routeLabel, shortcutHintText, onSettingsClick) {
  return h(
    PV.Card,
    {
      style: {
        borderRadius: "22px",
        border: "1px solid rgba(56, 189, 248, 0.22)",
        background:
          "linear-gradient(135deg, rgba(10,22,44,0.98) 0%, rgba(8,18,36,0.98) 52%, rgba(5,14,28,1) 100%)",
        boxShadow:
          "0 18px 38px rgba(2, 8, 23, 0.42), inset 0 1px 0 rgba(255,255,255,0.04)",
        overflow: "hidden",
        position: "relative"
      }
    },
    {
      content: () =>
        h(
          "div",
          {
            style: {
              position: "relative",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }
          },
          [
            h("div", {
              style: {
                position: "absolute",
                top: "-42px",
                right: "-48px",
                width: "180px",
                height: "180px",
                borderRadius: "999px",
                background:
                  "radial-gradient(circle, rgba(37,99,235,0.34), rgba(37,99,235,0))",
                filter: "blur(18px)",
                pointerEvents: "none"
              }
            }),

            h("div", {
              style: {
                position: "absolute",
                bottom: "-54px",
                left: "-38px",
                width: "170px",
                height: "170px",
                borderRadius: "999px",
                background:
                  "radial-gradient(circle, rgba(56,189,248,0.20), rgba(56,189,248,0))",
                filter: "blur(18px)",
                pointerEvents: "none"
              }
            }),

            h(
              "div",
              {
                style: {
                  position: "relative",
                  zIndex: "1",
                  display: "flex",
                  flexDirection: "column",
                  gap: "12px"
                }
              },
              [
                renderMotionItem(
                  "hero-head",
                  0,
                  h(
                    "div",
                    {
                      style: {
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px"
                      }
                    },
                    [
                      h(
                        "h1",
                        {
                          style: {
                            margin: "0",
                            fontSize: "30px",
                            lineHeight: "1.02",
                            fontWeight: "800",
                            letterSpacing: "-0.04em",
                            color: "#f8fafc"
                          }
                        },
                        "Імпорт даних"
                      ),

                      h(
                        PV.Button,
                        {
                          rounded: true,
                          text: true,
                          onClick: onSettingsClick,
                          "aria-label": "Налаштування",
                          style: {
                            width: "42px",
                            height: "42px",
                            minWidth: "42px",
                            padding: "0",
                            borderRadius: "999px",
                            border: "1px solid rgba(96, 165, 250, 0.20)",
                            background: "rgba(255,255,255,0.04)",
                            color: "#e0f2fe",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)"
                          }
                        },
                        {
                          default: () =>
                            h(
                              "svg",
                              {
                                viewBox: "0 0 24 24",
                                width: "18",
                                height: "18",
                                fill: "none",
                                xmlns: "http://www.w3.org/2000/svg"
                              },
                              [
                                h("path", {
                                  d: "M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35A1.724 1.724 0 0 0 5.382 7.752c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 0 0 2.572-1.065Z",
                                  stroke: "currentColor",
                                  "stroke-width": "1.8",
                                  "stroke-linecap": "round",
                                  "stroke-linejoin": "round"
                                }),
                                h("path", {
                                  d: "M12 15.25A3.25 3.25 0 1 0 12 8.75a3.25 3.25 0 0 0 0 6.5Z",
                                  stroke: "currentColor",
                                  "stroke-width": "1.8",
                                  "stroke-linecap": "round",
                                  "stroke-linejoin": "round"
                                })
                              ]
                            )
                        }
                      )
                    ]
                  ),
                  20
                ),
                renderMotionItem(
                  "hero-route-title",
                  130,
                  h(
                    "div",
                    {
                      style: {
                        marginTop: "4px",
                        fontSize: "11px",
                        letterSpacing: ".16em",
                        textTransform: "uppercase",
                        color: "#7dd3fc",
                        fontWeight: "700"
                      }
                    },
                    "Маршрут перенесення"
                  ),
                  14
                ),

                renderMotionItem(
                  "hero-line",
                  230,
                  h("div", {
                    style: {
                      width: "92px",
                      height: "3px",
                      borderRadius: "999px",
                      background:
                        "linear-gradient(135deg, #2563eb 0%, #1d4ed8 48%, #38bdf8 100%)",
                      boxShadow: "0 0 18px rgba(56, 189, 248, 0.42)"
                    }
                  }),
                  12
                )
              ]
            ),

            renderMotionItem(
              "hero-targets",
              300,
              h(
                "div",
                {
                  style: {
                    position: "relative",
                    zIndex: "1",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "12px",
                    alignItems: "stretch"
                  }
                },
                [
                  h(
                    "div",
                    {
                      style: {
                        borderRadius: "16px",
                        border: "1px solid rgba(148, 163, 184, 0.14)",
                        background:
                          "linear-gradient(180deg, rgba(9,19,36,0.88) 0%, rgba(6,14,28,0.94) 100%)",
                        padding: "14px",
                        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)"
                      }
                    },
                    [
                      h(
                        "div",
                        {
                          style: {
                            fontSize: "10px",
                            letterSpacing: ".16em",
                            textTransform: "uppercase",
                            color: "rgba(148,163,184,0.78)",
                            fontWeight: "700",
                            marginBottom: "8px"
                          }
                        },
                        "Джерело"
                      ),
                      h(
                        "div",
                        {
                          style: {
                            fontSize: "14px",
                            lineHeight: "1.5",
                            fontWeight: "700",
                            color: "#e2e8f0",
                            wordBreak: "break-word"
                          }
                        },
                        sourceValue
                      )
                    ]
                  ),

                  h(
                    "div",
                    {
                      style: {
                        borderRadius: "16px",
                        border: "1px solid rgba(56, 189, 248, 0.16)",
                        background:
                          "linear-gradient(180deg, rgba(8,24,44,0.90) 0%, rgba(6,16,32,0.96) 100%)",
                        padding: "14px",
                        boxShadow:
                          "inset 0 1px 0 rgba(255,255,255,0.03), 0 0 0 1px rgba(37,99,235,0.06)"
                      }
                    },
                    [
                      h(
                        "div",
                        {
                          style: {
                            fontSize: "10px",
                            letterSpacing: ".16em",
                            textTransform: "uppercase",
                            color: "#7dd3fc",
                            fontWeight: "700",
                            marginBottom: "8px"
                          }
                        },
                        "Приймач"
                      ),
                      h(
                        "div",
                        {
                          style: {
                            fontSize: "14px",
                            lineHeight: "1.5",
                            fontWeight: "700",
                            color: "#f8fafc",
                            wordBreak: "break-word"
                          }
                        },
                        targetValue
                      )
                    ]
                  )
                ]
              ),
              20
            ),
            renderMotionItem(
              "hero-shortcut",
              350,
              h(PV.Tag, {
                value: shortcutHintText,
                rounded: true,
                style: {
                  alignSelf: "flex-start",
                  color: "#e0f2fe",
                  background: "rgba(2, 6, 23, 0.72)",
                  border: "1px solid rgba(96, 165, 250, 0.18)",
                  fontWeight: "600"
                }
              }),
              16
            ),
          ]
        )
    }
  );
}

createApp({
  data() {
    return {
      ui: popupUiStateProxy,
      toasts: [],
      toastSeq: 0,
      toastListener: null
    };
  },

  computed: {
    routeLabel() {
      return `${this.ui.sourceSitePreview} → ${this.ui.targetSitePreview}`;
    }
  },

  methods: {
    openSettings() {
      handleOpenSettingsClick();
    },

    startImport() {
      handleImportButtonClick();
    },

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
    }
  },

  mounted() {
    document.documentElement.classList.add("app-dark");
    registerPopupRuntimeMessages();

    initPopup().catch((error) => {
      console.error("POPUP_INIT_ERROR", error);
      setStatus("Не вдалося завантажити налаштування.");
    });

    this.toastListener = (event) => this.addToast(event.detail || {});
    window.addEventListener(POPUP_TOAST_EVENT, this.toastListener);
  },

  beforeUnmount() {
    if (this.toastListener) {
      window.removeEventListener(POPUP_TOAST_EVENT, this.toastListener);
    }
  },

  render() {
    const statusSeverity = getStatusSeverity(this.ui.statusMessage);
    const statusBoxStyle = getStatusBoxStyle(statusSeverity);

    return h("div", { style: { position: "relative" } }, [
      renderToastStack(this.toasts, this.closeToast),

      h(
        PV.Card,
        {
          style: {
            position: "relative",
            overflow: "hidden",
            borderRadius: "0px",
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
                  position: "relative",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                  padding: "10px 4px 4px"
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
                      gap: "14px"
                    }
                  },
                  [
                    renderMotionItem(
                      "route-hero",
                      0,
                      renderRouteHeroCard(
                        this.ui.sourceSitePreview,
                        this.ui.targetSitePreview,
                        this.routeLabel,
                        this.ui.shortcutHintText,
                        this.openSettings
                      ),
                      24
                    ),

                    this.ui.statusMessage
                      ? renderMotionItem(
                        "status-message",
                        380,
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
                        18
                      )
                      : null,

                    renderMotionItem(
                      "import-card",
                      460,
                      h(
                        PV.Card,
                        {
                          style: {
                            borderRadius: "18px",
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
                                  gap: "10px"
                                }
                              },
                              [
                                h(PV.Button, {
                                  label: "Імпортувати дані",
                                  fluid: true,
                                  disabled: this.ui.importDisabled,
                                  onClick: this.startImport,
                                  style: {
                                    minHeight: "54px",
                                    borderRadius: "14px",
                                    fontWeight: "700",
                                    color: "#ffffff",
                                    background: primaryGradient,
                                    border: "none",
                                    boxShadow: primaryShadow
                                  }
                                })
                              ]
                            )
                        }
                      ),
                      20
                    )
                  ]
                )
              ]
            )
        }
      )
    ]);
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
  .mount("#popupAppRoot");