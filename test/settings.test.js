// 局域网访问密码开关（issue #24）：默认开启、持久化、可关可开
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// 每个测试用独立 DSH_HOME，互不干扰（settings.mjs 每次调用都读磁盘/环境变量）
async function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'dshp-settings-'));
  const prev = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    return await fn(home);
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  }
}

test('局域网密码开关默认开启（无配置文件）', () => withHome(async () => {
  const { lanAuthEnabled } = await import('../lib/settings.mjs');
  assert.equal(lanAuthEnabled(), true, '默认开启');
}));

test('关闭 → 持久化到 settings.json，重新读取仍为关闭', () => withHome(async () => {
  const { lanAuthEnabled, setLanAuthEnabled, settingsPath } = await import('../lib/settings.mjs');
  assert.equal(setLanAuthEnabled(false), false, '返回关闭状态');
  assert.equal(lanAuthEnabled(), false, '立即生效（每次读磁盘）');
  const raw = JSON.parse(readFileSync(settingsPath(), 'utf8'));
  assert.equal(raw.lanAuthEnabled, false, 'settings.json 内容正确');
}));

test('再开 → true；settings.json 权限 0600', () => withHome(async () => {
  const { lanAuthEnabled, setLanAuthEnabled, settingsPath } = await import('../lib/settings.mjs');
  setLanAuthEnabled(false);
  assert.equal(setLanAuthEnabled(true), true, '重新开启');
  assert.equal(lanAuthEnabled(), true, '开启生效');
  assert.ok(existsSync(settingsPath()), '配置文件已创建');
  if (process.platform !== 'win32') {
    assert.equal(statSync(settingsPath()).mode & 0o777, 0o600, '权限 0600');
  }
}));

test('局域网地址覆盖：默认自动，设置/清除持久化，非法 IPv4 拒绝', () => withHome(async () => {
  const { lanIpOverride, setLanIpOverride, settingsPath } = await import('../lib/settings.mjs');
  assert.equal(lanIpOverride(), '', '默认自动');
  assert.equal(setLanIpOverride('100.119.24.44'), '100.119.24.44', '设置成功');
  assert.equal(lanIpOverride(), '100.119.24.44', '立即生效');
  const raw = JSON.parse(readFileSync(settingsPath(), 'utf8'));
  assert.equal(raw.lanIpOverride, '100.119.24.44', 'settings.json 内容正确');
  assert.throws(() => setLanIpOverride('999.1.1.1'), /IPv4/, '非法地址拒绝');
  assert.equal(setLanIpOverride(''), '', '清除覆盖');
  assert.equal(lanIpOverride(), '', '恢复自动');
}));

test('PIN 自定义标记（issue #33）：默认 false，设置/清除持久化，未知类型 false', () => withHome(async () => {
  const { pinCustom, setPinCustom } = await import('../lib/settings.mjs');
  assert.equal(pinCustom('public'), false, '默认未自定义');
  assert.equal(pinCustom('lan'), false, '默认未自定义');
  assert.equal(pinCustom('other'), false, '未知类型 false');
  setPinCustom('public', true);
  assert.equal(pinCustom('public'), true, '持久化生效');
  setPinCustom('public', false);
  assert.equal(pinCustom('public'), false, '可清除');
  assert.equal(pinCustom('lan'), false, '互不影响');
}));

test('setCustomPin / rotateAccessToken（issue #33）：8 位数字自定义 + 自定义后公网不轮换；非法输入抛错', () => withHome(async () => {
  const { setCustomPin, rotateAccessToken, getAccessToken } = await import('../lib/index.js');
  const { pinCustom } = await import('../lib/settings.mjs');
  // 非法输入（527abba + 230039f：自定义放宽到 8–64 位英文字母大小写或数字）
  assert.throws(() => setCustomPin('public', '123'), /8–64 位/, '太短拒绝');
  assert.throws(() => setCustomPin('public', 'a1'.repeat(33)), /8–64 位/, '超过 64 位拒绝（65 位）');
  assert.throws(() => setCustomPin('public', 'abcdefg!'), /8–64 位/, '含字母数字以外的字符拒绝');
  assert.throws(() => setCustomPin('other', '12345678'), /未知/, '未知类型拒绝');
  // 新的合法形态：字母、字母+数字、正好 8 位与正好 64 位
  assert.equal(setCustomPin('lan', 'abcd1234'), 'abcd1234', '纯字母+数字的 8 位可自定义');
  assert.equal(setCustomPin('lan', 'x'.repeat(64)), 'x'.repeat(64), '64 位边界值可用');
  assert.equal(setCustomPin('lan', '77775555'), '77775555', '恢复 8 位数字形态');
  // 合法自定义：公网
  assert.equal(setCustomPin('public', '88886666'), '88886666', '公网自定义成功');
  assert.equal(pinCustom('public'), true, '公网标记自定义');
  assert.equal(getAccessToken(), '88886666', '值已写入');
  // 自定义后 rotateAccessToken 不轮换（值保持）
  assert.equal(rotateAccessToken(), '88886666', '自定义后开启公网不换新');
  assert.equal(getAccessToken(), '88886666', '值未被覆盖');
  // 合法自定义：局域网
  assert.equal(setCustomPin('lan', '77775555'), '77775555', '局域网自定义成功');
  assert.equal(pinCustom('lan'), true, '局域网标记自定义');
}));

// ---------- 恢复出厂设置（672b31b，含本 fork 的 NAS/frp 清理） ----------

test('恢复出厂设置：清空全部设置（含 NAS/frp 令牌与配置）+ 重设随机密码', () => withHome(async (home) => {
  const settings = await import('../lib/settings.mjs');
  const { setCustomPin, getAccessToken, resetPocketState } = await import('../lib/index.js');
  // 先把设置搞成非默认（lanEnabled 总开关是本 fork 后续批次才有的，这里不涉及）
  settings.setLanAuthEnabled(false);
  settings.setLanIpOverride('10.0.0.7');
  settings.setFrpConfig({ serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 13081, tls: true });
  settings.setFrpToken('nas-connect-token-1');
  const customPublic = setCustomPin('public', 'aB3xY9k2');
  const customLan = setCustomPin('lan', '77775555');
  assert.equal(existsSync(settings.settingsPath()), true, '设置文件已写入');
  assert.equal(settings.frpToken(), 'nas-connect-token-1', 'NAS 令牌已写入');

  const after = resetPocketState();
  assert.notEqual(after.accessToken, customPublic, '公网密码已换新（旧密码作废）');
  assert.notEqual(after.lanToken, customLan, '局域网密码已换新');
  assert.match(after.accessToken, /^\d{8}$/, '新公网密码是 8 位随机');
  assert.match(after.lanToken, /^\d{8}$/, '新局域网密码是 8 位随机');

  // 开关回到出厂默认
  assert.equal(settings.lanAuthEnabled(), true, '访问密码恢复默认开');
  assert.equal(settings.lanIpOverride(), '', '局域网地址恢复自动');
  assert.equal(settings.pinCustom('public'), false, '公网自定义标记已清除');
  assert.equal(settings.pinCustom('lan'), false, '局域网自定义标记已清除');
  assert.equal(getAccessToken(), after.accessToken, '读到的公网密码与返回一致');

  // 本 fork 的 NAS 反向隧道：配置与令牌一起清空（否则重置后还留着别人的 frps 凭据）
  assert.equal(settings.frpToken(), null, 'NAS 连接令牌一并清空');
  assert.deepEqual(settings.frpConfig(), { serverAddr: '', serverPort: 7000, remotePort: 7001, tls: false }, 'NAS 配置恢复默认');
}));
