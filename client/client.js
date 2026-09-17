window.__ModuleLoader__.load({
  id: "dsh-pocket-nas",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    // The DSH client module system provides react as a module, never as a
    // global. esbuild keeps react external (see the build config above) and
    // its classic JSX transform emits bare React.createElement calls for the
    // mobile components (which import only named hooks, not React itself), so
    // the bundle must bind React itself - otherwise every mobile component
    // crashes at render time with "ReferenceError: React is not defined".
    var React = require("react");
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject,
  name: () => name,
  redactStatus: () => redactStatus
});
module.exports = __toCommonJS(index_exports);
var import_react2 = require("react");
var import_dsh_client_ui_primitives4 = require("@deepseek-ai/dsh-client-ui-primitives");

// client/api.js
var POCKET_RPC_CHANNEL = "/dsh-pocket";
var POCKET_ENDPOINTS = Object.freeze({
  status: "pocket.status",
  tunnelStart: "tunnel.start",
  tunnelStop: "tunnel.stop",
  version: "pocket.version",
  update: "pocket.update",
  restart: "pocket.restart",
  lanTokenRefresh: "token.lanRefresh",
  lanAuthSetEnabled: "lanAuth.setEnabled",
  lanSetOverride: "lan.setOverride",
  pinSetCustom: "pin.setCustom",
  frpConfigGet: "frp.configGet",
  frpConfigSet: "frp.configSet",
  frpStart: "frp.start",
  frpStop: "frp.stop",
  // ---------- 以下端点与上游同名（接口冻结：并行开发时 host/client 两侧按此对齐） ----------
  /** 局域网访问总开关（上游 PR #61）。payload { on: boolean } → ok({ lanEnabled }) */
  lanSetEnabled: "lan.setEnabled",
  /** 恢复出厂设置（上游 #69 后续）。payload { confirm: true } → ok(status) */
  pocketReset: "pocket.reset",
  /** 移动端「复制文件内容」（上游 issue #17 内容复制）。payload { path, cwd? } → ok({ content, path, size }) */
  fileRead: "pocket.fileRead"
});
function compareVersions(a, b) {
  const pa = String(a).replace(/^[vV]/, "").split(".");
  const pb = String(b).replace(/^[vV]/, "").split(".");
  for (let i = 0; i < 3; i++) {
    const x = parseInt(pa[i], 10) || 0;
    const y = parseInt(pb[i], 10) || 0;
    if (x !== y) return x - y;
  }
  const aPre = String(a).replace(/^[vV]/, "").match(/-.*$/)?.[0] ?? "";
  const bPre = String(b).replace(/^[vV]/, "").match(/-.*$/)?.[0] ?? "";
  if (!aPre && !bPre) return 0;
  if (!aPre) return 1;
  if (!bPre) return -1;
  const aParts = aPre.slice(1).split(".");
  const bParts = bPre.slice(1).split(".");
  const len = Math.max(aParts.length, bParts.length);
  for (let i = 0; i < len; i++) {
    const ax = aParts[i] ?? "";
    const bx = bParts[i] ?? "";
    if (ax === bx) continue;
    const aNum = /^\d+$/.test(ax);
    const bNum = /^\d+$/.test(bx);
    if (aNum && bNum) return Number(ax) - Number(bx);
    if (aNum) return 1;
    if (bNum) return -1;
    return ax < bx ? -1 : 1;
  }
  return 0;
}
function redactStatus(s) {
  return {
    proxyRunning: s?.proxyRunning === true,
    proxyPort: s?.proxyPort ?? null,
    lanUrl: s?.lanUrl ?? null,
    lanQr: s?.lanQr ?? null,
    lanCandidates: Array.isArray(s?.lanCandidates) ? s.lanCandidates : [],
    lanIpOverride: s?.lanIpOverride ?? "",
    tunnelRunning: s?.tunnelRunning === true,
    tunnelUrl: s?.tunnelUrl ?? null,
    tunnelQr: s?.tunnelQr ?? null,
    tunnelState: s?.tunnelState ?? { phase: "idle" },
    // NAS 反向隧道（frp）：token 永不进入浏览器
    frpRunning: s?.frpRunning === true,
    frpState: s?.frpState ?? { phase: "idle" },
    frpConfig: s?.frpConfig ?? null,
    frpHasToken: s?.frpHasToken === true,
    dshPort: s?.dshPort ?? null
  };
}

// client/mobile/MobileNavToggle.tsx
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
function MobileNavToggle({ toggleSidebar, t }) {
  const toggleExplorer = () => {
    const frame = document.querySelector('[data-mobile-nav="frame"]');
    if (frame === null) return;
    if (frame.hasAttribute("data-aionui-explorer-open")) {
      frame.removeAttribute("data-aionui-explorer-open");
    } else {
      frame.setAttribute("data-aionui-explorer-open", "");
    }
  };
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-mobile-nav": "toggle",
      "aria-label": t("open"),
      title: t("open"),
      onClick: () => toggleSidebar()
    },
    /* @__PURE__ */ React.createElement(import_dsh_client_ui_primitives.IconPanelLeftOutline16, { size: 16 })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-mobile-nav": "files",
      "aria-label": t("files"),
      title: t("files"),
      onClick: toggleExplorer
    },
    /* @__PURE__ */ React.createElement(import_dsh_client_ui_primitives.IconFolderOpenOutline16, { size: 16 })
  ));
}

// client/mobile/MobileNavOverlay.tsx
var import_react = require("react");
var import_dsh_client_ui_primitives2 = require("@deepseek-ai/dsh-client-ui-primitives");

// client/mobile/nav-targets.mjs
var DRAWER_SELECTOR = '[data-mobile-nav="frame"] > :first-child';
var TOGGLE_SELECTOR = '[data-mobile-nav="toggle"]';
var NAV_TARGETS = [
  "button[data-dsh-taskboard-entry]",
  "button[data-dsh-ssh-entry]",
  // 抽屉底部的 "文件" 入口打开的是 dsh-web-ui 的 explorer 面板，它的 z-index
  // (55) 低于展开的抽屉 (600)，且在抽屉 DOM 之外：抽屉不关就会盖住面板，点
  // 面板里的行又会被"点抽屉外就关"吃掉。所以按导航处理，一起关掉。
  '[data-mobile-nav="files"]',
  '[class*="sessionRow"]',
  '[class*="newSession"]',
  '[class*="searchResultWorkspace"]',
  '[class*="searchResultRow"]'
].join(", ");
var NAV_EXCLUDE = '[class*="sessionRow"] button';
var OVERLAY_SELECTOR = [
  '[role="menu"]',
  '[role="listbox"]',
  '[role="dialog"]',
  '[role="tooltip"]',
  "[data-radix-popper-content-wrapper]"
].join(", ");
function navTargetFor(target) {
  if (target == null || typeof target.closest !== "function") return null;
  if (target.closest(NAV_EXCLUDE) !== null) return null;
  return target.closest(NAV_TARGETS);
}
function isOverlayTap(target) {
  if (target == null || typeof target.closest !== "function") return false;
  return target.closest(OVERLAY_SELECTOR) !== null;
}

// client/mobile/MobileNavOverlay.tsx
var MOBILE_QUERY = "(max-width: 1023px)";
function useMobile() {
  const [mobile, setMobile] = (0, import_react.useState)(() => window.matchMedia(MOBILE_QUERY).matches);
  (0, import_react.useEffect)(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const onChange = (event) => setMobile(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return mobile;
}
function findFrame() {
  return document.querySelector("[data-shell-overlay]")?.parentElement ?? null;
}
function MobileNavOverlay({ toggleSidebar, t }) {
  const mobile = useMobile();
  const [open, setOpen] = (0, import_react.useState)(false);
  const [fabVisible, setFabVisible] = (0, import_react.useState)(false);
  (0, import_react.useLayoutEffect)(() => {
    if (!mobile) {
      setOpen(false);
      return;
    }
    const frame = findFrame();
    if (frame === null) return;
    frame.setAttribute("data-mobile-nav", "frame");
    const sync = () => setOpen(!frame.hasAttribute("data-sidebar-collapsed"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(frame, { attributes: true, attributeFilter: ["data-sidebar-collapsed"] });
    return () => {
      observer.disconnect();
      frame.removeAttribute("data-mobile-nav");
    };
  }, [mobile]);
  (0, import_react.useEffect)(() => {
    if (!mobile) {
      setFabVisible(false);
      return;
    }
    const sync = () => setFabVisible(document.querySelector('[data-phase="active"]') === null);
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["data-phase"]
    });
    return () => observer.disconnect();
  }, [mobile]);
  (0, import_react.useEffect)(() => {
    if (!mobile || !open) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape" && document.querySelector('[aria-modal="true"]') === null) toggleSidebar();
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [mobile, open, toggleSidebar]);
  (0, import_react.useEffect)(() => {
    if (!mobile || !open) return;
    const onDrawerClick = (event) => {
      if (document.querySelector('[aria-modal="true"]') !== null) return;
      const target = event.target;
      if (target === null) return;
      const drawer = document.querySelector(DRAWER_SELECTOR);
      if (drawer === null || !drawer.contains(target)) return;
      if (navTargetFor(target) !== null) toggleSidebar();
    };
    document.addEventListener("click", onDrawerClick, true);
    return () => document.removeEventListener("click", onDrawerClick, true);
  }, [mobile, open, toggleSidebar]);
  (0, import_react.useEffect)(() => {
    if (!mobile || !open) return;
    let timer = null;
    const onDrawerPointerUp = (event) => {
      if (event.pointerType !== "touch" && event.pointerType !== "pen") return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const drawer = document.querySelector(DRAWER_SELECTOR);
      if (drawer === null || !drawer.contains(target)) return;
      if (navTargetFor(target) === null) return;
      if (timer !== null) return;
      timer = window.setTimeout(() => {
        timer = null;
        const frame = document.querySelector('[data-mobile-nav="frame"]');
        if (frame === null || frame.hasAttribute("data-sidebar-collapsed")) return;
        const row = navTargetFor(target);
        row?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
      }, 0);
    };
    document.addEventListener("pointerup", onDrawerPointerUp, true);
    return () => {
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("pointerup", onDrawerPointerUp, true);
    };
  }, [mobile, open]);
  (0, import_react.useEffect)(() => {
    if (!mobile || !open) return;
    const onOutsideClick = (event) => {
      if (document.querySelector('[aria-modal="true"]') !== null) return;
      const target = event.target;
      if (target === null) return;
      if (target.closest(TOGGLE_SELECTOR) !== null) return;
      if (isOverlayTap(target)) return;
      const drawer = document.querySelector(DRAWER_SELECTOR);
      if (drawer !== null && drawer.contains(target)) return;
      toggleSidebar();
    };
    document.addEventListener("click", onOutsideClick, true);
    return () => document.removeEventListener("click", onOutsideClick, true);
  }, [mobile, open, toggleSidebar]);
  if (!mobile) return null;
  return /* @__PURE__ */ React.createElement(React.Fragment, null, open && /* @__PURE__ */ React.createElement("div", { "data-mobile-nav": "backdrop" }), fabVisible && !open && /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-mobile-nav": "fab",
      "aria-label": t("open"),
      title: t("open"),
      onClick: () => toggleSidebar()
    },
    /* @__PURE__ */ React.createElement(import_dsh_client_ui_primitives2.IconPanelLeftOutline16, { size: 18 })
  ));
}

// client/mobile/MobileDrawerFooter.tsx
var import_dsh_client_ui_primitives3 = require("@deepseek-ai/dsh-client-ui-primitives");
function MobileDrawerFooter({ useSessions, downloadSessionLog, toggleSidebar, t }) {
  const sessionId = useSessions((state) => state.current);
  const openExplorer = () => {
    document.querySelector('[data-mobile-nav="frame"]')?.setAttribute("data-aionui-explorer-open", "");
    toggleSidebar();
  };
  return /* @__PURE__ */ React.createElement("div", { "data-mobile-nav": "drawer-actions" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-mobile-nav": "explorer",
      "aria-label": t("files"),
      title: t("files"),
      onClick: openExplorer
    },
    /* @__PURE__ */ React.createElement(import_dsh_client_ui_primitives3.IconPanelLeftOutline16, { size: 14 }),
    /* @__PURE__ */ React.createElement("span", null, t("files"))
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      type: "button",
      "data-mobile-nav": "session-log",
      "aria-label": t("sessionLog"),
      title: t("sessionLog"),
      disabled: sessionId === void 0,
      onClick: () => {
        if (sessionId !== void 0) downloadSessionLog(sessionId);
      }
    },
    /* @__PURE__ */ React.createElement(import_dsh_client_ui_primitives3.IconDownloadOutline16, { size: 14 }),
    /* @__PURE__ */ React.createElement("span", null, t("sessionLog"))
  ));
}

