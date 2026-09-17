import { useEffect, useLayoutEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconPanelLeftOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
import { NS } from './locales.ts'
import {
  DRAWER_SELECTOR,
  TOGGLE_SELECTOR,
  isOverlayTap,
  navTargetFor,
} from './nav-targets.mjs'

/** Full props for the shell overlay entry. */
export interface MobileNavOverlayProps extends PropsRuntime<'shell.overlay'>, PropsLocale<typeof NS> {
  /** Bound ctx.layout.toggleSidebar(). */
  toggleSidebar: () => void
}

/** Same breakpoint as the shell's SIDEBAR_AUTO_COLLAPSE (viewport < 1024). */
const MOBILE_QUERY = '(max-width: 1023px)'

/** Live matchMedia hook for the narrow breakpoint. */
function useMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY)
    const onChange = (event: MediaQueryListEvent) => setMobile(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return mobile
}

/** The AppFrame element: direct parent of the shell overlay layer. */
function findFrame(): HTMLElement | null {
  return document.querySelector('[data-shell-overlay]')?.parentElement ?? null
}

/**
 * Mobile shell overlay: owns the `data-mobile-nav` marker on the AppFrame
 * element (the CSS restructure keys off it), mirrors the frame's collapsed
 * state into React state, and renders the dimmed backdrop plus a floating
 * directory button for the hero/blank phases that have no session header.
 */
