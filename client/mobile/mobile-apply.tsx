// dsh-web-mobile 移植（MIT，见 LICENSE.dsh-web-mobile）：移动端适配的 client 侧实现。
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { MobileNavToggle } from './MobileNavToggle.tsx'
import { MobileNavOverlay } from './MobileNavOverlay.tsx'
import { MobileDrawerFooter } from './MobileDrawerFooter.tsx'
import { MOBILE_CSS } from './mobile.css.ts'
import { resolveLayout, persistLayoutFromUrl } from './layout-mode.mjs'
import { startAddWorkspaceHider } from './add-workspace.ts'
import { POCKET_RPC_CHANNEL, POCKET_ENDPOINTS, MOBILE_RIGHTBAR_ATTRIBUTE, MOBILE_RIGHTBAR_EVENT } from '../api.js'
import { NS, en, zh } from './locales.ts'
import type { MobileNavKey } from './locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Directory-drawer controls copy. */
    'mobileNav': MobileNavKey
  }
}

/** Required services (cordis fiber inject — the loader passes all module exports as an object plugin). */

/**
 * Coalesce a hot-path callback (a body-wide MutationObserver firing in storms
 * while the user types / the composer autosizes / focus opens the keyboard)
 * into at most one run per animation frame, so observer work can never starve
 * the main thread mid-gesture.
 */
function rafBatch(run: () => void): () => void {
  let scheduled = false
  return () => {
    if (scheduled) return
    scheduled = true
    requestAnimationFrame(() => {
      scheduled = false
      run()
    })
  }
}

/**
 * Mobile-adaptive shell, browser half: injects the mobile stylesheet, then
 * contributes the directory toggle to the session header and the backdrop +
 * floating button to the shell overlay.
 * @param ctx - client root context.
 */
