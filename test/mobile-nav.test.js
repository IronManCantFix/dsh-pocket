// 抽屉点击规则（client/mobile/nav-targets.mjs + MobileNavOverlay.tsx）。
// 没有 DOM 可用，所以判定逻辑是纯函数：用一个只有 closest() 的桩元素喂进去。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const {
  DRAWER_SELECTOR,
  TOGGLE_SELECTOR,
  NAV_TARGETS,
  NAV_EXCLUDE,
  OVERLAY_SELECTOR,
  navTargetFor,
  isOverlayTap,
} = await import('../client/mobile/nav-targets.mjs');

/**
 * 造一个只实现 closest() 的桩元素。hits 传**单个**选择器；closest() 收到的
 * 是逗号连接的复合选择器时按真实语义拆开逐条比对（命中任意一条即命中）。
 */
const stub = (...hits) => {
  const el = {
    closest: (sel) => {
      const parts = String(sel)
        .split(',')
        .map((s) => s.trim());
      return hits.some((h) => parts.includes(h)) ? el : null;
    },
  };
  return el;
};

test('导航选择器覆盖当前与旧一代侧边栏的行类名', () => {
  // 当前侧边栏（qDHVXG_ 区块 / YDXeBa_ 行）
  assert.match(NAV_TARGETS, /sessionRow/, '当前侧边栏的会话行 YDXeBa_sessionRow');
  // 旧一代侧边栏（_searchResultRow_ / _searchResultWorkspace_）
  assert.match(NAV_TARGETS, /searchResultRow/);
  assert.match(NAV_TARGETS, /searchResultWorkspace/);
  assert.match(NAV_TARGETS, /newSession/);
  assert.match(NAV_TARGETS, /data-dsh-taskboard-entry/);
  assert.match(NAV_TARGETS, /data-dsh-ssh-entry/);
  assert.match(NAV_TARGETS, /data-mobile-nav="files"/);
  assert.match(NAV_EXCLUDE, /sessionRow/, '行内 kebab 按钮');
});

test('工作区行（projectRow）按折叠开关处理，不算导航 —— issue #72', () => {
  // YDXeBa_projectRow 实测是折叠/展开：aria-expanded 来回翻、会话列表显隐，
  // 工作区本身不变。把它当导航会在每次展开工作区时把抽屉关掉。
  assert.doesNotMatch(NAV_TARGETS, /projectRow/);
  assert.equal(navTargetFor(stub('[class*="projectRow"]')), null);
});

test('会话行算导航，行内的 kebab 按钮不算', () => {
  assert.notEqual(navTargetFor(stub('[class*="sessionRow"]')), null);
  assert.notEqual(navTargetFor(stub('[class*="newSession"]')), null);
  assert.notEqual(navTargetFor(stub('[data-mobile-nav="files"]')), null);
  // NAV_EXCLUDE 就是 '[class*="sessionRow"] button'：行内 kebab 命中它优先
  assert.equal(navTargetFor(stub('[class*="sessionRow"] button')), null);
  assert.equal(
    navTargetFor(stub('[class*="sessionRow"] button', '[class*="sessionRow"]')),
    null,
    'kebab 同时命中行本身时，NAV_EXCLUDE 优先',
  );
});

test('空目标 / 非元素目标安全降级', () => {
  assert.equal(navTargetFor(null), null);
  assert.equal(navTargetFor(undefined), null);
  assert.equal(navTargetFor({}), null, '没有 closest 方法的对象不该抛错');
  assert.equal(isOverlayTap(null), false);
  assert.equal(isOverlayTap({}), false);
});

test('浮层内的点击被识别为 overlay（不该关抽屉）—— issue #72', () => {
  assert.match(OVERLAY_SELECTOR, /role="menu"/);
  assert.match(OVERLAY_SELECTOR, /role="listbox"/);
  assert.match(OVERLAY_SELECTOR, /role="dialog"/);
  assert.equal(isOverlayTap(stub('[role="menu"]')), true);
  assert.equal(isOverlayTap(stub('[data-radix-popper-content-wrapper]')), true);
  // 抽屉里的普通行、页面空白处都不是浮层
  assert.equal(isOverlayTap(stub('[class*="sessionRow"]')), false);
  assert.equal(isOverlayTap(stub()), false);
});

