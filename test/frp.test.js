// NAS 反向隧道（frp）：配置校验 / frpc.toml 渲染 / 隧道状态机 / settings 持久化 / service 集成
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync, readFileSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { normalizeFrpConfig, renderFrpcToml, startFrpTunnel, FRP_VERSION } from '../lib/frp-tunnel.mjs';

// ---------- normalizeFrpConfig ----------

test('frp 配置校验：合法配置归一化（域名/端口/TLS）', () => {
  assert.deepEqual(normalizeFrpConfig({ serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001 }), {
    serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001, tls: false,
  });
  // 容错：带协议前缀/尾斜杠、字符串端口
  assert.deepEqual(normalizeFrpConfig({ serverAddr: 'https://nas.example.com/', serverPort: '7000', remotePort: '7001', tls: 'true' }), {
    serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001, tls: true,
  });
  // IP 也合法
  assert.equal(normalizeFrpConfig({ serverAddr: '1.2.3.4' }).serverAddr, '1.2.3.4');
});

test('frp 配置校验：非法输入抛错', () => {
  assert.throws(() => normalizeFrpConfig({}), /NAS 地址/, '缺地址拒绝');
  assert.throws(() => normalizeFrpConfig({ serverAddr: 'bad host!' }), /格式不合法/, '非法字符拒绝');
  assert.throws(() => normalizeFrpConfig({ serverAddr: 'a.com', serverPort: 0 }), /1-65535/, '端口 0 拒绝');
  assert.throws(() => normalizeFrpConfig({ serverAddr: 'a.com', serverPort: 70000 }), /1-65535/, '端口超界拒绝');
  assert.throws(() => normalizeFrpConfig({ serverAddr: 'a.com', remotePort: 1.5 }), /1-65535/, '非整数拒绝');
  assert.throws(() => normalizeFrpConfig({ serverAddr: 'a.com', serverPort: 7001, remotePort: 7001 }), /不能相同/, '服务端口=转发端口拒绝');
});

// ---------- renderFrpcToml ----------

test('frpc.toml 渲染：含地址/token/代理块；TLS 可选', () => {
  const cfg = normalizeFrpConfig({ serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001 });
  const toml = renderFrpcToml(cfg, 'secret-token-123', 3081);
  assert.ok(toml.includes('serverAddr = "nas.example.com"'), 'serverAddr 带引号');
  assert.ok(toml.includes('serverPort = 7000'), 'serverPort');
  assert.ok(toml.includes('auth.token = "secret-token-123"'), 'token');
  assert.ok(toml.includes('localPort = 3081'), '转发目标为本机代理端口');
  assert.ok(toml.includes('remotePort = 7001'), 'remotePort');
  assert.ok(!toml.includes('transport.tls'), '默认不开 TLS');

  const tlsCfg = normalizeFrpConfig({ serverAddr: 'nas.example.com', tls: true });
  assert.ok(renderFrpcToml(tlsCfg, 'x'.repeat(16), 3081).includes('transport.tls.enable = true'), 'TLS 开启时渲染 tls 块');
});

// ---------- startFrpTunnel 状态机（真实假 frpc 脚本） ----------

async function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'dshp-frp-'));
  const prev = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  try {
    return await fn(home); // 必须 await：finally 要等异步体跑完再删目录
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = prev;
    rmSync(home, { recursive: true, force: true });
  }
}

/** 在 home/dsh-pocket/bin/frpc 放一个假 frpc 可执行脚本（输出指定行后长驻/退出）。 */
function fakeFrpc(home, { stdout = 'login to server success, get run id abc', exit = false } = {}) {
  const dir = join(home, 'dsh-pocket', 'bin');
  mkdirSync(dir, { recursive: true });
  const bin = join(dir, 'frpc');
  const lines = ['#!/bin/sh', `echo '${stdout}'`];
  if (exit) lines.push('exit 1');
  else lines.push('sleep 60');
  writeFileSync(bin, lines.join('\n') + '\n', { mode: 0o755 });
  chmodSync(bin, 0o755);
  return bin;
}

const READY_CFG = { serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001, tls: false };

