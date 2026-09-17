// dsh-pocket 设置持久化（$DSH_HOME/dsh-pocket/settings.json）
//
// 当前项：
//   - lanAuthEnabled    局域网访问密码开关（issue #24），默认开启
//   - publicPinCustom   公网密码是否用户自定义（issue #33），自定义后不自动轮换
//   - lanPinCustom      局域网密码是否用户自定义（issue #33）
//   - frp               NAS 反向隧道配置（serverAddr/serverPort/remotePort/tls），
//                       token 单独存 frp-token 文件（0600），见 frpToken()
// 默认**开启**（安全优先）：局域网扫码也要输 8 位密码；
// 用户可关闭——关闭后局域网扫码直连（仅同一网络内的设备能访问），公网不受影响（永远要密码）。

import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { isValidIpv4 } from './ip.mjs';
import { FRP_DEFAULTS, normalizeFrpConfig } from './frp-tunnel.mjs';

const settingsRel = join('dsh-pocket', 'settings.json');
export function settingsPath() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), settingsRel);
}

function readSettings() {
  try {
    const raw = JSON.parse(readFileSync(settingsPath(), 'utf8'));
    return raw && typeof raw === 'object' ? raw : {};
  } catch { /* 无文件/损坏 → 默认 */ }
  return {};
}

function writeSettings(s) {
  try {
    mkdirSync(dirname(settingsPath()), { recursive: true });
    writeFileSync(settingsPath(), JSON.stringify(s, null, 2), { mode: 0o600 });
  } catch { /* 忽略 */ }
  return s;
}

/** 局域网访问密码开关：默认开启（文件缺失/损坏都视为开启）。 */
export function lanAuthEnabled() {
  return readSettings().lanAuthEnabled !== false;
}

/** 设置局域网访问密码开关，返回新状态（持久化）。 */
export function setLanAuthEnabled(on) {
  const s = readSettings();
  s.lanAuthEnabled = !!on;
  writeSettings(s);
  return s.lanAuthEnabled;
}

/** 局域网地址手动覆盖：默认空字符串 = 自动选择。 */
export function lanIpOverride() {
  return readSettings().lanIpOverride ?? '';
}

/** 设置局域网地址覆盖；空字符串清除覆盖，恢复自动选择。非法 IPv4 抛错。 */
export function setLanIpOverride(value) {
  const ip = String(value ?? '').trim();
  if (ip && !isValidIpv4(ip)) {
    throw new Error('局域网地址必须是 IPv4 地址 | LAN address must be an IPv4 address');
  }
  const s = readSettings();
  if (ip) s.lanIpOverride = ip;
  else delete s.lanIpOverride;
  writeSettings(s);
  return ip;
}

// ---------- 访问密码「自定义」标记（issue #33） ----------
// 用户可把公网/局域网密码设成自己固定的 8–64 位密码（英文字母大小写或数字；
// 自定义后不再自动轮换）。长度/字符集校验在 lib/index.js 的 PIN_RE 里统一把关。
// 标记存 settings.json：publicPinCustom / lanPinCustom。
const PIN_CUSTOM_KEYS = { public: 'publicPinCustom', lan: 'lanPinCustom' };

/** 该 PIN（public | lan）是否用户自定义过（自定义后不自动轮换）。 */
export function pinCustom(which) {
  const key = PIN_CUSTOM_KEYS[which];
  if (!key) return false;
  return readSettings()[key] === true;
}

/** 设置自定义标记，返回新状态。 */
export function setPinCustom(which, on) {
  const key = PIN_CUSTOM_KEYS[which];
  if (!key) return false;
  const s = readSettings();
  s[key] = !!on;
  writeSettings(s);
  return !!on;
}

// ---------- 代理端口（20bb1b5 / issue #70） ----------
// 局域网代理的监听端口（默认 3081）。插件模式下改法就是写 settings.json 的
// proxyPort 字段（CLI 模式可用 dsh-pocket --port）。范围 1-65535；
// 端口被占用时本 fork 的 service.startProxy 会自动向后找一个空位（+1..+9）。

/** 当前代理端口（0 = 用默认 3081）。 */
export function proxyPort() {
  const v = Number(readSettings().proxyPort);
  return Number.isInteger(v) && v >= 1 && v <= 65535 ? v : 0;
}

