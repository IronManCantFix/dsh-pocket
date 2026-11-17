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
  assert.equal(DRAWER_SELECTOR, '[data-mobile-nav="frame"] > [class*="_sidebarCol"]');
  assert.equal(TOGGLE_SELECTOR, '[data-mobile-nav="toggle"], [data-sidebar-opener]');
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

test('手机端模型设置加载失败改引导提示（上游 5ab2ad4）', () => {
  // 手机侧本就不支持改模型设置，上游 dsh-web 的原始报错文案只会吓到用户；
  // 窄屏下就地把报错替换成「去电脑端修改」的引导。仅手机生效，桌面端不动。
  const src = readFileSync(new URL('../client/mobile/mobile-apply.tsx', import.meta.url), 'utf8');
  assert.ok(src.includes("'加载提供方目录失败'"), '要认上游 dsh-web 的中文报错文案');
  assert.ok(
    src.includes("'Settings are unavailable in this browser'"),
    '英文界面下同一报错也要覆盖',
  );
  assert.ok(src.includes('dshpModelNotice'), '要有幂等标记，避免 observer 反复改写同一节点');
  assert.ok(src.includes('findDeepest'), '要取最深节点，不能把外层容器整块清掉');
  assert.ok(src.includes('if (!narrow.matches) return'), '必须限定窄屏，桌面端不受影响');
});

