// issue #96：dsh 0.1.1-rc.2 起，宿主注入的 @deepseek-ai/dsh-client-connection 会调
//   const api = fixtureClient ?? transport?.createApiClient() ?? new WebApiClient()
// transport = globalThis.__DSH_TRANSPORT__。经 dsh-pocket 代理（手机 / 局域网 / 隧道）
// 访问时宿主给的 transport 不带 createApiClient → TypeError 整页崩。
// 本测试验证代理注入的兜底脚本 TRANSPORT_API_CLIENT_SHIM：
//   - 方法缺失时补一个返回 null 的实现（触发宿主 ?? new WebApiClient() 兜底）
//   - 宿主自己有实现时不覆盖
//   - shim 在宿主赋值之前/之后执行都能生效

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createContext, runInContext } from 'node:vm';

const { TRANSPORT_API_CLIENT_SHIM, DEFAULT_INJECT } = await import('../lib/proxy.mjs');

/** 提取 script 体（vm 只接受纯 JS）。 */
function shimJs() {
  return TRANSPORT_API_CLIENT_SHIM.match(/<script[^>]*>([\s\S]*)<\/script>/)?.[1]
    ?? TRANSPORT_API_CLIENT_SHIM;
}

/** 建一个模拟浏览器全局（globalThis 指向自身 + 常用内建），先执行 shim。 */
function freshContext() {
  const ctx = { Object, console, Array, Error, TypeError, String };
  ctx.globalThis = ctx;
  ctx.window = ctx;
  createContext(ctx);
  runInContext(shimJs(), ctx);
  return ctx;
}

test('shim：注入内容带判重标记，且已进入默认注入集合', () => {
  assert.ok(TRANSPORT_API_CLIENT_SHIM.includes('data-dsh-pocket-transport-shim="1"'), '带注入判重标记');
  assert.ok(DEFAULT_INJECT.includes('data-dsh-pocket-transport-shim="1"'), '进入 DEFAULT_INJECT');
  assert.ok(DEFAULT_INJECT.includes('data-dsh-pocket-polyfill="1"'), 'polyfill 仍保留');
});

test('shim（issue #96）：宿主之后赋值的 transport 缺 createApiClient 时补兜底', () => {
  const ctx = freshContext();
  runInContext('globalThis.__DSH_TRANSPORT__ = { foo: 1 };', ctx); // 宿主模块后跑
  const t = ctx.__DSH_TRANSPORT__;

  assert.equal(t.foo, 1, '不破坏宿主原有属性');
  assert.equal(typeof t.createApiClient, 'function', '补上 createApiClient');
  assert.equal(t.createApiClient(), null, '返回 null → 触发 ?? new WebApiClient()');
  // 模拟宿主那行：fixtureClient ?? transport?.createApiClient() ?? new WebApiClient()
  assert.equal(t.createApiClient() ?? 'WebApiClient', 'WebApiClient', '连接层回落到 WebApiClient');
});

test('shim（issue #96）：宿主自带 createApiClient 时绝不覆盖', () => {
  const ctx = freshContext();
  runInContext('globalThis.__DSH_TRANSPORT__ = { createApiClient: function(){ return "REAL"; } };', ctx);
  assert.equal(ctx.__DSH_TRANSPORT__.createApiClient(), 'REAL', '保留宿主实现');
});

test('shim（issue #96）：shim 晚于宿主赋值时，已存在的 transport 也会被补', () => {
  const ctx = { Object, console };
  ctx.globalThis = ctx;
  createContext(ctx);
  runInContext('globalThis.__DSH_TRANSPORT__ = { bar: 2 };', ctx); // 宿主先赋值
  runInContext(shimJs(), ctx);
  assert.equal(typeof ctx.__DSH_TRANSPORT__.createApiClient, 'function', '补上兜底');
  assert.equal(ctx.__DSH_TRANSPORT__.createApiClient(), null, '返回 null');
});

test('shim（issue #96）：transport 为 undefined / 非对象时不报错', () => {
  const ctx = freshContext();
  assert.equal(ctx.__DSH_TRANSPORT__, undefined, '未赋值时读取为 undefined');
  runInContext('globalThis.__DSH_TRANSPORT__ = null;', ctx);
  assert.equal(ctx.__DSH_TRANSPORT__, null, 'null 原样透传不抛错');
  runInContext('globalThis.__DSH_TRANSPORT__ = 42;', ctx);
  assert.equal(ctx.__DSH_TRANSPORT__, 42, '非对象不处理');
});