test('选择器常量与 MobileNavOverlay 的用法保持一致', () => {
  const src = readFileSync(new URL('../client/mobile/MobileNavOverlay.tsx', import.meta.url), 'utf8');
  assert.equal(DRAWER_SELECTOR, '[data-mobile-nav="frame"] > :first-child');
  assert.equal(TOGGLE_SELECTOR, '[data-mobile-nav="toggle"]');
  assert.ok(
    src.includes("document.querySelector<HTMLElement>(DRAWER_SELECTOR)"),
    '抽屉查询应复用 DRAWER_SELECTOR，避免与 CSS 里的选择器漂移',
  );
  assert.ok(src.includes('isOverlayTap(target)'), '点抽屉外的处理必须先豁免浮层（issue #72）');
  assert.ok(
    src.includes("event.pointerType !== 'touch'"),
    '触摸导航路径必须限定在 touch/pen，桌面鼠标不能受影响',
  );
  assert.ok(
    src.includes("attributeFilter: ['aria-selected']"),
    '触摸会话行必须等 aria-selected 变化后再关闭抽屉（上游 80b9d16 / issue #85）',
  );
  assert.ok(
    src.includes('pendingTouchRow !== null') && src.includes('&& isPendingTouchClick(event)'),
    '只有与待完成触摸位置/能力匹配的 click 才能绕过立即关闭，不能误伤鼠标',
  );
  assert.ok(
    src.includes('navClickArrived && selectedRow !== null && selectedRow !== selectedRowAtArm'),
    '必须等真实 click 到达且选中行变化，不能依赖可能被卸载或同名的旧 row',
  );
  assert.ok(
    src.includes("row.getAttribute('aria-selected') === 'true'"),
    '点击已选中会话时没有选择变化，必须直接关闭抽屉',
  );
  assert.ok(
    !src.includes("dispatchEvent(new MouseEvent('click'"),
    '不能再向 pointerup 保存的旧 DOM target 延迟补发 click（该节点已脱离 React 事件树）',
  );
  assert.ok(
    !/\[class\*="sessionRow"\],?\s*\[class\*="searchResultRow"\]/.test(src),
    '行选择器应集中在 nav-targets.mjs，组件里不要再内联一份',
  );
});

test('打包产物里带上抽屉规则的关键字', () => {
  const bundle = readFileSync(new URL('../client/client.js', import.meta.url), 'utf8');
  // client/client.js 是 esbuild 产物，跑测试前需先 npm run build:client
  for (const needle of ['sessionRow', 'searchResultWorkspace', 'role="menu"', 'pointerType']) {
    assert.ok(bundle.includes(needle), `打包产物缺少 "${needle}" —— 先跑 npm run build:client`);
  }
});

// ---------- 批次 1 其余移动端移植的守护测试 ----------

test('iOS 聚焦输入不再强制放大（8d5b3fa）：窄屏强制 16px 最小字号', () => {
  // iOS Safari 在聚焦 fontSize < 16px 的输入框时会把整页放大且不回弹；
  // 本 fork 的输入框内联 fontSize 只有 13–14px，必须在窄屏用 !important 顶到 16px。
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  assert.ok(css.includes('max-width: 1024px'), '恢复规则要限定窄屏，桌面端保持紧凑字号');
  assert.ok(css.includes('font-size: 16px !important'), '必须用 16px !important 压过内联字号');
  assert.ok(css.includes('[contenteditable="true"]'), 'contenteditable 同样会触发 iOS 放大');
});

test('抽屉层级压过 dsh-web-ui-all 全屏遮罩（88605d9 / issue #67）', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  assert.ok(css.includes('z-index: 1200 !important'), '抽屉要抬到 1200（对方的 1100/1050/1000 之上）');
  assert.ok(
    css.includes('[data-mobile-nav="frame"][data-mobile-nav="frame"]:not([data-sidebar-collapsed])::after'),
    '要用重复属性选择器提高特异性，稳定压过对方同特异性的遮罩规则',
  );
  assert.ok(css.includes('content: none !important'), '必须把对方 ::after 全屏遮罩关掉，否则点击被吃掉');
});