export function MobileNavOverlay({ toggleSidebar, t }: MobileNavOverlayProps) {
  const mobile = useMobile()
  const [open, setOpen] = useState(false)
  const [fabVisible, setFabVisible] = useState(false)

  // Frame ownership + open-state mirror. On wide screens this effect is inert:
  // the marker is never set, so the layout is untouched.
  useLayoutEffect(() => {
    if (!mobile) {
      setOpen(false)
      return
    }
    const frame = findFrame()
    if (frame === null) return
    frame.setAttribute('data-mobile-nav', 'frame')
    const sync = () => setOpen(!frame.hasAttribute('data-sidebar-collapsed'))
    sync()
    const observer = new MutationObserver(sync)
    observer.observe(frame, { attributes: true, attributeFilter: ['data-sidebar-collapsed'] })
    return () => {
      observer.disconnect()
      frame.removeAttribute('data-mobile-nav')
    }
  }, [mobile])

  // The floating button is a fallback for surfaces without a session header:
  // phase "active" means the header (and its toggle) is rendered already.
  useEffect(() => {
    if (!mobile) {
      setFabVisible(false)
      return
    }
    const sync = () => setFabVisible(document.querySelector('[data-phase="active"]') === null)
    sync()
    const observer = new MutationObserver(sync)
    // childList: the conversation root can be replaced wholesale on session
    // switches, so attribute-only observation would miss the new phase.
    observer.observe(document.documentElement, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-phase'],
    })
    return () => observer.disconnect()
  }, [mobile])

  // Escape closes the drawer — but yields to an open modal dialog (e.g. the
  // settings panel), which owns its own Escape handling.
  useEffect(() => {
    if (!mobile || !open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.querySelector('[aria-modal="true"]') === null) toggleSidebar()
    }
    // Capture phase: run before the settings panel's own document-bubble Escape
    // handler, so the modal is still present when we yield to it.
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [mobile, open, toggleSidebar])

  // Navigation inside the drawer closes it: tapping a session row or a
  // plugin takeover entry (task board / ssh) must hand the screen to the
  // content it just opened. Capture phase — the drawer closes before the
  // shell or a plugin processes the click, so takeover panels never render
  // under the open drawer.
  //
  // Deliberately NOT closed by this rule:
  // - Settings / Session log: their dialogs render INSIDE the drawer DOM
  //   (portaled into the sidebar); closing the drawer would slide the dialog
  //   off-screen with it.
  // - Workspace folder chevrons, the logo: pure UI toggles, not navigation.
  // - Anything while a modal dialog is open: the dialog owns the screen.
  useEffect(() => {
    if (!mobile || !open) return
    const onDrawerClick = (event: MouseEvent) => {
      if (document.querySelector('[aria-modal="true"]') !== null) return
      const target = event.target as HTMLElement | null
      if (target === null) return
      const drawer = document.querySelector<HTMLElement>(DRAWER_SELECTOR)
      if (drawer === null || !drawer.contains(target)) return
      // A session row's own action buttons — the "Session actions" kebab
      // (delete / rename), revealed on hover / long-press — open an edit
      // menu. Tapping one must NOT count as tapping the row, or the drawer
      // would close and take the just-opened menu with it. 命中选择器集中在
      // nav-targets.mjs（issue #72），组件里不再内联一份。
      if (navTargetFor(target) !== null) toggleSidebar()
    }
    document.addEventListener('click', onDrawerClick, true)
    return () => document.removeEventListener('click', onDrawerClick, true)
  }, [mobile, open, toggleSidebar])

  // iOS Safari touch self-heal (issue #72).
  //
  // A tap on a drawer row is delivered to the page as touchstart/touchend
  // plus a browser-synthesized click. On iOS that click is routinely
  // suppressed: a few px of finger drift is classified as a pan, and any DOM
  // shift under the finger before dispatch cancels it outright. When it does
  // not arrive, neither the row's own onClick nor the capture handler above
  // runs — the row looks completely dead ("抽屉点了没反应").
  //
  // So: on touch/pen pointerup inside the drawer that hits a navigation row,
  // arm a one-macrotask timer. When it fires:
  // - the drawer is already closed → the real click did arrive and handled
  //   everything → do nothing (zero interference with the normal path);
  // - otherwise the click never came → re-dispatch a bubbling click on the
  //   row ourselves. React's delegated listener runs the row's onClick (the
  //   session opens / the workspace switches) and the same click bubbles
  //   through the capture handler above, which closes the drawer.
  //
  // Mouse/pen-on-desktop keeps the plain click path: pointerType is 'mouse'.
  useEffect(() => {
    if (!mobile || !open) return
    let timer: number | null = null
    const onDrawerPointerUp = (event: PointerEvent): void => {
      if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
      const target = event.target
      if (!(target instanceof Element)) return
      const drawer = document.querySelector<HTMLElement>(DRAWER_SELECTOR)
      if (drawer === null || !drawer.contains(target)) return
      if (navTargetFor(target) === null) return
      if (timer !== null) return
      timer = window.setTimeout(() => {
        timer = null
        const frame = document.querySelector('[data-mobile-nav="frame"]')
        // Real click already closed it — nothing to heal.
        if (frame === null || frame.hasAttribute('data-sidebar-collapsed')) return
        const row = navTargetFor(target)
        row?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
      }, 0)
    }
    document.addEventListener('pointerup', onDrawerPointerUp, true)
    return () => {
      if (timer !== null) window.clearTimeout(timer)
      document.removeEventListener('pointerup', onDrawerPointerUp, true)
    }
  }, [mobile, open])

  // Tap-outside closes the drawer (issue #38). The backdrop is now
  // pointer-events: none (pure dimming layer that never steals clicks), so
  // "tap the dimmed area to close" moves here: any click outside the drawer
  // (and outside the header toggle) closes it, keeping the standard
  // interaction while letting drawer contents receive clicks normally.
  // Capture phase: the close happens before the content processes the tap
  // (same first-tap-closes behaviour as before).
  useEffect(() => {
    if (!mobile || !open) return
    const onOutsideClick = (event: MouseEvent) => {
      if (document.querySelector('[aria-modal="true"]') !== null) return
      const target = event.target as HTMLElement | null
      if (target === null) return
      if (target.closest(TOGGLE_SELECTOR) !== null) return
      // Portaled overlays (issue #72): the workspace section's "视图选项" /
      // "添加工作区" and the session row kebab all open menus that live on
      // document.body — outside the drawer DOM. Without this exemption the
      // first tap on a menu item is eaten: the drawer slides away, the menu
      // unmounts with the sidebar, and the item's onClick never runs, so
      // every workspace control reads as "点了没反应" on a phone.
      if (isOverlayTap(target)) return
      const drawer = document.querySelector<HTMLElement>(DRAWER_SELECTOR)
      if (drawer !== null && drawer.contains(target)) return
      toggleSidebar()
    }
    document.addEventListener('click', onOutsideClick, true)
    return () => document.removeEventListener('click', onOutsideClick, true)
  }, [mobile, open, toggleSidebar])

  if (!mobile) return null
  return (
    <>
      {open && (
        <div data-mobile-nav="backdrop" />
      )}
      {fabVisible && !open && (
        <button
          type="button"
          data-mobile-nav="fab"
          aria-label={t('open')}
          title={t('open')}
          onClick={() => toggleSidebar()}
        >
          <IconPanelLeftOutline16 size={18} />
        </button>
      )}
    </>
  )
}
