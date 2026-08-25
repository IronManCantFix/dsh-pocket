// dsh-pocket frp 反向隧道：把本机 dsh-pocket 代理（3081）反向映射到自家 NAS
//
// 为什么需要它：cloudflared 隧道只能连 Cloudflare 边缘（URL 随机、国内访问
// 依赖 CF 边缘）。国内自建 NAS（有公网 IP + 域名）时，用 frp 把 Mac 的 3081
// 「反向发布」到 NAS 的 frps 服务端——URL 固定（NAS 域名）、国内直连最快、
// 不依赖任何第三方。
//
// 实现策略：**不自己实现 frp 协议**，而是复刻 lib/tunnel.mjs 管理 cloudflared
// 的成熟模式——自动下载 frpc 二进制（多镜像加速源 + 自适应分块下载）、缓存到
// $DSH_HOME/dsh-pocket/bin/、spawn 托管、解析输出驱动状态机。NAS 端只需跑
// 现成的 frps 镜像（见 deploy/nas/），零自研。
//
// 状态机（onPhase 回调）：downloading → starting → connecting → ready | error

import { spawn, execSync } from 'node:child_process';
import { mkdir, access, chmod, rm, stat, rename, cp } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { writeFile } from 'node:fs/promises';
import { downloadFile } from './tunnel.mjs';

// 与 NAS 端 frps 镜像保持一致的版本（frp 要求 client/server 大版本接近）。
// 修改版本时同步改 deploy/nas/docker-compose.yml 里的镜像 tag。
export const FRP_VERSION = '0.71.0';

/** frp 发布资产名（按平台/架构）。macOS: darwin，Linux: linux，Windows: windows。 */
function platformAsset() {
  const archMap = { x64: 'amd64', arm64: 'arm64' };
  const a = archMap[process.arch] ?? process.arch;
  const os = process.platform === 'darwin' ? 'darwin' : process.platform === 'win32' ? 'windows' : 'linux';
  return { os, a, ext: os === 'windows' ? '.exe' : '' };
}

/**
 * frpc 下载源：官方 GitHub + 国内加速源（与 cloudflared 同一套镜像策略，
 * 2026-08 实测可达）。frp 没有 Homebrew bottle，不涉及清华镜像。
 */
const FRPC_MIRRORS = [
  (asset) => `https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/${asset}`,
  (asset) => `https://ghproxy.net/https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/${asset}`,
  (asset) => `https://gh.ddlc.top/https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/${asset}`,
  (asset) => `https://gh-proxy.com/https://github.com/fatedier/frp/releases/download/v${FRP_VERSION}/${asset}`,
];

function hostOf(url) {
  try { return new URL(url).host; } catch { return url; }
}

async function downloadFrpc(binPath, signal) {
  const { os, a, ext } = platformAsset();
  const dir = dirname(binPath);
  const tmpFile = join(dir, 'frpc.download');
  // 发布资产：Windows 是 zip，macOS/Linux 是 tar.gz（解压后目录里是 frpc 二进制）
  const asset = `frp_${FRP_VERSION}_${os}_${a}.${os === 'windows' ? 'zip' : 'tar.gz'}`;
  const fetchSignal = signal
    ? AbortSignal.any([signal, AbortSignal.timeout(120_000)])
    : AbortSignal.timeout(120_000);

  let lastErr = null;
  for (let i = 0; i < FRPC_MIRRORS.length; i++) {
    const url = FRPC_MIRRORS[i](asset);
    console.log(`⬇️  下载 frpc（${i + 1}/${FRPC_MIRRORS.length}：${hostOf(url)}）…`);
    try {
      await downloadFile(url, tmpFile, { signal: fetchSignal });
      const st = await stat(tmpFile);
      if (st.size < 100 * 1024) throw new Error(`文件异常小（${st.size} 字节），疑似镜像错误页`);
      lastErr = null;
      break;
    } catch (err) {
      lastErr = err;
      await rm(tmpFile, { force: true }).catch(() => {});
      console.warn(`  ⚠️ 源 ${i + 1} 失败：${err?.message ?? err}，尝试下一个…`);
    }
  }
  if (lastErr) {
    throw new Error(
      `frpc 下载失败：所有源都不通（最后错误：${lastErr?.message ?? lastErr}）。`
      + '可手动安装后重试：brew install frpc（macOS）/ 下载 frp release 把 frpc 放到 '
      + `${dir} 目录 | download failed — install frpc manually (brew install frpc) or drop the binary into ${dir}`,
    );
  }

  const extracted = join(dir, `frpc${ext}`);
  if (os === 'windows') {
    // Windows：zip 解压（Windows 10 1803+ 自带 bsdtar 支持 zip）
    const extractDir = join(dir, `.extract-frpc-${process.pid}-${Date.now()}`);
    await mkdir(extractDir, { recursive: true });
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('tar', ['-xf', tmpFile, '-C', extractDir], { stdio: 'ignore' });
        child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`frpc 解压失败（code=${code}）`)));
        child.once('error', reject);
      });
      const { readdir } = await import('node:fs/promises');
      let found = null;
      const entries = await readdir(extractDir);
      for (const e of entries) {
        const cand = join(extractDir, e, `frpc${ext}`);
        try { if ((await stat(cand)).isFile()) { found = cand; break; } } catch { /* 继续 */ }
      }
      if (!found) throw new Error('frpc 解压成功但未找到二进制 | binary not found after extract');
      await rename(found, extracted).catch(async () => { await cp(found, extracted).catch(() => {}); });
    } finally {
      await rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
  } else {
    const extractDir = join(dir, `.extract-frpc-${process.pid}-${Date.now()}`);
    await mkdir(extractDir, { recursive: true });
    try {
      await new Promise((resolve, reject) => {
        const child = spawn('tar', ['-xzf', tmpFile, '-C', extractDir], { stdio: 'ignore' });
        child.once('exit', (code) => code === 0 ? resolve() : reject(new Error(`frpc 解压失败（code=${code}）`)));
        child.once('error', reject);
      });
      const { readdir } = await import('node:fs/promises');
      let found = null;
      const entries = await readdir(extractDir);
      for (const e of entries) {
        const cand = join(extractDir, e, `frpc${ext}`);
        try { if ((await stat(cand)).isFile()) { found = cand; break; } } catch { /* 继续 */ }
      }
      if (!found) throw new Error('frpc 解压成功但未找到二进制 | binary not found after extract');
      if (found !== extracted) {
        await rename(found, extracted).catch(async () => { await cp(found, extracted).catch(() => {}); });
      }
    } finally {
      await rm(extractDir, { recursive: true, force: true }).catch(() => {});
    }
  }
  if (!isWindows()) await chmod(extracted, 0o755);
  await rm(tmpFile, { force: true }).catch(() => {});
  return extracted;
}