// ---------- 上游 7209de8 / 5c56d24 / f2e60b0 移植的守护测试 ----------

test('手机端右边栏默认显示，设置关闭后隐藏稳定 header corner 入口（上游 d2e0b46 / issue #122）', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  const apply = readFileSync(new URL('../client/mobile/mobile-apply.tsx', import.meta.url), 'utf8');
  assert.ok(
    css.includes('body[data-dsh-pocket-mobile-rightbar="off"] [data-conversation-header-corner]'),
    '仅在用户关闭设置时隐藏官方右栏入口',
  );
  assert.ok(
    !css.includes('[data-phase] header > :first-child > :last-child'),
    '不能依赖标题栏子元素顺序隐藏右栏入口（新版该位置就是原生右边栏入口）',
  );
  assert.ok(apply.includes('POCKET_ENDPOINTS.status'), '移动端启动时读取持久化设置');
  assert.ok(apply.includes('MOBILE_RIGHTBAR_EVENT'), '设置切换后立即同步右栏入口');
});

test('composer 弹层吸附为视口底部 sheet（上游 7209de8 / issue #88）', () => {
  // 模型下拉与 / 命令面板都是 scrollBody(overflow:hidden) 内的 position:absolute，
  // 手机上会被滚动容器拦腰裁掉。必须 fixed 吸附到视口 + 安全区，才能完整显示。
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  assert.ok(
    css.includes('[class$="_root"]:has(> [aria-haspopup="menu"]) > [role="menu"]'),
    '模型下拉要用稳定结构选择器命中',
  );
  assert.ok(css.includes('[class$="_card"]:has(> [class$="_search"])'), '/ 命令面板同样要吸附');
  assert.ok(css.includes('max-height: min(65dvh, 480px) !important'), '要有 dvh 上限与内部滚动');
  assert.ok(css.includes('env(safe-area-inset-bottom'), '底部要避开手势条');
});

test('composer 底栏用稳定 card 标记并在 360px 视口保持单行（上游 5c56d24）', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  assert.ok(css.includes('[data-composer-card="true"] > [class$="_row"]'));
  assert.ok(css.includes('flex-wrap: nowrap !important'));
  assert.ok(
    !css.includes('[class*="_card"]:has(textarea) > :last-child'),
    '会话 composer 底栏不能再依赖 textarea（编辑器已改 contenteditable）',
  );
});

test('统计行只从 composer.dock 标记，不误标 contenteditable composer 根节点（上游 5c56d24）', () => {
  const src = readFileSync(new URL('../client/mobile/mobile-apply.tsx', import.meta.url), 'utf8');
  assert.ok(
    src.includes('[data-slot="conversation.composer.dock"] [class$="_root"]'),
    '统计行必须限定在 DSH 的 conversation.composer.dock 稳定插槽内',
  );
  assert.ok(
    !src.includes("document.querySelectorAll('[data-phase] [class$=\"_root\"]')"),
    '不能扫描 composer 内所有 *_root；新版编辑器是 contenteditable，会让 composer 根误命中',
  );
  // 本 fork 额外保留的 button 守卫（上游没有），移植时不能丢。
  assert.ok(
    src.includes("root.querySelector('button') !== null"),
    'fork 自己的 input dock 误判守卫必须保留',
  );
});

test('侧边栏打开时弹出 aria-modal 弹窗会自动收起，不再卡死（上游 f2e60b0 / issue #99）', () => {
  const src = readFileSync(new URL('../client/mobile/MobileNavOverlay.tsx', import.meta.url), 'utf8');
  assert.ok(
    src.includes("node.matches('[aria-modal=\"true\"]')"),
    '要监听新出现的 aria-modal 节点',
  );
  assert.ok(
    src.includes('observer.observe(document.documentElement, { childList: true, subtree: true })'),
    '观察点挂在 documentElement 上，覆盖 portal 到 body 之外的弹窗',
  );
});
