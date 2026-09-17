// 主机侧 fileRead RPC（issue #17：手机复制文件内容）功能测试。
// 不引 jsdom：直接捕获 installPocketRpc 注册的处理函数，喂真实文件验证读写。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeFileSync, mkdtempSync, unlinkSync } from 'node:fs';
import { installPocketRpc } from '../lib/web-rpc.js';
import { POCKET_ENDPOINTS } from '../client/api.js';

/** 用 mock ctx 抓住注册进来的 RPC 处理函数。 */
function makeCtx() {
  let handler = null;
  const ctx = {
    connection: {
      rpc: {
        handle: (_channel, fn) => { handler = fn; return () => {}; },
      },
    },
  };
  return { ctx, call: (endpoint, payload, signal) => handler(endpoint, payload, signal) };
}

test('fileRead 端点已定义', () => {
  assert.equal(POCKET_ENDPOINTS.fileRead, 'pocket.fileRead');
});

test('fileRead 读取真实文件返回正文', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pocket-fr-'));
  const file = join(dir, 'hello.txt');
  writeFileSync(file, 'hello dsh-pocket\n');
  const { ctx, call } = makeCtx();
  installPocketRpc(ctx, { service: { status: async () => ({}) } });
  const res = await call(POCKET_ENDPOINTS.fileRead, { path: file });
  assert.equal(res.ok, true);
  assert.equal(res.value.content, 'hello dsh-pocket\n');
  assert.equal(res.value.path, file);
  assert.equal(res.value.size, 'hello dsh-pocket\n'.length);
});

test('fileRead 相对路径按 process.cwd() 解析', async () => {
  // 测试进程 cwd 即仓库根，相对路径应解析到根目录 package.json。
  const { ctx, call } = makeCtx();
  installPocketRpc(ctx, { service: { status: async () => ({}) } });
  const res = await call(POCKET_ENDPOINTS.fileRead, { path: 'package.json' });
  assert.equal(res.ok, true, '仓库根 package.json 应可读（相对路径按 cwd 解析）');
  assert.ok(res.value.content.includes('dsh-pocket'));
});

test('fileRead 相对路径按传入 cwd 解析', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pocket-fr-'));
  const file = join(dir, 'nested.txt');
  writeFileSync(file, 'cwd-resolved\n');
  const { ctx, call } = makeCtx();
  installPocketRpc(ctx, { service: { status: async () => ({}) } });
  // 传相对名 + cwd，应解析到 dir/nested.txt，而非 process.cwd()。
  const res = await call(POCKET_ENDPOINTS.fileRead, { path: 'nested.txt', cwd: dir });
  assert.equal(res.ok, true, '相对路径应按传入 cwd 解析');
  assert.equal(res.value.content, 'cwd-resolved\n');
});

test('fileRead ~/ 展开为用户 HOME', async () => {
  // 沙箱 / CI 里不能往真实 HOME 写文件，所以把 HOME 指向临时目录再验展开逻辑
  // （os.homedir() 在 POSIX 上优先读 $HOME，lib/web-rpc.js 也在请求时才解析）。
  const home = mkdtempSync(join(tmpdir(), 'pocket-home-'));
  const marker = 'pocket-fr-home.txt';
  const file = join(home, marker);
  writeFileSync(file, 'home-file\n');
  const prevHome = process.env.HOME;
  process.env.HOME = home;
  try {
    const { ctx, call } = makeCtx();
    installPocketRpc(ctx, { service: { status: async () => ({}) } });
    const res = await call(POCKET_ENDPOINTS.fileRead, { path: `~/${marker}` });
    assert.equal(res.ok, true, '~/ 形式应展开为 HOME 后读取');
    assert.equal(res.value.content, 'home-file\n');
    assert.equal(res.value.path, file, '返回解析后的绝对路径');
  } finally {
    process.env.HOME = prevHome;
    try { unlinkSync(file); } catch { /* ignore */ }
  }
});

test('fileRead 缺少路径 / 文件不存在 / 目录 均报错', async () => {
  const { ctx, call } = makeCtx();
  installPocketRpc(ctx, { service: { status: async () => ({}) } });
  const missing = await call(POCKET_ENDPOINTS.fileRead, { path: '/no/such/file-xyz.txt' });
  assert.equal(missing.ok, false, '不存在的文件应报错');
  const nodir = await call(POCKET_ENDPOINTS.fileRead, { path: tmpdir() });
  assert.equal(nodir.ok, false, '目录应报错');
  const empty = await call(POCKET_ENDPOINTS.fileRead, {});
  assert.equal(empty.ok, false, '缺 path 应报错');
});

test('fileRead 二进制文件报错（不复制无意义文本）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'pocket-fr-'));
  const file = join(dir, 'x.bin');
  writeFileSync(file, Buffer.from([0x00, 0x01, 0x02, 0x03]));
  const { ctx, call } = makeCtx();
  installPocketRpc(ctx, { service: { status: async () => ({}) } });
  const res = await call(POCKET_ENDPOINTS.fileRead, { path: file });
  assert.equal(res.ok, false, '二进制文件应报错');
});
