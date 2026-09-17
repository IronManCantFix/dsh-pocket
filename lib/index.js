// dsh-pocket-nas 插件入口（单包单插件：手机扫码访问 DSH，全在这一个包里）
//
// 设置一级入口「手机访问」：
//   - 局域网二维码：自动显示（代理随插件启动）
//   - 公网二维码：点「开启公网」→ cloudflared 隧道 → 扫码即用，人在外面也能访问
//   - 版本信息：设置页显示当前版本 + GitHub 最新版本 + 更新命令（不自动检测更新）
// 手机看到的界面 = 电脑上的 dsh web，实时同步（WebSocket 透传）。
//
// 注：Web Push 已移除——浏览器推送依赖 Google FCM（Chrome）等境外服务，
// 国内直连被墙，普通用户用不了，且排障成本高。专注扫码同屏这一件事。

import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { writeFile, readFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { randomBytes, randomInt } from 'node:crypto';

import { createPocketService } from './service.mjs';
import { installPocketRpc } from './web-rpc.js';
import { restartHost } from './restart.js';
import { desktopEnvPatchScript, advancedNoticeScript, DEFAULT_INJECT, classifyHost } from './proxy.mjs';
import { lanAuthEnabled, setLanAuthEnabled, lanIpOverride, setLanIpOverride, pinCustom, setPinCustom, frpConfig, setFrpConfig, frpToken, setFrpToken } from './settings.mjs';

const name = 'dsh-pocket-nas';
const inject = ['connection', 'webServer'];

const pkgPath = fileURLToPath(new URL('../package.json', import.meta.url));

/**
 * 本插件磁盘上的已安装版本。注意：**不能用 require 缓存**（进程内永远不变），
 * 必须实时读文件——一键更新会改写 package.json，「已更新未重启」靠它识别。
 */
function currentVersion() {
  try {
    return JSON.parse(readFileSync(pkgPath, 'utf8')).version;
  } catch {
    return '0.0.0';
  }
}

/** 进程启动时加载的版本（模块加载瞬间固化；用于识别「磁盘已更新但进程还是旧代码」）。 */
const loadedVersion = currentVersion();

// ---------- GitHub 最新版本（设置页静态展示，不自动检测更新） ----------
// 本插件通过 GitHub Releases 发布（release.yml，不发布 npm），所以「有没有新版本」
// 要看 GitHub 而不是 npm registry。只在设置页打开时由前端主动请求一次（服务端代取，
// 避免浏览器直连 GitHub 被墙/限流/CORS），带 10 分钟缓存；失败静默降级（旧缓存或 null，
// 前端显示「获取失败」），绝不打断设置页其它功能。
const GH_REPO = 'IronManCantFix/dsh-pocket';
let githubLatestCache = null; // { at, version, url, downloadUrl } | null
async function githubLatest({ timeoutMs = 6000 } = {}) {
  if (githubLatestCache && Date.now() - githubLatestCache.at < 10 * 60 * 1000) {
    return githubLatestCache;
  }
  try {
    const res = await fetch(`https://api.github.com/repos/${GH_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'dsh-pocket-nas' },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const body = await res.json();
    const version = String(body?.tag_name ?? '').replace(/^v/i, '');
    if (!version) throw new Error('missing tag_name');
    githubLatestCache = {
      at: Date.now(),
      version,
      url: String(body?.html_url ?? `https://github.com/${GH_REPO}/releases/latest`),
      // 版本化下载 URL（release.yml 每个版本都上传 dsh-pocket-nas-<版本>.tgz）。
      // 安装/更新用它：URL 带版本号每次不同，pnpm 会真正重新下载；
      // 而 releases/latest 固定 URL 会被 pnpm 按 URL 缓存旧包，导致「装完还是旧版」。
      downloadUrl: `https://github.com/${GH_REPO}/releases/download/v${version}/dsh-pocket-nas-${version}.tgz`,
    };
  } catch {
    return githubLatestCache ?? null; // 失败：旧缓存仍可用；无缓存则前端显示获取失败
  }
  return githubLatestCache;
}

// ---------- 访问密码（issue #13 + #18 + #33） ----------
// 公网与局域网**分开**：各自 8 位数字（自动生成的为 8 位数字；自定义可用 8–64 位
// 英文字母大小写或数字，见 PIN_RE），存本机 $DSH_HOME/dsh-pocket/。
// 公网密码（token）：默认每次开启公网时轮换（旧链接作废）；**用户自定义后不再轮换**；
// 局域网密码（token-lan）：默认手动刷新（设置页按钮）；自定义后刷新会换回随机值。
// 会话保持（issue #33）：登录 cookie 绑定进程级 sessionKey（见 apply）——
// dsh web 重启/更新后 sessionKey 变化 → 手机需重新输入。
// 密码规则（527abba + 230039f）：默认随机 PIN 是 8 位数字；自定义 PIN 放宽到
// 8–64 位英文字母（大小写）或数字——固定密码太长也不至于被暴破。
const PIN_RE = /^[a-zA-Z0-9]{8,64}$/;
function writePinToFile(p, fresh) {
  try {
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, fresh, { mode: 0o600 });
  } catch { /* 忽略 */ }
  return fresh;
}
function readPin(p) {
  try {
    const existing = readFileSync(p, 'utf8').trim();
    if (PIN_RE.test(existing)) return existing;
  } catch { /* 无文件 */ }
  return null;
}
/**
 * 生成 8 位访问 PIN（issue #90）。
 * 必须用 CSPRNG。语言内置的非加密随机数（V8 的 xorshift128+）是可预测的：拿到少量
 * 输出即可还原内部状态并推算后续值——用它生成访问密码，等于把 9×10⁷ 的搜索空间
 * 进一步压缩。`randomInt(min, max)` 上界开区间，取值 10000000..99999999。
 * test/auth-routing.test.js 有源码守卫，禁止这里再出现非加密随机数调用。
 */