test('frp 隧道：假 frpc 输出成功串 → ready', async () => withHome(async (home) => {
  fakeFrpc(home);
  const phases = [];
  const handle = await startFrpTunnel({ localPort: 3081, config: READY_CFG, token: 'secret-token-123', home, onPhase: (p) => phases.push(p) });
  assert.ok(phases.includes('downloading') || phases.includes('starting'), '经过 starting 阶段（缓存命中时无 downloading）');
  assert.ok(phases.includes('connecting'), '经过 connecting 阶段');
  assert.ok(phases.includes('ready'), '到达 ready');
  // frpc.toml 已写出且权限 0600
  const cfgPath = join(home, 'dsh-pocket', 'frpc.toml');
  assert.ok(existsSync(cfgPath), 'frpc.toml 已写出');
  if (process.platform !== 'win32') {
    assert.equal(statSync(cfgPath).mode & 0o777, 0o600, 'frpc.toml 权限 0600');
  }
  handle.kill(); // 清理假 frpc（sleep 60），避免挂住测试进程
}));

test('frp 隧道：假 frpc 输出失败串 → error 且 reject', async () => withHome(async (home) => {
  fakeFrpc(home, { stdout: 'login to server error: token is not correct', exit: true });
  const phases = [];
  await assert.rejects(
    () => startFrpTunnel({ localPort: 3081, config: READY_CFG, token: 'secret-token-123', home, onPhase: (p) => phases.push(p) }),
    /连接失败|token/,
    '连接失败要 reject',
  );
  assert.ok(phases.includes('error'), '状态机到 error');
}));

test('frp 隧道：token 过短直接抛错（不 spawn）', async () => withHome(async (home) => {
  await assert.rejects(
    () => startFrpTunnel({ localPort: 3081, config: READY_CFG, token: 'short', home }),
    /至少 8 位/,
    'token 太短拒绝',
  );
}));

test('frp 隧道：进程运行中退出 → onExit 通知（kill 后触发）', async () => withHome(async (home) => {
  const bin = fakeFrpc(home);
  const handle = await startFrpTunnel({ localPort: 3081, config: READY_CFG, token: 'secret-token-123', home });
  const exited = new Promise((resolve) => handle.onExit((code) => resolve(code)));
  handle.kill();
  const code = await exited;
  assert.equal(code, null, 'kill 后触发 onExit'); // SIGTERM 默认退出码 null（被信号终止）
  // 清理：脚本仍在 sleep，确保杀掉
  try { execSync(`pkill -f '${bin}' 2>/dev/null || true`); } catch { /* 忽略 */ }
}));

// ---------- settings 持久化 ----------

test('settings：frp 配置默认值 / 校验持久化 / token 文件 0600', () => withHome(async () => {
  const { frpConfig, setFrpConfig, frpToken, setFrpToken, settingsPath } = await import('../lib/settings.mjs');
  assert.deepEqual(frpConfig(), { serverAddr: '', serverPort: 7000, remotePort: 7001, tls: false }, '默认值');
  assert.equal(frpToken(), null, '默认无 token');

  const saved = setFrpConfig({ serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001, tls: true });
  assert.deepEqual(saved, { serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001, tls: true }, '返回新配置');
  assert.deepEqual(frpConfig(), saved, '持久化生效');
  const raw = JSON.parse(readFileSync(settingsPath(), 'utf8'));
  assert.deepEqual(raw.frp, saved, 'settings.json 内容正确');

  assert.throws(() => setFrpConfig({ serverAddr: '' }), /NAS 地址/, '非法配置拒绝且不落盘');
  assert.deepEqual(frpConfig(), saved, '拒绝后配置未变');

  assert.equal(setFrpToken('my-secret-token'), 'my-secret-token', 'token 写入');
  assert.equal(frpToken(), 'my-secret-token', 'token 读回');
  const tokenPath = join(process.env.DSH_HOME, 'dsh-pocket', 'frp-token');
  if (process.platform !== 'win32') {
    assert.equal(statSync(tokenPath).mode & 0o777, 0o600, 'token 文件权限 0600');
  }
  assert.throws(() => setFrpToken('short'), /至少 8 位/, 'token 太短拒绝');
}));