// client/mobile/mobile.css.ts
var MOBILE_CSS = `
/* ---------- base control styles (rendered at any width, hidden where unused) ---------- */

[data-mobile-nav="toggle"],
[data-mobile-nav="files"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex: none;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-secondary, inherit);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
[data-mobile-nav="toggle"]:hover,
[data-mobile-nav="files"]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
}
[data-mobile-nav="toggle"]:focus-visible,
[data-mobile-nav="files"]:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f6ef7);
  outline-offset: 1px;
}
/* Expand the touch target to ~44px without changing the visual size:
   a transparent ::before grows the hit area (layout principle: touch
   targets \u226544px even when the visible control is smaller). */
[data-mobile-nav="toggle"],
[data-mobile-nav="files"] {
  position: relative;
}
[data-mobile-nav="toggle"]::before,
[data-mobile-nav="files"]::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
}

/* Drawer footer actions: the relocated Session log download plus the Files
   action that opens the dsh-web-ui explorer sheet. */
[data-mobile-nav="drawer-actions"] {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
/* \u5BBF\u4E3B\u6CA1\u6709 aionui explorer \u5217\uFF08\u5B98\u65B9 DSH \u65E0 dsh-web-ui\uFF0Cissue #48\uFF09\u65F6\u9690\u85CF
   \u79FB\u52A8\u7AEF\u300C\u6587\u4EF6\u6D4F\u89C8\u300D\u5165\u53E3\uFF08header \u56FE\u6807 + drawer footer \u9879\uFF09\u2014\u2014\u4E0D\u7136\u70B9\u4E86\u6CA1\u53CD\u5E94\u3002 */
[data-mobile-nav-explorer="0"] [data-mobile-nav="files"],
[data-mobile-nav-explorer="0"] [data-mobile-nav="explorer"] {
  display: none !important;
}
[data-mobile-nav="session-log"],
[data-mobile-nav="explorer"] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 14px;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  border-radius: 12px;
  background: transparent;
  color: var(--dsw-alias-label-primary, inherit);
  font-family: inherit;
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}
[data-mobile-nav="session-log"]:hover:not(:disabled),
[data-mobile-nav="explorer"]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06));
}
[data-mobile-nav="session-log"]:disabled {
  color: var(--dsw-alias-label-dimmed, rgba(0, 0, 0, .35));
  cursor: default;
}

/* Floating fallback button (hero / blank phases without a session header).
   Bottom-right: the thumb zone on portrait phones; the 96px bottom offset
   keeps it above the composer card (plus the home-indicator safe area). */
[data-mobile-nav="fab"] {
  position: absolute;
  top: auto;
  right: 12px;
  bottom: calc(env(safe-area-inset-bottom, 0px) + 96px);
  left: auto;
  z-index: 21;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12));
  border-radius: 50%;
  background: var(--dsw-alias-button-floating-fill, #ffffff);
  color: var(--dsw-alias-label-primary, inherit);
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, .18);
  -webkit-tap-highlight-color: transparent;
}
/* Grow the touch target to ~54px without changing the visual size (same
   transparent ::before trick as the header toggles): the thumb can miss a
   bare 38px circle. */
[data-mobile-nav="fab"]::before {
  content: '';
  position: absolute;
  inset: -8px;
  border-radius: 50%;
}
[data-mobile-nav="fab"]:hover {
  background: var(--dsw-alias-button-floating-hover, rgba(0, 0, 0, .08));
}
[data-mobile-nav="fab"]:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f6ef7);
  outline-offset: 2px;
}

/* Dimmed backdrop under the open drawer; above every column, below the drawer.
   pointer-events: none \u2014\u2014 \u70B9\u51FB\u7A7F\u900F\uFF08issue #38\uFF09\uFF1Abackdrop \u53EA\u8D1F\u8D23\u89C6\u89C9\u538B\u6697\uFF0C
   \u4E0D\u62A2\u70B9\u51FB\u3002\u5173\u95ED\u62BD\u5C49\u6539\u7531 MobileNavOverlay \u7684 document \u7EA7\u300C\u62BD\u5C49\u5916\u70B9\u51FB\u300D\u76D1\u542C\u5904\u7406
   \uFF08\u7B49\u4EF7\u4E8E\u539F\u6765\u7684\u70B9\u51FB\u906E\u7F69\u5173\u95ED\uFF0C\u4E14\u62BD\u5C49\u5185\u70B9\u51FB\u4E0D\u518D\u88AB backdrop \u5403\u6389\uFF09\u3002 */
[data-mobile-nav="backdrop"] {
  position: absolute;
  inset: 0;
  z-index: 30;
  background: rgba(0, 0, 0, .45);
  pointer-events: none;
  animation: dsh-mobile-nav-fade .2s var(--ds-ease-in-out, ease-in-out);
  -webkit-tap-highlight-color: transparent;
}
@keyframes dsh-mobile-nav-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
/* Settings sheet entrance: the official dialog mounts with no animation at
   all, so it snaps in. Fade + slight rise/scale reads as a proper sheet. */
@keyframes dsh-mobile-nav-sheet-in {
  from {
    opacity: 0;
    transform: translateY(14px) scale(.98);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
/* Preview sheet rise: the aionui preview column opens as a bottom sheet. */
@keyframes dsh-mobile-nav-sheet-up {
  from {
    opacity: 0;
    transform: translateY(28px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

/* ---------- mobile-only layout ---------- */

@media (max-width: 1023px) {
  /* --- Phone chrome ---
     The system status bar stays visible (no fullscreen). Two adjustments
     make it behave:
     - touch-action: manipulation kills double-tap-to-zoom (and the 300ms
       tap delay) while keeping pan and pinch zoom; the client also
       suppresses legacy-iOS gesturestart as a fallback.
     - With the client's viewport-fit=cover, env(safe-area-inset-top) is the
       status bar / notch height; the rules below push the app content below
       it so the status bar never covers anything. Off notched phones (or in
       a normal browser tab where the layout viewport already sits below the
       status bar) the inset is 0 and nothing shifts. */
  html,
  body {
    touch-action: manipulation !important;
  }

  /* AppFrame: the drawer takes the sidebar column out of grid flow, so the
     remaining in-flow items (center, details) land in tracks 1..2: give the
     center every pixel and keep the details track at zero. The top padding
     clears the status bar / notch for every in-flow surface (session header,
     messages, composer); the absolutely-positioned drawer is unaffected (its
     containing block is the frame's padding box, i.e. still the frame top). */
  [data-mobile-nav="frame"] {
    position: relative !important;
    grid-template-columns: minmax(0, 1fr) 0 0 !important;
    padding-top: env(safe-area-inset-top, 0px) !important;
  }

  /* \u4E3B\u5185\u5BB9\u5217\uFF08\u7B2C 2 \u4E2A\u7F51\u683C\u5B50\u5143\u7D20\uFF09\u5728\u5B98\u65B9\u6837\u5F0F\u91CC\u6709\u663E\u5F0F grid-column: 2\u2014\u2014
     \u7F51\u683C\u88AB\u538B\u7F29\u6210 [1fr, 0, 0] \u540E\u5B83\u4F1A\u843D\u5728 0px \u7684\u7B2C 2 \u8F68\uFF0C\u6574\u4E2A\u4E3B\u754C\u9762\u88AB\u6324\u51FA
     \u89C6\u53E3\uFF08\u53EA\u5269\u80CC\u666F\u56FE\uFF09\u3002\u5FC5\u987B\u663E\u5F0F\u628A\u5B83\u62C9\u56DE\u7B2C 1 \u8F68\uFF08issue #5\uFF09\u3002
     \u7B2C 3 \u5217\uFF08details\uFF09\u4FDD\u6301 0 \u8F68\u5373\u53EF\uFF0C\u65E0\u9700\u5904\u7406\u3002 */
  [data-mobile-nav="frame"] > :nth-child(2) {
    grid-column: 1 !important;
    grid-row: 1 !important;
    min-width: 0 !important;
  }

  /* The sidebar column (first grid child) becomes a left drawer. The drawer
     hugs the sidebar content exactly (the wide sidebar carries an inline
     width, ~280px): a fixed 92vw box would leave a white strip where the
     container background shows beside the content.
     Closed state: translateX(-110%) \u2014 more than -100% of the max-content
     width \u2014 guarantees the whole drawer (and its shadow, had it one) leaves
     the viewport. A mere -100% leaves a sliver on screen; -105% (as used
     before) left 14px of the drawer plus a long 32px-blur shadow gradient
     visible along the left edge of the main UI. No box-shadow at all: the
     dimmed backdrop already separates drawer from content.
     Z-index note: the backdrop renders inside the shell's overlay layer
     ([data-shell-overlay]), which forms its own stacking context. Third-party
     plugins can force that layer up with !important (dsh-update-checker sets
     it to 500), and when the layer outranks the drawer, the backdrop paints
     ABOVE the drawer and swallows every tap \u2014 the drawer opens but no row
     can be pressed (every tap just closes it). The drawer must therefore
     outrank any such raise.
     1200 (was 600) clears the mobile layers shipped by
     @linxin666/dsh-web-ui-all \u2014 its sidebar pane is z-index 1100, its
     details pane 1000 and its full-screen frame ::after mask 1050 (issue
     #67: that mask sat on top of the 600 drawer and ate every tap). Still
     far under the fixed-position banners/toasts (z 9999) that float at the
     viewport level. */
  [data-mobile-nav="frame"] > :first-child {
    position: absolute !important;
    inset: 0 auto 0 0 !important;
    width: max-content !important;
    max-width: 92vw !important;
    z-index: 1200 !important;
    transform: translateX(-110%);
    transition: transform .28s var(--ds-ease-in-out, ease-in-out);
    background: var(--dsw-alias-bg-base, #ffffff);
    /* Keep the drawer's own content below the status bar / notch: the drawer
       spans the full frame height (its absolute containing block is the
       frame's padding box, so the frame's own safe-area padding does NOT
       reach it). The drawer background paints the status-bar strip, which
       the client's theme-color meta matches, so the strip reads seamless. */
    padding-top: env(safe-area-inset-top, 0px) !important;
    /* Kill the official sidebarCol right border: with the backdrop the edge
       reads cleanly, and the settings dialog (width:100% of this box) stays
       pixel-flush with the drawer. */
    border-right: none !important;
  }

  /* Expanded state (frame without data-sidebar-collapsed) slides the drawer in.
     The open state must be transform:none \u2014 NOT translateX(0): an identity
     transform still makes the drawer the containing block for fixed-position
     descendants (the settings dialog's .VOzbGW_overlay is portaled into the
     sidebar DOM). With the identity transform the wide settings sheet
     (100vw-16) overflows the 280px drawer, the dialog's focus scrolls the
     overflow:hidden drawer to scrollLeft=102, and every static child (plus the
     fixed overlay) shifts 102px off-screen. With transform:none the overlay is
     viewport-anchored: it dims the full screen and the sheet sits at left:8. */
  [data-mobile-nav="frame"]:not([data-sidebar-collapsed]) > :first-child {
    transform: none !important;
  }

  /* Drag handles are useless on touch and would float over the drawer. */
  [data-side="sidebar"],
  [data-side="details"] {
    display: none !important;
  }

  /* --- Conversation text on mobile ---
     The official message flow keeps desktop's 32px side gutters and 16px
     type. On a phone: shrink the type a notch and widen the lines by
     trimming the gutters (the sidebar drawer list keeps its size). The
     flow's scroll container is the only _scroll element holding markdown
     <p> paragraphs \u2014 the composer's own scroll (textarea) is excluded
     via :has(p). */
  /* The official main scroll body reserves scrollbar-gutter for desktop
     scrollbars (8px), which shoves every column off-center on a phone.
     Classic desktop scrollbars (Edge/Chrome) also occupy ~8-17px in a
     phone-sized viewport, shifting the column further. Mobile scrolling
     is touch/wheel, so remove the scrollbar entirely on phones: the
     column is then exactly centered in every browser. */
  [data-phase] [class$="_scrollBody"] {
    scrollbar-gutter: auto !important;
    scrollbar-width: none !important;
  }
  [data-phase] [class$="_scrollBody"]::-webkit-scrollbar {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
  }
  /* Message action rows (copy / run-time badges) can overflow the right
     edge on narrow screens \u2014 keep them inside the message width. */
  [data-phase] [class$="_actions"] {
    overflow: hidden !important;
  }
  [data-phase] [class$="_actions"] [class$="_timeEnd"] {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
  }

  [data-phase] [class$="_scroll"]:has(p) {
    padding-left: 20px !important;
    padding-right: 20px !important;
    font-size: 15px !important;
  }
  /* The official markdown styles set an explicit 16px on paragraphs and
     list items, so the container's inherited 15px is not enough. User
     messages render their text in a div whose class carries _text_
     (16px too) \u2014 cover it as well. */
  [data-phase] [class$="_scroll"]:has(p) p,
  [data-phase] [class$="_scroll"]:has(p) li,
  [data-phase] [class$="_scroll"]:has(p) [class*="_text_"] {
    font-size: 15px !important;
  }

  /* --- Composer bottom row on mobile ---
     The official row gives the model pill (trailing) flex:0 0 auto, which
     squeezes the agent-permission pill (modes) down to 15px: the pill's
     chevron then overflows on top of the model name. Let the permission
     pill keep its natural width and let the model pill shrink instead.
     Anchored by the composer card (:has(textarea)): row = last child,
     tools = first child, permission pill = its 2nd child, model pill =
     row's last child. */
  [data-phase] [class*="_card"]:has(textarea) > :last-child {
    gap: 8px !important;
  }
  [data-phase] [class*="_card"]:has(textarea) > :last-child > :first-child {
    gap: 8px !important;
  }
  [data-phase] [class*="_card"]:has(textarea) > :last-child > :first-child > :nth-child(2) {
    flex: 0 0 auto !important;
  }
  [data-phase] [class*="_card"]:has(textarea) > :last-child > :last-child {
    flex: 1 1 auto !important;
    min-width: 0 !important;
  }

  /* --- Bottom safe area (home indicator) ---
     The official layout pads for the status bar on top but not for the
     home indicator at the bottom. When the browser chrome hides (PWA /
     fullscreen) the composer sits under the gesture bar. Keep the composer
     stack clear of it. */
  [data-phase] [class$="_composerStack"] {
    padding-bottom: env(safe-area-inset-bottom, 0px) !important;
  }

  /* --- Long agent output on a phone ---
     Code blocks and tables overflow the 20px message gutters; let them
     scroll horizontally on touch instead of breaking the column. pre is a
     semantic element (not a hashed class), stable across dsh upgrades. */
  [data-phase] pre {
    max-width: 100%;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  /* Inline images / file cards must never blow out the column width. */
  [data-phase] img {
    max-width: 100%;
    height: auto;
  }

  /* --- Session header on mobile ---
     Layout goal: [toggle] [session title] [mode badge] in a row, with the
     Session log capsule removed from the header (relocated to the drawer
     footer). Stable structural hooks only:
       [data-phase] header                     the session header element
       header > :first-child                   titleRow (titleCluster + utilities)
       header > :first-child > :last-child     headerUtilities (Session log seat) */
  [data-phase] header {
    padding-right: 12px !important;
  }
  /* Give the title row a lane clear of the absolutely-placed toggle, then
     balance the header: with header padding-right 12px, a 20px left
     padding puts the title's geometric center exactly on the viewport
     center (measured 195/195 at 390px). */
  [data-phase] header > :first-child {
    padding-left: 20px !important;
  }
  /* The directory toggle sits at the far left of the header (the header
     is position:relative; the data-slot wrappers are display:contents). */
  [data-mobile-nav="toggle"] {
    position: absolute !important;
    left: 8px !important;
    top: 12px !important;
    z-index: 2 !important;
  }
  /* The Files action sits at the FAR RIGHT of the header so it reads as a
     distinct control from the directory toggle on the left (which opens
     the history sidebar). */
  [data-mobile-nav="files"] {
    position: absolute !important;
    left: auto !important;
    right: 8px !important;
    top: 12px !important;
    z-index: 2 !important;
  }
  /* Session log download: gone from the header row on mobile (the utilities
     seat holds only the session-log-export capsule). */
  [data-phase] header > :first-child > :last-child {
    display: none !important;
  }

  /* --- Settings dialog on mobile ---
     Desktop: 800px two-column flex (188px nav + content). Mobile: a
     near-full-width sheet \u2014 nav tabs wrap into rows on top, option rows
     stay horizontal (title+description left, control right). Structural
     selectors are scoped to the unique aria-modal dialog; every
     settings-specific rule is gated with
     :has(> :first-child > :last-child > button) \u2014 the settings nav tab
     list holds <button> tabs, so the transient export dialog (the same
     primitives Modal, header(title+close)+description+body) keeps its
     official centered card layout. Requires :has() support
     (Chromium 105+, 2022). */
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) {
    position: absolute !important;
    left: 8px !important;
    /* Fixed top (no translateY): a transform on the panel combined with the
       panel overflowing the max-content drawer shifts the fixed overlay's
       coordinate frame, dragging the whole sidebar content off-screen. The
       safe-area inset keeps the sheet below the status bar / notch. */
    top: calc(env(safe-area-inset-top, 0px) + 12px) !important;
    width: calc(100vw - 16px) !important;
    max-width: calc(100vw - 16px) !important;
    /* Height follows the content (no dead space under a short page); it
       caps at 100dvh-24 (less the safe-area top) and the options area
       scrolls only then. */
    height: auto !important;
    max-height: min(800px, calc(100vh - 24px - env(safe-area-inset-top, 0px))) !important;
    max-height: min(800px, calc(100dvh - 24px - env(safe-area-inset-top, 0px))) !important;
    flex-direction: column !important;
    border-radius: 14px !important;
    animation: dsh-mobile-nav-sheet-in .22s var(--ds-ease-out, ease-in-out);
  }
  /* The settings sheet's dimmed mask fades in with the panel (the mask is
     the first child of the overlay that directly contains the sheet). */
  :has(> [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"]))) > :first-child {
    animation: dsh-mobile-nav-fade .18s var(--ds-ease-out, ease-in-out);
  }
  @media (prefers-reduced-motion: reduce) {
    [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])),
    :has(> [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"]))) > :first-child {
      animation: none !important;
    }
  }
  /* The export dialog (not the settings sheet) must never overflow the
     viewport: the official centered card can be wider than 390px. */
  [aria-modal="true"]:not(:has(> :first-child > :last-child > button)) {
    max-width: calc(100vw - 32px) !important;
  }
  /* Nav bar: hide the "Settings" caption (redundant on a full-width sheet)
     and wrap the tab list so every tab is visible \u2014 a horizontal scroll cut
     the last tab ("Plugins") off with no affordance to scroll. */
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :first-child {
    width: 100% !important;
    flex-direction: row !important;
    align-items: center !important;
    gap: 6px !important;
    padding: 10px 12px 8px !important;
  }
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :first-child > :first-child {
    display: none !important;
  }
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :first-child > :last-child {
    flex-direction: row !important;
    flex-wrap: wrap !important;
    width: 100% !important;
    gap: 6px !important;
    overflow: visible !important;
  }
  /* Content toolbar (Open configuration file + close): spread to the edges
     instead of clustering right with a dead zone on the left. The toolbar
     children carry official auto-margins that would defeat space-between,
     so neutralize them. The close button gets a round tappable base so it
     reads as its own control, not part of the outline button. */
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :last-child > :first-child {
    justify-content: space-between !important;
    align-items: center !important;
    padding: 0 12px !important;
    min-height: 40px !important;
  }
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :last-child > :first-child > * {
    margin-left: 0 !important;
    margin-right: 0 !important;
  }
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :last-child > :first-child > :last-child {
    width: 32px !important;
    height: 32px !important;
    border-radius: 50% !important;
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06)) !important;
  }
  /* Appearance mode cards: the official cube row renders three tall
     vertical cards (~268px) that eat half the sheet. Turn them into a
     compact horizontal trio (icon + label inline, equal widths).
     Relies on the official cube-row class name of this version. */
  [aria-modal="true"] [class$="_cubeRow"] {
    gap: 6px !important;
  }
  [aria-modal="true"] [class$="_cubeRow"] > * {
    flex: 1 1 0 !important;
    flex-direction: row !important;
    align-items: center !important;
    justify-content: center !important;
    gap: 6px !important;
    padding: 10px 8px !important;
    min-height: 0 !important;
  }
  /* Content: the options scroll area gets bottom breathing room so the last
     row never sits flush against the sheet's rounded corner. */
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :last-child {
    flex: 1 1 auto !important;
    min-height: 0 !important;
  }
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :last-child > :last-child {
    padding: 0 12px 24px !important;
  }

  /* ---------- dsh-web-ui family compatibility ----------
     The linxin666 plugin suite extends the shell frame directly:
       - aionui-panel appends two trailing grid columns (explorer / preview)
         plus absolute drag handles to [data-dsh-frame]; its 5-track inline
         grid is already overridden above, but the handles and columns would
         still float over the main UI. On mobile the columns leave the grid
         as floating bottom sheets and keep their own visibility state \u2014
         the suite's collapse chevron / preview tabs still work, so no
         feature is lost. The task-board / ssh plugins inject sidebar
         entries and center-column takeover panels; the entries need
         spacing and the kanban needs scrollable columns. */

  /* Touch devices: the drag handles are useless \u2014 the floating expand
     button is the opener. */
  .aionui-explorer-handle,
  .aionui-preview-handle {
    display: none !important;
  }

  /* Shared base: both columns leave the grid as floating panels. The
     explorer is gated shut by default (its own persisted expanded state
     must never cover the mobile UI on load); the header Files action opens
     it via the frame marker below, and the sheet's own collapse chevron
     clears it. Preview stays owned by the suite (hidden while no tab is
     open). The per-column rules below override the geometry. */
  [data-aionui-explorer-col],
  [data-aionui-preview-col] {
    position: fixed !important;
    z-index: 55 !important;
    background: var(--aion-bg-base, #ffffff) !important;
    border-left: none !important;
  }
  /* Explorer (file tree) bottom sheet: bottom edge aligned exactly with
     the composer card's bottom line \u2014 the card sits 36px above the
     viewport bottom (8px composer padding + the 28px stats strip below
     the card), so the sheet uses the same 36px bottom offset. */
  [data-aionui-explorer-col] {
    visibility: hidden !important;
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    bottom: 36px !important;
    width: auto !important;
    height: min(55dvh, 460px) !important;
    max-height: calc(100dvh - 44px) !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    box-shadow: 0 -4px 28px rgba(0, 0, 0, .18) !important;
    animation: dsh-mobile-nav-sheet-up .24s var(--ds-ease-out, ease-in-out) !important;
  }
  /* Preview (file content) bottom sheet. Gated shut by default: the suite
     persists open preview tabs in localStorage and restores them on load,
     which would pop the sheet over the fresh UI. The client only sets the
     frame marker after the user taps a file row in the explorer; the
     suite's own collapse chevron clears it via the visibility watcher. */
  [data-aionui-preview-col] {
    visibility: hidden !important;
    position: fixed !important;
    left: 8px !important;
    right: 8px !important;
    top: auto !important;
    bottom: 40px !important;
    width: auto !important;
    height: min(50dvh, 420px) !important;
    max-height: calc(100dvh - 48px) !important;
    border-radius: 14px !important;
    overflow: hidden !important;
    box-shadow: 0 -4px 28px rgba(0, 0, 0, .18) !important;
    z-index: 56 !important;
    animation: dsh-mobile-nav-sheet-up .24s var(--ds-ease-out, ease-in-out) !important;
  }
  /* User-opened preview sheet (frame marker, set on file-row tap). */
  [data-mobile-nav="frame"][data-aionui-preview-open] [data-aionui-preview-col] {
    visibility: visible !important;
  }
  /* The Files action opens the explorer sheet (frame marker). */
  [data-mobile-nav="frame"][data-aionui-explorer-open] [data-aionui-explorer-col] {
    visibility: visible !important;
  }
  /* The open drawer must never sit under a sheet: while the frame is in the
     narrow-expanded state both sheets yield (later in the file than the
     open marker rule, so it wins at equal specificity). */
  [data-mobile-nav="frame"]:not([data-sidebar-collapsed]) [data-aionui-explorer-col],
  [data-mobile-nav="frame"]:not([data-sidebar-collapsed]) [data-aionui-preview-col] {
    visibility: hidden !important;
  }
  /* The suite's own expand button reads the store state we bypass on
     mobile \u2014 hide it; the header Files action is the opener. */
  .aionui-floating-expand {
    display: none !important;
  }

  /* dsh-web-ui sidebar entries (task board / ssh) sit flush against each
     other \u2014 give the injected rows breathing room. */
  button[data-dsh-taskboard-entry],
  button[data-dsh-ssh-entry] {
    margin-bottom: 8px !important;
  }

  /* Task board: five kanban columns at minmax(0,1fr) crush into ~78px phone
     strips. Give every column a usable minimum and let the row scroll. */
  [data-dsh-taskboard-board] > [class$="_columns"] {
    grid-template-columns: repeat(5, minmax(240px, 1fr)) !important;
    overflow-x: auto !important;
  }
  /* The floating button must not float over a takeover panel (task board /
     ssh own the center column while active). */
  html[data-dsh-taskboard-active] [data-mobile-nav="fab"],
  html[data-dsh-ssh-active] [data-mobile-nav="fab"],
  html[data-dsh-taskboard-active] [data-mobile-nav="backdrop"],
  html[data-dsh-ssh-active] [data-mobile-nav="backdrop"] {
    display: none !important;
  }
  /* Board header: let the search field take the slack instead of squeezing
     the action buttons. */
  [data-dsh-taskboard-board] > [class$="_boardHeader"] [class$="_search"] {
    flex: 1 1 auto !important;
    min-width: 80px !important;
  }

  /* ---------- dsh-web-ui polish: plugin market search ----------
     The market tab row (Discover / Themes / Installed + the plugin search
     box) is a no-wrap flex: at 390px the tabs plus the ~218px search box
     (~475px total) overflow the ~334px sheet and the search box runs off
     the right edge of the screen (it also forces a horizontal scrollbar on
     the sheet's options area). Let the row wrap: the tabs keep the first
     line and the search box gets its own full-width second line. */

  [aria-modal="true"] [class$="_tabs"] {
    flex-wrap: wrap !important;
    row-gap: 8px !important;
  }
  [aria-modal="true"] [class$="_searchInline"] {
    flex: 1 1 100% !important;
    width: 100% !important;
    max-width: 100% !important;
  }

  /* ---------- dsh-usage-stats polish: usage & balance panel ----------
     The panel's stats row shows three token counters side by side
     (today / month / total). The counters use tabular nowrap figures whose
     min-content width overflows the ~336px panel body on a phone: figures
     clip at the row's edges and the panel grows a horizontal scrollbar.
     Stack the three counters vertically \u2014 full-width rows, so the figures
     always fit. */

  [class*="usg_"][class$="_statsRow"] {
    flex-direction: column !important;
  }
  [class*="usg_"][class$="_stat"] {
    flex: 0 0 auto !important;
    width: 100% !important;
    min-width: 0 !important;
  }

  /* ---------- dsh-web-ui polish: settings sheet ----------
     The official dialog is a desktop two-column form; on a phone the
     label/control split leaves a huge dead gap and long descriptions wrap
     into tall stacks. Stack each row (text above, control full-width) and
     compact the nav tabs into an even wrap. */

  /* Nav tabs: a stable 3-per-row grid (two clean rows instead of a ragged
     wrap) with tighter cells. */
  [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :first-child > :last-child {
    display: grid !important;
    grid-template-columns: repeat(3, 1fr) !important;
    gap: 6px !important;
  }
  [aria-modal="true"] [class$="_navCell"] {
    padding: 6px 8px !important;
    gap: 6px !important;
    font-size: 13px !important;
    justify-content: flex-start !important;
  }
  [aria-modal="true"] [class$="_navCell"] svg {
    width: 14px !important;
    height: 14px !important;
    flex: none !important;
  }
  /* Setting rows: text on top, control below at full width. */
  [aria-modal="true"] [class$="_section"] [class$="_row"] {
    flex-direction: column !important;
    align-items: stretch !important;
    gap: 8px !important;
  }
  [aria-modal="true"] [class$="_section"] [class$="_row"] > :first-child {
    width: 100% !important;
    max-width: none !important;
  }
  [aria-modal="true"] [class$="_section"] [class$="_row"] > :last-child {
    width: 100% !important;
    max-width: none !important;
  }
  /* Appearance mode group: give the cube row a consistent bordered
     segmented look (the official borders differ per state). */
  [aria-modal="true"] [class$="_cubeRow"] > * {
    border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .12)) !important;
  }

  /* ---------- dsh-web-ui polish: explorer sheet ----------
     The aionui explorer was designed for a desktop side column: compact the
     header, search box and tree rows so a phone shows more entries, and pad
     the scroll bottom so the last row never sits flush on the edge. */

  [data-aionui-explorer-col] [class$="_tabBar"] {
    height: 36px !important;
  }
  [data-aionui-explorer-col] [class$="_tabBtn"],
  [data-aionui-explorer-col] [class$="_tabBtnActive"] {
    padding: 0 12px !important;
    font-size: 13px !important;
  }
  [data-aionui-explorer-col] [class$="_searchBox"] {
    height: 32px !important;
    font-size: 13px !important;
  }
  [data-aionui-explorer-col] [class$="_treeRow"] {
    height: 30px !important;
    font-size: 13px !important;
  }
  [data-aionui-explorer-col] [class$="_treeRow"] svg {
    width: 14px !important;
    height: 14px !important;
  }
  [data-aionui-explorer-col] [class$="_scrollArea"] {
    padding-bottom: 28px !important;
  }

  /* ---------- dsh-web-ui polish: drawer footer ----------
     The injected footer actions (Files + Session log) become two equal pill
     buttons instead of text-width capsules. */

  /* The official footerActions row also hosts the remote-web-ui entry
     row (two icon buttons); without wrapping the two groups squeeze each
     other on one line. Wrap so each group gets its own full-width row. */
  [data-mobile-nav="frame"] [class$="_footerActions"] {
    flex-wrap: wrap !important;
    gap: 6px !important;
  }
  [data-mobile-nav="drawer-actions"] {
    width: 100% !important;
  }
  [data-mobile-nav="drawer-actions"] > button {
    flex: 1 1 0 !important;
    padding: 0 8px !important;
    white-space: nowrap !important;
  }

  /* ---------- dsh-web-ui polish: floating pet ----------
     The whale-girl pet (dsh-pet) floats at the viewport corner with a
     persisted, draggable position. On phones the pet is scaled down so
     it does not dominate the screen; the plugin's own drag + persist
     still work (the position itself is left alone \u2014 the mobile default
     position is seeded via the pet API to just above the composer). */

  body > [class$="_float"]:has([class$="_sprite"][role="button"]) {
    transform: scale(.66);
    transform-origin: bottom right;
  }
  /* While a modal dialog (settings sheet / export) owns the screen the pet
     floats ABOVE it and covers the dialog content; modal semantics say the
     background is inert, so hide the pet for the modal's lifetime. */
  body:has([aria-modal="true"]) > [class$="_float"]:has([class$="_sprite"][role="button"]) {
    display: none !important;
  }

  /* ---------- dsh-web-ui polish: conversation stats line ----------
     The official session-status row (turns / steps / LLM time / TTFT /
     cache) is long. The client marks the exact row with
     [data-mobile-nav="stats"] (text-anchored, hashed classes can't be
     targeted). Layout: ONE fixed-height (28px) flex strip that scrolls
     horizontally \u2014 the full metrics stream stays reachable by swiping,
     the row never grows vertically, no ellipsis or fade, 12px gaps
     between metric groups, a 2px scrollbar as the swipe affordance. */

  [data-mobile-nav="stats"] {
    display: flex !important;
    flex-flow: row nowrap !important;
    align-items: center !important;
    width: 100% !important;
    max-width: 100% !important;
    min-width: 0 !important;
    height: 28px !important;
    min-height: 28px !important;
    max-height: 28px !important;
    box-sizing: border-box !important;
    white-space: nowrap !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
    scrollbar-width: thin !important;
    scrollbar-color: var(--dsw-alias-border-l1, rgba(0, 0, 0, .28)) transparent !important;
    padding: 0 0 4px !important;
    line-height: 20px !important;
    font-size: 12px !important;
  }
  [data-mobile-nav="stats"]::-webkit-scrollbar {
    height: 2px !important;
  }
  [data-mobile-nav="stats"]::-webkit-scrollbar-thumb {
    background: var(--dsw-alias-label-tertiary, rgba(0, 0, 0, .3)) !important;
    border-radius: 2px !important;
  }
  [data-mobile-nav="stats"]::-webkit-scrollbar-track {
    background: transparent !important;
  }
  [data-mobile-nav="stats"] > * {
    display: flex !important;
    flex: 0 0 auto !important;
    flex-flow: row nowrap !important;
    align-items: center !important;
    width: max-content !important;
    min-width: max-content !important;
    max-width: none !important;
    white-space: nowrap !important;
    margin-right: 12px !important;
    padding: 0 !important;
  }
  [data-mobile-nav="stats"] > *:last-child {
    margin-right: 0 !important;
  }
  [data-mobile-nav="stats"] * {
    white-space: nowrap !important;
  }

  /* ---------- hero composer on mobile ----------
     The official hero card carries a 2-line textarea plus a tall tool row,
     which reads oversized on a phone. Tighten the empty-state rhythm: keep
     the official centered hero, shrink the textarea line box, slim the card
     padding and the tool row, and close the gap under the headline. */

  [data-phase="hero"] [class$="_card"]:has(textarea) {
    padding-top: 6px !important;
    gap: 8px !important;
  }
  /* The official composer autosizes the textarea and writes an inline
     height (2 lines on the hero empty state) on the textarea's scroll/grow
     wrappers. :placeholder-shown lets us collapse the EMPTY state to one
     line with !important; as soon as the user types, the pseudo-class no
     longer matches and the autosizer's inline height takes over again \u2014 so
     multi-line growth keeps working. */
  [data-phase="hero"] textarea:placeholder-shown {
    height: 28px !important;
  }
  [data-phase="hero"] [class$="_card"]:has(textarea:placeholder-shown) > [class$="_scroll"],
  [data-phase="hero"] [class$="_card"]:has(textarea:placeholder-shown) [class$="_grow"] {
    height: 28px !important;
  }
  [data-phase="hero"] [class$="_card"]:has(textarea) > [class$="_row"] {
    padding-top: 2px !important;
  }
  [data-phase="hero"] [class$="_headline"] {
    line-height: 1.15 !important;
    margin-bottom: 0 !important;
  }
  [data-phase="hero"] [class$="_stack"] {
    gap: 0 !important;
  }

  /* ---------- landscape / very narrow screens ---------- */
  /* Landscape phones: the notches sit on the left/right edges. Push the
     frame content (and the composer) clear of them; the drawer is
     absolutely positioned and keeps its own background, so it may still
     span the full frame. */
  @media (orientation: landscape) {
    [data-mobile-nav="frame"] {
      padding-left: env(safe-area-inset-left, 0px) !important;
      padding-right: env(safe-area-inset-right, 0px) !important;
    }
    [data-phase] [class$="_composerStack"] {
      padding-left: env(safe-area-inset-left, 0px) !important;
      padding-right: env(safe-area-inset-right, 0px) !important;
    }
  }

  /* 320px-class screens: the settings nav tabs (3 columns) squeeze the
     labels; drop to 2 columns so every tab stays legible. */
  @media (max-width: 359px) {
    [aria-modal="true"]:has(> :first-child > :last-child > button):not(:has([role="navigation"])) > :first-child > :last-child {
      grid-template-columns: repeat(2, 1fr) !important;
    }
  }

  /* prefers-reduced-motion: keep every navigation surface's transitions off
     \u2014 the drawer slide, backdrop fade and both bottom sheets' rise. (The
     WAAPI replay for the sheets is guarded in mobile-apply.tsx; CSS rules
     cannot reach those programmatic animations.) */
  @media (prefers-reduced-motion: reduce) {
    [data-mobile-nav="frame"] > :first-child {
      transition: none !important;
    }
    [data-mobile-nav="backdrop"],
    [data-aionui-explorer-col],
    [data-aionui-preview-col] {
      animation: none !important;
    }
  }
}

/* ---------- desktop: the mobile controls must never appear ---------- */

@media (min-width: 1024px) {
  [data-mobile-nav="toggle"],
  [data-mobile-nav="files"],
  [data-mobile-nav="fab"],
  [data-mobile-nav="backdrop"],
  [data-mobile-nav="session-log"],
  [data-mobile-nav="explorer"],
  [data-mobile-nav="drawer-actions"] {
    display: none !important;
  }
}

/* ---------- \u79FB\u52A8\u7AEF\u6587\u4EF6\u5B88\u536B\uFF08issue #17\uFF0C\u79FB\u690D\u4E0A\u6E38 06f69fd\uFF09 ---------- */

@media (max-width: 1023px) {
  /* \u9690\u85CF\u300C\u6DFB\u52A0\u5DE5\u4F5C\u533A\u300D\u5165\u53E3\uFF08\u624B\u673A\u4E0A\u914D\u5DE5\u4F5C\u533A\u65E0\u610F\u4E49\uFF09\u3002
     \u56FE\u6807\u6309\u94AE\u7684 aria-label \u968F\u8BED\u8A00\u53D8\u5316\uFF08zh\u300C\u6DFB\u52A0\u5DE5\u4F5C\u533A\u300D/ en\u300CAdd workspace\u300D\uFF09\uFF0C
     \u4E24\u79CD\u90FD\u8986\u76D6\uFF1B\u4E0B\u62C9\u83DC\u5355\u91CC\u7684\u300C\u6DFB\u52A0\u5DE5\u4F5C\u533A\u2026\u300D\u9879\u7531 fileGuard.ts \u7684 MutationObserver
     \u6309\u6587\u6848\u515C\u5E95\u9690\u85CF\uFF08CSS \u9009\u4E0D\u5230\u7EAF\u6587\u672C\u8282\u70B9\uFF09\u3002\u684C\u9762\u7AEF\u7167\u5E38\u4FDD\u7559\u3002 */
  button[aria-label="\u6DFB\u52A0\u5DE5\u4F5C\u533A"],
  button[aria-label="\u6DFB\u52A0\u5DE5\u4F5C\u533A\u2026"],
  button[aria-label="Add workspace"],
  button[aria-label="Add workspace\u2026"] {
    display: none !important;
  }

  /* \u6587\u4EF6\u94FE\u63A5\u65C1\u7684\u300C\u590D\u5236\u300D\u6309\u94AE\uFF08issue #17\uFF1A\u590D\u5236\u6587\u4EF6\u5185\u5BB9\uFF09
     \u6302\u5728\u5BF9\u8BDD\u91CC\u7684\u6587\u4EF6\u94FE\u63A5\uFF08<button>/<a>\uFF0C\u6587\u6848\u5373\u8DEF\u5F84\uFF09\u7D27\u90BB\u4F4D\u7F6E\uFF0C\u7531 fileGuard.ts
     \u6CE8\u5165\u3002\u684C\u9762\u7AEF\u4E0D\u6CE8\u5165\u3001\u4E0D\u663E\u793A\uFF1B\u8FD9\u91CC\u518D\u515C\u5E95\u4E00\u5C42\u3002\u6587\u4EF6\u94FE\u63A5\u591A\u4E3A inline\uFF0C\u6309\u94AE\u7528
     inline-flex \u7D27\u8DDF\u5176\u540E\u5373\u53EF\u3002 */
  [data-mobile-nav="copy-file"] {
    display: inline-flex !important;
    align-items: center;
    justify-content: center;
    margin-left: 6px !important;
    vertical-align: baseline !important;
    height: 22px !important;
    padding: 0 8px !important;
    border: 1px solid var(--dsw-alias-border-l1, rgba(0, 0, 0, .14)) !important;
    border-radius: 6px !important;
    background: var(--dsw-alias-bg-layer-1, #fff) !important;
    color: var(--dsw-alias-label-primary, inherit) !important;
    font-family: inherit !important;
    font-size: 11px !important;
    line-height: 1 !important;
    cursor: pointer !important;
    -webkit-tap-highlight-color: transparent !important;
    box-shadow: 0 1px 3px rgba(0, 0, 0, .12) !important;
  }
  [data-mobile-nav="copy-file"]:active {
    background: var(--dsw-alias-interactive-bg-hover, rgba(0, 0, 0, .06)) !important;
  }
  [data-mobile-nav="copy-file"][disabled] {
    opacity: .55 !important;
    cursor: default !important;
  }
}

/* ---------- mobile: stop iOS Safari forced zoom on input focus ----------
 * Inputs are rendered with inline fontSize 13-14px, below the 16px threshold
 * that makes iOS Safari zoom the whole page on focus (and never recover).
 * Force the safe 16px minimum on narrow viewports only, so desktop keeps its
 * tighter metrics. !important is required to beat the inline styles.
 * \u79FB\u690D\u4E0A\u6E38 8d5b3fa\u3002 */
@media (max-width: 1024px) {
  input,
  textarea,
  [contenteditable="true"] {
    font-size: 16px !important;
  }
}

/* ---------- kill a competing full-screen mask (88605d9 / issue #67) ----------
   @linxin666/dsh-web-ui-all ships its own mobile drawer, and part of it is

     [data-dsh-frame]:not([data-sidebar-collapsed])::after {
       content: ""; position: fixed; inset: 0; z-index: 1050;
       background: rgb(0 0 0 / 24%);
     }

   The pseudo-element belongs to the frame we already mark, and the frame
   carries only "position: relative" with z-index auto \u2014 no stacking context
   \u2014 so this mask competes with the drawer in the parent stacking context
   and, at 1050, paints over it. It covers the whole viewport, so every tap
   on a session row lands on the mask instead: the drawer opens but nothing
   inside it can be pressed, and the page behind cannot be scrolled.
   Removing it is safe: the mobile stylesheet already renders its own
   backdrop, and tapping outside the drawer is handled in JS.

   The attribute selector is repeated on purpose. Their rule has the same
   specificity (0,2,1) once ours is written the obvious way, and plugin
   stylesheets are injected in load order, so a tie would be decided by
   whichever plugin happened to load last. Doubling the attribute makes it
   (0,3,1) and deterministic. */
[data-mobile-nav="frame"][data-mobile-nav="frame"]:not([data-sidebar-collapsed])::after {
  content: none !important;
}
`;