function isWindows() {
  return process.platform === 'win32';
}

/** PATH 里是否已有 frpc。 */
function frpcOnPath() {
  try {
    execSync(process.platform === 'win32' ? 'where frpc' : 'command -v frpc', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/** in-flight 下载（单飞）：并发调用复用同一次，防止交错写入损坏压缩包。 */
let downloading = null;

/**
 * 拿一个可用的 frpc 路径。
 * 优先：PATH 已有 → 直接用；否则持久缓存（$DSH_HOME/dsh-pocket/bin/frpc），
 * 只有缓存缺失才下载——避免每次开启隧道都重新下 ~10MB。
 */
export async function resolveFrpc({ home, onPhase = () => {}, signal } = {}) {
  if (frpcOnPath()) return 'frpc';
  const dshHome = home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
  const cacheDir = join(dshHome, 'dsh-pocket', 'bin');
  const { ext } = platformAsset();
  const bin = join(cacheDir, `frpc${ext}`);
  try {
    await access(bin);
    return bin; // 缓存命中
  } catch { /* 无缓存 → 下载 */ }
  onPhase('downloading');
  await mkdir(cacheDir, { recursive: true });
  if (!downloading) {
    downloading = downloadFrpc(bin, signal).finally(() => { downloading = null; });
  }
  return downloading;
}

// ---------- frpc 配置 ----------

export const FRP_DEFAULTS = {
  serverPort: 7000,
  remotePort: 7001,
  tls: false,
};

/** 校验并规范化 frp 配置；非法输入抛错（由 RPC 层转成错误响应）。 */
export function normalizeFrpConfig(raw = {}) {
  const serverAddr = String(raw.serverAddr ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!serverAddr) throw new Error('请填写 NAS 地址（域名或 IP）| NAS address is required');
  if (/[^\w.-]/.test(serverAddr) || serverAddr.length > 253) {
    throw new Error('NAS 地址格式不合法 | invalid NAS address');
  }
  const serverPort = Number(raw.serverPort ?? FRP_DEFAULTS.serverPort);
  const remotePort = Number(raw.remotePort ?? FRP_DEFAULTS.remotePort);
  for (const [k, v] of [['服务端口 serverPort', serverPort], ['转发端口 remotePort', remotePort]]) {
    if (!Number.isInteger(v) || v < 1 || v > 65535) throw new Error(`${k} 必须是 1-65535 的整数 | ${k} must be 1-65535`);
  }
  if (serverPort === remotePort) throw new Error('服务端口与转发端口不能相同 | serverPort and remotePort must differ');
  const tls = raw.tls === true || raw.tls === 'true';
  return { serverAddr, serverPort, remotePort, tls };
}

/** 渲染 frpc.toml（frp v0.52+ TOML 格式，与 frps 0.71.0 匹配）。 */
export function renderFrpcToml(cfg, token, localPort) {
  const tlsBlock = cfg.tls
    ? `\ntransport.tls.enable = true\n`
    : '';
  return `serverAddr = ${JSON.stringify(cfg.serverAddr)}
serverPort = ${cfg.serverPort}
auth.method = "token"
auth.token = ${JSON.stringify(token)}${tlsBlock}

[[proxies]]
name = "dsh-pocket"
type = "tcp"
localIP = "127.0.0.1"
localPort = ${localPort}
remotePort = ${cfg.remotePort}
`;
}

// ---------- 隧道启动 ----------

// frpc 输出特征串（v0.71）：
//   - 连接成功：'login to server success' / 'start proxy success'
//   - 连接失败：'login to server error' / 'connect to server error'
const FRPC_READY_RE = /login to server success|start proxy success/i;
const FRPC_ERROR_RE = /login to server error|connect to server error|proxy \[.*\] start error|invalid token|auth failed/i;

/**
 * 启动 frp 反向隧道。
 * @param {object} opts
 * @param {number} opts.localPort  本机代理端口（转发目标，默认 3081）
 * @param {object} opts.config     规范化后的 frp 配置 {serverAddr, serverPort, remotePort, tls}
 * @param {string} opts.token      frps 连接令牌
 * @param {string} [opts.home]     $DSH_HOME（frpc 持久缓存）
 * @param {AbortSignal} [opts.signal]
 * @param {(phase:string, detail?:string)=>void} [opts.onPhase]
 * @returns {Promise<{kill:()=>void, onExit:(cb)=>()=>void}>}
 */
export async function startFrpTunnel({ localPort = 3081, config, token, home, signal, onPhase = () => {} } = {}) {
  const cfg = normalizeFrpConfig(config);
  if (!token || String(token).length < 8) {
    throw new Error('请先设置连接令牌（至少 8 位）| set the connection token first (min 8 chars)');
  }
  const bin = await resolveFrpc({ home, onPhase, signal });
  onPhase('starting');
  // 配置写临时文件（frpc 只接受文件路径；避免每次生成重复临时文件——用固定缓存名）
  const dshHome = home ?? process.env.DSH_HOME ?? join(homedir(), '.dsh');
  const cfgDir = join(dshHome, 'dsh-pocket');
  await mkdir(cfgDir, { recursive: true });
  const cfgPath = join(cfgDir, 'frpc.toml');
  await writeFile(cfgPath, renderFrpcToml(cfg, token, localPort), { mode: 0o600 });

  const child = spawn(bin, ['-c', cfgPath], { stdio: ['ignore', 'pipe', 'pipe'] });
  // H1：spawn 失败（缓存二进制损坏等）必须接住，否则 uncaughtException 崩宿主
  child.on('error', (err) => {
    cleanup?.();
    onPhase('error', `frpc 启动失败：${err?.message ?? err}（可删除 $DSH_HOME/dsh-pocket/bin 缓存后重试）`);
    rejectErr?.(new Error(`frpc 启动失败：${err?.message ?? err}`));
  });
  onPhase('connecting');

  let cleanup = null;
  let rejectErr = null;
  let resolved = false;
  await new Promise((resolve, reject) => {
    let buf = '';
    const onData = (chunk) => {
      buf += String(chunk);
      if (buf.length > 16_384) buf = buf.slice(-16_384);
      if (!resolved && FRPC_READY_RE.test(buf)) {
        resolved = true;
        cleanup();
        onPhase('ready');
        resolve();
      } else if (!resolved && FRPC_ERROR_RE.test(buf)) {
        resolved = true;
        const detail = buf.split('\n').filter((l) => /error|fail/i.test(l)).pop()?.trim() ?? 'frpc 连接失败';
        cleanup();
        onPhase('error', detail);
        reject(new Error(`frp 隧道连接失败：${detail}（检查 NAS 地址/token/frps 是否运行）`));
      }
    };
    const onExit = (code) => {
      if (resolved) return; // 已 ready 后的退出交给 onExit 监听方（exitListeners）
      cleanup();
      reject(new Error(`frpc 退出（code=${code}）`));
    };
    cleanup = () => {
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
      child.off('exit', onExit);
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      child.stdout.resume();
      child.stderr.resume();
    };
    const onAbort = () => {
      cleanup();
      child.kill();
      reject(new Error('已取消 | cancelled'));
    };
    const timer = setTimeout(() => {
      cleanup();
      child.kill();
      reject(new Error('frpc 连接超时（30s）——检查 NAS 地址、frps 是否运行、token 是否一致 | connection timeout'));
    }, 30_000);

    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.once('exit', onExit);
    signal?.addEventListener('abort', onAbort, { once: true });
    rejectErr = reject;
  });

  // 隧道进程运行中死亡（崩溃/被杀）→ 通知监听方（service 据此把状态从 ready 打回）
  const exitListeners = new Set();
  child.on('exit', (code) => {
    for (const cb of exitListeners) cb(code);
  });

  return {
    kill: () => {
      try { child.kill(); } catch { /* 忽略 */ }
    },
    /** 注册「进程已退出」回调，返回取消函数。 */
    onExit: (cb) => {
      exitListeners.add(cb);
      return () => exitListeners.delete(cb);
    },
  };
}