// ---------- service 集成 ----------

test('service：frp 隧道生命周期 + status 不含 token + 自动恢复', async () => {
  const { createPocketService } = await import('../lib/service.mjs');
  const home = mkdtempSync(join(tmpdir(), 'dshp-frp-svc-'));
  try {
    let started = 0;
    let stopped = 0;
    const cfg = { serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001, tls: false, token: 'secret-token-123' };
    const service = createPocketService({
      dshPort: 3080,
      port: 0,
      home,
      getFrpConfig: () => cfg,
      internals: {
        createProxy: async () => ({ port: 3081, close: async () => {} }),
        startFrpTunnel: async () => {
          started++;
          return { kill: () => { stopped++; }, onExit: () => () => {} };
        },
      },
    });
    await service.startProxy();

    // 未开启时 status
    let st = await service.status();
    assert.equal(st.frpRunning, false, '初始未运行');
    assert.deepEqual(st.frpConfig, { serverAddr: 'nas.example.com', serverPort: 7000, remotePort: 7001, tls: false }, 'status 含配置');
    assert.equal(st.frpHasToken, true, 'status 标记有 token');
    assert.equal(JSON.stringify(st).includes('secret-token-123'), false, 'token 绝不进 status');

    // 开启
    await service.startFrpTunnel();
    assert.equal(started, 1, '启动一次');
    st = await service.status();
    assert.equal(st.frpRunning, true, 'frp 运行中');
    assert.equal(st.frpState.phase, 'ready', '状态 ready');

    // 幂等：重复调用不重复 spawn
    await service.startFrpTunnel();
    assert.equal(started, 1, '幂等，不重复启动');

    // 自动恢复标记（persistAutoFrp 是异步 fire-and-forget，轮询等待落盘）
    const marker = join(home, 'dsh-pocket', 'tunnel-auto-frp.json');
    for (let i = 0; i < 20 && !existsSync(marker); i++) await new Promise((r) => setTimeout(r, 10));
    assert.ok(existsSync(marker), '开启后写自动恢复标记');
    service.stopFrpTunnel();
    assert.equal(stopped, 1, 'stop 调用 kill');
    for (let i = 0; i < 20 && existsSync(marker); i++) await new Promise((r) => setTimeout(r, 10));
    assert.equal(existsSync(marker), false, '手动关闭清除标记');

    // 自动恢复：写标记 → restoreFrpIfNeeded 重新拉起
    mkdirSync(join(home, 'dsh-pocket'), { recursive: true });
    writeFileSync(marker, JSON.stringify({ at: Date.now() }), 'utf8');
    await service.restoreFrpIfNeeded();
    assert.equal(started, 2, '自动恢复重新启动');
    assert.equal((await service.status()).frpRunning, true, '恢复后运行中');

    await service.dispose();
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('service：frp 配置不完整时 startFrpTunnel 抛错 / 自动恢复跳过', async () => {
  const { createPocketService } = await import('../lib/service.mjs');
  const home = mkdtempSync(join(tmpdir(), 'dshp-frp-svc2-'));
  try {
    const service = createPocketService({
      dshPort: 3080,
      port: 0,
      home,
      getFrpConfig: () => null, // 未配置
      internals: {
        createProxy: async () => ({ port: 3081, close: async () => {} }),
        startFrpTunnel: async () => { throw new Error('should not be called'); },
      },
    });
    await service.startProxy();
    await assert.rejects(() => service.startFrpTunnel(), /请先填写/, '配置不完整抛错');
    await service.restoreFrpIfNeeded(); // 无标记 → 直接返回
    assert.equal((await service.status()).frpRunning, false);
    await service.dispose();
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('FRP_VERSION 与部署模板一致（deploy/nas/docker-compose.yml 的镜像 tag）', () => {
  const compose = readFileSync(new URL('../deploy/nas/docker-compose.yml', import.meta.url), 'utf8');
  assert.ok(compose.includes(`snowdreamtech/frps:${FRP_VERSION}-alpine`), 'NAS 镜像 tag 与插件内置 frpc 版本一致');
});
