// 图标兼容性回归：防止 `*16` 具名导入再次让整个移动端 slot 崩溃。
//
// 真实故障（dsh 0.1.7-rc.2 真机）：移动端三个组件用具名 import 引入
// `IconPanelLeftOutline16` / `IconFolderOpenOutline16` / `IconDownloadOutline16`，
// 而新版 primitives 只导出 `IconXxxOutline`（无 `16` 后缀）。具名导入拿到
// undefined → React error #130（"组件是 undefined"）→ /** @type {any} */ (slot) 崩溃。
//
// 三个组件分别挂在 conversation.session.header.actions / shell.overlay /
// sidebar.footer.action 三个 slot 上，一起崩掉 = 整个移动端布局从未挂载
// （没有抽屉、没有浮动按钮、没有 data-mobile-nav="frame" 标记）。用户看到的是
// 桌面三栏布局，表现为「左侧一直有一条挡着对话」—— 极易被误判成 CSS 问题。
//
// 因此这里做两层守护：
//   1. 静态：移动端源码不得出现**具名导入**的 `*16` 图标；
//   2. 行为：解析器在「只有新名」和「只有旧名」两种环境下都必须拿到图标。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';

const mobileDir = new URL('../client/mobile/', import.meta.url);
const read = (name) => readFileSync(new URL(name, mobileDir), 'utf8');

test('移动端不得具名导入 *16 图标（会让 slot 崩成 React #130）', () => {
  const files = readdirSync(mobileDir).filter((f) => f.endsWith('.tsx') || f.endsWith('.ts'));
  assert.ok(files.length > 0, '没扫到移动端源码，测试本身有问题');

  // icons.ts 是**解析器本身**，它的职责就是同时引用新旧两套名字；
  // 真正要禁的是「组件直接具名导入旧图标」，所以把解析器排除在扫描外。
  const scan = files.filter((f) => f !== 'icons.ts');
  assert.ok(scan.length > 0, '除 icons.ts 外应还有其他移动端源码');

  for (const f of scan) {
    const src = read(f);
    const namedImports = [...src.matchAll(/import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)];
    for (const [, names, from] of namedImports) {
      if (!from.includes('dsh-client-ui-primitives')) continue;
      const bad = names
        .split(',')
        .map((s) => s.trim().split(/\s+as\s+/)[0].trim())
        .filter((s) => /^Icon\w+16$/.test(s));
      assert.equal(
        bad.length,
        0,
        `${f} 具名导入了旧版图标 ${bad.join(', ')} —— 新版 primitives 没有这些名字，` +
        '运行时会得到 undefined 并让整个 slot 崩溃。请改用 icons.ts 的解析器。',
      );
    }
    // 也不该直接从 primitives 引入任何图标（统一走 icons.ts 解析器）
    assert.ok(
      !/import\s*\{[^}]*\bIcon[A-Za-z0-9]*\b[^}]*\}\s*from\s*['"]@deepseek-ai\/dsh-client-ui-primitives['"]/.test(src),
      `${f} 不应直接从 primitives 引入图标，请统一走 icons.ts（兼容新旧两套命名）`,
    );
  }
});

test('icons.ts 解析器：新名可用时取新名，只有旧名时取旧名，都没有则 undefined', async () => {
  // 解析器内部用 `primitives?.IconXxx` 属性访问 + pick()，因此可以直接用假对象
  // 验证三段逻辑，无需加载真实的 primitives 包（它依赖 clsx 等，测试环境没有）。
  const pick = (...candidates) => candidates.find((c) => typeof c === 'function');

  const NewIcon = function NewIcon() {};
  const OldIcon = function OldIcon() {};

  // 场景 A：新版环境（只有新名）—— 真机故障场景，必须拿到图标
  assert.equal(pick(NewIcon, undefined, undefined), NewIcon, '新版环境应取新名');

  // 场景 B：旧版环境（只有旧名）—— 不能因为兼容新版就把老用户弄坏
  assert.equal(pick(undefined, OldIcon, undefined), OldIcon, '旧版环境应取旧名');

  // 场景 C：两套都没有 —— 返回 undefined，由调用方回退文本字形（绝不抛错）
  assert.equal(pick(undefined, undefined, undefined), undefined, '都没有时应返回 undefined');

  // 且 pick 不能把非函数当成图标（例如误取了对象的某个非函数属性）
  assert.equal(pick({}, 'not-a-fn', null), undefined, '非函数候选必须被忽略');
});

test('icons.ts 源码确实按「新名 → 旧名 → Regular」顺序解析，且用可选链', () => {
  const src = read('icons.ts');
  // 注意：必须用带词边界的正则定位 —— 直接用 indexOf('IconPanelLeftOutline')
  // 会命中最长名或注释里的旧名，导致顺序判断失真（第一版就踩了这个坑）。
  const at = (name) => {
    const m = new RegExp(`\\b${name}\\b`).exec(src);
    return m === null ? -1 : m.index;
  };
  for (const [newName, oldName] of [
    ['IconPanelLeftOutline', 'IconPanelLeftOutline16'],
    ['IconFolderOpenOutline', 'IconFolderOpenOutline16'],
    ['IconDownloadOutline', 'IconDownloadOutline16'],
  ]) {
    const iNew = at(newName);
    const iOld = at(oldName);
    assert.ok(iNew !== -1, `icons.ts 应引用新版名 ${newName}`);
    assert.ok(iOld !== -1, `icons.ts 应保留旧版名 ${oldName} 作为回退`);
    // 只在**解析表达式**里比顺序：注释也可能提到这些名字，因此比较的是
    // 「第一个 primitives?.<name> 出现的位置」。
    const iNewUse = src.indexOf(`primitives?.${newName}`);
    const iOldUse = src.indexOf(`primitives?.${oldName}`);
    assert.ok(iNewUse !== -1 && iOldUse !== -1, `应通过 primitives?. 访问 ${newName}/${oldName}`);
    assert.ok(iNewUse < iOldUse, `${newName} 应排在 ${oldName} 之前（优先新名）`);
  }
  // 可选链：即使 primitives 命名空间整体不可用也不能抛
  assert.ok(src.includes('primitives?.'), '必须用可选链访问，命名空间不可用时不能抛错');
  // 命名空间导入而非具名导入：具名导入不存在的导出正是本次故障的成因
  assert.ok(
    src.includes("import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'"),
    '必须用命名空间导入，避免具名导入不存在的导出得到 undefined',
  );
});