// client/mobile/layout-mode.mjs
function resolveLayout({ urlValue, stored, narrowMatch }) {
  const url = String(urlValue ?? "").trim();
  if (url === "desktop") return "desktop";
  if (url === "mobile") return "mobile";
  if (stored === "desktop" || stored === "mobile") return stored;
  return narrowMatch ? "mobile" : "desktop";
}
function persistLayoutFromUrl(urlValue) {
  if (typeof localStorage === "undefined") return "";
  const v = String(urlValue ?? "").trim();
  try {
    if (v === "desktop" || v === "mobile") localStorage.setItem("dsh-pocket.layout", v);
    else if (v === "auto" || v === "") localStorage.removeItem("dsh-pocket.layout");
  } catch {
  }
  try {
    const s = localStorage.getItem("dsh-pocket.layout");
    return s === "desktop" || s === "mobile" ? s : "";
  } catch {
    return "";
  }
}

// client/mobile/fileGuard.ts
var GUARD_MSG = "\u624B\u673A\u4E0A\u65E0\u6CD5\u76F4\u63A5\u6253\u5F00\u7535\u8111\u4E0A\u7684\u6587\u4EF6";
var WS_LABELS = ["\u6DFB\u52A0\u5DE5\u4F5C\u533A", "\u6DFB\u52A0\u5DE5\u4F5C\u533A\u2026", "Add workspace", "Add workspace\u2026"];
var COPY_LABEL = "\u590D\u5236";
function looksLikeFilePath(text) {
  const t = (text ?? "").trim();
  if (t.length < 3 || t.length > 320) return false;
  if (/^(\/|~\/|\.\.?\/|[A-Za-z]:\\)/.test(t)) return true;
  if (/\/[\w.\-]+\.\w{1,12}$/.test(t)) return true;
  if (/[\w.\-]+\/[\w.\-]+\.\w{1,12}/.test(t)) return true;
  return false;
}
function isInsidePocket(el) {
  return el !== null && el.closest('[data-mobile-nav="frame"]') !== null;
}
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.top = "-9999px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const okCopy = document.execCommand("copy");
    ta.remove();
    return okCopy;
  } catch {
    return false;
  }
}
function startFileGuard(readFile) {
  let toastEl = null;
  let toastTimer = null;
  const showToast = (text) => {
    if (toastEl === null) {
      toastEl = document.createElement("div");
      toastEl.setAttribute("data-mobile-nav", "file-guard-toast");
      Object.assign(toastEl.style, {
        position: "fixed",
        left: "50%",
        bottom: "64px",
        transform: "translateX(-50%)",
        maxWidth: "84vw",
        zIndex: "9999",
        padding: "10px 14px",
        borderRadius: "10px",
        background: "rgba(20,22,28,.92)",
        color: "#fff",
        fontSize: "13px",
        lineHeight: "1.4",
        textAlign: "center",
        fontFamily: "inherit",
        boxShadow: "0 4px 16px rgba(0,0,0,.28)",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity .18s ease"
      });
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = text;
    requestAnimationFrame(() => {
      if (toastEl !== null) toastEl.style.opacity = "1";
    });
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => {
      if (toastEl !== null) toastEl.style.opacity = "0";
    }, 2600);
  };
  const onClick = (event) => {
    const target = event.target;
    if (target === null || isInsidePocket(target)) return;
    const el = target.closest("button, a");
    if (el === null) return;
    if (!looksLikeFilePath(el.textContent)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    showToast(GUARD_MSG);
  };
  document.addEventListener("click", onClick, true);
  const injectCopyButtons = () => {
    const links = document.querySelectorAll("button, a");
    links.forEach((el) => {
      if (el.getAttribute("data-mobile-nav-copy") === "1") return;
      const txt = (el.textContent ?? "").trim();
      if (!looksLikeFilePath(txt)) return;
      if (isInsidePocket(el)) return;
      el.setAttribute("data-mobile-nav-copy", "1");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.setAttribute("data-mobile-nav", "copy-file");
      btn.textContent = COPY_LABEL;
      btn.addEventListener("click", async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const filePath = (el.textContent ?? "").trim();
        btn.disabled = true;
        btn.textContent = "\u2026";
        try {
          const res = await readFile(filePath);
          if (!res?.ok) {
            showToast(res?.error?.message ?? "\u590D\u5236\u5931\u8D25");
            return;
          }
          const content = res.value?.content ?? "";
          const copied = await copyText(content);
          if (copied) {
            const kb = Math.max(1, Math.round((res.value?.size ?? content.length) / 1024));
            showToast(`\u5DF2\u590D\u5236\u6587\u4EF6\u5185\u5BB9\uFF08${kb} KB\uFF09`);
          } else {
            showToast("\u590D\u5236\u5931\u8D25\uFF0C\u8BF7\u624B\u52A8\u9009\u62E9");
          }
        } catch (err) {
          showToast(err instanceof Error ? err.message : "\u590D\u5236\u5931\u8D25");
        } finally {
          btn.disabled = false;
          btn.textContent = COPY_LABEL;
        }
      });
      el.parentElement?.insertBefore(btn, el.nextSibling);
    });
  };
  injectCopyButtons();
  const copyObserver = new MutationObserver(() => injectCopyButtons());
  copyObserver.observe(document.body, { childList: true, subtree: true });
  const hideWsEntries = () => {
    const checkOne = (node) => {
      if (node.nodeType !== 1) return;
      const el = node;
      const txt = (el.getAttribute("aria-label") ?? el.textContent ?? "").trim();
      if (WS_LABELS.includes(txt)) {
        el.style.display = "none";
        el.setAttribute("data-mobile-nav-hide", "add-workspace");
      }
    };
    const sel = '[role="menuitem"],[role="option"],li,button,a';
    document.querySelectorAll(sel).forEach(checkOne);
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType !== 1) return;
          checkOne(n);
          n.querySelectorAll?.(sel).forEach(checkOne);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  };
  const disconnectWs = hideWsEntries();
  return () => {
    document.removeEventListener("click", onClick, true);
    copyObserver.disconnect();
    disconnectWs();
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastEl?.remove();
  };
}