test('手机端右边栏默认显示，设置关闭后隐藏稳定 header corner 入口（上游 d2e0b46 / issue #122）', () => {  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
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

test('抽屉收起时不残留窄条：位移用视口宽度 + 兜底隐藏（真机反馈）', () => {
  // 真机现象：装了第三方侧边栏插件时，translateX(-110%) 的百分比基准是抽屉
  // **自身宽度**（width:max-content），该宽度可能算成折叠 rail 的 ~20–40px，
  // 于是只移出几十像素，左侧残留一条带图标的窄条挡住对话。
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  // 注意：断言只针对**声明本体**，不针对注释 —— 注释里会引述旧写法作对比，
  // 因此先剥掉 /* … */ 注释块再检查。
  const drawerRule = css
    .slice(
      css.indexOf('[data-mobile-nav="frame"] > [class*="_sidebarCol"] {'),
      css.indexOf('[data-mobile-nav="frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"]'),
    )
    .replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(drawerRule.length > 0, '切出的抽屉规则不能为空（否则断言会假通过）');
  assert.ok(
    drawerRule.includes('transform: translateX(-100vw)'),
    '收起态必须用视口宽度位移，不能依赖抽屉自身宽度',
  );
  assert.ok(
    !drawerRule.includes('translateX(-110%)'),
    '规则本体不能再用自身宽度百分比位移（第三方侧边栏下会残留窄条）',
  );
  // B 兜底：收起态隐藏该列；必须用 visibility 而非 display，否则列脱离网格会让
  // 第 2/3 列的显式 grid-column 错位（issue #5 的教训）。
  assert.ok(
    css.includes('[data-mobile-nav="frame"][data-sidebar-collapsed] > [class*="_sidebarCol"]'),
    '收起态要有兜底隐藏规则',
  );
  assert.ok(
    /\[data-mobile-nav="frame"\]\[data-sidebar-collapsed\] > \[class\*="_sidebarCol"\] \{\s*visibility: hidden/.test(css),
    '兜底要用 visibility: hidden（display:none 会使列脱离网格导致错位）',
  );
  // 展开态仍须可见：两条规则互斥（有/无 data-sidebar-collapsed）。
  assert.ok(
    css.includes('[data-mobile-nav="frame"]:not([data-sidebar-collapsed]) > [class*="_sidebarCol"]'),
    '展开态规则必须保留（含 transform:none 的定位语义）',
  );
});

test('DSH 0.2.2 自带抽屉：按类名定位 AppFrame 列，不再依赖子元素序号', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  const nav = readFileSync(new URL('../client/mobile/nav-targets.mjs', import.meta.url), 'utf8');
  // 0.2.2 的 AppFrame 在窄屏开启自带抽屉（.frame[data-sidebar-drawer]），并在
  // frame 里插入 div[data-sidebar-mask] 作为第一个子元素。位置选择器因此整体
  // 错位：> :first-child 命中遮罩、> :nth-child(2) 命中侧边栏列，主内容列留在
  // 0px 的第 2 轨 —— 手机上整个会话界面消失，只剩左侧栏/背景。
  assert.ok(
    /\[data-mobile-nav="frame"\]\s*>\s*\[class\*="_centerCol"\]\s*\{[^}]*grid-column:\s*1\s*!/.test(css),
    '主内容列必须按类名（_centerCol）拉回第 1 轨，不能按子元素序号',
  );
  assert.ok(
    /\[data-mobile-nav="frame"\]\s*>\s*\[class\*="_sidebarCol"\]\s*\{[^}]*position:\s*absolute\s*!/.test(css),
    '抽屉列必须按类名（_sidebarCol）定位，不能按 :first-child',
  );
  assert.ok(
    !/\[data-mobile-nav="frame"\]\s*>\s*:nth-child\(2\)/.test(css),
    '不能再出现按序号定位主内容列的规则（0.2.2 会错位到侧边栏列）',
  );
  assert.ok(
    !/\[data-mobile-nav="frame"\]\[?[^\s>]*\]?\s*>\s*:first-child\s*\{/.test(css),
    '不能再出现按 :first-child 定位抽屉的规则（0.2.2 首个子元素是遮罩）',
  );
  // 宿主自带遮罩会二次 toggle：必须摘掉，只留插件自己的 backdrop。
  assert.ok(
    /\[data-mobile-nav="frame"\]\s*>\s*\[data-sidebar-mask\]\s*\{\s*display:\s*none/.test(css),
    '必须隐藏宿主 0.2.2 自带的 [data-sidebar-mask]',
  );
  // 宿主自带开抽屉按钮时让位，避免三个入口重叠。
  assert.ok(
    css.includes(':has([data-sidebar-opener]) [data-mobile-nav="toggle"]'),
    '有 [data-sidebar-opener] 时要隐藏插件自绘的 toggle',
  );
  // 抽屉本体 / 开关常量同步到类名与官方 opener。
  assert.match(nav, /DRAWER_SELECTOR = '\[data-mobile-nav="frame"\] > \[class\*="_sidebarCol"\]'/);
  assert.match(nav, /TOGGLE_SELECTOR = '\[data-mobile-nav="toggle"\], \[data-sidebar-opener\]'/);
});

test('body 级 portal 浮层必须高于抽屉，否则抽屉里的「更多」菜单看不见 —— issue #88', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  // DSH 的 Menu / Tooltip 把浮层 createPortal 到 document.body，和抽屉不在
  // 同一个层叠上下文里，只能靠 z-index 比大小（Menu/Tooltip 都是 1100，抽屉 1200）。
  const drawerZ = Number(
    css.slice(css.indexOf('> [class*="_sidebarCol"] {')).match(/z-index:\s*(\d+)\s*!/)[1],
  );
  const portalRule = css.match(
    /body\s*>\s*\[role="menu"\][\s\S]{0,400}?\{[^}]*z-index:\s*(\d+)\s*!/,
  );
  assert.ok(portalRule, '缺少把 body 级 [role="menu"] 抬到抽屉之上的规则');
  const portalZ = Number(portalRule[1]);
  assert.ok(portalZ > drawerZ, `浮层 z-index ${portalZ} 必须高于抽屉 ${drawerZ}`);
  assert.ok(portalZ < 9999, `浮层 z-index ${portalZ} 不该盖住视口级 banner/toast（9999）`);
  // Tooltip 气泡 / toast 同样是 body 级 portal，也要一起抬。
  assert.ok(
    /body\s*>\s*\[role="tooltip"\]/.test(css) && /body\s*>\s*\[data-portal\]/.test(css),
    'Tooltip 的 portal 气泡（[role="tooltip"] / [data-portal]）要一起抬',
  );
  assert.ok(/body\s*>\s*\[role="alert"\]/.test(css), 'toast（[role="alert"]）也要抬到抽屉之上');
  // 只抬 body 的直接子元素：被 portal 进抽屉内部的浮层要保持自己的层叠上下文。
  assert.ok(
    !/\[data-mobile-nav="frame"\]\s+\[role="menu"\]/.test(css),
    '不要在抽屉内部再抬一次 [role="menu"]（会顶掉抽屉内对话框的层级）',
  );
});

test('body 级模态层必须高于抽屉，否则展开的侧边栏会挡住「设置」窗口', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  const drawerZ = Number(
    css.slice(css.indexOf('> [class*="_sidebarCol"] {')).match(/z-index:\s*(\d+)\s*!/)[1],
  );
  const modalRule = css.match(
    /body\s*>\s*\[role="presentation"\][\s\S]{0,400}?\{[^}]*z-index:\s*(\d+)\s*!/,
  );
  assert.ok(modalRule, '缺少把 body 级模态层（设置面板 / Modal）抬到抽屉之上的规则');
  const modalZ = Number(modalRule[1]);
  assert.ok(modalZ > drawerZ, `模态层 z-index ${modalZ} 必须高于抽屉 ${drawerZ}`);
  assert.ok(modalZ < 9999, `模态层 z-index ${modalZ} 不该盖住视口级 banner/toast（9999）`);
  // 菜单层要高于模态层，设置面板里的下拉才能盖住面板本身。
  const portalZ = Number(
    css.match(/body\s*>\s*\[role="menu"\][\s\S]{0,400}?\{[^}]*z-index:\s*(\d+)\s*!/)[1],
  );
  assert.ok(portalZ > modalZ, `菜单层 ${portalZ} 必须高于模态层 ${modalZ}`);
  assert.ok(
    /body\s*>\s*\[role="dialog"\]\[aria-modal="true"\]/.test(css),
    'body 级 [role="dialog"][aria-modal="true"]（账号平台浮层）要一起抬',
  );
});

test('会话头部放不下时横向滚动，而不是让 chip 互相压盖', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  // 取「某个选择器后面第一个 { ... }」的规则体，避免整份 CSS 里别处的同名声明干扰断言。
  const ruleBody = (selector) => {
    const at = css.indexOf(selector);
    assert.ok(at >= 0, `缺少选择器 ${selector}`);
    const open = css.indexOf('{', at);
    const close = css.indexOf('}', open);
    return css.slice(open + 1, close);
  };
  const cluster = '[data-phase] header [class$="_titleRow"] [class$="_titleCluster"]';
  const body = ruleBody(`${cluster} {`);
  assert.ok(body.includes('overflow-x: auto !important'), '头部集群必须能横向滚动');
  assert.ok(body.includes('overflow-y: hidden !important'), '只滚动横轴，纵向不能把 chip 裁成半截');
  assert.ok(body.includes('scrollbar-width: thin'), '滚动条要细，36px 的头部容不下常规滚动条');
  // 子元素不再压缩：压缩正是 chip 溢出后互相压盖的成因
  assert.ok(
    ruleBody(`${cluster} > * {`).includes('flex: 0 0 auto !important'),
    '集群子元素必须保持固有宽度',
  );
  // 滚动容器是集群，不是整行：右侧 utilities / corner 必须保持固定可点
  assert.ok(
    !/\[class\$="_titleRow"\]\s*\{[^}]*overflow-x/.test(css),
    '不能让整行滚动，否则右栏入口会被推出视口',
  );
  // 细滚动条样式（webkit 需要显式高度才不是 overlay 隐藏态）
  assert.ok(
    css.includes(`${cluster}::-webkit-scrollbar {`),
    '必须给 webkit 定义细滚动条，否则手机上默认是滑动才出现的 overlay',
  );
});

test('issue #181：排版规则不覆盖输入框几何，控制行换行后不被固定行高裁掉', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  const exclude = ':has(p):not([data-input-scroll])';
  assert.equal(css.split(exclude).length - 1, 4, 'padding 与 font-size 两组规则都要排除 [data-input-scroll]');
  assert.ok(
    !/\[class\$="_scroll"\]:has\(p\)\s*[{,p]/.test(css),
    '不能留下未排除输入框的 :has(p) 选择器（会压掉皮肤给发送键预留的 padding-right）',
  );
  assert.match(css, /height: auto !important;\s*min-height: 28px !important;/, '换行必须配自适应高度');
  assert.match(css, /max-height: none !important;\s*overflow: visible !important;/, '第二行控件不能被 28px 行盒裁掉');
});

test('issue #196：抽屉工作区保底高度 + 侧栏列可滚动', () => {
  const css = readFileSync(new URL('../client/mobile/mobile.css.ts', import.meta.url), 'utf8');
  assert.match(css, /min-height: min\(55vh, 420px\) !important/, '矮屏上工作区不能被压成 0 高');
  assert.match(css, /\[data-mobile-nav="frame"\] :has\(> \[class\$="_regionArea"\]\)/, '按直接子级定位列根，不靠子元素序号');
  assert.match(css, /overflow-y: auto !important/, '上下固定区块溢出时仍能滚到工作区');
  assert.match(css, /overscroll-behavior: contain !important/);
});