/** 设置代理端口（持久化）。空/0/非法值清除，回退默认 3081。 */
export function setProxyPort(value) {
  const n = Number(value);
  const s = readSettings();
  if (Number.isInteger(n) && n >= 1 && n <= 65535) s.proxyPort = n;
  else delete s.proxyPort;
  writeSettings(s);
  return proxyPort();
}

// ---------- 局域网访问总开关（2373f4b / PR #61） ----------
// 与「局域网访问密码开关」（lanAuthEnabled）是两个独立开关：
//   - 总开关（lanEnabled，默认开）：关了代理直接拒绝局域网 Host，扫码/链接立即失效；
//   - 密码开关（lanAuthEnabled，默认开）：还允许局域网访问，但要求输密码。
// 公网隧道不受总开关影响。

/** 局域网访问总开关：默认开启（文件缺失/损坏都视为开启）。 */
export function lanEnabled() {
  return readSettings().lanEnabled !== false;
}

/** 设置局域网访问总开关，返回新状态（持久化）。 */
export function setLanEnabled(on) {
  const s = readSettings();
  s.lanEnabled = !!on;
  writeSettings(s);
  return s.lanEnabled;
}

// ---------- 恢复出厂设置（672b31b，含本 fork 的 NAS/frp 清理） ----------
// 设置出问题时的临时兜底：删掉 settings.json 即回到出厂默认（文件缺失 = 默认开启，
// 于是局域网访问开、访问密码开、局域网地址自动、公网模式随机、NAS 配置默认）。
// 本 fork 的 frp 连接令牌存在单独文件里（0600），是别人的 frps 凭据，一并删掉；
// DSH 自身的会话、模型、插件配置都在 $DSH_HOME 的其他目录，不受影响。

/** 删除本机设置文件（含 NAS 令牌）；返回 true 表示已清空。 */
export function resetSettings() {
  let okFlag = true;
  try {
    rmSync(settingsPath(), { force: true });
  } catch {
    okFlag = false;
  }
  try {
    rmSync(frpTokenPath(), { force: true });
  } catch {
    okFlag = false;
  }
  return okFlag;
}

// ---------- NAS 反向隧道（frp）配置（issue: nas-tunnel） ----------
// 地址/端口/TLS 存 settings.json 的 frp 字段；连接令牌单独存 frp-token 文件
// （0600，与 token/token-lan 同款），避免把密钥写进可读的 settings.json。

const frpTokenRel = join('dsh-pocket', 'frp-token');
function frpTokenPath() {
  return join(process.env.DSH_HOME ?? join(homedir(), '.dsh'), frpTokenRel);
}

/** 当前 frp 连接令牌；无则 null。 */
export function frpToken() {
  try {
    const existing = readFileSync(frpTokenPath(), 'utf8').trim();
    if (existing.length >= 8) return existing;
  } catch { /* 无文件 */ }
  return null;
}

/** 设置 frp 连接令牌（长度 ≥ 8），写 0600 文件；返回令牌。 */
export function setFrpToken(value) {
  const v = String(value ?? '').trim();
  if (v.length < 8) throw new Error('连接令牌至少 8 位 | token must be at least 8 chars');
  try {
    mkdirSync(dirname(frpTokenPath()), { recursive: true });
    writeFileSync(frpTokenPath(), v, { mode: 0o600 });
  } catch { /* 忽略 */ }
  return v;
}

/** 当前 frp 配置（未经校验的原始值 + 默认值）；token 不在此处。 */
export function frpConfig() {
  const s = readSettings();
  const f = s.frp && typeof s.frp === 'object' ? s.frp : {};
  return {
    serverAddr: String(f.serverAddr ?? ''),
    serverPort: Number(f.serverPort ?? FRP_DEFAULTS.serverPort),
    remotePort: Number(f.remotePort ?? FRP_DEFAULTS.remotePort),
    tls: f.tls === true,
  };
}

/** 更新 frp 配置（校验后持久化），返回新配置。 */
export function setFrpConfig(patch = {}) {
  const cur = frpConfig();
  const merged = normalizeFrpConfig({
    serverAddr: patch.serverAddr !== undefined ? patch.serverAddr : cur.serverAddr,
    serverPort: patch.serverPort !== undefined ? patch.serverPort : cur.serverPort,
    remotePort: patch.remotePort !== undefined ? patch.remotePort : cur.remotePort,
    tls: patch.tls !== undefined ? patch.tls : cur.tls,
  });
  const s = readSettings();
  s.frp = merged;
  writeSettings(s);
  return merged;
}
