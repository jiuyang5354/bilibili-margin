var B = typeof globalThis < "u" ? globalThis : typeof window < "u" ? window : typeof global < "u" ? global : typeof self < "u" ? self : {};
function U(i) {
  return i && i.__esModule && Object.prototype.hasOwnProperty.call(i, "default") ? i.default : i;
}
var $ = { exports: {} };
(function(i, x) {
  (function(y, w) {
    w(i);
  })(typeof globalThis < "u" ? globalThis : typeof self < "u" ? self : B, function(y) {
    if (!(globalThis.chrome && globalThis.chrome.runtime && globalThis.chrome.runtime.id))
      throw new Error("This script should only be loaded in a browser extension.");
    if (globalThis.browser && globalThis.browser.runtime && globalThis.browser.runtime.id)
      y.exports = globalThis.browser;
    else {
      const w = "The message port closed before a response was received.", u = (o) => {
        const E = {
          alarms: {
            clear: {
              minArgs: 0,
              maxArgs: 1
            },
            clearAll: {
              minArgs: 0,
              maxArgs: 0
            },
            get: {
              minArgs: 0,
              maxArgs: 1
            },
            getAll: {
              minArgs: 0,
              maxArgs: 0
            }
          },
          bookmarks: {
            create: {
              minArgs: 1,
              maxArgs: 1
            },
            get: {
              minArgs: 1,
              maxArgs: 1
            },
            getChildren: {
              minArgs: 1,
              maxArgs: 1
            },
            getRecent: {
              minArgs: 1,
              maxArgs: 1
            },
            getSubTree: {
              minArgs: 1,
              maxArgs: 1
            },
            getTree: {
              minArgs: 0,
              maxArgs: 0
            },
            move: {
              minArgs: 2,
              maxArgs: 2
            },
            remove: {
              minArgs: 1,
              maxArgs: 1
            },
            removeTree: {
              minArgs: 1,
              maxArgs: 1
            },
            search: {
              minArgs: 1,
              maxArgs: 1
            },
            update: {
              minArgs: 2,
              maxArgs: 2
            }
          },
          browserAction: {
            disable: {
              minArgs: 0,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            enable: {
              minArgs: 0,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            getBadgeBackgroundColor: {
              minArgs: 1,
              maxArgs: 1
            },
            getBadgeText: {
              minArgs: 1,
              maxArgs: 1
            },
            getPopup: {
              minArgs: 1,
              maxArgs: 1
            },
            getTitle: {
              minArgs: 1,
              maxArgs: 1
            },
            openPopup: {
              minArgs: 0,
              maxArgs: 0
            },
            setBadgeBackgroundColor: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            setBadgeText: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            setIcon: {
              minArgs: 1,
              maxArgs: 1
            },
            setPopup: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            setTitle: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            }
          },
          browsingData: {
            remove: {
              minArgs: 2,
              maxArgs: 2
            },
            removeCache: {
              minArgs: 1,
              maxArgs: 1
            },
            removeCookies: {
              minArgs: 1,
              maxArgs: 1
            },
            removeDownloads: {
              minArgs: 1,
              maxArgs: 1
            },
            removeFormData: {
              minArgs: 1,
              maxArgs: 1
            },
            removeHistory: {
              minArgs: 1,
              maxArgs: 1
            },
            removeLocalStorage: {
              minArgs: 1,
              maxArgs: 1
            },
            removePasswords: {
              minArgs: 1,
              maxArgs: 1
            },
            removePluginData: {
              minArgs: 1,
              maxArgs: 1
            },
            settings: {
              minArgs: 0,
              maxArgs: 0
            }
          },
          commands: {
            getAll: {
              minArgs: 0,
              maxArgs: 0
            }
          },
          contextMenus: {
            remove: {
              minArgs: 1,
              maxArgs: 1
            },
            removeAll: {
              minArgs: 0,
              maxArgs: 0
            },
            update: {
              minArgs: 2,
              maxArgs: 2
            }
          },
          cookies: {
            get: {
              minArgs: 1,
              maxArgs: 1
            },
            getAll: {
              minArgs: 1,
              maxArgs: 1
            },
            getAllCookieStores: {
              minArgs: 0,
              maxArgs: 0
            },
            remove: {
              minArgs: 1,
              maxArgs: 1
            },
            set: {
              minArgs: 1,
              maxArgs: 1
            }
          },
          devtools: {
            inspectedWindow: {
              eval: {
                minArgs: 1,
                maxArgs: 2,
                singleCallbackArg: !1
              }
            },
            panels: {
              create: {
                minArgs: 3,
                maxArgs: 3,
                singleCallbackArg: !0
              },
              elements: {
                createSidebarPane: {
                  minArgs: 1,
                  maxArgs: 1
                }
              }
            }
          },
          downloads: {
            cancel: {
              minArgs: 1,
              maxArgs: 1
            },
            download: {
              minArgs: 1,
              maxArgs: 1
            },
            erase: {
              minArgs: 1,
              maxArgs: 1
            },
            getFileIcon: {
              minArgs: 1,
              maxArgs: 2
            },
            open: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            pause: {
              minArgs: 1,
              maxArgs: 1
            },
            removeFile: {
              minArgs: 1,
              maxArgs: 1
            },
            resume: {
              minArgs: 1,
              maxArgs: 1
            },
            search: {
              minArgs: 1,
              maxArgs: 1
            },
            show: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            }
          },
          extension: {
            isAllowedFileSchemeAccess: {
              minArgs: 0,
              maxArgs: 0
            },
            isAllowedIncognitoAccess: {
              minArgs: 0,
              maxArgs: 0
            }
          },
          history: {
            addUrl: {
              minArgs: 1,
              maxArgs: 1
            },
            deleteAll: {
              minArgs: 0,
              maxArgs: 0
            },
            deleteRange: {
              minArgs: 1,
              maxArgs: 1
            },
            deleteUrl: {
              minArgs: 1,
              maxArgs: 1
            },
            getVisits: {
              minArgs: 1,
              maxArgs: 1
            },
            search: {
              minArgs: 1,
              maxArgs: 1
            }
          },
          i18n: {
            detectLanguage: {
              minArgs: 1,
              maxArgs: 1
            },
            getAcceptLanguages: {
              minArgs: 0,
              maxArgs: 0
            }
          },
          identity: {
            launchWebAuthFlow: {
              minArgs: 1,
              maxArgs: 1
            }
          },
          idle: {
            queryState: {
              minArgs: 1,
              maxArgs: 1
            }
          },
          management: {
            get: {
              minArgs: 1,
              maxArgs: 1
            },
            getAll: {
              minArgs: 0,
              maxArgs: 0
            },
            getSelf: {
              minArgs: 0,
              maxArgs: 0
            },
            setEnabled: {
              minArgs: 2,
              maxArgs: 2
            },
            uninstallSelf: {
              minArgs: 0,
              maxArgs: 1
            }
          },
          notifications: {
            clear: {
              minArgs: 1,
              maxArgs: 1
            },
            create: {
              minArgs: 1,
              maxArgs: 2
            },
            getAll: {
              minArgs: 0,
              maxArgs: 0
            },
            getPermissionLevel: {
              minArgs: 0,
              maxArgs: 0
            },
            update: {
              minArgs: 2,
              maxArgs: 2
            }
          },
          pageAction: {
            getPopup: {
              minArgs: 1,
              maxArgs: 1
            },
            getTitle: {
              minArgs: 1,
              maxArgs: 1
            },
            hide: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            setIcon: {
              minArgs: 1,
              maxArgs: 1
            },
            setPopup: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            setTitle: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            },
            show: {
              minArgs: 1,
              maxArgs: 1,
              fallbackToNoCallback: !0
            }
          },
          permissions: {
            contains: {
              minArgs: 1,
              maxArgs: 1
            },
            getAll: {
              minArgs: 0,
              maxArgs: 0
            },
            remove: {
              minArgs: 1,
              maxArgs: 1
            },
            request: {
              minArgs: 1,
              maxArgs: 1
            }
          },
          runtime: {
            getBackgroundPage: {
              minArgs: 0,
              maxArgs: 0
            },
            getPlatformInfo: {
              minArgs: 0,
              maxArgs: 0
            },
            openOptionsPage: {
              minArgs: 0,
              maxArgs: 0
            },
            requestUpdateCheck: {
              minArgs: 0,
              maxArgs: 0
            },
            sendMessage: {
              minArgs: 1,
              maxArgs: 3
            },
            sendNativeMessage: {
              minArgs: 2,
              maxArgs: 2
            },
            setUninstallURL: {
              minArgs: 1,
              maxArgs: 1
            }
          },
          sessions: {
            getDevices: {
              minArgs: 0,
              maxArgs: 1
            },
            getRecentlyClosed: {
              minArgs: 0,
              maxArgs: 1
            },
            restore: {
              minArgs: 0,
              maxArgs: 1
            }
          },
          storage: {
            local: {
              clear: {
                minArgs: 0,
                maxArgs: 0
              },
              get: {
                minArgs: 0,
                maxArgs: 1
              },
              getBytesInUse: {
                minArgs: 0,
                maxArgs: 1
              },
              remove: {
                minArgs: 1,
                maxArgs: 1
              },
              set: {
                minArgs: 1,
                maxArgs: 1
              }
            },
            managed: {
              get: {
                minArgs: 0,
                maxArgs: 1
              },
              getBytesInUse: {
                minArgs: 0,
                maxArgs: 1
              }
            },
            sync: {
              clear: {
                minArgs: 0,
                maxArgs: 0
              },
              get: {
                minArgs: 0,
                maxArgs: 1
              },
              getBytesInUse: {
                minArgs: 0,
                maxArgs: 1
              },
              remove: {
                minArgs: 1,
                maxArgs: 1
              },
              set: {
                minArgs: 1,
                maxArgs: 1
              }
            }
          },
          tabs: {
            captureVisibleTab: {
              minArgs: 0,
              maxArgs: 2
            },
            create: {
              minArgs: 1,
              maxArgs: 1
            },
            detectLanguage: {
              minArgs: 0,
              maxArgs: 1
            },
            discard: {
              minArgs: 0,
              maxArgs: 1
            },
            duplicate: {
              minArgs: 1,
              maxArgs: 1
            },
            executeScript: {
              minArgs: 1,
              maxArgs: 2
            },
            get: {
              minArgs: 1,
              maxArgs: 1
            },
            getCurrent: {
              minArgs: 0,
              maxArgs: 0
            },
            getZoom: {
              minArgs: 0,
              maxArgs: 1
            },
            getZoomSettings: {
              minArgs: 0,
              maxArgs: 1
            },
            goBack: {
              minArgs: 0,
              maxArgs: 1
            },
            goForward: {
              minArgs: 0,
              maxArgs: 1
            },
            highlight: {
              minArgs: 1,
              maxArgs: 1
            },
            insertCSS: {
              minArgs: 1,
              maxArgs: 2
            },
            move: {
              minArgs: 2,
              maxArgs: 2
            },
            query: {
              minArgs: 1,
              maxArgs: 1
            },
            reload: {
              minArgs: 0,
              maxArgs: 2
            },
            remove: {
              minArgs: 1,
              maxArgs: 1
            },
            removeCSS: {
              minArgs: 1,
              maxArgs: 2
            },
            sendMessage: {
              minArgs: 2,
              maxArgs: 3
            },
            setZoom: {
              minArgs: 1,
              maxArgs: 2
            },
            setZoomSettings: {
              minArgs: 1,
              maxArgs: 2
            },
            update: {
              minArgs: 1,
              maxArgs: 2
            }
          },
          topSites: {
            get: {
              minArgs: 0,
              maxArgs: 0
            }
          },
          webNavigation: {
            getAllFrames: {
              minArgs: 1,
              maxArgs: 1
            },
            getFrame: {
              minArgs: 1,
              maxArgs: 1
            }
          },
          webRequest: {
            handlerBehaviorChanged: {
              minArgs: 0,
              maxArgs: 0
            }
          },
          windows: {
            create: {
              minArgs: 0,
              maxArgs: 1
            },
            get: {
              minArgs: 1,
              maxArgs: 2
            },
            getAll: {
              minArgs: 0,
              maxArgs: 1
            },
            getCurrent: {
              minArgs: 0,
              maxArgs: 1
            },
            getLastFocused: {
              minArgs: 0,
              maxArgs: 1
            },
            remove: {
              minArgs: 1,
              maxArgs: 1
            },
            update: {
              minArgs: 2,
              maxArgs: 2
            }
          }
        };
        if (Object.keys(E).length === 0)
          throw new Error("api-metadata.json has not been included in browser-polyfill");
        class P extends WeakMap {
          constructor(r, t = void 0) {
            super(t), this.createItem = r;
          }
          get(r) {
            return this.has(r) || this.set(r, this.createItem(r)), super.get(r);
          }
        }
        const F = (e) => e && typeof e == "object" && typeof e.then == "function", D = (e, r) => (...t) => {
          o.runtime.lastError ? e.reject(new Error(o.runtime.lastError.message)) : r.singleCallbackArg || t.length <= 1 && r.singleCallbackArg !== !1 ? e.resolve(t[0]) : e.resolve(t);
        }, k = (e) => e == 1 ? "argument" : "arguments", v = (e, r) => function(n, ...g) {
          if (g.length < r.minArgs)
            throw new Error(`Expected at least ${r.minArgs} ${k(r.minArgs)} for ${e}(), got ${g.length}`);
          if (g.length > r.maxArgs)
            throw new Error(`Expected at most ${r.maxArgs} ${k(r.maxArgs)} for ${e}(), got ${g.length}`);
          return new Promise((A, c) => {
            if (r.fallbackToNoCallback)
              try {
                n[e](...g, D({
                  resolve: A,
                  reject: c
                }, r));
              } catch (s) {
                console.warn(`${e} API method doesn't seem to support the callback parameter, falling back to call it without a callback: `, s), n[e](...g), r.fallbackToNoCallback = !1, r.noCallback = !0, A();
              }
            else r.noCallback ? (n[e](...g), A()) : n[e](...g, D({
              resolve: A,
              reject: c
            }, r));
          });
        }, T = (e, r, t) => new Proxy(r, {
          apply(n, g, A) {
            return t.call(g, e, ...A);
          }
        });
        let _ = Function.call.bind(Object.prototype.hasOwnProperty);
        const f = (e, r = {}, t = {}) => {
          let n = /* @__PURE__ */ Object.create(null), g = {
            has(c, s) {
              return s in e || s in n;
            },
            get(c, s, d) {
              if (s in n)
                return n[s];
              if (!(s in e))
                return;
              let a = e[s];
              if (typeof a == "function")
                if (typeof r[s] == "function")
                  a = T(e, e[s], r[s]);
                else if (_(t, s)) {
                  let S = v(s, t[s]);
                  a = T(e, e[s], S);
                } else
                  a = a.bind(e);
              else if (typeof a == "object" && a !== null && (_(r, s) || _(t, s)))
                a = f(a, r[s], t[s]);
              else if (_(t, "*"))
                a = f(a, r[s], t["*"]);
              else
                return Object.defineProperty(n, s, {
                  configurable: !0,
                  enumerable: !0,
                  get() {
                    return e[s];
                  },
                  set(S) {
                    e[s] = S;
                  }
                }), a;
              return n[s] = a, a;
            },
            set(c, s, d, a) {
              return s in n ? n[s] = d : e[s] = d, !0;
            },
            defineProperty(c, s, d) {
              return Reflect.defineProperty(n, s, d);
            },
            deleteProperty(c, s) {
              return Reflect.deleteProperty(n, s);
            }
          }, A = Object.create(e);
          return new Proxy(A, g);
        }, p = (e) => ({
          addListener(r, t, ...n) {
            r.addListener(e.get(t), ...n);
          },
          hasListener(r, t) {
            return r.hasListener(e.get(t));
          },
          removeListener(r, t) {
            r.removeListener(e.get(t));
          }
        }), R = new P((e) => typeof e != "function" ? e : function(t) {
          const n = f(t, {}, {
            getContent: {
              minArgs: 0,
              maxArgs: 0
            }
          });
          e(n);
        }), b = new P((e) => typeof e != "function" ? e : function(t, n, g) {
          let A = !1, c, s = new Promise((H) => {
            c = function(h) {
              A = !0, H(h);
            };
          }), d;
          try {
            d = e(t, n, c);
          } catch (H) {
            d = Promise.reject(H);
          }
          const a = d !== !0 && F(d);
          if (d !== !0 && !a && !A)
            return !1;
          const S = (H) => {
            H.then((h) => {
              g(h);
            }, (h) => {
              let O;
              h && (h instanceof Error || typeof h.message == "string") ? O = h.message : O = "An unexpected error occurred", g({
                __mozWebExtensionPolyfillReject__: !0,
                message: O
              });
            }).catch((h) => {
              console.error("Failed to send onMessage rejected reply", h);
            });
          };
          return S(a ? d : s), !0;
        }), l = ({
          reject: e,
          resolve: r
        }, t) => {
          o.runtime.lastError ? o.runtime.lastError.message === w ? r() : e(new Error(o.runtime.lastError.message)) : t && t.__mozWebExtensionPolyfillReject__ ? e(new Error(t.message)) : r(t);
        }, C = (e, r, t, ...n) => {
          if (n.length < r.minArgs)
            throw new Error(`Expected at least ${r.minArgs} ${k(r.minArgs)} for ${e}(), got ${n.length}`);
          if (n.length > r.maxArgs)
            throw new Error(`Expected at most ${r.maxArgs} ${k(r.maxArgs)} for ${e}(), got ${n.length}`);
          return new Promise((g, A) => {
            const c = l.bind(null, {
              resolve: g,
              reject: A
            });
            n.push(c), t.sendMessage(...n);
          });
        }, V = {
          devtools: {
            network: {
              onRequestFinished: p(R)
            }
          },
          runtime: {
            onMessage: p(b),
            onMessageExternal: p(b),
            sendMessage: C.bind(null, "sendMessage", {
              minArgs: 1,
              maxArgs: 3
            })
          },
          tabs: {
            sendMessage: C.bind(null, "sendMessage", {
              minArgs: 2,
              maxArgs: 3
            })
          }
        }, M = {
          clear: {
            minArgs: 1,
            maxArgs: 1
          },
          get: {
            minArgs: 1,
            maxArgs: 1
          },
          set: {
            minArgs: 1,
            maxArgs: 1
          }
        };
        return E.privacy = {
          network: {
            "*": M
          },
          services: {
            "*": M
          },
          websites: {
            "*": M
          }
        }, f(o, V, E);
      };
      y.exports = u(chrome);
    }
  });
})($);
var q = $.exports;
const I = /* @__PURE__ */ U(q);
async function N(i) {
  try {
    const text = await i.text();
    try {
      return JSON.parse(text);
    } catch {
      return { code: i.status || -1, message: "Bilibili API 响应非 JSON (可能需登录或触发风控验证)", raw: text };
    }
  } catch (err) {
    return { code: -1, message: err?.message || "网络请求失败" };
  }
}
function W(i) {
  return i;
}
function L(i) {
  return (x) => i(x);
}
const m = {
  J_D: [N, W],
  J_S: [N, L],
  S: [L]
};
function Q(i) {
  return async (x, y, w) => {
    const u = x.contentScriptQuery;
    if (!u || !i[u])
      return console.error(`Cannot find this contentScriptQuery: ${u}`);
    if (i[u] instanceof Function)
      return i[u](x, y, w);
    const o = i[u];
    return z(x, o, w);
  };
}
function z(i, x, y, w) {
  try {
    let { contentScriptQuery: u, ...o } = i;
    o = o || {};
    let { _fetch: E, url: P, params: F = {}, afterHandle: D } = x;
    const { method: k, headers: v = {}, body: T } = E, _ = k.toLocaleLowerCase() === "get", f = Object.assign({}, F);
    let p = Object.assign({}, T);
    if (Object.keys(o).forEach((l) => {
      T && T[l] !== void 0 ? p[l] = o[l] : f[l] = o[l];
    }), Object.keys(f).length) {
      const l = new URLSearchParams();
      for (const C in f)
        f[C] && l.append(C, f[C]);
      P += `?${l.toString()}`;
    }
    _ || (p = v && v["Content-Type"] && v["Content-Type"].includes("application/x-www-form-urlencoded") ? new URLSearchParams(p) : JSON.stringify(p));
    const R = { method: k, headers: v };
    !_ && Object.assign(R, { body: p });
    let b = fetch(P, {
      ...R,
      credentials: "include",
      signal: AbortSignal.timeout(15e3)
    });
    return D.forEach((l) => {
      l.name === L.name && y ? b = b.then(L(y)) : b = b.then(l);
    }), b.catch(console.error), b;
  } catch (u) {
    console.error(u);
  }
}
const G = {
  // https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/history&toview/history.md#%E8%8E%B7%E5%8F%96%E5%8E%86%E5%8F%B2%E8%AE%B0%E5%BD%95%E5%88%97%E8%A1%A8_web%E7%AB%AF
  getHistoryList: {
    url: "https://api.bilibili.com/x/web-interface/history/cursor",
    _fetch: {
      method: "get"
    },
    params: {
      ps: 20,
      type: "",
      view_at: 0
    },
    afterHandle: m.J_D
  },
  searchHistoryList: {
    url: "https://api.bilibili.com/x/web-interface/history/search",
    _fetch: {
      method: "get"
    },
    params: {
      pn: 1,
      keyword: "",
      business: "all"
    },
    afterHandle: m.J_D
  },
  // https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/history&toview/history.md#%E5%88%A0%E9%99%A4%E5%8E%86%E5%8F%B2%E8%AE%B0%E5%BD%95
  deleteHistoryItem: {
    url: "https://api.bilibili.com/x/v2/history/delete",
    _fetch: {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: {
        kid: "",
        csrf: ""
      }
    },
    afterHandle: m.J_D
  },
  // https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/history&toview/history.md#%E6%B8%85%E7%A9%BA%E5%8E%86%E5%8F%B2%E8%AE%B0%E5%BD%95
  clearAllHistory: {
    url: "https://api.bilibili.com/x/v2/history/clear",
    _fetch: {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: {
        csrf: ""
      }
    },
    afterHandle: m.J_D
  },
  // https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/history&toview/history.md#%E6%9F%A5%E8%AF%A2%E5%8E%86%E5%8F%B2%E8%AE%B0%E5%BD%95%E5%81%9C%E7%94%A8%E7%8A%B6%E6%80%81
  getHistoryPauseStatus: {
    url: "https://api.bilibili.com/x/v2/history/shadow",
    _fetch: {
      method: "get"
    },
    params: {},
    afterHandle: m.J_D
  },
  // https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/history&toview/history.md#%E5%81%9C%E7%94%A8%E5%8E%86%E5%8F%B2%E8%AE%B0%E5%BD%95
  setHistoryPauseStatus: {
    url: "https://api.bilibili.com/x/v2/history/shadow/set",
    _fetch: {
      method: "post",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8"
      },
      body: {
        switch: !1,
        csrf: ""
      }
    },
    afterHandle: m.J_D
  }
}, j = {
  getRecommendVideos: {
    url: "https://api.bilibili.com/x/web-interface/index/top/feed/rcmd",
    _fetch: {
      method: "get"
    },
    params: {
      fresh_idx: 0,
      feed_version: "V2",
      fresh_type: 4,
      ps: 30,
      plat: 1
    },
    afterHandle: m.J_D
  },
  getAppRecommendVideos: {
    url: "https://app.bilibili.com/x/v2/feed/index",
    _fetch: {
      method: "get"
    },
    params: {
      build: 74800100,
      device: "pad",
      mobi_app: "iphone",
      c_locate: "CN",
      s_locale: "zh-CN",
      idx: 0,
      appkey: "27eb53fc9058f8c3",
      access_key: ""
    },
    afterHandle: m.J_D
  },
  // https://github.com/indefined/UserScripts/blob/master/bilibiliHome/bilibiliHome.API.md#%E6%8F%90%E4%BA%A4%E4%B8%8D%E5%96%9C%E6%AC%A2
  dislikeVideo: {
    url: "https://app.bilibili.com/x/feed/dislike",
    _fetch: {
      method: "get"
    },
    params: {
      access_key: "",
      goto: "",
      id: 0,
      idx: "",
      reason_id: 1,
      device: "",
      mobi_app: "",
      build: 0,
      appkey: "",
      sign: ""
    },
    afterHandle: m.J_D
  },
  // https://github.com/indefined/UserScripts/blob/master/bilibiliHome/bilibiliHome.API.md#%E6%92%A4%E9%94%80%E4%B8%8D%E5%96%9C%E6%AC%A2
  undoDislikeVideo: {
    url: "https://app.bilibili.com/x/feed/dislike/cancel",
    _fetch: {
      method: "get"
    },
    params: {
      access_key: "",
      goto: "",
      id: 0,
      idx: 0,
      reason_id: 1,
      device: "",
      mobi_app: "",
      build: 0,
      sign: "",
      appkey: ""
    },
    afterHandle: m.J_D
  },
  // https://socialsisteryi.github.io/bilibili-API-collect/docs/video/info.html#%E8%8E%B7%E5%8F%96%E8%A7%86%E9%A2%91%E8%AF%A6%E7%BB%86%E4%BF%A1%E6%81%AF-web%E7%AB%AF
  getVideoInfo: {
    url: "https://api.bilibili.com/x/web-interface/view",
    _fetch: {
      method: "get"
    },
    params: {
      aid: "",
      bvid: ""
    },
    afterHandle: m.J_D
  },
  // https://github.com/SocialSisterYi/bilibili-API-collect/blob/master/docs/comment/list.md#%E8%8E%B7%E5%8F%96%E8%AF%84%E8%AE%BA%E5%8C%BA%E6%98%8E%E7%BB%86_%E7%BF%BB%E9%A1%B5%E5%8A%A0%E8%BD%BD
  getVideoComments: {
    url: "https://api.bilibili.com/x/v2/reply",
    _fetch: {
      method: "get"
    },
    params: {
      csrf: "",
      type: 1,
      oid: 0,
      sort: 0,
      nohot: 0,
      pn: 1,
      ps: 20
    },
    afterHandle: m.J_D
  },
  // https://github.com/SocialSisterYi/bilibili-API-collect/blob/def57d7a70ed1f39080069ba0f40648ce6ce2b90/docs/video_ranking/popular.md#%E8%8E%B7%E5%8F%96%E5%BD%93%E5%89%8D%E7%83%AD%E9%97%A8%E8%A7%86%E9%A2%91%E5%88%97%E8%A1%A8
  getPopularVideos: {
    url: "https://api.bilibili.com/x/web-interface/popular",
    _fetch: {
      method: "get"
    },
    params: {
      pn: 1,
      ps: 20
    },
    afterHandle: m.J_D
  },
  // https://socialsisteryi.github.io/bilibili-API-collect/docs/video/videostream_url.html#%E8%8E%B7%E5%8F%96%E8%A7%86%E9%A2%91%E6%B5%81%E5%9C%B0%E5%9D%80-web%E7%AB%AF
  getVideoPreview: {
    url: "https://api.bilibili.com/x/player/wbi/playurl",
    _fetch: {
      method: "get"
    },
    params: {
      qn: 32,
      fnver: 0,
      fnval: 1,
      bvid: "",
      cid: 0
    },
    afterHandle: m.J_D
  }
}, J = {
  getRecommendVideos: j.getRecommendVideos,
  getPopularVideos: j.getPopularVideos,
  getHistoryList: G.getHistoryList
}, Z = Q(J);
I.runtime.onMessage.addListener((i, x) => {
  if (!(!i?.contentScriptQuery || !(i.contentScriptQuery in J)))
    return Z(i, x);
});