function newPin() {
  return String(randomInt(10_000_000, 100_000_000));
}

// --- 公网密码 ---
const tokenRel = join('dsh-pocket', 'token');
function tokenPath() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), tokenRel);
}
/** 当前公网访问密码；文件不存在时生成一个。 */
export function getAccessToken() {
  return readPin(tokenPath()) ?? writePinToFile(tokenPath(), newPin());
}
/** 轮换公网密码（开启公网时调用）。用户自定义后不再轮换（尊重自定义值）。 */
export function rotateAccessToken() {
  if (pinCustom('public')) return getAccessToken();
  return writePinToFile(tokenPath(), newPin());
}

// --- 局域网密码（issue #18：局域网与公网分开，手动刷新） ---
const lanTokenRel = join('dsh-pocket', 'token-lan');
function lanTokenPath() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), lanTokenRel);
}
/** 当前局域网访问密码；文件不存在时生成一个。 */
function getLanToken() {
  return readPin(lanTokenPath()) ?? writePinToFile(lanTokenPath(), newPin());
}
/** 刷新局域网密码（设置页按钮触发，旧密码立即作废）；换新后清除自定义标记。 */
function refreshLanToken() {
  setPinCustom('lan', false);
  return writePinToFile(lanTokenPath(), newPin());
}
/**
 * 按 Host 分发的访问密码（issue #66：fail closed）。
 * 公网 = classifyHost 判为 public 的 Host（trycloudflare **或用户自建命名隧道的任意固定域名**），
 * 一律校验公网密码；loopback/局域网（私网 IP、.local 等）才走局域网密码——
 * 自建隧道 + 关闭局域网密码不再出现公网裸奔。
 */
export function tokenForHost(host) {
  if (isLanOverrideHost(host)) return getLanToken();
  if (isFrpHost(host)) return getLanToken();
  return classifyHost(host) === 'public' ? getAccessToken() : getLanToken();
}
/**
 * 请求 Host 是否匹配 frp 隧道的服务端地址（NAS 域名）。
 * frp 反向隧道是自建固定域名、走 NAS 反代 HTTPS 入口，用户体验应等价于
 * 局域网访问（用局域网密码/开关），而非公网密码——否则 classifyHost 把它当
 * public 会要求公网密码，与文档（输入局域网密码）矛盾，用户输对密码也进不来。
 *
 * 匹配逻辑：精确匹配 或 Host 以 `.<serverAddr>` 结尾（兼容 NAS 反代用子域名
 * 如 dsh.huangjia.pw 而 frp 配置的是 huangjia.pw 的场景）。
 */
