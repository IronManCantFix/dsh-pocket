// 插件入口的持久化根目录契约（上游 cab1e24 / issue #121）。
//
// 为什么单独测这个：隧道自动恢复的标记是在「开启隧道时写」、在「下次进程启动时读」，
// 两处必须落在同一个 base 上。上游 #121 的根因是入口只传 internals.home（真实部署下
// DSH 未必提供），而 service 内部又自行回退到 $DSH_HOME —— 同一路径被独立推导两次，
// 一旦不一致就出现「重启后公网隧道不自动恢复」，且不会报错，极难排查。
//
// 说明（避免误解这条测试的能力边界）：本 fork 的 service.mjs 早就有等价的
// `home ?? DSH_HOME ?? ~/.dsh` 回退，所以**把 index.js 那行改回 bare internals.home，
// 本测试依然通过**——真正被守住的是「整条链路端到端可用」这个契约：标记确实写进了
// DSH_HOME、卸载后保留、新实例确实自动恢复、手动关闭确实清标记。显式 home 覆盖的
// 优先级也是真实行为（这条在改动前同样成立）。上游那行修复在这里的价值是**消除重复
// 推导**（单一事实来源），不是修一个当前可复现的故障。
//
// 本测试走真实的 apply() → service → 文件系统链路，只替换网络/进程边界
// （createProxy / startTunnel）。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout } from 'node:timers/promises';

import { apply } from '../lib/index.js';
import { POCKET_ENDPOINTS } from '../client/api.js';

async function waitFor(check, message) {
  for (let i = 0; i < 200; i++) {
    if (await check()) return;
    await setTimeout(10);
  }
  assert.fail(message);
}

async function fixture(t) {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-pocket-home-'));
  const previous = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  const disposers = [];
  t.after(async () => {
    for (const dispose of disposers.reverse()) await dispose();
    if (previous === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = previous;
    await rm(dir, { recursive: true, force: true });
  });

  let starts = 0;
  let restores = 0;
  const logs = [];
  const cleanups = [];
  // dispose 时保留标记（keepAutoMarker），因此这里只统计「新实例自动恢复」的次数。
  const marker = (base = dir) => join(base, 'dsh-pocket', 'tunnel-auto.json');
  const hasMarker = async (base) =>
    /"at"\s*:/.test(await readFile(marker(base), 'utf8').catch(() => ''));

  function mount({ home } = {}) {
    let handler = null;
    let proxyReady = false;
    let disposed = false;
    let cleanup;
    const ctx = {
      webServer: { port: 3080 },
      // 走老版 DSH 的公开 rpc.handle 路径即可：本测试关心的是持久化 base，
      // 不是通道注册（后者由 web-rpc-compat.test.js 覆盖）。
      connection: { rpc: { handle: (_channel, fn) => { handler = fn; return () => {}; } } },
      get: () => undefined,
      logger: () => ({
        info(message) {
          logs.push(String(message));
          if (String(message).includes('proxy ready')) proxyReady = true;
          if (String(message).includes('auto-restored')) restores += 1;
        },
        warn() {},
        error() {},
      }),
      // effect 回调立即执行并收集 cleanup，供 dispose 时回放。
      effect: (callback) => {
        const result = callback();
        if (typeof result === 'function') cleanups.push(result);
      },
    };
    const disposeEntry = apply(ctx, {}, {
      ...(home === undefined ? {} : { home }),
      dshPort: 3080,
      createProxy: async () => ({ port: 0, close: async () => {} }),
      startTunnel: async () => {
        starts += 1;
        return { url: 'https://example.trycloudflare.com', kill() {} };
      },
      lanIPv4: () => '192.168.1.2',
      lanCandidates: async () => ['192.168.1.2'],
      encodeQr: async () => 'data:qr',
    });
    const dispose = async () => {
      if (disposed) return;
      disposed = true;
      for (const fn of cleanups.reverse()) await fn();
      if (typeof disposeEntry === 'function') await disposeEntry();
    };
    disposers.push(dispose);
    return {
      ready: () => waitFor(() => proxyReady, 'entry did not start its proxy'),
      call: (endpoint, payload = {}) => handler(endpoint, payload),
      dispose,
    };
  }

  return { dir, mount, hasMarker, starts: () => starts, restores: () => restores };
}

test('插件入口在 DSH_HOME 下落盘并恢复隧道标记（上游 cab1e24 / issue #121）', async (t) => {
  const f = await fixture(t);

  // 第一次挂载：显式开启公网隧道 → 标记必须落在 $DSH_HOME 下
  const first = f.mount();
  await first.ready();
  const started = await first.call(POCKET_ENDPOINTS.tunnelStart, { disclaimer: true });
  assert.equal(started.ok, true, '隧道开启成功');
  assert.equal(f.starts(), 1);
  await waitFor(() => f.hasMarker(), '入口没有把隧道标记写进 DSH_HOME');

  // 卸载（= 进程退出/重启）：标记必须保留，否则重启后不会自动恢复
  await first.dispose();
  assert.equal(await f.hasMarker(), true, '卸载后必须保留自动恢复标记（issue #107）');

  // 新实例启动：应按标记自动恢复
  const restarted = f.mount();
  await restarted.ready();
  await waitFor(() => f.restores() === 1, '新入口没有完成隧道自动恢复');
  assert.equal(f.starts(), 2, '自动恢复确实重新拉起了隧道');

  // 手动关闭：标记要清掉，避免下次又自动拉起
  const stopped = await restarted.call(POCKET_ENDPOINTS.tunnelStop);
  assert.equal(stopped.ok, true, '隧道关闭成功');
  await waitFor(async () => !(await f.hasMarker()), '手动关闭没有清除标记');
  await restarted.dispose();
});

test('显式传入 home 时优先于 DSH_HOME（上游 cab1e24）', async (t) => {
  const f = await fixture(t);
  const override = join(f.dir, 'override');
  const entry = f.mount({ home: override });
  await entry.ready();
  assert.equal((await entry.call(POCKET_ENDPOINTS.tunnelStart, { disclaimer: true })).ok, true);
  await waitFor(() => f.hasMarker(override), '显式 home 没有被使用');
  assert.equal(await f.hasMarker(), false, '显式 home 存在时不能再写 $DSH_HOME');
  await entry.dispose();
});