export function mobileApply(ctx): void {
  // 布局模式（issue #74，移植上游 018aef0）：URL 参数 > localStorage > auto(=matchMedia)。
  // desktop 模式（宽屏手机/平板强制电脑布局）下整段 mobile 效果都不挂——
  // 不加 styles、不挂 slots、不跑 effects，直接走 DSH 原生桌面 UI。
  const urlValue = new URL(window.location.href).searchParams.get('dsh-layout') ?? '';
  const narrowMQ = window.matchMedia('(max-width: 1023px)');
  const stored = persistLayoutFromUrl(urlValue);
  const layout = resolveLayout({ urlValue, stored, narrowMatch: narrowMQ.matches });
  document.body?.setAttribute('data-dsh-pocket-layout', layout);
  if (layout === 'desktop') return;
  // 强制 mobile：narrow 永远 true；宽度变化不再切换（用户已显式选 mobile）
  // auto 模式：narrow 是真实的 matchMedia，宽度变化会触发 effect 挂载/卸载
  let narrow: MediaQueryList = narrowMQ;
  if (layout === 'mobile') {
    narrow = { matches: true, addEventListener: () => {}, removeEventListener: () => {} } as MediaQueryList;
  }

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-mobile-nav: dictionaries')

  // 手机端可选右边栏（移植上游 d2e0b46 / issue #122）：默认显示原生右边栏入口，
  // 用户可在设置页关掉以保持紧凑。开关状态经 status RPC 下发，设置页改动时用
  // MOBILE_RIGHTBAR_EVENT 广播；body 上的属性由 mobile.css.ts 消费。
  ctx.effect(() => {
    let active = true
    const applyEnabled = (enabled: boolean): void => {
      document.body?.setAttribute(MOBILE_RIGHTBAR_ATTRIBUTE, enabled ? 'on' : 'off')
    }
    const onChange = (event: Event): void => {
      applyEnabled((event as CustomEvent<{ enabled?: boolean }>).detail?.enabled === true)
    }
    const load = async (): Promise<void> => {
      try {
        const result = await ctx.connection.rpc.call(POCKET_RPC_CHANNEL, POCKET_ENDPOINTS.status, {}) as {
          ok?: boolean
          value?: { mobileRightbarEnabled?: boolean }
        }
        // 读不到状态时按「显示」兜底：这里本来就是上游原生入口，藏起来才是异常。
        if (active) applyEnabled(result?.ok === true ? result.value?.mobileRightbarEnabled !== false : true)
      } catch {
        if (active) applyEnabled(true)
      }
    }
    window.addEventListener(MOBILE_RIGHTBAR_EVENT, onChange)
    void load()
    return () => {
      active = false
      window.removeEventListener(MOBILE_RIGHTBAR_EVENT, onChange)
      document.body?.removeAttribute(MOBILE_RIGHTBAR_ATTRIBUTE)
    }
  }, 'dsh-mobile-nav: optional right sidebar')

  ctx.effect(() => {
    const tag = document.createElement('style')
    tag.dataset.plugin = '@dsh-external/dsh-mobile-nav'
    tag.dataset.pluginCss = '@dsh-external/dsh-mobile-nav/mobile.css'
    tag.textContent = MOBILE_CSS
    document.head.appendChild(tag)
    return () => {
      tag.remove()
    }
  }, 'dsh-mobile-nav: styles')

  // 隐藏「添加工作区」入口：只在**桌面宿主**的窄屏上隐藏（issue #17 + #205）。
  // 桌面宿主用的是系统文件选择器，手机上点开必然失败；但 `dsh web` CLI / Linux
  // 走的是网页文件选择器，手机上同样能选路径、能新建工作区。原来一律按屏幕宽度
  // 隐藏，等于把可用功能藏掉了。status 里的 desktop 字段就是宿主类型，按设备判定。
  // 读不到状态时保守起见保持旧行为（隐藏），避免桌面宿主上露出必失败的入口。
  ctx.effect(() => {
    if (!narrow.matches) return () => {}
    let active = true
    let dispose: (() => void) | null = null
    const load = async (): Promise<void> => {
      try {
        const result = await ctx.connection.rpc.call(POCKET_RPC_CHANNEL, POCKET_ENDPOINTS.status, {}) as {
          ok?: boolean
          value?: { desktop?: boolean }
        }
        if (!active) return
        if (result?.ok === true && result.value?.desktop === false) return
        dispose = startAddWorkspaceHider()
      } catch {
        if (active) dispose = startAddWorkspaceHider()
      }
    }
    void load()
    return () => {
      active = false
      dispose?.()
    }
  }, 'dsh-mobile-nav: hide add-workspace on desktop hosts only (issue #17 #205)')

  // 手机上模型 / 提供方设置加载失败：上游 dsh-web 会渲染「加载提供方目录失败 /
  // Settings are unavailable in this browser」。这条文案不是 dsh-pocket 的，但手机侧
  // 本就不支持改模型设置，原报错只会吓到用户。窄屏下用 MutationObserver 就地把该报错
  // 文本替换成「去电脑端修改」的引导提示（仅手机，桌面端不受影响）。
  // （移植上游 5ab2ad4）
  ctx.effect(() => {
    if (!narrow.matches) return () => {}
    const PHRASES = ['加载提供方目录失败', 'Settings are unavailable in this browser']
    const NOTICE = '手机上不支持模型设置，请去电脑端修改设置'
    // 取包含报错文案的最深节点，避免把外层大容器整块清掉。
    const findDeepest = (el: Element): Element => {
      let deepest = el
      for (const child of el.querySelectorAll('*')) {
        if (PHRASES.some((p) => (child.textContent ?? '').includes(p))) deepest = child
      }
      return deepest
    }
    const patch = (): void => {
      for (const el of document.querySelectorAll('body *')) {
        const t = el.textContent ?? ''
        if (!PHRASES.some((p) => t.includes(p))) continue
        if ((el as HTMLElement).dataset?.dshpModelNotice === '1') continue
        const target = findDeepest(el)
        target.textContent = NOTICE
        ;(target as HTMLElement).dataset.dshpModelNotice = '1'
      }
    }
    const observer = new MutationObserver(patch)
    observer.observe(document.body, { childList: true, subtree: true, characterData: true })
    patch()
    return () => observer.disconnect()
  }, 'dsh-mobile-nav: replace model-settings load error with mobile hint')

  // Phone chrome: KEEP the system status bar (no fullscreen) and make it
  // blend into the page. On narrow screens:
  // - The viewport meta gains viewport-fit=cover ONLY on genuine iOS Safari /
  //   iOS PWA where the layout viewport genuinely touches the status bar/notch.
  //   On Android (and in WeChat/MicroMessenger on both OSes), the system status bar
  //   and the app title bar sit above the WebView. Setting viewport-fit=cover there
  //   causes Chromium / XWeb to calculate safe-area-inset-top as the screen status
  //   bar height, creating a wide empty strip at the top of the chat and drawer.
  // - A theme-color meta tracks the shell background (the official theme is
  //   toggled by body[data-ds-dark-theme], which flips --dsw-alias-bg-base):
  //   Android then paints the status bar / URL bar with the page's own base
  //   color, so the status bar reads as part of the UI instead of a foreign
  //   strip. The drawer paints the same strip on iOS / notch displays.
  // - gesturestart is suppressed as the legacy-iOS fallback for double-tap
  //   zoom; modern browsers are covered by the stylesheet's
  //   touch-action: manipulation (which keeps pan and pinch zoom).
  ctx.effect(() => {
    const viewport = document.querySelector<HTMLMetaElement>('meta[name="viewport"]')
    const originalViewport = viewport?.content ?? ''
    const themeMeta = document.createElement('meta')
    themeMeta.name = 'theme-color'
    const bodyBg = (): string => getComputedStyle(document.body).backgroundColor

    const isWeChat = /MicroMessenger/i.test(navigator.userAgent)
    const isAndroid = /Android/i.test(navigator.userAgent)
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isStandalone =
      (typeof window !== 'undefined' &&
        ((window.navigator as unknown as { standalone?: boolean })?.standalone === true ||
          window.matchMedia?.('(display-mode: standalone)').matches)) ??
      false

    // 只有真正的 iOS 浏览器 / PWA 独立全屏（且非微信等自带顶栏的内嵌应用）才需要开启 viewport-fit=cover
    // 避让刘海 / 灵动岛。Android 与微信内置浏览器自身已在状态栏下方渲染，若开启 cover 会导致
    // Android Chromium / XWeb 误把系统状态栏高度算入 safe-area-inset-top，导致界面顶部出现一大截空白。
    const needsTopInset = (isIOS && !isWeChat) || (isStandalone && !isAndroid && !isWeChat)

    const sync = (): void => {
      // interactive-widget=resizes-content（Chrome/Android 108+）：键盘弹出时布局
      // 视口确定性地收窄（composer 随之上移），避免部分 OEM 浏览器在默认
      // resizes-visual 下先平移再二次重排造成的迟滞。其他内核忽略未知键。
      if (viewport !== null) {
        viewport.content = needsTopInset
          ? 'width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content'
          : 'width=device-width, initial-scale=1, interactive-widget=resizes-content'
      }
      document.documentElement.dataset.dshSafeTop = needsTopInset ? '1' : '0'
      document.documentElement.style.setProperty(
        '--dsh-safe-area-top',
        needsTopInset ? 'env(safe-area-inset-top, 0px)' : '0px'
      )
      themeMeta.content = bodyBg()
      if (themeMeta.parentElement === null) document.head.appendChild(themeMeta)
    }
    const restore = (): void => {
      if (viewport !== null) viewport.content = originalViewport
      delete document.documentElement.dataset.dshSafeTop
      document.documentElement.style.removeProperty('--dsh-safe-area-top')
      themeMeta.remove()
    }
    const onGestureStart = (event: Event) => event.preventDefault()
    if (narrow.matches) sync()
    const onChange = (event: MediaQueryListEvent) => (event.matches ? sync() : restore())
    narrow.addEventListener('change', onChange)
    const observer = new MutationObserver(() => {
      if (narrow.matches) themeMeta.content = bodyBg()
    })
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    document.addEventListener('gesturestart', onGestureStart)
    return () => {
      narrow.removeEventListener('change', onChange)
      observer.disconnect()
      document.removeEventListener('gesturestart', onGestureStart)
      restore()
    }
  }, 'dsh-mobile-nav: status bar theme + viewport + zoom guard')

  // dsh-web-ui compatibility: the aionui explorer column would render as a
  // sheet over the whole mobile UI whenever its (persisted) expanded state
  // is active — including right after a reload, with no way out (the
  // suite's floating expand button only exists while collapsed). Instead
  // of fighting the suite's store timing, the mobile stylesheet keeps the
  // explorer column hidden by default and the header's Files action (plus
  // the drawer footer entry) opens it via the `data-aionui-explorer-open`
  // marker on the frame. This effect just clears that marker when the
  // sheet's own collapse chevron is tapped, so closing is symmetric with
  // opening.
  ctx.effect(() => {
    if (!narrow.matches) return () => {}
    const onChevronClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target === null || !target.closest('.aionui-collapse-chevron')) return
      document.querySelector('[data-mobile-nav="frame"]')?.removeAttribute('data-aionui-explorer-open')
    }
    document.addEventListener('click', onChevronClick, true)
    return () => document.removeEventListener('click', onChevronClick, true)
  }, 'dsh-mobile-nav: aionui explorer close marker')

  // The mobile "Files" entries (header icon + drawer footer) open the
  // dsh-web-ui **aionui explorer column** — a host-side component that plain
  // DeepSeek Harness does NOT ship (issue #48). Without it the entries are
  // dead buttons (they only toggle a frame attribute; nothing ever renders).
  // Detect whether the host provides the column and mark the frame with
  // `data-mobile-nav-explorer="1|0"` so the stylesheet can hide the entries
  // on hosts without it (dsh-web-ui installs keep the feature).
  ctx.effect(() => {
    if (!narrow.matches) return () => {}
    const frame = (): HTMLElement | null => document.querySelector('[data-mobile-nav="frame"]')
    const check = () => {
      const has = document.querySelector('[data-aionui-explorer-col]') !== null
      frame()?.setAttribute('data-mobile-nav-explorer', has ? '1' : '0')
    }
    check()
    const timer = window.setTimeout(check, 1500) // 宿主懒渲染：稍后再查一次
    const observer = new MutationObserver(rafBatch(check))
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      window.clearTimeout(timer)
      observer.disconnect()
    }
  }, 'dsh-mobile-nav: explorer availability (issue #48)')

  // dsh-web-ui compatibility: the aionui preview column persists its open
  // tabs in localStorage and restores them on load, which would pop the
  // preview sheet over the fresh UI after a reload. Gate it like the
  // explorer: the stylesheet keeps the column hidden unless the frame
  // carries `data-aionui-preview-open`; this effect sets that marker when
  // the user actually taps a file row in the explorer sheet, and clears it
  // whenever the suite hides the column again (collapse chevron / tab
  // close), so a restored-but-unwanted sheet never appears.
  ctx.effect(() => {
    if (!narrow.matches) return () => {}
    const frame = (): HTMLElement | null => document.querySelector('[data-mobile-nav="frame"]')
    const onTap = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null
      if (target === null) return
      if (target.closest('[data-aionui-explorer-col] [class$="_treeRow"]') === null) return
      frame()?.setAttribute('data-aionui-preview-open', '')
    }
    const sync = (): void => {
      const pv = document.querySelector('[data-aionui-preview-col]')
      if (pv === null) return
      if (getComputedStyle(pv).visibility === 'hidden') frame()?.removeAttribute('data-aionui-preview-open')
    }
    document.addEventListener('click', onTap, true)
    const observer = new MutationObserver(sync)
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style'] })
    sync()
    return () => {
      document.removeEventListener('click', onTap, true)
      observer.disconnect()
    }
  }, 'dsh-mobile-nav: preview sheet open marker')

  // The official conversation status row (turns / steps / LLM time / TTFT /
  // cache) has a hashed class, so the stylesheet cannot target it directly.
  // Mark the exact row on narrow screens by text: a [class$=_root] that
  // carries the metrics text and no textarea (the composer card also ends in
  // _root and can mention turns in its model line). The CSS then lays the
  // marked row out as ONE horizontally scrolling line with every metric
  // reachable.
  //
  // Mis-mark guard (input docks): the todo / plan / goal / queue strips render
  // in the SAME composer stack ABOVE the input bar (conversation.input.dock),
  // their hashed section classes also end in `_root`, and an EXPANDED task
  // list routinely contains 步/轮/"steps"… — the old text-only heuristic then
  // matched the dock FIRST (tree order) and crushed it into the 28px strip,
  // which looked like "collapse broke the panel". Distinguisher: the real
  // StatsLine renders plain spans only; every dock has a header <button>.
  ctx.effect(() => {
    if (!narrow.matches) return () => {}
    // The composer root renders the TPS readout ("TPS 89.4 tok/s") as its
    // own row BELOW the status strip; fold it into the strip so every
    // metric scrolls together. Idempotent: cheap early-exit while TPS is
    // already present, full-stack walk only when it is missing.
    const moveTps = (stats: Element): void => {
      if ([...stats.children].some((c) => /^TPS\s+\d/.test((c.textContent ?? '').trim()))) return
      const stack = stats.closest('[class$="_composerStack"]')
      if (stack === null) return
      for (const el of stack.querySelectorAll('div')) {
        const text = (el.textContent ?? '').trim()
        if (!/^TPS\s+\d/.test(text)) continue
        if (el.children.length > 0) continue
        stats.appendChild(el)
        return
      }
    }
    let marked: Element | null = null
    let lastScan = 0
    const scan = (): void => {
      // Fast path: while the marked element stays connected only re-check at
      // most twice a second (late TPS pickup). Typing fires mutation storms;
      // per-batch full scans used to burn main-thread frames exactly when the
      // keyboard opens.
      const now = Date.now()
      if (marked !== null && marked.isConnected && now - lastScan < 500) return
      lastScan = now
      if (marked === null || !marked.isConnected) marked = null
      for (const root of document.querySelectorAll('[data-phase] [data-slot="conversation.composer.dock"] [class$="_root"]')) {
        // The status row lives inside the composer stack; message-area
        // blocks can also mention turns/steps and must be skipped.
        if (root.closest('[class$="_composerStack"]') === null) continue
        // Mis-mark guard (input docks): the todo / plan / goal / queue strips
        // render in the SAME composer stack ABOVE the input bar, their hashed
        // section classes also end in `_root`, and an EXPANDED task list
        // routinely contains 步/轮/"steps"… — the old text-only heuristic then
        // matched the dock FIRST (tree order) and crushed it into the 28px
        // strip. Distinguisher: the real StatsLine renders plain spans only;
        // every dock has a header <button>. 上游 5c56d24 改用稳定的
        // conversation.composer.dock 标记收窄扫描范围，本 fork 额外保留这条
        // button 守卫作为第二道保险。
        if (root.querySelector('button') !== null) continue
        const text = root.textContent ?? ''
        if (!/(turns|steps|\bLLM\b|轮|步)/.test(text)) continue
        root.setAttribute('data-mobile-nav', 'stats')
        moveTps(root)
        marked = root
        return
      }
    }
    const mark = rafBatch(scan)
    const observer = new MutationObserver(mark)
    observer.observe(document.body, { childList: true, subtree: true })
    scan()
    return () => {
      observer.disconnect()
      marked = null
    }
  }, 'dsh-mobile-nav: stats line marker')

  // The dsh-web-ui explorer / preview columns toggle via `visibility`
  // (their inline style), which never restarts a CSS animation — so the
  // sheets would only animate on first mount. Replay the rise animation
  // with the Web Animations API each time a column turns visible, then
  // leave the resting state to the stylesheet. Users asking for reduced
  // motion get none (the CSS keyframes have their own media-query guard;
  // WAAPI ignores those rules, hence this JS check).
  ctx.effect(() => {
    if (!narrow.matches) return () => {}
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const cols = ['[data-aionui-explorer-col]', '[data-aionui-preview-col]']
    const seen = new Map<string, boolean>()
    const play = (el: Element): void => {
      if (reducedMotion.matches) return
      el.animate(
        [
          { opacity: 0, transform: 'translateY(28px)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration: 280, easing: 'cubic-bezier(.16, 1, .3, 1)', fill: 'backwards' },
      )
    }
    const check = (): void => {
      for (const sel of cols) {
        const el = document.querySelector(sel)
        if (el === null) continue
        const visible = getComputedStyle(el).visibility === 'visible'
        const prev = seen.get(sel) ?? false
        if (visible && !prev) play(el)
        seen.set(sel, visible)
      }
    }
    const observer = new MutationObserver(rafBatch(check))
    // Visibility flips come through inline style mutations (suite) or the
    // explorer-open marker on the frame; class changes are watched too.
    observer.observe(document.body, { attributes: true, subtree: true, attributeFilter: ['style', 'class', 'data-aionui-explorer-open'] })
    check()
    return () => {
      observer.disconnect()
    }
  }, 'dsh-mobile-nav: sheet rise animation replay')

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'mobile-nav-toggle',
    order: 10,
    locale: NS,
    inject: () => ({
      toggleSidebar: () => ctx.layout.toggleSidebar(),
    }),
  }, MobileNavToggle))

  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'mobile-nav-overlay',
    order: 10,
    locale: NS,
    inject: () => ({
      toggleSidebar: () => ctx.layout.toggleSidebar(),
    }),
  }, MobileNavOverlay))

  // Session log download, relocated from the session header to the drawer
  // footer on mobile (the header capsule is hidden by CSS); the drawer
  // footer also hosts the Files action that opens the dsh-web-ui explorer
  // sheet.
  ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register({
    name: 'sidebar.footer.action',
    id: 'mobile-nav-session-log',
    order: 10,
    locale: NS,
    inject: () => ({
      downloadSessionLog: (sessionId: string) => ctx.sessionLogDownload.download(sessionId),
      toggleSidebar: () => ctx.layout.toggleSidebar(),
    }),
  }, MobileDrawerFooter))
}

// Type-only augmentation imports: pull the layout / conversation / sidebar
// SlotMap merges and the sessionLogDownload service typing into this program
// without any runtime import.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-session-log-export/client'