export function isFrpHost(host) {
  const cfg = frpConfig();
  if (!cfg.serverAddr) return false;
  const name = hostNameOnly(host);
  if (!name) return false;
  const addr = cfg.serverAddr.toLowerCase();
  return name === addr || name.endsWith('.' + addr);
}
/** 去掉 Host 的端口（与 classifyHost 一致），用于和手动设置的局域网地址比较。 */
function hostNameOnly(host) {
  let name = String(host ?? '').trim().toLowerCase();
  if (name.startsWith('[')) {
    const end = name.indexOf(']');
    if (end >= 0) name = name.slice(1, end);
  } else {
    name = name.replace(/:\d+$/, '');
  }
  return name;
}
/**
 * 手动局域网地址覆盖匹配（issue #79）：Host 去掉端口后，与 settings.json 里
 * `lanIpOverride` 的精确值、CIDR 网段或 Tailscale/CGNAT 100.64/10 网段比对。
 * 命中 → 该 Host 一律走局域网密码/开关（即使 classifyHost 判为 public）。
 */
export function isLanOverrideHost(host) {
  const override = lanIpOverride();
  if (!override) return false;
  const name = hostNameOnly(host);
  if (!name) return false;
  // 精确匹配
  if (name === override.toLowerCase()) return true;
  // CIDR 匹配（仅 IPv4）
  if (override.includes('/')) {
    try {
      const [net, bits] = override.split('/');
      const mask = ~(2 ** (32 - Number(bits)) - 1);
      const ipToInt = (ip) => ip.split('.').reduce((acc, o) => (acc * 256) + Number(o), 0);
      return (ipToInt(name) & mask) === (ipToInt(net) & mask);
    } catch { /* 忽略 */ }
  }
  // Tailscale/CGNAT 100.64/10 网段（issue #79）
  if (name.startsWith('100.') && /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(name)) return true;
  return false;
}
/**
 * 用户自定义访问密码（issue #33）：公网/局域网各自设置固定的 8–64 位密码
 * （英文字母大小写或数字，527abba + 230039f）。自定义后公网开启时不再自动轮换
 * （rotateAccessToken 见上）。非法输入（少于 8 位、超过 64 位或含字母数字以外
 * 字符）抛错，由 RPC 层转成错误响应。
 */
export function setCustomPin(which, value) {
  const v = String(value ?? '').trim();
  if (!PIN_RE.test(v)) throw new Error('密码必须是 8–64 位英文字母或数字 | PIN must be 8–64 characters (letters and digits only)');
  if (which === 'public') {
    writePinToFile(tokenPath(), v);
    setPinCustom('public', true);
    return v;
  }
  if (which === 'lan') {
    writePinToFile(lanTokenPath(), v);
    setPinCustom('lan', true);
    return v;
  }
  throw new Error('未知密码类型 | unknown PIN kind');
}

const restartNoticeRel = join('dsh-pocket', 'restarted.json');
function restartNoticePath() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), restartNoticeRel);
}
async function readRestartNotice() {
  try {
    const raw = JSON.parse(await readFile(restartNoticePath(), 'utf8'));
    if (!raw?.at) return null;
    if (Date.now() - raw.at > 30 * 60 * 1000) return null; // 30 分钟后过期
    return raw;
  } catch { return null; }
}
function writeRestartNotice() {
  return mkdir(dirname(restartNoticePath()), { recursive: true })
    .then(() => writeFile(restartNoticePath(), JSON.stringify({ at: Date.now(), pid: process.pid }), 'utf8'));
}
/**
 * 读重启标记并**删除**（一次性消费）：重启后首次打开设置页显示一次「已重启」横幅，
 * 之后不再出现——否则残留文件会让「已重启」一直显示（用户没点重启也误报）。
 */
async function consumeRestartNotice() {
  const notice = await readRestartNotice();
  if (notice) {
    await rm(restartNoticePath(), { force: true }).catch(() => {});
  }
  return notice;
}
/**
 * 自重启。
 * 顺序很重要：先拉起 helper（失败就如实返回，不写标记、不停隧道）→ 停公网隧道
 * （否则孤儿 cloudflared 让旧公网 URL 永活，与「重启即换 URL 作废」的宣传矛盾）→
 * 写重启标记（新进程据此显示一次「已重启」横幅）。
 */
function pocketRestart(service) {
  const result = restartHost();
  if (!result || result.helperPid == null) return result; // helper 都没 spawn 出来 → 失败
  // keepAutoMarker：自重启不是用户主动关闭隧道——旧进程退出只是让旧公网 URL 作废，
  // 用户仍然开着公网访问，新进程必须能自动把隧道拉回来（issue #106）。
  try { service?.stopTunnel({ keepAutoMarker: true }); } catch { /* 忽略 */ }
  writeRestartNotice().catch(() => {});
  return result;
}

