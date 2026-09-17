// DSH Host 兼容性手动检查（不进 CI：依赖本机安装的 DSH Desktop 应用包）
//
// 用法：
//   node test/manual/dsh-host-compat.mjs                       # 默认 /Applications/DSH Desktop.app
//   DSH_DESKTOP_APP=/path/to/DSH\ Desktop.app node test/manual/dsh-host-compat.mjs
//
// 为什么需要它：DSH 升级会改动 Host 侧服务形态（例：0.9.0 起 connection 插件把
// webServer 从自身 inject 摘掉，`connection.rpc.handle()` 因此抛
// `cannot get property "webServer" without inject`，插件 apply 失败并拖垮整棵插件树）。
// 这个脚本用**应用自带的真实 cordis + 真实 HostConnectionService**跑一遍
// dsh-pocket 的注册路径与完整 apply()，再用真实 HTTP 打一次 RPC，把这类破坏性变更
// 在发布前暴露出来。

import { createServer } from 'node:http';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

import { installPocketRpc } from '../../lib/web-rpc.js';
import { apply } from '../../lib/index.js';
import { POCKET_ENDPOINTS } from '../../client/api.js';

const appDir = process.env.DSH_DESKTOP_APP ?? '/Applications/DSH Desktop.app';
const modules = join(appDir, 'Contents/Resources/app/node_modules');
if (!existsSync(join(modules, '@deepseek-ai/cordis'))) {
  console.error(`找不到 DSH 应用包：${modules}\n请用 DSH_DESKTOP_APP 指定 DSH Desktop.app 路径。`);
  process.exit(2);
}
const load = (id) => import(pathToFileURL(join(modules, id)).href);
const { Context, Service } = await load('@deepseek-ai/cordis/lib/index.js');
const { HostConnectionService } = await load('@deepseek-ai/dsh-client-connection/lib/index.js');

const failures = [];
const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✔' : '✖'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(name);
};

/** 与 dsh-host-webserver 同语义的最小 webServer（含真实 HTTP 派发）。 */
class FakeWebServer extends Service {
  exact = new Map();
  prefixes = new Map();
  constructor(ctx, server) {
    super(ctx, 'webServer');
    this.server = server;
    this.listenedPort = server.address()?.port ?? 0;
    server.on('request', (req, res) => {
      const { pathname } = new URL(req.url, 'http://127.0.0.1');
      const route = this.exact.get(pathname) ?? [...this.prefixes.values()].find((r) => pathname.startsWith(r.path));
      if (!route) { res.writeHead(404); res.end('not found'); return; }
      Promise.resolve(route.handler(req, res)).catch((err) => { res.writeHead(500); res.end(String(err)); });
    });
  }
  get port() { return this.listenedPort; }
  register(route) {
    const table = route.kind === 'exact' ? this.exact : this.prefixes;
    if (table.has(route.path)) throw new Error(`webserver: duplicate ${route.kind} route "${route.path}"`);
    table.set(route.path, route);
    return () => table.delete(route.path);
  }
}

/** 建一棵 DSH 0.9 形态的树：真实 connection 服务 + 假 webServer + 真实 apply()。 */
async function buildTree() {
  const root = new Context();
  const httpServer = createServer();
  await new Promise((r) => httpServer.listen(0, '127.0.0.1', r));

  const box = {};
  root.plugin({ name: 'fake-web-server', apply(ctx) { box.webServer = new FakeWebServer(ctx, httpServer); } });
  root.plugin({ name: 'fake-credentials', apply(ctx) { ctx.provide('credentials', {}); } });
  root.plugin({
    name: 'real-connection',
    inject: ['credentials'],
    apply(ctx) {
      new HostConnectionService(ctx, [], {
        isAuthenticated: () => true,
        authenticate() {},
        authorizeIndex() {},
        authenticatedUrl: (u) => `${u}/?token=manual-check`,
      });
    },
  });

  const fakeService = {
    dshPort: 0,
    async status() { return { proxyRunning: true, proxyPort: 3081, dshPort: 0 }; },
    async dispose() {},
    async startProxy() { return { port: 3081 }; },
    async restoreTunnelIfNeeded() {},
    async restoreFrpIfNeeded() {},
  };
  let applyError = null;
  const fiber = root.plugin({
    name: 'dsh-pocket-nas',
    inject: ['connection', 'webServer'],
    apply(ctx) {
      try {
        apply(ctx, {}, {
          service: fakeService,
          isDesktop: true,
          runUpdate: { currentVersion: () => 'x', loadedVersion: () => 'x', perform: async () => ({ ok: true }) },
          getGithubLatest: async () => 'x',
        });
      } catch (err) { applyError = err; }
    },
  });
  await new Promise((r) => setTimeout(r, 200));
  return { httpServer, webServer: box.webServer, fiber, applyError, port: httpServer.address().port };
}

// ---------- 1. 只测通道注册（老版 DSH 会走 rpc.handle，新版走 connection.register） ----------
{
  const root = new Context();
  const box = {};
  root.plugin({ name: 'fake-web-server', apply(ctx) { box.webServer = new FakeWebServer(ctx, createServer()); } });
  root.plugin({ name: 'fake-credentials', apply(ctx) { ctx.provide('credentials', {}); } });
  root.plugin({
    name: 'real-connection',
    inject: ['credentials'],
    apply(ctx) { new HostConnectionService(ctx, [], { isAuthenticated: () => true, authenticate() {}, authorizeIndex() {} }); },
  });
  let error = null;
  root.plugin({
    name: 'rpc-only',
    inject: ['connection', 'webServer'],
    apply(ctx) {
      try {
        installPocketRpc(ctx, { service: { status: async () => ({}) }, log: { warn() {}, error() {} } });
      } catch (err) { error = err; }
    },
  });
  await new Promise((r) => setTimeout(r, 200));
  check('installPocketRpc 注册 /dsh-pocket 通道', error === null && box.webServer.prefixes.has('/dsh-pocket'), error?.message ?? '');
}

// ---------- 2. 真实 apply() + 真实 HTTP RPC 端到端 ----------
{
  const tree = await buildTree();
  check('apply() 在真实 Host 树上不抛错', tree.applyError === null, tree.applyError?.message ?? '');
  check('apply() 注册了 /dsh-pocket 路由', tree.webServer.prefixes.has('/dsh-pocket'));
  const res = await fetch(`http://127.0.0.1:${tree.port}/dsh-pocket/${POCKET_ENDPOINTS.status}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: 'manual-check', method: POCKET_ENDPOINTS.status, payload: {} }),
  });
  const body = await res.json().catch(() => null);
  check('RPC status 端到端可用', res.status === 200 && body?.result?.ok === true, `HTTP ${res.status}`);
  await tree.fiber.dispose();
  await new Promise((r) => setTimeout(r, 100));
  check('卸载后路由被摘掉（热重载无残留）', !tree.webServer.prefixes.has('/dsh-pocket'));
  tree.httpServer.close();
}

console.log(failures.length ? `\n✖ ${failures.length} 项失败：${failures.join('、')}` : '\n✔ 全部通过');
process.exit(failures.length ? 1 : 0);
