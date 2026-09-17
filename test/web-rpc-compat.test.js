// 通道注册兼容性回归：DSH 0.9.0（dsh 0.1.5-rc.2）起 connection 插件不再向自身 fiber
// 注入 webServer，`connection.rpc.handle()` 内部解析 owner.webServer 会抛
// `cannot get property "webServer" without inject`，插件 apply 直接失败并拖垮整棵插件树。
// 修复：优先公开 API，探测不可用时退回 connection.register(插件自己的 ctx, ...)。

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { installPocketRpc } from '../lib/web-rpc.js';
import { POCKET_RPC_CHANNEL, POCKET_ENDPOINTS } from '../client/api.js';

const WEB_SERVER_ERROR = 'cannot get property "webServer" without inject';

/** 假 service：RPC status 端点需要的最小实现（不碰网络/磁盘）。 */
function fakeService() {
  return {
    dshPort: 3080,
    async status() {
      return { proxyRunning: true, proxyPort: 3081, dshPort: 3080 };
    },
  };
}

function quietLog() {
  const lines = [];
  return {
    lines,
    warn: (...args) => lines.push(['warn', args]),
    error: (...args) => lines.push(['error', args]),
  };
}

/** 新版 DSH 的 connection 服务形态：rpc.handle 必抛，register 是可用退路。 */
function fakeNewDshConnection() {
  const state = { handleCalls: 0, registerCalls: [], handler: null, disposed: false };
  // connection 服务注册时的 ctx：解析 webServer 会抛（webServer 已改成可选依赖）
  const ownCtx = {
    get webServer() {
      throw new Error(WEB_SERVER_ERROR);
    },
  };
  const connection = {
    [Symbol.for('cordis.original')]: { ctx: ownCtx },
    rpc: {
      handle() {
        state.handleCalls += 1;
        throw new Error(WEB_SERVER_ERROR);
      },
    },
    register(owner, channel, handler) {
      state.registerCalls.push({ owner, channel });
      state.handler = handler;
      return () => {
        state.disposed = true;
        state.handler = null;
      };
    },
  };
  return { connection, state };
}

test('新版 DSH（connection 不注入 webServer）：退回 connection.register，通道照常可用', async () => {
  const { connection, state } = fakeNewDshConnection();
  const ctx = { connection };
  const log = quietLog();

  const dispose = installPocketRpc(ctx, { service: fakeService(), log });

  assert.equal(typeof dispose, 'function', '返回 disposer，不抛错');
  assert.equal(state.handleCalls, 0, '探测到公开 API 不可用，不去触发那次注定失败的注册');
  assert.equal(state.registerCalls.length, 1, '退回 connection.register 注册一次');
  assert.equal(state.registerCalls[0].channel, POCKET_RPC_CHANNEL, '通道名不变');
  assert.equal(state.registerCalls[0].owner, ctx, 'owner 必须是插件自己的 ctx（webServer 在它上面可解析）');
  assert.ok(log.lines.some(([level]) => level === 'warn'), '回退有告警日志');

  const r = await state.handler(POCKET_ENDPOINTS.status, {});
  assert.equal(r.ok, true, 'RPC 端到端可用');
  assert.equal(r.value.proxyRunning, true);

  dispose();
  assert.equal(state.disposed, true, 'disposer 生效');
});

test('老版 DSH（rpc.handle 可用）：仍走公开 API，不碰内部 register', async () => {
  const calls = [];
  let handler = null;
  const connection = {
    rpc: {
      handle(channel, fn, options) {
        calls.push({ channel, options });
        handler = fn;
        return () => { handler = null; };
      },
    },
    register() {
      throw new Error('老版 DSH 不应走到 connection.register');
    },
  };

  const dispose = installPocketRpc({ connection }, { service: fakeService(), log: quietLog() });

  assert.equal(calls.length, 1, '走公开 API');
  assert.equal(calls[0].channel, POCKET_RPC_CHANNEL);
  assert.deepEqual(calls[0].options, { authority: 'loopback' }, '第三参原样保留');
  assert.equal(typeof dispose, 'function');

  const r = await handler(POCKET_ENDPOINTS.status, {});
  assert.equal(r.ok, true);
});

test('connection 服务形态未知（handle 抛错且无 register）：不抛错，返回 no-op disposer', () => {
  const connection = {
    rpc: {
      handle() {
        throw new Error(WEB_SERVER_ERROR);
      },
    },
  };
  const log = quietLog();

  const dispose = installPocketRpc({ connection }, { service: fakeService(), log });

  assert.equal(typeof dispose, 'function', '插件 apply 不能因注册失败而抛错（否则整棵插件树加载失败）');
  assert.equal(dispose(), undefined);
  assert.equal(log.lines.filter(([level]) => level === 'error').length, 1, '如实记录错误日志');
});

test('完全没有 Connection RPC：沿用原来的「设置页不可用」降级', () => {
  const log = quietLog();
  const dispose = installPocketRpc({}, { service: fakeService(), log });
  assert.equal(typeof dispose, 'function');
  assert.equal(log.lines.filter(([level]) => level === 'warn').length, 1);
});