/** 执行更新：dsh plugin --profile <p> update dsh-pocket-nas --latest -w（超时保护）。 */
function performUpdate(profile, { timeoutMs = 180_000 } = {}) {
  return new Promise((resolve) => {
    const child = spawn('dsh', ['plugin', '--profile', profile, 'update', 'dsh-pocket-nas', '--latest', '-w'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // Windows 上裸 spawn('dsh') 解析到无扩展名 POSIX shim → ENOENT；
      // Node 22+ 直接 spawn .cmd 会 EINVAL（CVE-2024-27980），必须走 shell（PR #54）
      shell: process.platform === 'win32',
    });
    let out = '';
    const onData = (c) => { out += String(c); if (out.length > 4000) out = out.slice(-4000); };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.once('exit', (code) => {
      clearTimeout(timer);
      resolve({ ok: code === 0, code, output: out.slice(-800) });
    });
    child.once('error', (err) => {
      clearTimeout(timer);
      resolve({ ok: false, error: err.message });
    });
  });
}

export function apply(ctx, config = {}, internals = {}) {
  const logger = ctx.logger?.(name) ?? console;
  const dshPort = internals.dshPort ?? ctx.webServer?.port;
  if (!dshPort) {
    logger.error('dsh-pocket: webServer port unavailable — cannot start proxy | 拿不到 dsh web 端口，无法启动代理');
    return () => {};
  }

  // 桌面端环境识别（官方兼容模式，见 desktop 的 plugin-development.md）：
  // desktopProfiles / desktopPnpm 只在 DSH Desktop（Electron）里存在。
  // 桌面端有自己的更新/进程管理，我们这两项功能在此环境**关闭**（不删除），
  // 避免与 desktopPnpm / Electron 进程模型冲突；扫码同屏等正常功能照常。
  const isDesktop = internals.isDesktop !== undefined
    ? internals.isDesktop === true
    : ctx.get?.('desktopProfiles') !== undefined || ctx.get?.('desktopPnpm') !== undefined;
  if (isDesktop) {
    logger.info('dsh-pocket: DSH Desktop detected — update/restart disabled here | 检测到桌面端环境，更新/重启已关闭');
  }

  // 桌面端 advanced 模式检测（issue #19）：dsh-plugin-desktop 的 mode 配置存在
  // $DSH_HOME/settings.yaml 的 dsh-plugin-desktop 命名空间下。advanced 组合禁用网页版
  // ui-layout、手机页面又拿不到桌面 layout → 手机访问白屏，这里注入覆盖层提示用户切回。
  const desktopAdvanced = isDesktop && (() => {
    try {
      const raw = readFileSync(join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), 'settings.yaml'), 'utf8');
      return /dsh-plugin-desktop\s*:\s*[\s\S]{0,300}?mode\s*:\s*advanced/i.test(raw);
    } catch { return false; }
  })();
  if (desktopAdvanced) {
    logger.warn('dsh-pocket: DSH Desktop advanced mode — phone access unsupported, injecting notice | 桌面端 advanced 模式：手机访问暂不支持，已注入提示');
  }

  const service = internals.service ?? createPocketService({
    dshPort,
    port: internals.port ?? config.port ?? 3081,
    home: internals.home,
    internals,
    // 隧道自动恢复等后台日志走宿主 ctx.logger：console 输出在 DSH Desktop 里不进日志文件
    log: logger,
    getLanIpOverride: () => lanIpOverride(),
    // 桌面端：手机扫码访问的页面缺 dsh-desktop-mode/platform 参数会让 dsh-plugin-desktop
    // client 崩溃（issue #3/#4）。给代理注入「桌面参数补丁」（history.replaceState 补齐参数，
    // 无跳转；compatibility 模式不套桌面布局，避免移动端按钮叠加）。保留默认 polyfill。
    // advanced 模式再加警告覆盖层（issue #19）。
    injectHtml: isDesktop
      ? DEFAULT_INJECT + desktopEnvPatchScript(process.platform) + (desktopAdvanced ? advancedNoticeScript() : '')
      : undefined,
    // 访问密码（issue #13 + #18 + #24 + #33）：公网永远要密码（默认每次开启变新，
    // 用户自定义后不再轮换）；局域网按开关（默认开启；关闭后局域网扫码直连）。
    auth: {
      // sessionKey：进程级随机密钥——登录 cookie 绑定它（会话保持，issue #33）：
      // dsh web 重启/更新后 sessionKey 变化 → 手机需重新输入
      sessionKey: randomBytes(16).toString('hex'),
      getToken: (host) => tokenForHost(host),
      isProtected: (host) => (classifyHost(host) === 'public' && !isLanOverrideHost(host) && !isFrpHost(host) ? true : lanAuthEnabled()),
    },
    // dsh web 浏览器会话启动 token（issue #77）：新版 dsh（>= 0.1.2-alpha.1）要求根路径
    // 带一次 `?token=` 换 cookie，否则 /api 与 WebSocket 全 401。token 每次进程启动都变，
    // 所以每次请求实时从 connection 服务取；老版本没有这个方法 → 返回空，行为不变。
    launchToken: () => {
      try {
        const fn = ctx.connection?.authenticatedUrl;
        if (typeof fn !== 'function') return '';
        const url = new URL(fn.call(ctx.connection, `http://127.0.0.1:${dshPort}`));
        return url.searchParams.get('token') ?? '';
      } catch {
        return '';
      }
    },
    // 每次公网隧道就绪 → 轮换 8 位密码（旧密码/旧链接立即作废；用户自定义后不轮换）
    onTunnelReady: () => {
      const fresh = rotateAccessToken();
      logger.info('dsh-pocket: public access PIN refreshed | 公网访问密码已更新（自定义密码不受影响）');
      return fresh;
    },
    // NAS 反向隧道（frp）：配置读取（含 token，仅 service 内部使用，RPC 层会过滤）
    getFrpConfig: () => {
      const cfg = frpConfig();
      if (!cfg.serverAddr) return null;
      return { ...cfg, token: frpToken() };
    },
  });

  const disposers = [];
  // 设置页通道注册失败（如 DSH 接口变动）不能让整个插件树挂掉：DSH 会把插件
  // apply 抛错当成 plugin tree failed to load，整个 harness 都起不来（v1.16.x +
  // DSH 0.9.0 的真实事故）。代理/隧道与 RPC 无关，继续跑，只有设置页不可用。
  let disposeRpc = () => {};
  try {
    disposeRpc = installPocketRpc(ctx, {
      service,
      desktop: isDesktop,
      getToken: () => getAccessToken(),
      getLanToken: () => getLanToken(),
      refreshLanToken: () => refreshLanToken(),
      getLanAuthEnabled: () => lanAuthEnabled(),
      setLanAuthEnabled: (on) => setLanAuthEnabled(on),
      getLanIpOverride: () => lanIpOverride(),
      setLanIpOverride: (ip) => setLanIpOverride(ip),
      getPinCustom: (which) => pinCustom(which),
      setCustomPin: (which, value) => setCustomPin(which, value),
      // NAS 反向隧道（frp）：配置读写（RPC 层负责 token 过滤）
      getFrpConfig: () => {
        const cfg = frpConfig();
        return { ...cfg, token: frpToken() };
      },
      setFrpConfig: (patch) => setFrpConfig(patch),
      setFrpToken: (v) => setFrpToken(v),
      runUpdate: internals.runUpdate ?? { currentVersion, perform: performUpdate, loadedVersion: () => loadedVersion },
      // GitHub 最新版本（设置页展示用；测试注入 internals.getGithubLatest 可完全绕开网络）
      getGithubLatest: internals.getGithubLatest ?? (() => githubLatest()),
      restart: internals.restart ?? (() => pocketRestart(service)),
      restartNotice: internals.restartNotice ?? consumeRestartNotice,
      log: logger,
    });
  } catch (err) {
    logger.error('dsh-pocket: RPC channel setup failed — settings tab disabled | RPC 通道注册失败，设置页不可用: %s', err?.message ?? err);
  }
  disposers.push(disposeRpc);

  // 代理随插件自动启动（局域网二维码开箱即用，零配置）
  void service.startProxy().then((proxy) => {
    logger.info('dsh-pocket: proxy ready on :%d | 局域网代理已就绪', proxy.port);
    // 自动恢复上次开启的公网隧道（DSH 重启后 cloudflared 子进程被杀，issue #11）
    void service.restoreTunnelIfNeeded?.().catch(() => {});
    // 自动恢复上次开启的 NAS 反向隧道（frp）
    void service.restoreFrpIfNeeded?.().catch(() => {});
  }).catch((err) => {
    logger.error('dsh-pocket: proxy start failed | 代理启动失败: %s', err?.message ?? err);
  });

  ctx.effect(() => async () => {
    for (const d of disposers.reverse()) { try { d(); } catch { /* 忽略 */ } }
    await service.dispose();
  }, 'dsh-pocket: stop proxy and tunnel');
}

export { name, inject, readRestartNotice, consumeRestartNotice };