// client/mobile/locales.ts
var NS = "mobileNav";
var zh = {
  "open": "\u6253\u5F00\u76EE\u5F55",
  "close": "\u6536\u8D77\u76EE\u5F55",
  "backdrop": "\u70B9\u51FB\u5173\u95ED\u76EE\u5F55",
  "sessionLog": "\u5BFC\u51FA\u4F1A\u8BDD\u65E5\u5FD7",
  "files": "\u6587\u4EF6\u6D4F\u89C8"
};
var en = {
  "open": "Open directory",
  "close": "Close directory",
  "backdrop": "Click to close directory",
  "sessionLog": "Session log",
  "files": "Files"
};

// client/mobile/mobile-apply.tsx
function rafBatch(run) {
  let scheduled = false;
  return () => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      run();
    });
  };
}
function mobileApply(ctx) {
  const urlValue = new URL(window.location.href).searchParams.get("dsh-layout") ?? "";
  const narrowMQ = window.matchMedia("(max-width: 1023px)");
  const stored = persistLayoutFromUrl(urlValue);
  const layout = resolveLayout({ urlValue, stored, narrowMatch: narrowMQ.matches });
  document.body?.setAttribute("data-dsh-pocket-layout", layout);
  if (layout === "desktop") return;
  let narrow = narrowMQ;
  if (layout === "mobile") {
    narrow = { matches: true, addEventListener: () => {
    }, removeEventListener: () => {
    } };
  }
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-mobile-nav: dictionaries");
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = "@dsh-external/dsh-mobile-nav";
    tag.dataset.pluginCss = "@dsh-external/dsh-mobile-nav/mobile.css";
    tag.textContent = MOBILE_CSS;
    document.head.appendChild(tag);
    return () => {
      tag.remove();
    };
  }, "dsh-mobile-nav: styles");
  ctx.effect(() => {
    if (!narrow.matches) return () => {
    };
    const getWorkspaceCwd = () => {
      try {
        const ws = ctx.get?.("workspaces") ?? ctx.workspaces;
        const list = ws?.list;
        const arr = Array.isArray(list) ? list : list && typeof list === "object" && "value" in list ? list.value : null;
        if (Array.isArray(arr)) {
          for (const w of arr) {
            const c = w?.cwd ?? w?.root;
            if (typeof c === "string" && c) return c;
          }
        }
      } catch {
      }
      return "";
    };
    const readFile = (filePath) => ctx.connection.rpc.call(
      POCKET_RPC_CHANNEL,
      POCKET_ENDPOINTS.fileRead,
      { path: filePath, cwd: getWorkspaceCwd() }
    );
    return startFileGuard(readFile);
  }, "dsh-mobile-nav: file open guard + copy button + hide add-workspace (issue #17)");
  ctx.effect(() => {
    const viewport = document.querySelector('meta[name="viewport"]');
    const originalViewport = viewport?.content ?? "";
    const themeMeta = document.createElement("meta");
    themeMeta.name = "theme-color";
    const bodyBg = () => getComputedStyle(document.body).backgroundColor;
    const sync = () => {
      if (viewport !== null) viewport.content = "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";
      themeMeta.content = bodyBg();
      if (themeMeta.parentElement === null) document.head.appendChild(themeMeta);
    };
    const restore = () => {
      if (viewport !== null) viewport.content = originalViewport;
      themeMeta.remove();
    };
    const onGestureStart = (event) => event.preventDefault();
    if (narrow.matches) sync();
    const onChange = (event) => event.matches ? sync() : restore();
    narrow.addEventListener("change", onChange);
    const observer = new MutationObserver(() => {
      if (narrow.matches) themeMeta.content = bodyBg();
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    document.addEventListener("gesturestart", onGestureStart);
    return () => {
      narrow.removeEventListener("change", onChange);
      observer.disconnect();
      document.removeEventListener("gesturestart", onGestureStart);
      restore();
    };
  }, "dsh-mobile-nav: status bar theme + viewport + zoom guard");
  ctx.effect(() => {
    if (!narrow.matches) return () => {
    };
    const onChevronClick = (event) => {
      const target = event.target;
      if (target === null || !target.closest(".aionui-collapse-chevron")) return;
      document.querySelector('[data-mobile-nav="frame"]')?.removeAttribute("data-aionui-explorer-open");
    };
    document.addEventListener("click", onChevronClick, true);
    return () => document.removeEventListener("click", onChevronClick, true);
  }, "dsh-mobile-nav: aionui explorer close marker");
  ctx.effect(() => {
    if (!narrow.matches) return () => {
    };
    const frame = () => document.querySelector('[data-mobile-nav="frame"]');
    const check = () => {
      const has = document.querySelector("[data-aionui-explorer-col]") !== null;
      frame()?.setAttribute("data-mobile-nav-explorer", has ? "1" : "0");
    };
    check();
    const timer = window.setTimeout(check, 1500);
    const observer = new MutationObserver(rafBatch(check));
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      window.clearTimeout(timer);
      observer.disconnect();
    };
  }, "dsh-mobile-nav: explorer availability (issue #48)");
  ctx.effect(() => {
    if (!narrow.matches) return () => {
    };
    const frame = () => document.querySelector('[data-mobile-nav="frame"]');
    const onTap = (event) => {
      const target = event.target;
      if (target === null) return;
      if (target.closest('[data-aionui-explorer-col] [class$="_treeRow"]') === null) return;
      frame()?.setAttribute("data-aionui-preview-open", "");
    };
    const sync = () => {
      const pv = document.querySelector("[data-aionui-preview-col]");
      if (pv === null) return;
      if (getComputedStyle(pv).visibility === "hidden") frame()?.removeAttribute("data-aionui-preview-open");
    };
    document.addEventListener("click", onTap, true);
    const observer = new MutationObserver(sync);
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["style"] });
    sync();
    return () => {
      document.removeEventListener("click", onTap, true);
      observer.disconnect();
    };
  }, "dsh-mobile-nav: preview sheet open marker");
  ctx.effect(() => {
    if (!narrow.matches) return () => {
    };
    const moveTps = (stats) => {
      if ([...stats.children].some((c) => /^TPS\s+\d/.test((c.textContent ?? "").trim()))) return;
      const stack = stats.closest('[class$="_composerStack"]');
      if (stack === null) return;
      for (const el of stack.querySelectorAll("div")) {
        const text = (el.textContent ?? "").trim();
        if (!/^TPS\s+\d/.test(text)) continue;
        if (el.children.length > 0) continue;
        stats.appendChild(el);
        return;
      }
    };
    let marked = null;
    let lastScan = 0;
    const scan = () => {
      const now = Date.now();
      if (marked !== null && marked.isConnected && now - lastScan < 500) return;
      lastScan = now;
      if (marked === null || !marked.isConnected) marked = null;
      for (const root of document.querySelectorAll('[data-phase] [class$="_root"]')) {
        if (root.closest('[class$="_composerStack"]') === null) continue;
        if (root.querySelector("button") !== null) continue;
        const text = root.textContent ?? "";
        if (!/(turns|steps|\bLLM\b|轮|步)/.test(text)) continue;
        if (root.querySelector("textarea") !== null) continue;
        root.setAttribute("data-mobile-nav", "stats");
        moveTps(root);
        marked = root;
        return;
      }
    };
    const mark = rafBatch(scan);
    const observer = new MutationObserver(mark);
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    return () => {
      observer.disconnect();
      marked = null;
    };
  }, "dsh-mobile-nav: stats line marker");
  ctx.effect(() => {
    if (!narrow.matches) return () => {
    };
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const cols = ["[data-aionui-explorer-col]", "[data-aionui-preview-col]"];
    const seen = /* @__PURE__ */ new Map();
    const play = (el) => {
      if (reducedMotion.matches) return;
      el.animate(
        [
          { opacity: 0, transform: "translateY(28px)" },
          { opacity: 1, transform: "none" }
        ],
        { duration: 280, easing: "cubic-bezier(.16, 1, .3, 1)", fill: "backwards" }
      );
    };
    const check = () => {
      for (const sel of cols) {
        const el = document.querySelector(sel);
        if (el === null) continue;
        const visible = getComputedStyle(el).visibility === "visible";
        const prev = seen.get(sel) ?? false;
        if (visible && !prev) play(el);
        seen.set(sel, visible);
      }
    };
    const observer = new MutationObserver(rafBatch(check));
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["style", "class", "data-aionui-explorer-open"] });
    check();
    return () => {
      observer.disconnect();
    };
  }, "dsh-mobile-nav: sheet rise animation replay");
  ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
    name: "conversation.session.header.actions",
    id: "mobile-nav-toggle",
    order: 10,
    locale: NS,
    inject: () => ({
      toggleSidebar: () => ctx.layout.toggleSidebar()
    })
  }, MobileNavToggle));
  ctx.slots.inject("shell.overlay", () => ctx.slots.register({
    name: "shell.overlay",
    id: "mobile-nav-overlay",
    order: 10,
    locale: NS,
    inject: () => ({
      toggleSidebar: () => ctx.layout.toggleSidebar()
    })
  }, MobileNavOverlay));
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "mobile-nav-session-log",
    order: 10,
    locale: NS,
    inject: () => ({
      downloadSessionLog: (sessionId) => ctx.sessionLogDownload.download(sessionId),
      toggleSidebar: () => ctx.layout.toggleSidebar()
    })
  }, MobileDrawerFooter));
}

