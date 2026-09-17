// 设置页 i18n 词典完整性（PR #36）：zh/en key 集合必须一致、占位符一致、
// 源码 t()/fmt() 引用的 key 必须都在词典中——防止加字符串时 key 不同步（英文漏翻/白屏 key）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { NS, zh, en } = await import('../client/pocket-locales.js');

const ph = (s) => [...String(s).matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

test('pocket 词典：zh/en key 集合完全一致', () => {
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  assert.deepEqual(enKeys, zhKeys, 'en 与 zh 的 key 必须一一对应');
  assert.ok(zhKeys.length >= 40, `词典 key 数异常（${zhKeys.length}）——i18n 重构后应有 40+`);
});

test('pocket 词典：占位符 {placeholder} 在 zh/en 中一致', () => {
  for (const key of Object.keys(zh)) {
    assert.deepEqual(ph(en[key]), ph(zh[key]), `key "${key}" 的占位符在 zh/en 不一致`);
  }
});

test('pocket 词典：源码 t()/fmt() 引用的 key 都在词典中', () => {
  const src = readFileSync(new URL('../client/index.jsx', import.meta.url), 'utf8');
  const used = new Set();
  for (const m of src.matchAll(/\bt\('([^']+)'\)/g)) used.add(m[1]);
  for (const m of src.matchAll(/fmt\(t,\s*'([^']+)'/g)) used.add(m[1]);
  const missing = [...used].filter((k) => !(k in zh));
  assert.deepEqual(missing, [], '源码引用了词典中不存在的 key');
  // section 经 translate() 调用，单独校验
  assert.equal(zh.section, '手机访问', 'tab 标签中文');
  assert.equal(en.section, 'Phone access', 'tab 标签英文');
  assert.equal(NS, 'pocket', 'namespace 固定');
});

test('后端错误消息按界面语言只显示对应一半（bd79283）', () => {
  // 后端错误统一为「中文 | English」混排；设置页用 errText() 按当前语言取一半。
  const src = readFileSync(new URL('../client/index.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('const errText = (msg)'), 'index.jsx 需要 errText helper');
  assert.ok(src.includes("s.indexOf(' | ')"), '按 " | " 切分中英两半');
  assert.ok(
    src.includes("t('ok') === POCKET_ZH.ok"),
    '用词典里 ok 的中文值判定当前语言（zh → 取前半，en → 取后半）',
  );
  assert.ok(src.includes('POCKET_ZH'), '必须 import 中文词典用于语言判定');
  for (const site of ['customPin.err', 'tunnelStateDetail', 'error']) {
    assert.ok(
      new RegExp(`errText\\(\\s*${site.replace('.', '\\.')}`).test(src),
      `渲染 ${site} 时必须过 errText()，否则英文界面会看到中文半句`,
    );
  }
});

test('自定义密码输入放宽到 8–64 位字母数字（527abba + 230039f）', () => {
  const src = readFileSync(new URL('../client/index.jsx', import.meta.url), 'utf8');
  assert.ok(src.includes('minLength: 8'), '输入框下限 8 位');
  assert.ok(src.includes('maxLength: 64'), '输入框上限 64 位');
  assert.ok(
    src.includes("e.target.value.replace(/[^a-zA-Z0-9]/g, '')"),
    '只过滤字母数字以外的字符（此前是 replace(/\\D/g) 只允许数字）',
  );
  assert.ok(zh.pinInvalid.includes('8–64'), '中文错误文案要说明新范围');
  assert.ok(en.pinInvalid.includes('8–64'), '英文错误文案要说明新范围');
});