// client/pocket-locales.js
var NS2 = "pocket";
var zh2 = {
  "section": "\u624B\u673A\u8BBF\u95EE",
  "entryLabel": "\u624B\u673A\u8BBF\u95EE",
  "closeDialog": "\u5173\u95ED",
  "subtitle": "\u624B\u673A\u626B\u7801\u6253\u5F00\u7684\u5C31\u662F\u7535\u8111\u4E0A\u7684\u8FD9\u4E2A\u754C\u9762\uFF0C\u5B9E\u65F6\u540C\u6B65",
  "developer": "\u5F00\u53D1\u8005\uFF1A\u7A0B\u5E8F\u5458\u5C11\u5317\u6668",
  "starAsk": "\u2B50 \u987A\u624B\u7559\u9897 Star\uFF0C\u4F5C\u8005\u80FD\u9AD8\u5174\u4E00\u6574\u5929",
  "starCta": "\u884C\uFF0C\u7ED9\u4F60\u4E00\u9897 Star",
  "restarted": "\u{1F504} \u5DF2\u91CD\u542F",
  "ok": "\u77E5\u9053\u4E86",
  "bgHint": "\u8FDB\u7A0B\u5728\u540E\u53F0\u8FD0\u884C\uFF08\u4E0D\u6302\u7EC8\u7AEF\uFF09\u3002\u5982\u9700\u505C\u6B62\uFF1A{cmd}",
  // 版本信息（不自动检测更新）：当前版本 + GitHub 最新版本 + 更新命令
  "versionTitle": "\u7248\u672C\u4FE1\u606F",
  "versionCurrentLabel": "\u5F53\u524D\u7248\u672C",
  "versionGithubLabel": "GitHub \u6700\u65B0",
  "versionGithubLoading": "\u67E5\u8BE2\u4E2D\u2026",
  "versionGithubFail": "\u83B7\u53D6\u5931\u8D25",
  "versionGithubOpen": "\u6253\u5F00 GitHub",
  "versionNewer": "\uFF08\u6709\u65B0\u7248\u672C\uFF09",
  "versionRefresh": "\u91CD\u65B0\u67E5\u8BE2",
  "updateCmd": "\u5B89\u88C5 / \u66F4\u65B0\u5230\u6700\u65B0\u7248",
  "updateHint": "\u63D2\u4EF6\u540D\u79F0\u4E3A dsh-pocket-nas\u3002\u82E5\u8FD8\u88C5\u6709\u65E7\u540D\u63D2\u4EF6\uFF0C\u5148\u6267\u884C dsh plugin --profile web remove dsh-pocket -w\uFF0C\u518D\u8FD0\u884C\u4E0A\u9762\u547D\u4EE4",
  "copy": "\u590D\u5236",
  "copied": "\u5DF2\u590D\u5236",
  "versionRestartHint": "\u78C1\u76D8\u4E0A\u5DF2\u66F4\u65B0\u5230 v{ver}\uFF0C\u91CD\u542F dsh web \u751F\u6548",
  "restarting": "\u91CD\u542F\u4E2D\u2026",
  "restartNow": "\u{1F504} \u91CD\u542F dsh web \u751F\u6548",
  "restartingDetail": "\u23F3 \u6B63\u5728\u91CD\u542F\u751F\u6548\uFF08\u901A\u5E38 10-30 \u79D2\uFF09\xB7 \u5DF2\u7B49\u5F85 {s} \u79D2",
  "lanTitle": "\u{1F4F6} \u5C40\u57DF\u7F51\uFF08\u540C\u4E00 WiFi\uFF09",
  "lanHint": "\u624B\u673A\u8FDE\u63A5\u540C\u4E00 WiFi \u540E\u626B\u7801\u5373\u53EF\u6253\u5F00",
  "lanAddress": "\u5C40\u57DF\u7F51\u5730\u5740",
  "lanAddressAuto": "\u81EA\u52A8\uFF08\u63A8\u8350\uFF09",
  "lanAddressHint": "\u9AD8\u7EA7\u9009\u9879\uFF1A\u4E00\u822C\u4E0D\u9700\u8981\u4FEE\u6539\uFF1B\u4F7F\u7528 Tailscale/VPN \u7B49\u8FDC\u7A0B\u8BBF\u95EE\u65F6\u53EF\u624B\u52A8\u9009\u62E9",
  "lanPin": "\u5C40\u57DF\u7F51\u8BBF\u95EE\u5BC6\u7801",
  "on": "\u5F00",
  "off": "\u5173",
  "lanPinValue": "\u{1F510} \u8BBF\u95EE\u5BC6\u7801\uFF1A{pin}\uFF08\u624B\u673A\u6253\u5F00\u9700\u8F93\u5165\uFF1B\u4E0E\u516C\u7F51\u5BC6\u7801\u5206\u5F00\uFF09",
  "lanPinCustomValue": "\u{1F510} \u8BBF\u95EE\u5BC6\u7801\uFF1A{pin}\uFF08\u81EA\u5B9A\u4E49\uFF1B\u624B\u673A\u6253\u5F00\u9700\u8F93\u5165\uFF09",
  "refresh": "\u5237\u65B0",
  "customize": "\u81EA\u5B9A\u4E49",
  "customizing": "\u65B0\u5BC6\u7801\uFF088\u201364 \u4F4D\uFF0C\u82F1\u6587\u5B57\u6BCD\u6216\u6570\u5B57\uFF09\uFF1A",
  "save": "\u4FDD\u5B58",
  "cancel": "\u53D6\u6D88",
  "pinInvalid": "\u5BC6\u7801\u5FC5\u987B\u662F 8\u201364 \u4F4D\u82F1\u6587\u5B57\u6BCD\u6216\u6570\u5B57",
  // 明文切换 / 复制失败反馈
  "show": "\u663E\u793A",
  "hide": "\u9690\u85CF",
  "copyFail": "\u590D\u5236\u5931\u8D25",
  // 公网免责声明：确认按钮（与勾选框文案区分，动词 + 宾语）
  "confirmEnable": "\u786E\u8BA4\u5E76\u5F00\u542F\u516C\u7F51",
  "pinCustomHint": "\u81EA\u5B9A\u4E49\u540E\u5F00\u542F\u516C\u7F51\u4E0D\u518D\u81EA\u52A8\u6362\u65B0",
  "lanPinOff": "\u{1F513} \u5BC6\u7801\u5DF2\u5173\u95ED\uFF1A\u626B\u7801\u76F4\u8FDE\uFF0C\u65E0\u9700\u5BC6\u7801\uFF08\u4EC5\u540C\u4E00\u5C40\u57DF\u7F51\u8BBE\u5907\u53EF\u8BBF\u95EE\uFF1B\u516C\u7F51\u4ECD\u8981\u5BC6\u7801\uFF09",
  "lanStarting": "\u4EE3\u7406\u672A\u5C31\u7EEA\u2026",
  "wanTitle": "\u{1F310} \u516C\u7F51\uFF08\u4EBA\u5728\u5916\u9762\uFF09",
  "wanHint": "\u4EFB\u4F55\u7F51\u7EDC\u626B\u7801\u5373\u7528\uFF08URL \u6BCF\u6B21\u91CD\u542F\u81EA\u52A8\u6362\u65B0\uFF09",
  "wanPin": "\u{1F510} \u8BBF\u95EE\u5BC6\u7801\uFF1A{pin}\uFF08\u6BCF\u6B21\u5F00\u542F\u516C\u7F51\u53D8\u65B0\uFF1B\u624B\u673A\u6253\u5F00\u94FE\u63A5\u9700\u8F93\u5165\u6B64\u5BC6\u7801\uFF09",
  "wanPinCustom": "\u{1F510} \u8BBF\u95EE\u5BC6\u7801\uFF1A{pin}\uFF08\u81EA\u5B9A\u4E49\uFF0C\u5F00\u542F\u516C\u7F51\u4E0D\u518D\u81EA\u52A8\u6362\u65B0\uFF09",
  "stopTunnel": "\u5173\u95ED\u516C\u7F51",
  "enable": "\u5F00\u542F\u516C\u7F51\u8BBF\u95EE",
  "opening": "\u5F00\u542F\u4E2D\u2026",
  "disclaimerTitle": "\u26A0\uFE0F \u5B89\u5168\u514D\u8D23\u58F0\u660E",
  "disclaimerBody": "\u5F00\u542F\u516C\u7F51 = \u628A\u672C\u673A DSH\uFF08\u80FD\u6267\u884C\u4EE3\u7801\uFF09\u66B4\u9732\u5230\u4E92\u8054\u7F51\u3002\u4EFB\u4F55\u4EBA\u62FF\u5230\u516C\u7F51\u94FE\u63A5\u548C\u5BC6\u7801\uFF0C\u90FD\u80FD\u8BBF\u95EE\u751A\u81F3\u64CD\u4F5C\u4F60\u7684\u7535\u8111\u3002\u8BF7\u786E\u8BA4\uFF1A\u2460 \u4F7F\u7528\u81EA\u5B9A\u4E49\u5F3A\u5BC6\u7801\u6216\u59A5\u5584\u4FDD\u7BA1\u81EA\u52A8\u5BC6\u7801\uFF1B\u2461 \u7528\u5B8C\u7ACB\u5373\u300C\u5173\u95ED\u516C\u7F51\u300D\uFF1B\u2462 \u516C\u53F8/\u6D89\u5BC6\u7F51\u7EDC\u8BF7\u5148\u786E\u8BA4\u5408\u89C4\u3002",
  "disclaimerAgree": "\u6211\u5DF2\u77E5\u60C5\uFF0C\u540C\u610F\u5F00\u542F",
  "disclaimerHint": "\u8BF7\u52FE\u9009\u300C\u6211\u5DF2\u77E5\u60C5\u300D\u540E\u518D\u5F00\u542F\u516C\u7F51",
  "downloading": "\u23F3 \u4E0B\u8F7D cloudflared\uFF08\u9996\u6B21\u7EA6 20-50MB\uFF0C\u901A\u5E38 1-2 \u5206\u949F\uFF1B\u4E4B\u540E\u79D2\u5F00\uFF09\xB7 \u5DF2\u7B49\u5F85 {s} \u79D2",
  "connecting": "\u23F3 \u8FDE\u63A5 Cloudflare \u8FB9\u7F18\uFF08\u901A\u5E38 5-30 \u79D2\uFF09\xB7 \u5DF2\u7B49\u5F85 {s} \u79D2{suffix}",
  "slowHint": " \u2014 \u6709\u70B9\u4E45\uFF1F\u68C0\u67E5\u662F\u5426\u5F00\u7740\u4EE3\u7406/VPN\uFF08Clash TUN \u7B49\uFF09",
  "error": "\u274C \u5F00\u542F\u5931\u8D25\uFF1A{detail}\uFF08\u53EF\u91CD\u8BD5\uFF1B\u82E5\u662F\u4EE3\u7406/VPN \u95EE\u9898\u89C1 README \u6392\u969C\uFF09",
  "unknownError": "\u672A\u77E5\u9519\u8BEF",
  // NAS 反向隧道（frp）
  "frpTitle": "\u{1F3E0} NAS \u53CD\u5411\u96A7\u9053\uFF08\u81EA\u5EFA\uFF0C\u56FD\u5185\u66F4\u5FEB\uFF09",
  "frpHint": "\u628A\u672C\u673A\u4EE3\u7406\u53CD\u5411\u53D1\u5E03\u5230\u81EA\u5BB6 NAS\uFF08frp\uFF09\uFF1A\u624B\u673A\u8BBF\u95EE NAS \u57DF\u540D\u5373\u8FBE\u7535\u8111\uFF0CURL \u56FA\u5B9A\u3001\u56FD\u5185\u76F4\u8FDE\u6700\u5FEB\uFF1BNAS \u7AEF\u9700\u5148\u90E8\u7F72 frps + \u53CD\u5411\u4EE3\u7406\uFF08\u89C1\u300C\u590D\u5236\u90E8\u7F72\u6A21\u677F\u300D\uFF09",
  "frpServerAddr": "NAS \u5730\u5740",
  "frpServerAddrPlaceholder": "\u57DF\u540D\u6216 IP\uFF0C\u5982 nas.example.com",
  "frpServerPort": "\u670D\u52A1\u7AEF\u53E3",
  "frpRemotePort": "\u8F6C\u53D1\u7AEF\u53E3",
  "frpToken": "\u8FDE\u63A5\u4EE4\u724C",
  "frpTokenShow": "\u663E\u793A\u660E\u6587",
  "frpTokenHide": "\u9690\u85CF\u660E\u6587",
  "frpTokenPlaceholder": "\u4E0E frps.toml \u7684 token \u4E00\u81F4\uFF08\u81F3\u5C11 8 \u4F4D\uFF09",
  "frpTls": "\u4F20\u8F93\u52A0\u5BC6\uFF08TLS\uFF09",
  "frpTlsHint": "\u9700 frps \u7AEF\u540C\u6B65\u5F00\u542F transport.tls.force\uFF0C\u5426\u5219\u8FDE\u4E0D\u4E0A",
  "frpSave": "\u4FDD\u5B58\u914D\u7F6E",
  "frpSaved": "\u2705 \u5DF2\u4FDD\u5B58",
  "frpStart": "\u5F00\u542F\u96A7\u9053",
  "frpStop": "\u5173\u95ED\u96A7\u9053",
  "frpStarting": "\u5F00\u542F\u4E2D\u2026",
  "frpConfigureFirst": "\u5148\u586B\u5199 NAS \u5730\u5740\u4E0E\u8FDE\u63A5\u4EE4\u724C\u5E76\u4FDD\u5B58",
  "frpStateIdle": "\u672A\u5F00\u542F",
  "frpStateDownloading": "\u23F3 \u4E0B\u8F7D frpc\uFF08\u9996\u6B21\u7EA6 10MB\uFF09\xB7 \u5DF2\u7B49\u5F85 {s} \u79D2",
  "frpStateConnecting": "\u23F3 \u8FDE\u63A5 NAS frps\uFF08\u901A\u5E38\u6570\u79D2\uFF09\xB7 \u5DF2\u7B49\u5F85 {s} \u79D2",
  "frpStateReady": "\u2705 \u96A7\u9053\u5C31\u7EEA \xB7 \u624B\u673A\u8BBF\u95EE https://\u4F60\u7684NAS\u57DF\u540D\uFF08\u8BBF\u95EE\u5BC6\u7801\u5373\u300C\u5C40\u57DF\u7F51\u300D\u7684\u5BC6\u7801\uFF09",
  "frpStateError": "\u274C {detail}",
  "frpCopyCompose": "\u{1F4CB} \u590D\u5236 NAS \u90E8\u7F72\u6A21\u677F\uFF08docker-compose\uFF09",
  "frpCopied": "\u2705 \u5DF2\u590D\u5236\u5230\u526A\u8D34\u677F\uFF08frps + caddy\uFF1B\u653E\u884C 443/80/7000 \u7AEF\u53E3\uFF0C\u89E3\u6790\u57DF\u540D\u5230 NAS\uFF09",
  "frpLog": "\u67E5\u770B\u65E5\u5FD7",
  "frpNoToken": "\u672A\u8BBE\u7F6E\u4EE4\u724C",
  "lanAccess": "\u5C40\u57DF\u7F51\u8BBF\u95EE",
  "lanDisabledHint": "\u{1F512} \u5C40\u57DF\u7F51\u8BBF\u95EE\u5DF2\u5173\u95ED\uFF1A\u624B\u673A\u626B\u7801/\u94FE\u63A5\u5747\u4E0D\u53EF\u7528\uFF08\u516C\u7F51\u4E0D\u53D7\u5F71\u54CD\uFF09\u3002\u70B9\u300C\u5F00\u300D\u6062\u590D\u3002",
  "lanToggleTitleOff": "\u5173\u95ED\u5C40\u57DF\u7F51\u8BBF\u95EE",
  "lanToggleBodyOff": "\u5173\u95ED\u540E\uFF0C\u540C\u4E00 WiFi \u4E0B\u7684\u624B\u673A\u5C06\u65E0\u6CD5\u626B\u7801\u8BBF\u95EE\uFF08\u5C40\u57DF\u7F51\u4E8C\u7EF4\u7801/\u94FE\u63A5\u7ACB\u5373\u5931\u6548\uFF09\u3002\u516C\u7F51\u8BBF\u95EE\u4E0D\u53D7\u5F71\u54CD\u3002\u786E\u5B9A\u5173\u95ED\uFF1F",
  "lanToggleTitleOn": "\u5F00\u542F\u5C40\u57DF\u7F51\u8BBF\u95EE",
  "lanToggleBodyOn": "\u5F00\u542F\u540E\uFF0C\u540C\u4E00 WiFi \u7684\u624B\u673A\u626B\u7801\u5373\u53EF\u8BBF\u95EE\uFF08\u9ED8\u8BA4\u9700\u8F93\u5165\u5C40\u57DF\u7F51\u5BC6\u7801\uFF09\u3002\u786E\u5B9A\u5F00\u542F\uFF1F",
  "confirm": "\u786E\u5B9A",
  "resetFactory": "\u{1F9F9} \u6062\u590D\u51FA\u5382\u8BBE\u7F6E",
  "resetGo": "\u6062\u590D",
  "resetIntro": "\u8BBE\u7F6E\u641E\u51FA\u95EE\u9898\u65F6\u7684\u4E34\u65F6\u515C\u5E95\uFF1A\u6E05\u7A7A\u672C\u673A\u914D\u7F6E\u5E76\u91CD\u8BBE\u968F\u673A\u5BC6\u7801\uFF08DSH \u7684\u4F1A\u8BDD\u3001\u6A21\u578B\u3001\u63D2\u4EF6\u914D\u7F6E\u4E0D\u53D7\u5F71\u54CD\uFF09",
  "resetTitle": "\u26A0\uFE0F \u786E\u8BA4\u6062\u590D\u51FA\u5382\u8BBE\u7F6E\uFF1F",
  "resetBody": "\u5C06\u6E05\u7A7A\u5E76\u6062\u590D\u9ED8\u8BA4\uFF1A\n\u2460 \u5F00\u5173\uFF1A\u5C40\u57DF\u7F51\u8BBF\u95EE\u5BC6\u7801=\u5F00\u3001\u5C40\u57DF\u7F51\u5730\u5740=\u81EA\u52A8\n\u2461 \u516C\u7F51\uFF1A\u6A21\u5F0F\u56DE\u5230\u968F\u673A\u57DF\u540D\uFF0C\u6E05\u7A7A Tunnel Token \u4E0E\u56FA\u5B9A\u57DF\u540D\uFF0C\u5E76\u5173\u95ED\u6B63\u5728\u8FD0\u884C\u7684\u516C\u7F51\n\u2462 NAS \u53CD\u5411\u96A7\u9053\uFF1A\u6E05\u7A7A\u670D\u52A1\u5668\u5730\u5740/\u7AEF\u53E3/\u8FDE\u63A5\u4EE4\u724C\uFF0C\u5E76\u5173\u95ED\u6B63\u5728\u8FD0\u884C\u7684 NAS \u96A7\u9053\n\u2463 \u5BC6\u7801\uFF1A\u516C\u7F51\u548C\u5C40\u57DF\u7F51\u90FD\u6362\u6210\u65B0\u7684\u968F\u673A 8 \u4F4D\u5BC6\u7801\uFF08\u65E7\u5BC6\u7801\u7ACB\u5373\u4F5C\u5E9F\uFF0C\u624B\u673A\u9700\u91CD\u65B0\u8F93\u5165\uFF09\n\nDSH \u81EA\u8EAB\u7684\u4F1A\u8BDD\u3001\u6A21\u578B\u3001\u63D2\u4EF6\u914D\u7F6E\u4E0D\u53D7\u5F71\u54CD\uFF1B\u6B64\u64CD\u4F5C\u4E0D\u53EF\u64A4\u9500\u3002",
  "resetConfirm": "\u786E\u8BA4\u6062\u590D",
  "resetDone": "\u2705 \u5DF2\u6062\u590D\u51FA\u5382\u8BBE\u7F6E\uFF1A\u8BBE\u7F6E\u5DF2\u6E05\u7A7A\uFF0C\u5BC6\u7801\u5DF2\u6362\u65B0\uFF08\u624B\u673A\u9700\u91CD\u65B0\u8F93\u5165\uFF09",
  "resetFailed": "\u274C \u6062\u590D\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
  "feedback": "\u6709\u95EE\u9898\uFF1F\u6B22\u8FCE\u5230 GitHub Issues \u53CD\u9988 \u{1F64F}"
};
var en2 = {
  "section": "Phone access",
  "entryLabel": "Phone access",
  "closeDialog": "Close",
  "subtitle": "The phone shows this exact screen, live",
  "developer": "Developer: \u5C11\u5317\u6668 (shaobeichen)",
  "starAsk": "\u2B50 Drop a Star if it helped \u2014 it makes the author\u2019s day",
  "starCta": "\u2605 Give a Star",
  "restarted": "\u{1F504} Restarted",
  "ok": "Got it",
  "bgHint": "Running in the background (not attached to a terminal). To stop: {cmd}",
  // Version info (no auto update check): current version + latest GitHub release + update command
  "versionTitle": "Version info",
  "versionCurrentLabel": "Current",
  "versionGithubLabel": "GitHub latest",
  "versionGithubLoading": "Checking\u2026",
  "versionGithubFail": "Failed to fetch",
  "versionGithubOpen": "Open GitHub",
  "versionNewer": "(newer available)",
  "versionRefresh": "Re-check",
  "updateCmd": "Install / update to the latest version",
  "updateHint": "The plugin is named dsh-pocket-nas. If the old-named dsh-pocket is still installed, run dsh plugin --profile web remove dsh-pocket -w first, then the command above",
  "copy": "Copy",
  "copied": "Copied",
  "versionRestartHint": "v{ver} is on disk \u2014 restart dsh web to apply",
  "restarting": "Restarting\u2026",
  "restartNow": "\u{1F504} Restart dsh web now",
  "restartingDetail": "\u23F3 Restarting to apply (usually 10-30s) \xB7 {s}s elapsed",
  "lanTitle": "\u{1F4F6} LAN (same Wi-Fi)",
  "lanHint": "Scan to open once your phone is on the same Wi-Fi",
  "lanAddress": "LAN address",
  "lanAddressAuto": "Auto (recommended)",
  "lanAddressHint": "Advanced option: usually no change needed; select manually when accessing through Tailscale/VPN",
  "lanPin": "LAN access PIN",
  "on": "On",
  "off": "Off",
  "lanPinValue": "\u{1F510} PIN: {pin} (required on the phone; separate from the public PIN)",
  "lanPinCustomValue": "\u{1F510} PIN: {pin} (custom; required on the phone)",
  "refresh": "Refresh",
  "customize": "Customize",
  "customizing": "New PIN (8\u201364 chars, letters/digits): ",
  "save": "Save",
  "cancel": "Cancel",
  "pinInvalid": "PIN must be 8\u201364 characters (letters and digits only)",
  // Reveal toggle / copy failure feedback
  "show": "Show",
  "hide": "Hide",
  "copyFail": "Copy failed",
  // Public-tunnel disclaimer: confirm button label (verb + object)
  "confirmEnable": "Confirm & enable",
  "pinCustomHint": "custom PINs are not rotated on tunnel start",
  "lanPinOff": "\u{1F513} PIN off \u2014 scan & go, no PIN (LAN devices only; public still requires PIN)",
  "lanStarting": "Proxy starting\u2026",
  "wanTitle": "\u{1F310} Anywhere (public)",
  "wanHint": "Scan from any network (the URL changes on every restart)",
  "wanPin": "\u{1F510} PIN: {pin} (changes each time the tunnel is enabled; required on the phone)",
  "wanPinCustom": "\u{1F510} PIN: {pin} (custom \u2014 not rotated on tunnel start)",
  "stopTunnel": "Stop",
  "enable": "Enable anywhere",
  "opening": "Enabling\u2026",
  "disclaimerTitle": "\u26A0\uFE0F Security disclaimer",
  "disclaimerBody": "Enabling public access exposes this computer\u2019s DSH (which can execute code) to the internet. Anyone with the public link and PIN can reach \u2014 and operate \u2014 your computer. Please confirm: \u2460 use a strong custom PIN or keep the auto-generated one safe; \u2461 turn public access OFF as soon as you\u2019re done; \u2462 on a corporate/classified network, confirm compliance first.",
  "disclaimerAgree": "I understand and agree",
  "disclaimerHint": 'Check "I understand" before enabling public access',
  "downloading": "\u23F3 Downloading cloudflared (first run ~20-50MB, usually 1-2 min; instant afterward) \xB7 {s}s elapsed",
  "connecting": "\u23F3 Connecting to Cloudflare edge (usually 5-30s) \xB7 {s}s elapsed{suffix}",
  "slowHint": " \u2014 taking long? Check for a proxy/VPN (e.g., Clash TUN)",
  "error": "\u274C Failed to enable: {detail} (you can retry; for proxy/VPN issues see the README)",
  "unknownError": "unknown error",
  // NAS reverse tunnel (frp)
  "frpTitle": "\u{1F3E0} NAS reverse tunnel (self-hosted, faster in CN)",
  "frpHint": 'Publishes this machine\u2019s proxy to your own NAS via frp: the phone opens the NAS domain to reach the Mac \u2014 fixed URL, direct route, no third-party edge. Deploy frps + a reverse proxy on the NAS first (see "copy deploy template")',
  "frpServerAddr": "NAS address",
  "frpServerAddrPlaceholder": "hostname or IP, e.g. nas.example.com",
  "frpServerPort": "Server port",
  "frpRemotePort": "Forward port",
  "frpToken": "Connection token",
  "frpTokenShow": "Show token",
  "frpTokenHide": "Hide token",
  "frpTokenPlaceholder": "same as frps.toml token (min 8 chars)",
  "frpTls": "TLS transport",
  "frpTlsHint": "requires transport.tls.force on the frps side, or the connection fails",
  "frpSave": "Save config",
  "frpSaved": "\u2705 Saved",
  "frpStart": "Start tunnel",
  "frpStop": "Stop tunnel",
  "frpStarting": "Starting\u2026",
  "frpConfigureFirst": "Set the NAS address and token first, then save",
  "frpStateIdle": "Not started",
  "frpStateDownloading": "\u23F3 Downloading frpc (first run ~10MB) \xB7 {s}s elapsed",
  "frpStateConnecting": "\u23F3 Connecting to NAS frps (usually seconds) \xB7 {s}s elapsed",
  "frpStateReady": "\u2705 Tunnel ready \xB7 open https://your-NAS-domain on the phone (the PIN is the LAN access PIN)",
  "frpStateError": "\u274C {detail}",
  "frpCopyCompose": "\u{1F4CB} Copy NAS deploy template (docker-compose)",
  "frpCopied": "\u2705 Copied to clipboard (frps + caddy; open ports 443/80/7000 and point your domain at the NAS)",
  "frpLog": "View log",
  "frpNoToken": "No token set",
  "lanAccess": "LAN access",
  "lanDisabledHint": '\u{1F512} LAN access is off \u2014 the QR code and link are unavailable (public access is unaffected). Tap "On" to restore.',
  "lanToggleTitleOff": "Turn off LAN access",
  "lanToggleBodyOff": "Once off, phones on the same Wi-Fi can no longer scan to connect (the LAN QR code and link stop working immediately). Public access is unaffected. Turn it off?",
  "lanToggleTitleOn": "Turn on LAN access",
  "lanToggleBodyOn": "Once on, phones on the same Wi-Fi can scan to connect (a LAN PIN is required by default). Turn it on?",
  "confirm": "Confirm",
  "resetFactory": "\u{1F9F9} Factory reset",
  "resetGo": "Reset",
  "resetIntro": "Temporary fallback when settings break: clear local config and re-roll random PINs (DSH sessions, models and plugin config are untouched)",
  "resetTitle": "\u26A0\uFE0F Confirm factory reset?",
  "resetBody": "This clears and restores defaults:\n\u2460 Switches: access PIN on, LAN address auto\n\u2461 Public: mode back to random URL, Tunnel Token and fixed domain cleared, and any running tunnel is stopped\n\u2462 NAS reverse tunnel: server address/port/connect token cleared, and any running NAS tunnel is stopped\n\u2463 PINs: both public and LAN become new random 8-digit PINs (old ones stop working; the phone must re-enter)\n\nYour DSH sessions, models and plugin config are untouched. This cannot be undone.",
  "resetConfirm": "Reset",
  "resetDone": "\u2705 Factory reset done: settings cleared and PINs re-rolled (re-enter the PIN on your phone)",
  "resetFailed": "\u274C Reset failed \u2014 please retry",
  "feedback": "\u{1F64F} Questions? Open an issue on GitHub"
};

// client/index.jsx
var name = "dsh-pocket-nas";
var inject = ["slots", "connection", "layout", "locale", "sessionLogDownload"];
var UPDATE_CMD = "dsh plugin --profile web update dsh-pocket-nas --latest -w";
var FRP_COMPOSE_TEMPLATE = `# dsh-pocket-nas NAS \u7AEF\u90E8\u7F72\uFF08\u4EC5 frps\uFF09
# \u7528\u6CD5\uFF1A\u653E\u5230 NAS \u7684 docker \u76EE\u5F55 \u2192 docker compose up -d
# \u6B65\u9AA4\uFF1A
#   1. frps.toml \u7684 token \u6539\u4E3A openssl rand -hex 16 \u751F\u6210\u7684\u503C\uFF08\u4E0E\u8BBE\u7F6E\u9875\u4E00\u81F4\uFF09
#   2. \u53CD\u4EE3\u5165\u53E3\u7528\u4F60 NAS \u4E0A\u73B0\u6709\u7684\u5DE5\u5177\uFF08lucky / \u7FA4\u6656\u81EA\u5E26\u53CD\u5411\u4EE3\u7406 / nginx \u7B49\uFF09\uFF1A
#      \u65B0\u589E\u89C4\u5219\u300C\u524D\u7AEF https://dsh.\u4F60\u7684\u57DF\u540D.com \u2192 \u540E\u7AEF http://127.0.0.1:7001\u300D\uFF0C
#      \u52A1\u5FC5\u5F00\u542F WebSocket \u652F\u6301\uFF0C\u8BC1\u4E66\u7528 Let's Encrypt\uFF0880 \u88AB\u5360\u65F6\u9009 DNS \u9A8C\u8BC1\uFF09
#   3. \u9632\u706B\u5899\u653E\u884C 443/80\uFF08\u53CD\u4EE3\u5DE5\u5177\uFF09\u548C 7000\uFF08frps \u63A7\u5236\u7AEF\u53E3\uFF09\uFF1BSSH \u4E0D\u9700\u8981\u5F00\u653E
# docker-compose.yml
services:
  frps:
    image: snowdreamtech/frps:0.71.0-alpine
    container_name: frps
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./frps.toml:/etc/frp/frps.toml
# frps.toml
bindPort = 7000
auth.method = "token"
auth.token = "\u6362\u6210\u4F60\u7684\u957F\u968F\u673A\u4E32"
proxyBindAddr = "127.0.0.1"
allowPorts = [{ start = 7001, end = 7010 }]
`;
function fmt(t, key, vars) {
  let s = t(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = String(s).split(`{${k}}`).join(String(v));
    }
  }
  return s;
}
var styles = {
  card: { background: "var(--dsw-alias-bg-layer-1,#fff)", border: "1px solid var(--dsw-alias-border-l2,#e5e7eb)", borderRadius: 12, padding: "16px 20px", maxWidth: 480 },
  block: { borderTop: "1px solid var(--dsw-alias-border-l2,#e5e7eb)", marginTop: 16, paddingTop: 16 },
  muted: { color: "var(--dsw-alias-label-tertiary,#8b93a1)", fontSize: 12, lineHeight: 1.5 },
  code: { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, wordBreak: "break-all", margin: "6px 0 10px", color: "var(--dsw-alias-label-primary,inherit)" },
  // 主按钮：官方 md 胶囊形（36px）
  primary: { font: "inherit", cursor: "pointer", border: "none", background: "var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary,#4f6ef7))", color: "var(--dsw-alias-label-primary-foreground, #fff)", height: 36, padding: "0 16px", borderRadius: 999, fontSize: 13, fontWeight: 500, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  // 次级按钮：官方 outline/ghost 胶囊形
  btn: { font: "inherit", cursor: "pointer", border: "1px solid var(--dsw-alias-button-ghost-active-border, var(--dsw-alias-border-l2,#d1d5db))", background: "var(--dsw-alias-bg-layer-1,#fff)", color: "var(--dsw-alias-label-primary,inherit)", height: 36, padding: "0 16px", borderRadius: 999, fontSize: 13, display: "inline-flex", alignItems: "center", justifyContent: "center" },
  qr: { width: 220, height: 220, borderRadius: 10, border: "1px solid var(--dsw-alias-border-l2,#e5e7eb)", margin: "8px 0" },
  warn: { color: "var(--dsw-alias-state-warn-primary,#b45309)", fontSize: 12, lineHeight: 1.5 }
};
var POCKET_UI_CSS = `
/* \u4FA7\u8FB9\u680F\u5165\u53E3\uFF08\u5BBD\u884C + \u6536\u8D77\u540E\u7684\u5706\u5F62 rail \u90FD\u7528\u540C\u4E00\u94A9\u5B50\uFF09 */
[data-dsh-pocket-entry] {
  transition: background var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease);
}
[data-dsh-pocket-entry]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)) !important;
}
[data-dsh-pocket-entry]:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f6ef7);
  outline-offset: -2px;
}
/* \u8BBE\u7F6E\u9875\u63A7\u4EF6\u72B6\u6001 */
button[data-dshp] {
  transition:
    background var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease),
    color var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease),
    opacity var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease);
}
button[data-dshp="primary"]:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill, #4f6ef7)) !important;
}
button[data-dshp="primary"]:disabled { opacity: .5 !important; cursor: default; }
button[data-dshp="ghost"]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)) !important;
}
button[data-dshp="ghost"]:disabled {
  color: var(--dsw-alias-label-dimmed, #9aa1ac) !important;
  cursor: default;
}
input[data-dshp-field], select[data-dshp-field] {
  transition: border-color var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease);
}
input[data-dshp-field]:focus, select[data-dshp-field]:focus {
  outline: none;
  border-color: var(--dsw-alias-state-business-primary, #4f6ef7) !important;
}
button[data-dshp]:focus-visible, button[data-dshp-toggle]:focus-visible, [data-dshp-link]:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f6ef7);
  outline-offset: 1px;
}
/* \u5BF9\u8BDD\u6846\u5165\u573A\uFF1A\u906E\u7F69\u6DE1\u5165 + \u9762\u677F\u8F7B\u5FAE\u4E0A\u6D6E\uFF0Creduced-motion \u76F4\u63A5\u5173\u95ED */
@keyframes dsh-pocket-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dsh-pocket-pop {
  from { opacity: 0; transform: translateY(10px) scale(.985); }
  to { opacity: 1; transform: none; }
}
[data-dsh-pocket-overlay] { animation: dsh-pocket-fade .15s linear both; }
[data-dsh-pocket-panel] { animation: dsh-pocket-pop .18s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) {
  [data-dsh-pocket-overlay], [data-dsh-pocket-panel] { animation: none; }
}
`;
var copyText2 = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  } catch {
    return false;
  }
};
function PocketSettingsTab({ rpcCall, t }) {
  const [status, setStatus] = (0, import_react2.useState)(null);
  const [busy, setBusy] = (0, import_react2.useState)(false);
  const [error, setError] = (0, import_react2.useState)(null);
  const [tunnelState, setTunnelState] = (0, import_react2.useState)(null);
  const [restartNotice, setRestartNotice] = (0, import_react2.useState)(false);
  const [versionInfo, setVersionInfo] = (0, import_react2.useState)({ current: null, loaded: null, githubLatest: null, githubUrl: null, loading: true, failed: false });
  const tagVersion = versionInfo.githubLatest ?? versionInfo.current;
  const installCmd = tagVersion ? `dsh plugin --profile web add github:IronManCantFix/dsh-pocket#v${tagVersion} -w` : UPDATE_CMD;
  const [restartState, setRestartState] = (0, import_react2.useState)(null);
  const [isDesktop, setIsDesktop] = (0, import_react2.useState)(false);
  const [now, setNow] = (0, import_react2.useState)(Date.now());
  const [frpForm, setFrpForm] = (0, import_react2.useState)(null);
  const [frpSaved, setFrpSaved] = (0, import_react2.useState)(false);
  const [frpBusy, setFrpBusy] = (0, import_react2.useState)(false);
  const [frpError, setFrpError] = (0, import_react2.useState)(null);
  const [frpShowToken, setFrpShowToken] = (0, import_react2.useState)(false);
  const [lanToggleOpen, setLanToggleOpen] = (0, import_react2.useState)(null);
  const requestLanToggle = (on) => setLanToggleOpen(on);
  const confirmLanToggle = async () => {
    const on = lanToggleOpen;
    setLanToggleOpen(null);
    if (on === null) return;
    try {
      const r = await call(POCKET_ENDPOINTS.lanSetEnabled, { on });
      setStatus((st) => ({ ...st, lanEnabled: r.lanEnabled }));
    } catch (err) {
      setError(err.message);
    }
  };
  const [resetOpen, setResetOpen] = (0, import_react2.useState)(false);
  const [toast, setToast] = (0, import_react2.useState)(null);
  const toastTimerRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => () => clearTimeout(toastTimerRef.current), []);
  const showToast = (text) => {
    setToast(text);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  };
  const doFactoryReset = async () => {
    setResetOpen(false);
    setBusy(true);
    setError(null);
    try {
      setStatus(await call(POCKET_ENDPOINTS.pocketReset, { confirm: true }));
      setCustomPin(null);
      setFrpForm(null);
      setFrpError(null);
      showToast(t("resetDone"));
    } catch (err) {
      setError(err.message);
      showToast(t("resetFailed"));
    } finally {
      setBusy(false);
    }
  };
  const [copied, setCopied] = (0, import_react2.useState)(null);
  const copiedTimerRef = (0, import_react2.useRef)(null);
  (0, import_react2.useEffect)(() => () => clearTimeout(copiedTimerRef.current), []);
  const copyWithFeedback = async (key, text) => {
    clearTimeout(copiedTimerRef.current);
    const ok = await copyText2(text);
    setCopied(ok ? key : `!${key}`);
    copiedTimerRef.current = setTimeout(() => setCopied(null), ok ? 2500 : 3e3);
  };
  (0, import_react2.useEffect)(() => {
    const t2 = setInterval(() => setNow(Date.now()), 1e3);
    return () => clearInterval(t2);
  }, []);
  const elapsed = (startedAt) => startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1e3)) : 0;
  const call = async (endpoint, payload) => {
    const res = await rpcCall(endpoint, payload);
    if (!res?.ok) throw new Error(res?.error?.message ?? "RPC failed");
    return res.value;
  };
  const load = async () => {
    try {
      const s = await call(POCKET_ENDPOINTS.status, {});
      setStatus(s);
      setTunnelState(s.tunnelState ?? null);
      if (s.desktop) setIsDesktop(true);
      if (s.restartNotice) {
        setRestartNotice(true);
        if (!sessionStorage.getItem("dshp-auto-reloaded")) {
          sessionStorage.setItem("dshp-auto-reloaded", "1");
          setTimeout(() => {
            try {
              location.reload();
            } catch {
            }
          }, 2e3);
        }
      }
    } catch {
    }
  };
  (0, import_react2.useEffect)(() => {
    load();
    const t2 = setInterval(load, 3e3);
    return () => clearInterval(t2);
  }, []);
  (0, import_react2.useEffect)(() => {
    if (frpForm === null && status?.frpConfig) {
      setFrpForm({ ...status.frpConfig, token: status.frpToken ?? "" });
    }
  }, [status, frpForm]);
  const saveFrp = async () => {
    setFrpBusy(true);
    setFrpError(null);
    try {
      const r = await call(POCKET_ENDPOINTS.frpConfigSet, {
        serverAddr: frpForm.serverAddr,
        serverPort: Number(frpForm.serverPort),
        remotePort: Number(frpForm.remotePort),
        tls: frpForm.tls === true,
        token: String(frpForm.token ?? "").trim() || void 0
      });
      if (typeof r?.token === "string" && r.token) {
        setFrpForm((f) => ({ ...f, token: r.token }));
      }
      setFrpSaved(true);
      setTimeout(() => setFrpSaved(false), 2500);
      await load();
    } catch (err) {
      setFrpError(err.message);
    } finally {
      setFrpBusy(false);
    }
  };
  const startFrp = async () => {
    setFrpBusy(true);
    setFrpError(null);
    try {
      setStatus(await call(POCKET_ENDPOINTS.frpStart, {}));
    } catch (err) {
      setFrpError(err.message);
    } finally {
      setFrpBusy(false);
    }
  };
  const stopFrp = async () => {
    try {
      setStatus(await call(POCKET_ENDPOINTS.frpStop, {}));
    } catch {
    }
  };
  const copyFrpCompose = async () => {
    await copyWithFeedback("frp", FRP_COMPOSE_TEMPLATE);
  };
  (0, import_react2.useEffect)(() => {
    try {
      sessionStorage.removeItem("dshp-auto-reloaded");
    } catch {
    }
  }, []);
  const loadVersion = async () => {
    try {
      const v = await call(POCKET_ENDPOINTS.version, {});
      const gh = v?.githubLatest ?? null;
      setVersionInfo({
        current: v?.current ?? null,
        loaded: v?.loaded ?? null,
        githubLatest: gh?.version ?? null,
        githubUrl: gh?.url ?? "https://github.com/IronManCantFix/dsh-pocket/releases/latest",
        loading: false,
        failed: false
      });
    } catch {
      setVersionInfo((prev) => ({ ...prev, loading: false, failed: true }));
    }
  };
  (0, import_react2.useEffect)(() => {
    loadVersion();
  }, []);
  const restartPocket = async () => {
    setRestartState({ restarting: true, startedAt: Date.now() });
    try {
      await Promise.race([
        call(POCKET_ENDPOINTS.restart, {}),
        new Promise((_, rej) => setTimeout(() => rej(new Error("restart requested (no reply within 3s)")), 3e3))
      ]);
      setRestartState((s) => ({ ...s, restarting: true }));
    } catch (err) {
      const msg = String(err?.message ?? "");
      if (/connection|socket|fetch|network|abort|cancelled|ECONN|disconnect|closed|timeout/i.test(msg)) {
        setRestartState((s) => ({ ...s, restarting: true }));
        return;
      }
      setRestartState({ restarting: false, startedAt: null });
    }
  };
  const [disclaimerOpen, setDisclaimerOpen] = (0, import_react2.useState)(false);
  const [disclaimerChecked, setDisclaimerChecked] = (0, import_react2.useState)(false);
  const doStartTunnel = async () => {
    setBusy(true);
    setError(null);
    setTunnelState({ phase: "starting", detail: "\u6B63\u5728\u5F00\u542F\u2026", startedAt: Date.now() });
    try {
      setStatus(await call(POCKET_ENDPOINTS.tunnelStart, { disclaimer: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const startTunnel = () => {
    setDisclaimerChecked(false);
    setDisclaimerOpen(true);
  };
  const confirmDisclaimer = () => {
    if (!disclaimerChecked) return;
    setDisclaimerOpen(false);
    doStartTunnel();
  };
  const stopTunnel = async () => {
    try {
      setStatus(await call(POCKET_ENDPOINTS.tunnelStop, {}));
    } catch {
    }
  };
  const refreshLanPin = async () => {
    try {
      const r = await call(POCKET_ENDPOINTS.lanTokenRefresh, {});
      setStatus((s) => ({ ...s, lanToken: r.lanToken }));
    } catch {
    }
  };
  const setLanAuth = async (on) => {
    try {
      const r = await call(POCKET_ENDPOINTS.lanAuthSetEnabled, { on });
      setStatus((s) => ({ ...s, lanAuthEnabled: r.lanAuthEnabled }));
    } catch {
    }
  };
  const setLanAddress = async (ip) => {
    try {
      setStatus(await call(POCKET_ENDPOINTS.lanSetOverride, { ip }));
    } catch (err) {
      setError(err.message);
    }
  };
  const [customPin, setCustomPin] = (0, import_react2.useState)(null);
  const saveCustomPin = async (which) => {
    try {
      const r = await call(POCKET_ENDPOINTS.pinSetCustom, { which, value: customPin?.value ?? "" });
      setStatus((s) => ({
        ...s,
        accessToken: which === "public" ? r.pin : s.accessToken,
        lanToken: which === "lan" ? r.pin : s.lanToken,
        publicPinCustom: which === "public" ? true : s.publicPinCustom,
        lanPinCustom: which === "lan" ? true : s.lanPinCustom
      }));
      setCustomPin(null);
    } catch (err) {
      setCustomPin((c) => ({ ...c, err: err.message }));
    }
  };
  const errText = (msg) => {
    const s = String(msg ?? "");
    const i = s.indexOf(" | ");
    if (i < 0) return s;
    return (t("ok") === zh2.ok ? s.slice(0, i) : s.slice(i + 3)).trim();
  };
  const customPinRow = (which) => (0, import_react2.createElement)(
    "div",
    { style: { marginTop: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", lineHeight: 1.5 } },
    t("customizing"),
    (0, import_react2.createElement)("input", {
      "data-dshp-field": "",
      style: { width: 130, margin: "0 6px", padding: "4px 8px", fontSize: 14, letterSpacing: 1, textAlign: "center", border: "1px solid var(--dsw-alias-border-l2,#d1d5db)", borderRadius: 6, outline: "none" },
      type: "password",
      minLength: 8,
      maxLength: 64,
      value: customPin?.value ?? "",
      autoFocus: true,
      onChange: (e) => setCustomPin((c) => ({ ...c, value: e.target.value.replace(/[^a-zA-Z0-9]/g, ""), err: null })),
      onKeyDown: (e) => {
        if (e.key === "Enter") saveCustomPin(which);
        if (e.key === "Escape") setCustomPin(null);
      }
    }),
    (0, import_react2.createElement)("button", { style: { ...styles.btn, height: 26, padding: "0 10px", fontSize: 12, marginLeft: 2 }, "data-dshp": "ghost", onClick: () => saveCustomPin(which) }, t("save")),
    (0, import_react2.createElement)("button", { style: { ...styles.btn, height: 26, padding: "0 10px", fontSize: 12 }, "data-dshp": "ghost", onClick: () => setCustomPin(null) }, t("cancel")),
    customPin?.err ? (0, import_react2.createElement)("div", { style: { color: "var(--dsw-alias-state-error-primary,#dc2626)", marginTop: 4 } }, errText(customPin.err)) : null
  );
  const customBtn = (which) => (0, import_react2.createElement)("button", { style: { ...styles.btn, height: 26, padding: "0 10px", fontSize: 12, marginLeft: 8 }, "data-dshp": "ghost", onClick: () => setCustomPin({ which, value: "", err: null }) }, t("customize"));
  const lanUrl = status?.lanUrl;
  const tunnelUrl = status?.tunnelUrl;
  const tunnelPhase = tunnelState?.phase ?? "idle";
  const tunnelStarting = ["downloading", "starting", "registering"].includes(tunnelPhase);
  const tunnelStateDetail = tunnelState?.detail ?? "";
  const tunnelStateStarted = tunnelState?.startedAt ?? null;
  const frpPhase = status?.frpState?.phase ?? "idle";
  const frpDetail = status?.frpState?.detail ?? "";
  const frpStarted = status?.frpState?.startedAt ?? null;
  const frpStatusText = () => {
    if (frpPhase === "downloading") return fmt(t, "frpStateDownloading", { s: elapsed(frpStarted) });
    if (frpPhase === "starting" || frpPhase === "connecting") return fmt(t, "frpStateConnecting", { s: elapsed(frpStarted) });
    if (frpPhase === "ready") return t("frpStateReady");
    if (frpPhase === "error") return fmt(t, "frpStateError", { detail: frpDetail || t("unknownError") });
    return t("frpStateIdle");
  };
  return (0, import_react2.createElement)(
    "div",
    { style: styles.card },
    // 对话框头部已写明「手机访问」，卡片内不再重复标题，只留一句副标题
    (0, import_react2.createElement)(
      "div",
      { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
      (0, import_react2.createElement)("div", { style: styles.muted }, t("subtitle")),
      (0, import_react2.createElement)(
        "div",
        { style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary,#8b93a1)", textAlign: "right" } },
        (0, import_react2.createElement)("div", { style: { whiteSpace: "nowrap" } }, t("developer")),
        (0, import_react2.createElement)("div", { style: { whiteSpace: "nowrap" } }, t("starAsk")),
        (0, import_react2.createElement)(
          "a",
          { href: "https://github.com/IronManCantFix/dsh-pocket", target: "_blank", rel: "noreferrer", style: { color: "var(--dsw-alias-brand-primary,#4f6ef7)", fontSize: 12, lineHeight: 1.6, textDecoration: "underline" } },
          t("starCta")
        )
      )
    ),
    // 重启后提示（进程在后台运行，停止方法）——整框浅底色，不用侧边色条
    !isDesktop && restartNotice ? (0, import_react2.createElement)(
      "div",
      { style: { ...styles.block, border: "1px solid var(--dsw-alias-border-l2,#e5e7eb)", borderRadius: 8, background: "var(--dsw-alias-bg-layer-2,#f3f4f6)", padding: "10px 12px" } },
      (0, import_react2.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
        (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 13 } }, t("restarted")),
        (0, import_react2.createElement)("button", { style: styles.btn, "data-dshp": "ghost", onClick: () => setRestartNotice(false) }, t("ok"))
      ),
      (0, import_react2.createElement)("div", { style: styles.muted, marginTop: 4, wordBreak: "break-all" }, fmt(t, "bgHint", { cmd: status?.killHint ?? `lsof -ti :${status?.dshPort ?? 3080} | xargs kill -9` }))
    ) : null,
    // 版本信息（桌面端/手机端都显示）：当前版本 + GitHub 最新版本 + 更新命令
    // 不自动检测更新、不弹更新横幅；GitHub 版本由服务端查询（失败静默降级，显示「获取失败」）。
    // 磁盘已更新未重启时（仅非桌面端）提示重启生效——桌面端更新/重启由 DSH Desktop 管理。
    (0, import_react2.createElement)(
      "div",
      { style: styles.block },
      (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 13 } }, t("versionTitle")),
      (0, import_react2.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8, fontSize: 12, lineHeight: 1.6 } },
        (0, import_react2.createElement)("span", { style: { color: "var(--dsw-alias-label-secondary,#6b7280)" } }, t("versionCurrentLabel")),
        (0, import_react2.createElement)("span", { style: { fontFamily: "monospace" } }, versionInfo.current ? `v${versionInfo.current}` : "\u2014"),
        (0, import_react2.createElement)("span", { style: { color: "var(--dsw-alias-label-secondary,#6b7280)", marginLeft: 12 } }, t("versionGithubLabel")),
        versionInfo.loading ? (0, import_react2.createElement)("span", { style: styles.muted }, t("versionGithubLoading")) : !versionInfo.githubLatest || versionInfo.failed ? (0, import_react2.createElement)(
          "span",
          { style: { color: "var(--dsw-alias-state-error-primary,#dc2626)" } },
          t("versionGithubFail"),
          (0, import_react2.createElement)("a", { href: versionInfo.githubUrl ?? "https://github.com/IronManCantFix/dsh-pocket/releases/latest", target: "_blank", rel: "noreferrer", style: { color: "var(--dsw-alias-brand-primary,#4f6ef7)", marginLeft: 6 } }, t("versionGithubOpen"))
        ) : (0, import_react2.createElement)(
          "span",
          null,
          (0, import_react2.createElement)("a", {
            href: versionInfo.githubUrl,
            target: "_blank",
            rel: "noreferrer",
            style: {
              fontFamily: "monospace",
              color: compareVersions(versionInfo.githubLatest, versionInfo.current) > 0 ? "var(--dsw-alias-state-warn-primary,#b45309)" : "var(--dsw-alias-brand-primary,#4f6ef7)"
            }
          }, `v${versionInfo.githubLatest}`),
          compareVersions(versionInfo.githubLatest, versionInfo.current) > 0 ? (0, import_react2.createElement)("span", { style: { color: "var(--dsw-alias-state-warn-primary,#b45309)", marginLeft: 6 } }, t("versionNewer")) : null
        ),
        (0, import_react2.createElement)("button", {
          style: { ...styles.btn, height: 26, padding: "0 8px", fontSize: 12, marginLeft: "auto" },
          "data-dshp": "ghost",
          onClick: () => {
            setVersionInfo((v) => ({ ...v, loading: true, failed: false }));
            loadVersion();
          },
          disabled: versionInfo.loading,
          title: t("versionRefresh"),
          "aria-label": t("versionRefresh")
        }, typeof import_dsh_client_ui_primitives4.IconRefreshOutline16 === "function" ? (0, import_react2.createElement)(import_dsh_client_ui_primitives4.IconRefreshOutline16, { size: 14 }) : "\u21BB")
      ),
      (0, import_react2.createElement)("div", { style: { color: "var(--dsw-alias-label-secondary,#6b7280)", marginTop: 10, fontSize: 12 } }, t("updateCmd")),
      (0, import_react2.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 4 } },
        (0, import_react2.createElement)("code", { style: { ...styles.code, margin: 0, flex: 1, background: "var(--dsw-alias-bg-layer-2,#f3f4f6)", padding: "6px 8px", borderRadius: 6 } }, installCmd),
        (0, import_react2.createElement)(
          "button",
          {
            style: { ...styles.btn, height: 26, padding: "0 10px", fontSize: 12, flex: "none" },
            "data-dshp": "ghost",
            onClick: () => copyWithFeedback("cmd", installCmd)
          },
          copied === "cmd" ? t("copied") : copied === "!cmd" ? t("copyFail") : t("copy")
        )
      ),
      (0, import_react2.createElement)("div", { style: styles.muted, marginTop: 6, fontSize: 12 }, t("updateHint")),
      // 磁盘已更新未重启（仅非桌面端提示重启生效）
      !isDesktop && versionInfo.current && versionInfo.loaded && compareVersions(versionInfo.current, versionInfo.loaded) > 0 ? (0, import_react2.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 } },
        (0, import_react2.createElement)("div", { style: { ...styles.warn, margin: 0, flex: 1 } }, fmt(t, "versionRestartHint", { ver: versionInfo.current })),
        (0, import_react2.createElement)("button", {
          style: { ...styles.primary, height: 30, padding: "0 14px", fontSize: 12, flex: "none" },
          "data-dshp": "primary",
          onClick: restartPocket,
          disabled: restartState?.restarting
        }, restartState?.restarting ? fmt(t, "restartingDetail", { s: elapsed(restartState.startedAt) }) : t("restartNow"))
      ) : null
    ),
    // NAS 反向隧道（frp）：自建入口——本插件主打 NAS 场景，排在局域网/公网之前；
    // 手机访问 NAS 域名即达电脑，国内直连最快
    (0, import_react2.createElement)(
      "div",
      { style: styles.block },
      (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 13 } }, t("frpTitle")),
      (0, import_react2.createElement)("div", { style: { ...styles.muted, marginTop: 4 } }, t("frpHint")),
      frpForm ? (0, import_react2.createElement)(
        "div",
        { style: { marginTop: 10, display: "grid", gap: 8 } },
        (0, import_react2.createElement)(
          "label",
          { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", display: "grid", gap: 4 } },
          t("frpServerAddr"),
          (0, import_react2.createElement)("input", {
            "data-dshp-field": "",
            style: { font: "inherit", height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2,#d1d5db)", background: "var(--dsw-alias-bg-layer-1,#fff)", color: "var(--dsw-alias-label-primary,inherit)" },
            type: "text",
            placeholder: t("frpServerAddrPlaceholder"),
            value: frpForm.serverAddr,
            onChange: (e) => setFrpForm((f) => ({ ...f, serverAddr: e.target.value }))
          })
        ),
        (0, import_react2.createElement)(
          "div",
          { style: { display: "flex", gap: 8 } },
          (0, import_react2.createElement)(
            "label",
            { style: { flex: 1, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", display: "grid", gap: 4 } },
            t("frpServerPort"),
            (0, import_react2.createElement)("input", {
              "data-dshp-field": "",
              style: { font: "inherit", height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2,#d1d5db)", background: "var(--dsw-alias-bg-layer-1,#fff)", color: "var(--dsw-alias-label-primary,inherit)" },
              type: "number",
              min: 1,
              max: 65535,
              value: frpForm.serverPort,
              onChange: (e) => setFrpForm((f) => ({ ...f, serverPort: e.target.value }))
            })
          ),
          (0, import_react2.createElement)(
            "label",
            { style: { flex: 1, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", display: "grid", gap: 4 } },
            t("frpRemotePort"),
            (0, import_react2.createElement)("input", {
              "data-dshp-field": "",
              style: { font: "inherit", height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2,#d1d5db)", background: "var(--dsw-alias-bg-layer-1,#fff)", color: "var(--dsw-alias-label-primary,inherit)" },
              type: "number",
              min: 1,
              max: 65535,
              value: frpForm.remotePort,
              onChange: (e) => setFrpForm((f) => ({ ...f, remotePort: e.target.value }))
            })
          )
        ),
        (0, import_react2.createElement)(
          "label",
          { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", display: "grid", gap: 4 } },
          t("frpToken"),
          (0, import_react2.createElement)(
            "div",
            { style: { position: "relative" } },
            (0, import_react2.createElement)("input", {
              "data-dshp-field": "",
              style: { font: "inherit", height: 30, width: "100%", boxSizing: "border-box", padding: "0 52px 0 8px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2,#d1d5db)", background: "var(--dsw-alias-bg-layer-1,#fff)", color: "var(--dsw-alias-label-primary,inherit)" },
              type: frpShowToken ? "text" : "password",
              placeholder: status?.frpHasToken && !frpForm.token ? `\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022 (${t("frpSaved")})` : t("frpTokenPlaceholder"),
              value: frpForm.token,
              onChange: (e) => setFrpForm((f) => ({ ...f, token: e.target.value }))
            }),
            // 明文切换：文字按钮（无障碍名称完整），不用表情符号当图标
            (0, import_react2.createElement)("button", {
              type: "button",
              "data-dshp": "ghost",
              title: frpShowToken ? t("frpTokenHide") : t("frpTokenShow"),
              "aria-label": frpShowToken ? t("frpTokenHide") : t("frpTokenShow"),
              onClick: () => setFrpShowToken((v) => !v),
              style: { position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", height: 20, padding: "0 6px", border: "none", background: "transparent", cursor: "pointer", fontSize: 12, lineHeight: 1, color: "var(--dsw-alias-label-secondary,#8b93a1)", borderRadius: 6 }
            }, frpShowToken ? t("hide") : t("show"))
          )
        ),
        (0, import_react2.createElement)(
          "label",
          { style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)" } },
          (0, import_react2.createElement)("input", { type: "checkbox", checked: frpForm.tls === true, onChange: (e) => setFrpForm((f) => ({ ...f, tls: e.target.checked })) }),
          t("frpTls")
        ),
        (0, import_react2.createElement)("div", { style: { ...styles.muted, marginTop: -2 } }, t("frpTlsHint")),
        (0, import_react2.createElement)(
          "div",
          { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 2 } },
          (0, import_react2.createElement)("button", { style: { ...styles.btn, height: 30, padding: "0 12px", fontSize: 12 }, "data-dshp": "ghost", onClick: saveFrp, disabled: frpBusy }, frpSaved ? t("frpSaved") : t("frpSave")),
          status?.frpRunning ? (0, import_react2.createElement)("button", { style: { ...styles.btn, height: 30, padding: "0 12px", fontSize: 12 }, "data-dshp": "ghost", onClick: stopFrp }, t("frpStop")) : (0, import_react2.createElement)("button", {
            style: { ...styles.primary, height: 30, padding: "0 12px", fontSize: 12 },
            "data-dshp": "primary",
            onClick: startFrp,
            disabled: frpBusy || !status?.frpConfig?.serverAddr || !status?.frpHasToken
          }, frpBusy ? t("frpStarting") : t("frpStart"))
        ),
        !status?.frpConfig?.serverAddr || !status?.frpHasToken ? (0, import_react2.createElement)("div", { style: { ...styles.warn, marginTop: 4 } }, t("frpConfigureFirst")) : null
      ) : (0, import_react2.createElement)("div", { style: { ...styles.muted, marginTop: 8 } }, t("frpConfigureFirst")),
      (0, import_react2.createElement)("div", { style: { marginTop: 8, fontSize: 12, lineHeight: 1.6 } }, frpStatusText()),
      frpError ? (0, import_react2.createElement)("div", { style: { color: "var(--dsw-alias-state-error-primary,#dc2626)", fontSize: 12, marginTop: 4 } }, `\u274C ${frpError}`) : null,
      (0, import_react2.createElement)(
        "div",
        { style: { marginTop: 10 } },
        (0, import_react2.createElement)(
          "button",
          { style: { ...styles.btn, height: 30, padding: "0 12px", fontSize: 12 }, "data-dshp": "ghost", onClick: copyFrpCompose },
          copied === "frp" ? t("frpCopied") : copied === "!frp" ? t("copyFail") : t("frpCopyCompose")
        )
      )
    ),
    // 局域网
    (0, import_react2.createElement)(
      "div",
      { style: styles.block },
      (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 13 } }, t("lanTitle")),
      // 局域网访问总开关：关闭后二维码/链接直接失效（公网不受影响）
      (0, import_react2.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
        (0, import_react2.createElement)("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)" } }, t("lanAccess")),
        (0, import_react2.createElement)("button", {
          "data-dshp-toggle": "",
          style: { ...styles.btn, height: 28, padding: "0 12px", fontSize: 12, fontWeight: status?.lanEnabled !== false ? 600 : 400, background: status?.lanEnabled !== false ? "var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary,#4f6ef7))" : "var(--dsw-alias-bg-layer-1,#fff)", color: status?.lanEnabled !== false ? "var(--dsw-alias-label-primary-foreground, #fff)" : "var(--dsw-alias-label-primary,inherit)" },
          onClick: () => requestLanToggle(true)
        }, t("on")),
        (0, import_react2.createElement)("button", {
          "data-dshp-toggle": "",
          style: { ...styles.btn, height: 28, padding: "0 12px", fontSize: 12, fontWeight: status?.lanEnabled === false ? 600 : 400, background: status?.lanEnabled === false ? "var(--dsw-alias-state-error-primary,#dc2626)" : "var(--dsw-alias-bg-layer-1,#fff)", color: status?.lanEnabled === false ? "#fff" : "var(--dsw-alias-label-primary,inherit)" },
          onClick: () => requestLanToggle(false)
        }, t("off"))
      ),
      status?.lanEnabled === false ? (0, import_react2.createElement)("div", { style: { marginTop: 8, fontSize: 12, color: "var(--dsw-alias-state-warn-primary,#b45309)", lineHeight: 1.5 } }, t("lanDisabledHint")) : lanUrl ? (0, import_react2.createElement)(
        "div",
        null,
        (0, import_react2.createElement)("img", { src: status.lanQr, alt: "LAN QR", style: styles.qr }),
        (0, import_react2.createElement)("div", { style: styles.code }, lanUrl),
        (0, import_react2.createElement)("div", { style: styles.muted }, t("lanHint")),
        (0, import_react2.createElement)(
          "label",
          { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)" } },
          t("lanAddress"),
          (0, import_react2.createElement)(
            "select",
            {
              "data-dshp-field": "",
              value: status?.lanIpOverride || "",
              onChange: (e) => setLanAddress(e.target.value),
              style: { font: "inherit", height: 30, padding: "0 8px", borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2,#d1d5db)", background: "var(--dsw-alias-bg-layer-1,#fff)", color: "var(--dsw-alias-label-primary,inherit)" }
            },
            (0, import_react2.createElement)("option", { value: "" }, t("lanAddressAuto")),
            (status?.lanCandidates || []).map((ip) => (0, import_react2.createElement)("option", { key: ip, value: ip }, ip))
          )
        ),
        (0, import_react2.createElement)("div", { style: { ...styles.muted, marginTop: 2 } }, t("lanAddressHint")),
        // 访问密码开关（issue #24）：默认开启；关闭后扫码直连（仅同一局域网设备可访问）
        (0, import_react2.createElement)(
          "div",
          { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 8 } },
          (0, import_react2.createElement)("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)" } }, t("lanPin")),
          (0, import_react2.createElement)("button", {
            "data-dshp-toggle": "",
            style: { ...styles.btn, height: 28, padding: "0 12px", fontSize: 12, fontWeight: status?.lanAuthEnabled !== false ? 600 : 400, background: status?.lanAuthEnabled !== false ? "var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary,#4f6ef7))" : "var(--dsw-alias-bg-layer-1,#fff)", color: status?.lanAuthEnabled !== false ? "var(--dsw-alias-label-primary-foreground, #fff)" : "var(--dsw-alias-label-primary,inherit)" },
            onClick: () => setLanAuth(true)
          }, t("on")),
          (0, import_react2.createElement)("button", {
            "data-dshp-toggle": "",
            style: { ...styles.btn, height: 28, padding: "0 12px", fontSize: 12, fontWeight: status?.lanAuthEnabled === false ? 600 : 400, background: status?.lanAuthEnabled === false ? "var(--dsw-alias-state-error-primary,#dc2626)" : "var(--dsw-alias-bg-layer-1,#fff)", color: status?.lanAuthEnabled === false ? "#fff" : "var(--dsw-alias-label-primary,inherit)" },
            onClick: () => setLanAuth(false)
          }, t("off"))
        ),
        status?.lanAuthEnabled !== false ? customPin?.which === "lan" ? customPinRow("lan") : (0, import_react2.createElement)(
          "div",
          { style: { marginTop: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", lineHeight: 1.5 } },
          fmt(t, status?.lanPinCustom ? "lanPinCustomValue" : "lanPinValue", { pin: status.lanToken }),
          (0, import_react2.createElement)("button", { style: { ...styles.btn, height: 26, padding: "0 10px", fontSize: 12, marginLeft: 8 }, "data-dshp": "ghost", onClick: refreshLanPin }, t("refresh")),
          customBtn("lan")
        ) : (0, import_react2.createElement)(
          "div",
          { style: { marginTop: 6, fontSize: 12, color: "var(--dsw-alias-state-warn-primary,#b45309)", lineHeight: 1.5 } },
          t("lanPinOff")
        )
      ) : (0, import_react2.createElement)("div", { style: styles.muted }, t("lanStarting"))
    ),
    // 公网
    (0, import_react2.createElement)(
      "div",
      { style: styles.block },
      (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 13 } }, t("wanTitle")),
      tunnelUrl ? (0, import_react2.createElement)(
        "div",
        null,
        (0, import_react2.createElement)("img", { src: status.tunnelQr, alt: "Tunnel QR", style: styles.qr }),
        (0, import_react2.createElement)("div", { style: styles.code }, tunnelUrl),
        (0, import_react2.createElement)("div", { style: styles.muted }, t("wanHint")),
        status.accessToken ? customPin?.which === "public" ? customPinRow("public") : (0, import_react2.createElement)(
          "div",
          { style: { marginTop: 6, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", lineHeight: 1.5 } },
          fmt(t, status?.publicPinCustom ? "wanPinCustom" : "wanPin", { pin: status.accessToken }),
          customBtn("public"),
          status?.publicPinCustom ? (0, import_react2.createElement)("div", { style: { marginTop: 2, fontSize: 11, color: "var(--dsw-alias-state-warn-primary,#b45309)" } }, t("pinCustomHint")) : null
        ) : null,
        (0, import_react2.createElement)("button", { style: styles.btn, "data-dshp": "ghost", onClick: stopTunnel }, t("stopTunnel"))
      ) : (0, import_react2.createElement)(
        "div",
        null,
        (0, import_react2.createElement)("button", { style: { ...styles.primary, margin: "8px 0" }, "data-dshp": "primary", onClick: startTunnel, disabled: busy || tunnelStarting }, busy ? t("opening") : t("enable")),
        tunnelStarting ? (0, import_react2.createElement)(
          "div",
          { style: { marginTop: 4, fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)" } },
          tunnelPhase === "downloading" ? fmt(t, "downloading", { s: elapsed(tunnelStateStarted) }) : fmt(t, "connecting", { s: elapsed(tunnelStateStarted), suffix: elapsed(tunnelStateStarted) > 30 ? t("slowHint") : "" })
        ) : tunnelPhase === "error" ? (0, import_react2.createElement)(
          "div",
          { style: { marginTop: 4, fontSize: 12, color: "var(--dsw-alias-state-error-primary,#dc2626)" } },
          fmt(t, "error", { detail: errText(tunnelStateDetail) || t("unknownError") })
        ) : null
      )
    ),
    error ? (0, import_react2.createElement)("div", { style: { color: "var(--dsw-alias-state-error-primary,#dc2626)", fontSize: 12, marginTop: 8 } }, `\u274C ${errText(error)}`) : null,
    // 安全免责声明弹框（issue #31）：每次开启公网访问前确认
    disclaimerOpen ? (0, import_react2.createElement)(
      "div",
      { role: "dialog", "aria-modal": true, "aria-label": t("disclaimerTitle"), style: { position: "fixed", inset: 0, zIndex: 1e4, background: "var(--dsw-alias-bg-mask-1, rgba(15,17,21,.55))", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
      (0, import_react2.createElement)(
        "div",
        { style: { background: "var(--dsw-alias-bg-layer-1,#fff)", borderRadius: 12, maxWidth: 420, width: "100%", padding: "20px 22px", boxShadow: "0 8px 32px rgba(0,0,0,.18)" } },
        (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 15, color: "var(--dsw-alias-state-warn-primary,#b45309)", marginBottom: 10 } }, t("disclaimerTitle")),
        (0, import_react2.createElement)("div", { style: { fontSize: 13, lineHeight: 1.7, color: "var(--dsw-alias-label-primary,inherit)" } }, t("disclaimerBody")),
        (0, import_react2.createElement)(
          "label",
          { style: { display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 13, cursor: "pointer" } },
          (0, import_react2.createElement)("input", { type: "checkbox", checked: disclaimerChecked, onChange: (e) => setDisclaimerChecked(e.target.checked), autoFocus: true, style: { width: 16, height: 16 } }),
          t("disclaimerAgree")
        ),
        (0, import_react2.createElement)(
          "div",
          { style: { display: "flex", gap: 8, marginTop: 16 } },
          (0, import_react2.createElement)("button", { style: { ...styles.btn, flex: 1 }, "data-dshp": "ghost", onClick: () => setDisclaimerOpen(false) }, t("cancel")),
          (0, import_react2.createElement)("button", {
            style: { ...styles.primary, flex: 1 },
            "data-dshp": "primary",
            disabled: !disclaimerChecked,
            onClick: confirmDisclaimer
          }, t("confirmEnable"))
        ),
        !disclaimerChecked ? (0, import_react2.createElement)("div", { style: { marginTop: 8, fontSize: 12, color: "var(--dsw-alias-state-error-primary,#dc2626)" } }, t("disclaimerHint")) : null
      )
    ) : null,
    // 恢复出厂设置（672b31b）：设置出问题时的兜底，放在最底部避免误触
    (0, import_react2.createElement)(
      "div",
      { style: styles.block },
      (0, import_react2.createElement)(
        "div",
        { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 } },
        (0, import_react2.createElement)("span", { style: { fontWeight: 600, fontSize: 13 } }, t("resetFactory")),
        (0, import_react2.createElement)("button", {
          style: { ...styles.btn, height: 28, padding: "0 12px", fontSize: 12, color: "var(--dsw-alias-state-error-primary,#dc2626)" },
          "data-dshp": "ghost",
          onClick: () => setResetOpen(true)
        }, t("resetGo"))
      ),
      (0, import_react2.createElement)("div", { style: { ...styles.muted, marginTop: 6 } }, t("resetIntro"))
    ),
    // 局域网访问开关确认弹框（切换时提醒影响范围）
    lanToggleOpen !== null ? (0, import_react2.createElement)(
      "div",
      { style: { position: "fixed", inset: 0, zIndex: 1e4, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
      (0, import_react2.createElement)(
        "div",
        { style: { background: "var(--dsw-alias-bg-layer-1,#fff)", borderRadius: 12, maxWidth: 400, width: "100%", padding: "20px 22px", boxShadow: "0 8px 32px rgba(0,0,0,.18)" } },
        (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 15, marginBottom: 10 } }, t(lanToggleOpen ? "lanToggleTitleOn" : "lanToggleTitleOff")),
        (0, import_react2.createElement)("div", { style: { fontSize: 13, lineHeight: 1.7, color: "var(--dsw-alias-label-primary,inherit)" } }, t(lanToggleOpen ? "lanToggleBodyOn" : "lanToggleBodyOff")),
        (0, import_react2.createElement)(
          "div",
          { style: { display: "flex", gap: 8, marginTop: 16 } },
          (0, import_react2.createElement)("button", { style: { ...styles.btn, flex: 1 }, onClick: () => setLanToggleOpen(null) }, t("cancel")),
          (0, import_react2.createElement)("button", { style: { ...styles.primary, flex: 1 }, onClick: confirmLanToggle }, t("confirm"))
        )
      )
    ) : null,
    // 恢复出厂设置确认弹框（必须二次确认；宿主侧也会再校验 payload.confirm）
    resetOpen ? (0, import_react2.createElement)(
      "div",
      { style: { position: "fixed", inset: 0, zIndex: 1e4, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 } },
      (0, import_react2.createElement)(
        "div",
        { style: { background: "var(--dsw-alias-bg-layer-1,#fff)", borderRadius: 12, maxWidth: 440, width: "100%", padding: "20px 22px", boxShadow: "0 8px 32px rgba(0,0,0,.18)" } },
        (0, import_react2.createElement)("div", { style: { fontWeight: 600, fontSize: 15, color: "var(--dsw-alias-state-warn-primary,#b45309)", marginBottom: 10 } }, t("resetTitle")),
        (0, import_react2.createElement)("div", { style: { fontSize: 13, lineHeight: 1.7, color: "var(--dsw-alias-label-primary,inherit)", whiteSpace: "pre-line" } }, t("resetBody")),
        (0, import_react2.createElement)(
          "div",
          { style: { display: "flex", gap: 8, marginTop: 16 } },
          (0, import_react2.createElement)("button", { style: { ...styles.btn, flex: 1 }, onClick: () => setResetOpen(false) }, t("cancel")),
          (0, import_react2.createElement)("button", { style: { ...styles.primary, flex: 1, background: "var(--dsw-alias-state-error-primary,#dc2626)" }, onClick: doFactoryReset }, t("resetConfirm"))
        )
      )
    ) : null,
    // 页面最底部：反馈入口
    (0, import_react2.createElement)(
      "div",
      { style: { ...styles.block, textAlign: "center" } },
      (0, import_react2.createElement)(
        "a",
        { href: "https://github.com/IronManCantFix/dsh-pocket/issues", target: "_blank", rel: "noreferrer", style: { fontSize: 12, color: "var(--dsw-alias-label-secondary,#6b7280)", textDecoration: "none" } },
        t("feedback")
      )
    ),
    // Toast：重置等操作的即时反馈（074744d，居中 + 收窄 280px 见 2bcaff0）：
    // 底部居中的胶囊在设置页滚动时会跑到可视区外，改成屏幕正中央 + 深色底。
    toast ? (0, import_react2.createElement)("div", {
      style: { position: "fixed", left: "50%", top: "50%", transform: "translate(-50%, -50%)", zIndex: 10001, width: "auto", maxWidth: 280, background: "rgba(17,24,39,.92)", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", fontSize: 13, lineHeight: 1.5, textAlign: "center", boxShadow: "0 8px 24px rgba(0,0,0,.22)" }
    }, toast) : null
  );
}
function PocketEntryButton({ rpcCall, t, wide = true }) {
  const [open, setOpen] = (0, import_react2.useState)(false);
  const [narrow, setNarrow] = (0, import_react2.useState)(() => window.matchMedia("(max-width: 1023px)").matches);
  (0, import_react2.useEffect)(() => {
    const q = window.matchMedia("(max-width: 1023px)");
    const on = (e) => setNarrow(e.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  (0, import_react2.useEffect)(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open]);
  (0, import_react2.useEffect)(() => {
    if (!open) return;
    const prev = document.activeElement;
    return () => {
      try {
        prev?.focus?.();
      } catch {
      }
    };
  }, [open]);
  if (narrow) return null;
  const label = t("entryLabel");
  const railButton = (0, import_react2.createElement)("button", {
    type: "button",
    "data-dsh-pocket-entry": "",
    "aria-label": label,
    title: import_dsh_client_ui_primitives4.Tooltip == null ? label : void 0,
    // 官方 Tooltip 缺席时用原生 title 兜底
    onClick: () => setOpen(true),
    style: {
      width: 36,
      height: 36,
      margin: "4px 0",
      padding: 0,
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      border: "none",
      borderRadius: "50%",
      background: "transparent",
      color: "var(--dsw-alias-label-primary, inherit)",
      cursor: "pointer",
      font: "inherit"
    }
  }, (0, import_react2.createElement)("span", { "aria-hidden": true, style: { fontSize: 16, lineHeight: 1, flex: "none" } }, "\u{1F4F1}"));
  return (0, import_react2.createElement)(
    import_react2.Fragment,
    null,
    wide ? (0, import_react2.createElement)(
      "button",
      {
        type: "button",
        "data-dsh-pocket-entry": "",
        onClick: () => setOpen(true),
        style: {
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          boxSizing: "border-box",
          height: 42,
          padding: "0 10px 0 8px",
          margin: "4px -2px",
          border: "none",
          borderRadius: 12,
          background: "transparent",
          color: "var(--dsw-alias-label-primary, inherit)",
          font: "inherit",
          fontSize: 14,
          lineHeight: "22px",
          cursor: "pointer",
          textAlign: "left"
        }
      },
      (0, import_react2.createElement)("span", { style: { fontSize: 16, flex: "none", lineHeight: 1 } }, "\u{1F4F1}"),
      (0, import_react2.createElement)("span", { style: { whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, label)
    ) : import_dsh_client_ui_primitives4.Tooltip != null ? (0, import_react2.createElement)(import_dsh_client_ui_primitives4.Tooltip, { label, delayMs: 500 }, railButton) : railButton,
    open ? (0, import_react2.createElement)(
      "div",
      {
        role: "dialog",
        "aria-modal": "true",
        "aria-label": t("section"),
        "data-dsh-pocket-dialog": "",
        "data-dsh-pocket-overlay": "",
        style: {
          position: "fixed",
          inset: 0,
          zIndex: 1e4,
          background: "var(--dsw-alias-bg-mask-1, rgba(15,17,21,.55))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 20
        },
        onClick: (e) => {
          if (e.target === e.currentTarget) setOpen(false);
        }
      },
      (0, import_react2.createElement)(
        "div",
        { "data-dsh-pocket-panel": "", style: {
          background: "var(--dsw-alias-bg-base, #fff)",
          borderRadius: 14,
          boxShadow: "0 18px 50px rgba(0,0,0,.25)",
          width: "100%",
          maxWidth: 560,
          maxHeight: "min(88vh, 820px)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden"
        } },
        (0, import_react2.createElement)(
          "div",
          { style: {
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 18px",
            borderBottom: "1px solid var(--dsw-alias-border-l2, #e5e7eb)",
            flex: "none"
          } },
          (0, import_react2.createElement)("strong", { style: { fontSize: 15, color: "var(--dsw-alias-label-primary, inherit)" } }, t("section")),
          (0, import_react2.createElement)("button", {
            type: "button",
            "aria-label": t("closeDialog"),
            autoFocus: true,
            // 打开对话框即落在关闭钮上，Esc/Tab 从这里开始
            onClick: () => setOpen(false),
            style: {
              width: 30,
              height: 30,
              borderRadius: "50%",
              border: "none",
              background: "var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06))",
              color: "var(--dsw-alias-label-primary, inherit)",
              cursor: "pointer",
              fontSize: 14,
              lineHeight: 1
            }
          }, "\u2715")
        ),
        (0, import_react2.createElement)(
          "div",
          { style: { padding: 18, overflowY: "auto" } },
          (0, import_react2.createElement)(PocketSettingsTab, { rpcCall, t })
        )
      )
    ) : null
  );
}
function apply(ctx) {
  if (ctx?.connection) {
    try {
      Object.defineProperty(ctx.connection, "isLoopback", { value: true, writable: true, configurable: true });
    } catch {
      try {
        ctx.connection.isLoopback = true;
      } catch {
      }
    }
  }
  mobileApply(ctx);
  const rpcCall = (endpoint, payload, signal) => ctx.connection.rpc.call(POCKET_RPC_CHANNEL, endpoint, payload, signal);
  const translate = ctx.locale.bind(NS2);
  ctx.effect(() => ctx.locale.register(NS2, { zh: zh2, en: en2 }), "dsh-pocket: pocket locale dictionaries");
  ctx.effect(() => {
    const tag = document.createElement("style");
    tag.dataset.plugin = name;
    tag.dataset.pluginCss = `${name}/ui.css`;
    tag.textContent = POCKET_UI_CSS;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, "dsh-pocket: client ui state styles");
  ctx.slots.inject(
    "sidebar.footer.action",
    () => ctx.slots.register(
      {
        name: "sidebar.footer.action",
        id: "pocket-entry",
        order: 0,
        locale: NS2,
        inject: () => ({ rpcCall, t: translate })
      },
      PocketEntryButton
    )
  );
}

    return module.exports;
  }
});
