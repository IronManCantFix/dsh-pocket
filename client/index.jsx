// dsh-pocket 网页客户端：
//   1. 设置页签「手机访问」（局域网/公网二维码 + 版本信息/更新命令）
//   2. 移动端适配（移植自 MIT 项目 dsh-web-mobile，见 client/mobile/LICENSE.dsh-web-mobile）
//
// 手机扫码打开的就是电脑上的 dsh web，实时同步；窄屏自动变成抽屉布局。
//
// 注：Web Push 已移除——浏览器推送依赖 Google FCM（Chrome）等境外服务，
// 国内直连被墙，普通用户用不了。专注扫码同屏这一件事。

import { createElement as h, Fragment, useEffect, useRef, useState } from 'react';

import { Tooltip, IconRefreshOutline16 } from '@deepseek-ai/dsh-client-ui-primitives';
import { POCKET_RPC_CHANNEL, POCKET_ENDPOINTS, redactStatus, compareVersions } from './api.js';
import { mobileApply } from './mobile/mobile-apply.tsx';
import { NS as POCKET_NS, zh as POCKET_ZH, en as POCKET_EN } from './pocket-locales.js';

const name = 'dsh-pocket-nas';
const inject = ['slots', 'connection', 'layout', 'locale', 'sessionLogDownload'];

// 更新命令（设置页一键复制；本插件经 GitHub Releases 发布，见 release.yml）
const UPDATE_CMD = 'dsh plugin --profile web update dsh-pocket-nas --latest -w';

// NAS 端 frp 部署模板（设置页一键复制；与 deploy/nas/ 同步维护）
const FRP_COMPOSE_TEMPLATE = `# dsh-pocket-nas NAS 端部署（仅 frps）
# 用法：放到 NAS 的 docker 目录 → docker compose up -d
# 步骤：
#   1. frps.toml 的 token 改为 openssl rand -hex 16 生成的值（与设置页一致）
#   2. 反代入口用你 NAS 上现有的工具（lucky / 群晖自带反向代理 / nginx 等）：
#      新增规则「前端 https://dsh.你的域名.com → 后端 http://127.0.0.1:7001」，
#      务必开启 WebSocket 支持，证书用 Let's Encrypt（80 被占时选 DNS 验证）
#   3. 防火墙放行 443/80（反代工具）和 7000（frps 控制端口）；SSH 不需要开放
# docker-compose.yml
services:
  frps:
    image: snowdreamtech/frps:0.71.0-alpine
    container_name: frps
    restart: unless-stopped
    network_mode: host
    volumes:
      - ./frps.toml:/etc/frp/frps.toml
# frps.toml
bindPort = 7000
auth.method = "token"
auth.token = "换成你的长随机串"
proxyBindAddr = "127.0.0.1"
allowPorts = [{ start = 7001, end = 7010 }]
`;

// 词典在 pocket-locales.js；这里只做「取 key → 替换 {占位符} → 字符串」。
// 不依赖 DSH t() 的插值能力，避免行为不一致。
function fmt(t, key, vars) {
  let s = t(key);
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      s = String(s).split(`{${k}}`).join(String(v));
    }
  }
  return s;
}

// 官方 DeepSeek Harness 设计系统（dsh-client-ui-theme design-platform.css）：
// 按钮 md=36px 胶囊形 / sm=28px；品牌色 --dsw-alias-brand-primary；
// hover 走 --dsw-alias-button-*-hover；间距 4px 栅格；正文 13px。
const styles = {
  card: { background: 'var(--dsw-alias-bg-layer-1,#fff)', border: '1px solid var(--dsw-alias-border-l2,#e5e7eb)', borderRadius: 12, padding: '16px 20px', maxWidth: 480 },
  block: { borderTop: '1px solid var(--dsw-alias-border-l2,#e5e7eb)', marginTop: 16, paddingTop: 16 },
  muted: { color: 'var(--dsw-alias-label-tertiary,#8b93a1)', fontSize: 12, lineHeight: 1.5 },
  code: { fontFamily: 'ui-monospace,Menlo,monospace', fontSize: 12, wordBreak: 'break-all', margin: '6px 0 10px', color: 'var(--dsw-alias-label-primary,inherit)' },
  // 主按钮：官方 md 胶囊形（36px）
  primary: { font: 'inherit', cursor: 'pointer', border: 'none', background: 'var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary,#4f6ef7))', color: 'var(--dsw-alias-label-primary-foreground, #fff)', height: 36, padding: '0 16px', borderRadius: 999, fontSize: 13, fontWeight: 500, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  // 次级按钮：官方 outline/ghost 胶囊形
  btn: { font: 'inherit', cursor: 'pointer', border: '1px solid var(--dsw-alias-button-ghost-active-border, var(--dsw-alias-border-l2,#d1d5db))', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)', height: 36, padding: '0 16px', borderRadius: 999, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' },
  qr: { width: 220, height: 220, borderRadius: 10, border: '1px solid var(--dsw-alias-border-l2,#e5e7eb)', margin: '8px 0' },
  warn: { color: 'var(--dsw-alias-state-warn-primary,#b45309)', fontSize: 12, lineHeight: 1.5 },
};

// 状态层样式（hover/focus/disabled/入场动画）：inline style 表达不了伪类，
// 这里集中注入一次，作用域钉在自有 data-* 钩子上，颜色全部走官方 alias
// token（深浅色随主题），不依赖宿主哈希类名。
const POCKET_UI_CSS = `
/* 侧边栏入口（宽行 + 收起后的圆形 rail 都用同一钩子） */
[data-dsh-pocket-entry] {
  transition: background var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease);
}
[data-dsh-pocket-entry]:hover {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)) !important;
}
[data-dsh-pocket-entry]:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f6ef7);
  outline-offset: -2px;
}
/* 设置页控件状态 */
button[data-dshp] {
  transition:
    background var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease),
    color var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease),
    opacity var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease);
}
button[data-dshp="primary"]:hover:not(:disabled) {
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill, #4f6ef7)) !important;
}
button[data-dshp="primary"]:disabled { opacity: .5 !important; cursor: default; }
button[data-dshp="ghost"]:hover:not(:disabled) {
  background: var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06)) !important;
}
button[data-dshp="ghost"]:disabled {
  color: var(--dsw-alias-label-dimmed, #9aa1ac) !important;
  cursor: default;
}
input[data-dshp-field], select[data-dshp-field] {
  transition: border-color var(--ds-transition-duration-fast, .12s) var(--ds-ease-in-out, ease);
}
input[data-dshp-field]:focus, select[data-dshp-field]:focus {
  outline: none;
  border-color: var(--dsw-alias-state-business-primary, #4f6ef7) !important;
}
button[data-dshp]:focus-visible, button[data-dshp-toggle]:focus-visible, [data-dshp-link]:focus-visible {
  outline: 2px solid var(--dsw-alias-state-business-primary, #4f6ef7);
  outline-offset: 1px;
}
/* 对话框入场：遮罩淡入 + 面板轻微上浮，reduced-motion 直接关闭 */
@keyframes dsh-pocket-fade { from { opacity: 0; } to { opacity: 1; } }
@keyframes dsh-pocket-pop {
  from { opacity: 0; transform: translateY(10px) scale(.985); }
  to { opacity: 1; transform: none; }
}
[data-dsh-pocket-overlay] { animation: dsh-pocket-fade .15s linear both; }
[data-dsh-pocket-panel] { animation: dsh-pocket-pop .18s cubic-bezier(.22,1,.36,1) both; }
@media (prefers-reduced-motion: reduce) {
  [data-dsh-pocket-overlay], [data-dsh-pocket-panel] { animation: none; }
}
`;

// 复制到剪贴板：优先 async clipboard（安全上下文），失败回退 textarea +
// execCommand（老浏览器 / HTTP 环境），返回是否成功——按钮据此如实反馈，
// 不再「剪贴板不可用却显示已复制」。
const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch { /* 继续走回退路径 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
};

function PocketSettingsTab({ rpcCall, t }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [tunnelState, setTunnelState] = useState(null); // 隧道进度 {phase, detail, startedAt}
  const [restartNotice, setRestartNotice] = useState(false); // 重启后提示
  // 版本信息（仅展示，不自动检测更新）：{ current, loaded, githubLatest, githubUrl, loading, failed }
  const [versionInfo, setVersionInfo] = useState({ current: null, loaded: null, githubLatest: null, githubUrl: null, loading: true, failed: false });

  // 安装/更新到最新版：优先「add + GitHub 仓库的版本 tag（git 方式安装）」——
  // github:owner/repo#vX.Y.Z 让 pnpm 按 git tag 拉取安装，不经过 Releases 的 tgz
  // URL（tgz/固定 URL 会被 pnpm 按 URL 缓存旧包，装完还是旧版、影响更新）。
  // tag 版本号一律来自真实数据、绝不写死：GitHub 最新 Release 版本优先（对应
  // 「更新到最新版」）；GitHub 查询失败（被墙/限流）时用本机实际安装版本兜底；
  // 两者都拿不到才回退到 update 命令。
  const tagVersion = versionInfo.githubLatest ?? versionInfo.current;
  const installCmd = tagVersion
    ? `dsh plugin --profile web add github:IronManCantFix/dsh-pocket#v${tagVersion} -w`
    : UPDATE_CMD;
  // 磁盘已更新未重启时的重启状态：{ restarting, startedAt } | null
  const [restartState, setRestartState] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false); // DSH Desktop（Electron）环境：更新/重启由桌面版管理
  const [now, setNow] = useState(Date.now()); // 每秒 tick，驱动倒计时
  // NAS 反向隧道（frp）
  const [frpForm, setFrpForm] = useState(null); // { serverAddr, serverPort, remotePort, tls, token }
  const [frpSaved, setFrpSaved] = useState(false);
  const [frpBusy, setFrpBusy] = useState(false);
  const [frpError, setFrpError] = useState(null);
  const [frpShowToken, setFrpShowToken] = useState(false); // frp 连接令牌明文显示开关

  // 复制反馈（统一一处）：成功显示对应「已复制」文案；失败如实显示「复制失败」，
  // 不再出现剪贴板不可用却提示已复制的假反馈。'cmd' | 'frp'，加 ! 前缀表示失败。
  const [copied, setCopied] = useState(null);
  const copiedTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(copiedTimerRef.current), []);
  const copyWithFeedback = async (key, text) => {
    clearTimeout(copiedTimerRef.current);
    const ok = await copyText(text);
    setCopied(ok ? key : `!${key}`);
    copiedTimerRef.current = setTimeout(() => setCopied(null), ok ? 2500 : 3000);
  };

  // 进行中操作的「已等待 X 秒」倒计时
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = (startedAt) => (startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);

  const call = async (endpoint, payload) => {
    const res = await rpcCall(endpoint, payload);
    if (!res?.ok) throw new Error(res?.error?.message ?? 'RPC failed');
    return res.value;
  };

  const load = async () => {
    try {
      const s = await call(POCKET_ENDPOINTS.status, {});
      setStatus(s);
      setTunnelState(s.tunnelState ?? null);
      if (s.desktop) setIsDesktop(true);
      if (s.restartNotice) {
        // 新进程确认起来了：显示一次「已重启」，然后自动刷新页面加载新代码——不用用户手动刷新
        setRestartNotice(true);
        if (!sessionStorage.getItem('dshp-auto-reloaded')) {
          sessionStorage.setItem('dshp-auto-reloaded', '1');
          setTimeout(() => { try { location.reload(); } catch { /* 忽略 */ } }, 2000);
        }
      }
    } catch { /* 忽略瞬时失败 */ }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  // frp 表单初始化：status 首次带回 frpConfig 时填一次；
  // token 从 status.frpToken 回显（仅 loopback RPC 可见），输入框默认打星，小眼睛可切明文
  useEffect(() => {
    if (frpForm === null && status?.frpConfig) {
      setFrpForm({ ...status.frpConfig, token: status.frpToken ?? '' });
    }
  }, [status, frpForm]);

  // frp：保存配置（token 留空表示不修改）
  const saveFrp = async () => {
    setFrpBusy(true);
    setFrpError(null);
    try {
      const r = await call(POCKET_ENDPOINTS.frpConfigSet, {
        serverAddr: frpForm.serverAddr,
        serverPort: Number(frpForm.serverPort),
        remotePort: Number(frpForm.remotePort),
        tls: frpForm.tls === true,
        token: String(frpForm.token ?? '').trim() || undefined,
      });
      // 保存后回显实际生效的 token（仅 loopback RPC 返回），输入框默认打星可切换明文
      if (typeof r?.token === 'string' && r.token) {
        setFrpForm((f) => ({ ...f, token: r.token }));
      }
      setFrpSaved(true);
      setTimeout(() => setFrpSaved(false), 2500);
      await load(); // 刷新 status（frpConfig / frpHasToken / frpToken）
    } catch (err) {
      setFrpError(err.message);
    } finally {
      setFrpBusy(false);
    }
  };

  // frp：开启 / 关闭隧道
  const startFrp = async () => {
    setFrpBusy(true);
    setFrpError(null);
    try {
      setStatus(await call(POCKET_ENDPOINTS.frpStart, {}));
    } catch (err) {
      setFrpError(err.message);
    } finally {
      setFrpBusy(false);
    }
  };
  const stopFrp = async () => {
    try { setStatus(await call(POCKET_ENDPOINTS.frpStop, {})); } catch { /* 忽略 */ }
  };

  // frp：复制 NAS 部署模板（复制失败时按钮如实显示「复制失败」）
  const copyFrpCompose = async () => {
    await copyWithFeedback('frp', FRP_COMPOSE_TEMPLATE);
  };

  // 每次页面加载清掉自动刷新标记——这样下次重启（更新后）才能再次触发自动刷新
  useEffect(() => {
    try { sessionStorage.removeItem('dshp-auto-reloaded'); } catch { /* 忽略 */ }
  }, []);

  // 版本信息（host 当前版本 + 磁盘已更新版本 + GitHub 最新版本）
  // 不做自动更新检测、不轮询——本插件（IronManCantFix/dsh-pocket）通过 GitHub Releases 发布，
  // 与 npm registry 的 dsh-pocket 无关。GitHub 查询由服务端代理（避免浏览器 CORS/限流/网络封锁），
  // 失败时静默降级：githubLatest 为 null，UI 显示「获取失败」+ 「打开 GitHub」链接。
  // 桌面端（isDesktop）：更新/重启由 DSH Desktop 管理，只显示版本信息，不提示重启。
  const loadVersion = async () => {
    try {
      const v = await call(POCKET_ENDPOINTS.version, {});
      const gh = v?.githubLatest ?? null;
      setVersionInfo({
        current: v?.current ?? null,
        loaded: v?.loaded ?? null,
        githubLatest: gh?.version ?? null,
        githubUrl: gh?.url ?? 'https://github.com/IronManCantFix/dsh-pocket/releases/latest',
        loading: false,
        failed: false,
      });
    } catch {
      setVersionInfo((prev) => ({ ...prev, loading: false, failed: true }));
    }
  };
  // 挂载时查一次即可（无轮询）
  useEffect(() => {
    loadVersion();
  }, []);

  // 重启宿主（更新生效必需：刷新页面不会重载服务端代码）
  const restartPocket = async () => {
    setRestartState({ restarting: true, startedAt: Date.now() });
    try {
      // 宿主 500ms 后自杀，RPC 响应可能来不及送达 → 3 秒超时兜底，别让按钮永远卡「重启中…」
      await Promise.race([
        call(POCKET_ENDPOINTS.restart, {}),
        new Promise((_, rej) => setTimeout(() => rej(new Error('restart requested (no reply within 3s)')), 3000)),
      ]);
      // 成功收到响应：宿主即将重启，保持「重启中…」等待 restartNotice 触发的页面刷新
      setRestartState((s) => ({ ...s, restarting: true }));
    } catch (err) {
      // 网络断连/超时同样视为「已请求重启」——旧进程即将退出，等新进程起来后刷新即可
      const msg = String(err?.message ?? '');
      if (/connection|socket|fetch|network|abort|cancelled|ECONN|disconnect|closed|timeout/i.test(msg)) {
        setRestartState((s) => ({ ...s, restarting: true }));
        return;
      }
      // 其他真实错误才恢复按钮
      setRestartState({ restarting: false, startedAt: null });
    }
  };

  // 安全免责声明（issue #31）：每次开启公网都必须先弹框勾选「我已知情」。
  // 服务端同样强制（tunnel.start 需 disclaimer: true），防绕过前端直接调 RPC。
  const [disclaimerOpen, setDisclaimerOpen] = useState(false);
  const [disclaimerChecked, setDisclaimerChecked] = useState(false);

  const doStartTunnel = async () => {
    setBusy(true);
    setError(null);
    setTunnelState({ phase: 'starting', detail: '正在开启…', startedAt: Date.now() });
    try {
      setStatus(await call(POCKET_ENDPOINTS.tunnelStart, { disclaimer: true }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  const startTunnel = () => {
    // 每次开启都弹免责确认（勾选后才能继续）
    setDisclaimerChecked(false);
    setDisclaimerOpen(true);
  };
  const confirmDisclaimer = () => {
    if (!disclaimerChecked) return; // 未勾选不允许
    setDisclaimerOpen(false);
    doStartTunnel();
  };

  const stopTunnel = async () => {
    try { setStatus(await call(POCKET_ENDPOINTS.tunnelStop, {})); } catch { /* 忽略 */ }
  };

  // 刷新局域网访问密码（旧密码立即作废）
  const refreshLanPin = async () => {
    try {
      const r = await call(POCKET_ENDPOINTS.lanTokenRefresh, {});
      setStatus((s) => ({ ...s, lanToken: r.lanToken }));
    } catch { /* 忽略 */ }
  };

  // 局域网访问密码开关（issue #24）：默认开启；关闭后局域网扫码直连（公网不受影响）
  const setLanAuth = async (on) => {
    try {
      const r = await call(POCKET_ENDPOINTS.lanAuthSetEnabled, { on });
      setStatus((s) => ({ ...s, lanAuthEnabled: r.lanAuthEnabled }));
    } catch { /* 忽略 */ }
  };

  // 局域网地址手动覆盖（Tailscale/VPN 等远程访问场景）：空值恢复自动选择
  const setLanAddress = async (ip) => {
    try {
      setStatus(await call(POCKET_ENDPOINTS.lanSetOverride, { ip }));
    } catch (err) {
      setError(err.message);
    }
  };

  // 自定义访问密码（issue #33）：公网/局域网各自设固定 8 位数字；自定义后公网不再自动轮换。
  // customPin: { which: 'public'|'lan', value, err } | null —— 正在输入自定义密码的区块
  const [customPin, setCustomPin] = useState(null);
  const saveCustomPin = async (which) => {
    try {
      const r = await call(POCKET_ENDPOINTS.pinSetCustom, { which, value: customPin?.value ?? '' });
      setStatus((s) => ({
        ...s,
        accessToken: which === 'public' ? r.pin : s.accessToken,
        lanToken: which === 'lan' ? r.pin : s.lanToken,
        publicPinCustom: which === 'public' ? true : s.publicPinCustom,
        lanPinCustom: which === 'lan' ? true : s.lanPinCustom,
      }));
      setCustomPin(null);
    } catch (err) {
      setCustomPin((c) => ({ ...c, err: err.message }));
    }
  };
  // 渲染自定义输入行（共用）：输入框 + 保存/取消
  const customPinRow = (which) => h('div', { style: { marginTop: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', lineHeight: 1.5 } },
    t('customizing'),
    h('input', {
      'data-dshp-field': '',
      style: { width: 110, margin: '0 6px', padding: '4px 8px', fontSize: 14, letterSpacing: 2, textAlign: 'center', border: '1px solid var(--dsw-alias-border-l2,#d1d5db)', borderRadius: 6, outline: 'none' },
      type: 'password',
      inputMode: 'numeric',
      maxLength: 8,
      value: customPin?.value ?? '',
      autoFocus: true,
      onChange: (e) => setCustomPin((c) => ({ ...c, value: e.target.value.replace(/\D/g, ''), err: null })),
      onKeyDown: (e) => { if (e.key === 'Enter') saveCustomPin(which); if (e.key === 'Escape') setCustomPin(null); },
    }),
    h('button', { style: { ...styles.btn, height: 26, padding: '0 10px', fontSize: 12, marginLeft: 2 }, 'data-dshp': 'ghost', onClick: () => saveCustomPin(which) }, t('save')),
    h('button', { style: { ...styles.btn, height: 26, padding: '0 10px', fontSize: 12 }, 'data-dshp': 'ghost', onClick: () => setCustomPin(null) }, t('cancel')),
    customPin?.err ? h('div', { style: { color: 'var(--dsw-alias-state-error-primary,#dc2626)', marginTop: 4 } }, customPin.err) : null,
  );
  // 「自定义」按钮（非输入态显示在密码行末尾）
  const customBtn = (which) => h('button', { style: { ...styles.btn, height: 26, padding: '0 10px', fontSize: 12, marginLeft: 8 }, 'data-dshp': 'ghost', onClick: () => setCustomPin({ which, value: '', err: null }) }, t('customize'));

  const lanUrl = status?.lanUrl;
  const tunnelUrl = status?.tunnelUrl;
  const tunnelPhase = tunnelState?.phase ?? 'idle';
  const tunnelStarting = ['downloading', 'starting', 'registering'].includes(tunnelPhase);
  const tunnelStateDetail = tunnelState?.detail ?? '';
  const tunnelStateStarted = tunnelState?.startedAt ?? null;

  // frp 状态文案
  const frpPhase = status?.frpState?.phase ?? 'idle';
  const frpDetail = status?.frpState?.detail ?? '';
  const frpStarted = status?.frpState?.startedAt ?? null;
  const frpStatusText = () => {
    if (frpPhase === 'downloading') return fmt(t, 'frpStateDownloading', { s: elapsed(frpStarted) });
    if (frpPhase === 'starting' || frpPhase === 'connecting') return fmt(t, 'frpStateConnecting', { s: elapsed(frpStarted) });
    if (frpPhase === 'ready') return t('frpStateReady');
    if (frpPhase === 'error') return fmt(t, 'frpStateError', { detail: frpDetail || t('unknownError') });
    return t('frpStateIdle');
  };

  return h('div', { style: styles.card },
    // 对话框头部已写明「手机访问」，卡片内不再重复标题，只留一句副标题
    h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
      h('div', { style: styles.muted }, t('subtitle')),
      h('div', { style: { fontSize: 12, color: 'var(--dsw-alias-label-tertiary,#8b93a1)', textAlign: 'right' } },
        h('div', { style: { whiteSpace: 'nowrap' } }, t('developer')),
        h('div', { style: { whiteSpace: 'nowrap' } }, t('starAsk')),
        h('a', { href: 'https://github.com/IronManCantFix/dsh-pocket', target: '_blank', rel: 'noreferrer', style: { color: 'var(--dsw-alias-brand-primary,#4f6ef7)', fontSize: 12, lineHeight: 1.6, textDecoration: 'underline' } },
          t('starCta')),
      ),
    ),

    // 重启后提示（进程在后台运行，停止方法）——整框浅底色，不用侧边色条
    !isDesktop && restartNotice ? h('div', { style: { ...styles.block, border: '1px solid var(--dsw-alias-border-l2,#e5e7eb)', borderRadius: 8, background: 'var(--dsw-alias-bg-layer-2,#f3f4f6)', padding: '10px 12px' } },
      h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 } },
        h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('restarted')),
        h('button', { style: styles.btn, 'data-dshp': 'ghost', onClick: () => setRestartNotice(false) }, t('ok')),
      ),
      h('div', { style: styles.muted, marginTop: 4, wordBreak: 'break-all' }, fmt(t, 'bgHint', { cmd: status?.killHint ?? `lsof -ti :${status?.dshPort ?? 3080} | xargs kill -9` })),
    ) : null,

    // 版本信息（桌面端/手机端都显示）：当前版本 + GitHub 最新版本 + 更新命令
    // 不自动检测更新、不弹更新横幅；GitHub 版本由服务端查询（失败静默降级，显示「获取失败」）。
    // 磁盘已更新未重启时（仅非桌面端）提示重启生效——桌面端更新/重启由 DSH Desktop 管理。
    h('div', { style: styles.block },
      h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('versionTitle')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12, lineHeight: 1.6 } },
        h('span', { style: { color: 'var(--dsw-alias-label-secondary,#6b7280)' } }, t('versionCurrentLabel')),
        h('span', { style: { fontFamily: 'monospace' } }, versionInfo.current ? `v${versionInfo.current}` : '—'),
        h('span', { style: { color: 'var(--dsw-alias-label-secondary,#6b7280)', marginLeft: 12 } }, t('versionGithubLabel')),
        versionInfo.loading
          ? h('span', { style: styles.muted }, t('versionGithubLoading'))
        : (!versionInfo.githubLatest || versionInfo.failed)
          ? h('span', { style: { color: 'var(--dsw-alias-state-error-primary,#dc2626)' } },
              t('versionGithubFail'),
              h('a', { href: versionInfo.githubUrl ?? 'https://github.com/IronManCantFix/dsh-pocket/releases/latest', target: '_blank', rel: 'noreferrer', style: { color: 'var(--dsw-alias-brand-primary,#4f6ef7)', marginLeft: 6 } }, t('versionGithubOpen')),
            )
          : h('span', null,
              h('a', {
                href: versionInfo.githubUrl,
                target: '_blank',
                rel: 'noreferrer',
                style: {
                  fontFamily: 'monospace',
                  color: compareVersions(versionInfo.githubLatest, versionInfo.current) > 0
                    ? 'var(--dsw-alias-state-warn-primary,#b45309)'
                    : 'var(--dsw-alias-brand-primary,#4f6ef7)',
                },
              }, `v${versionInfo.githubLatest}`),
              compareVersions(versionInfo.githubLatest, versionInfo.current) > 0
                ? h('span', { style: { color: 'var(--dsw-alias-state-warn-primary,#b45309)', marginLeft: 6 } }, t('versionNewer'))
                : null,
            ),
        h('button', {
          style: { ...styles.btn, height: 26, padding: '0 8px', fontSize: 12, marginLeft: 'auto' },
          'data-dshp': 'ghost',
          onClick: () => { setVersionInfo((v) => ({ ...v, loading: true, failed: false })); loadVersion(); },
          disabled: versionInfo.loading,
          title: t('versionRefresh'),
          'aria-label': t('versionRefresh'),
        }, typeof IconRefreshOutline16 === 'function' ? h(IconRefreshOutline16, { size: 14 }) : '↻'),
      ),
      h('div', { style: { color: 'var(--dsw-alias-label-secondary,#6b7280)', marginTop: 10, fontSize: 12 } }, t('updateCmd')),
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 } },
        h('code', { style: { ...styles.code, margin: 0, flex: 1, background: 'var(--dsw-alias-bg-layer-2,#f3f4f6)', padding: '6px 8px', borderRadius: 6 } }, installCmd),
        h('button', {
          style: { ...styles.btn, height: 26, padding: '0 10px', fontSize: 12, flex: 'none' },
          'data-dshp': 'ghost',
          onClick: () => copyWithFeedback('cmd', installCmd),
        },
          copied === 'cmd' ? t('copied')
            : copied === '!cmd' ? t('copyFail') : t('copy')),
      ),
      h('div', { style: styles.muted, marginTop: 6, fontSize: 12 }, t('updateHint')),
      // 磁盘已更新未重启（仅非桌面端提示重启生效）
      !isDesktop && versionInfo.current && versionInfo.loaded && compareVersions(versionInfo.current, versionInfo.loaded) > 0
        ? h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 } },
            h('div', { style: { ...styles.warn, margin: 0, flex: 1 } }, fmt(t, 'versionRestartHint', { ver: versionInfo.current })),
            h('button', {
              style: { ...styles.primary, height: 30, padding: '0 14px', fontSize: 12, flex: 'none' },
              'data-dshp': 'primary',
              onClick: restartPocket,
              disabled: restartState?.restarting,
            }, restartState?.restarting ? fmt(t, 'restartingDetail', { s: elapsed(restartState.startedAt) }) : t('restartNow')),
          )
        : null,
    ),

    // NAS 反向隧道（frp）：自建入口——本插件主打 NAS 场景，排在局域网/公网之前；
    // 手机访问 NAS 域名即达电脑，国内直连最快
    h('div', { style: styles.block },
      h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('frpTitle')),
      h('div', { style: { ...styles.muted, marginTop: 4 } }, t('frpHint')),
      frpForm ? h('div', { style: { marginTop: 10, display: 'grid', gap: 8 } },
        h('label', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', display: 'grid', gap: 4 } },
          t('frpServerAddr'),
          h('input', {
            'data-dshp-field': '',
            style: { font: 'inherit', height: 30, padding: '0 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2,#d1d5db)', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)' },
            type: 'text',
            placeholder: t('frpServerAddrPlaceholder'),
            value: frpForm.serverAddr,
            onChange: (e) => setFrpForm((f) => ({ ...f, serverAddr: e.target.value })),
          }),
        ),
        h('div', { style: { display: 'flex', gap: 8 } },
          h('label', { style: { flex: 1, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', display: 'grid', gap: 4 } },
            t('frpServerPort'),
            h('input', {
              'data-dshp-field': '',
              style: { font: 'inherit', height: 30, padding: '0 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2,#d1d5db)', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)' },
              type: 'number', min: 1, max: 65535,
              value: frpForm.serverPort,
              onChange: (e) => setFrpForm((f) => ({ ...f, serverPort: e.target.value })),
            }),
          ),
          h('label', { style: { flex: 1, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', display: 'grid', gap: 4 } },
            t('frpRemotePort'),
            h('input', {
              'data-dshp-field': '',
              style: { font: 'inherit', height: 30, padding: '0 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2,#d1d5db)', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)' },
              type: 'number', min: 1, max: 65535,
              value: frpForm.remotePort,
              onChange: (e) => setFrpForm((f) => ({ ...f, remotePort: e.target.value })),
            }),
          ),
        ),
        h('label', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', display: 'grid', gap: 4 } },
          t('frpToken'),
          h('div', { style: { position: 'relative' } },
            h('input', {
              'data-dshp-field': '',
              style: { font: 'inherit', height: 30, width: '100%', boxSizing: 'border-box', padding: '0 52px 0 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2,#d1d5db)', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)' },
              type: frpShowToken ? 'text' : 'password',
              placeholder: status?.frpHasToken && !frpForm.token ? `•••••••• (${t('frpSaved')})` : t('frpTokenPlaceholder'),
              value: frpForm.token,
              onChange: (e) => setFrpForm((f) => ({ ...f, token: e.target.value })),
            }),
            // 明文切换：文字按钮（无障碍名称完整），不用表情符号当图标
            h('button', {
              type: 'button',
              'data-dshp': 'ghost',
              title: frpShowToken ? t('frpTokenHide') : t('frpTokenShow'),
              'aria-label': frpShowToken ? t('frpTokenHide') : t('frpTokenShow'),
              onClick: () => setFrpShowToken((v) => !v),
              style: { position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', height: 20, padding: '0 6px', border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 12, lineHeight: 1, color: 'var(--dsw-alias-label-secondary,#8b93a1)', borderRadius: 6 },
            }, frpShowToken ? t('hide') : t('show')),
          ),
        ),
        h('label', { style: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)' } },
          h('input', { type: 'checkbox', checked: frpForm.tls === true, onChange: (e) => setFrpForm((f) => ({ ...f, tls: e.target.checked })) }),
          t('frpTls'),
        ),
        h('div', { style: { ...styles.muted, marginTop: -2 } }, t('frpTlsHint')),
        h('div', { style: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 } },
          h('button', { style: { ...styles.btn, height: 30, padding: '0 12px', fontSize: 12 }, 'data-dshp': 'ghost', onClick: saveFrp, disabled: frpBusy }, frpSaved ? t('frpSaved') : t('frpSave')),
          status?.frpRunning
            ? h('button', { style: { ...styles.btn, height: 30, padding: '0 12px', fontSize: 12 }, 'data-dshp': 'ghost', onClick: stopFrp }, t('frpStop'))
            : h('button', {
              style: { ...styles.primary, height: 30, padding: '0 12px', fontSize: 12 },
              'data-dshp': 'primary',
              onClick: startFrp,
              disabled: frpBusy || !status?.frpConfig?.serverAddr || !status?.frpHasToken,
            }, frpBusy ? t('frpStarting') : t('frpStart')),
        ),
        (!status?.frpConfig?.serverAddr || !status?.frpHasToken)
          ? h('div', { style: { ...styles.warn, marginTop: 4 } }, t('frpConfigureFirst'))
          : null,
      ) : h('div', { style: { ...styles.muted, marginTop: 8 } }, t('frpConfigureFirst')),
      h('div', { style: { marginTop: 8, fontSize: 12, lineHeight: 1.6 } }, frpStatusText()),
      frpError ? h('div', { style: { color: 'var(--dsw-alias-state-error-primary,#dc2626)', fontSize: 12, marginTop: 4 } }, `❌ ${frpError}`) : null,
      h('div', { style: { marginTop: 10 } },
        h('button', { style: { ...styles.btn, height: 30, padding: '0 12px', fontSize: 12 }, 'data-dshp': 'ghost', onClick: copyFrpCompose },
          copied === 'frp' ? t('frpCopied')
            : copied === '!frp' ? t('copyFail') : t('frpCopyCompose')),
      ),
    ),

    // 局域网
    h('div', { style: styles.block },
      h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('lanTitle')),
      lanUrl
        ? h('div', null,
          h('img', { src: status.lanQr, alt: 'LAN QR', style: styles.qr }),
          h('div', { style: styles.code }, lanUrl),
          h('div', { style: styles.muted }, t('lanHint')),
          h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)' } },
            t('lanAddress'),
            h('select', {
              'data-dshp-field': '',
              value: status?.lanIpOverride || '',
              onChange: (e) => setLanAddress(e.target.value),
              style: { font: 'inherit', height: 30, padding: '0 8px', borderRadius: 8, border: '1px solid var(--dsw-alias-border-l2,#d1d5db)', background: 'var(--dsw-alias-bg-layer-1,#fff)', color: 'var(--dsw-alias-label-primary,inherit)' },
            },
            h('option', { value: '' }, t('lanAddressAuto')),
            (status?.lanCandidates || []).map((ip) => h('option', { key: ip, value: ip }, ip)),
            ),
          ),
          h('div', { style: { ...styles.muted, marginTop: 2 } }, t('lanAddressHint')),
          // 访问密码开关（issue #24）：默认开启；关闭后扫码直连（仅同一局域网设备可访问）
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 } },
            h('span', { style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)' } }, t('lanPin')),
            h('button', {
              'data-dshp-toggle': '',
              style: { ...styles.btn, height: 28, padding: '0 12px', fontSize: 12, fontWeight: status?.lanAuthEnabled !== false ? 600 : 400, background: status?.lanAuthEnabled !== false ? 'var(--dsw-alias-button-primary-fill, var(--dsw-alias-brand-primary,#4f6ef7))' : 'var(--dsw-alias-bg-layer-1,#fff)', color: status?.lanAuthEnabled !== false ? 'var(--dsw-alias-label-primary-foreground, #fff)' : 'var(--dsw-alias-label-primary,inherit)' },
              onClick: () => setLanAuth(true),
            }, t('on')),
            h('button', {
              'data-dshp-toggle': '',
              style: { ...styles.btn, height: 28, padding: '0 12px', fontSize: 12, fontWeight: status?.lanAuthEnabled === false ? 600 : 400, background: status?.lanAuthEnabled === false ? 'var(--dsw-alias-state-error-primary,#dc2626)' : 'var(--dsw-alias-bg-layer-1,#fff)', color: status?.lanAuthEnabled === false ? '#fff' : 'var(--dsw-alias-label-primary,inherit)' },
              onClick: () => setLanAuth(false),
            }, t('off')),
          ),
          status?.lanAuthEnabled !== false
            ? (customPin?.which === 'lan'
                ? customPinRow('lan')
                : h('div', { style: { marginTop: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', lineHeight: 1.5 } },
                  fmt(t, status?.lanPinCustom ? 'lanPinCustomValue' : 'lanPinValue', { pin: status.lanToken }),
                  h('button', { style: { ...styles.btn, height: 26, padding: '0 10px', fontSize: 12, marginLeft: 8 }, 'data-dshp': 'ghost', onClick: refreshLanPin }, t('refresh')),
                  customBtn('lan'),
                ))
            : h('div', { style: { marginTop: 6, fontSize: 12, color: 'var(--dsw-alias-state-warn-primary,#b45309)', lineHeight: 1.5 } },
              t('lanPinOff')),
        )
        : h('div', { style: styles.muted }, t('lanStarting')),
    ),

    // 公网
    h('div', { style: styles.block },
      h('div', { style: { fontWeight: 600, fontSize: 13 } }, t('wanTitle')),
      tunnelUrl
        ? h('div', null,
          h('img', { src: status.tunnelQr, alt: 'Tunnel QR', style: styles.qr }),
          h('div', { style: styles.code }, tunnelUrl),
          h('div', { style: styles.muted }, t('wanHint')),
          status.accessToken
            ? (customPin?.which === 'public'
                ? customPinRow('public')
                : h('div', { style: { marginTop: 6, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', lineHeight: 1.5 } },
                  fmt(t, status?.publicPinCustom ? 'wanPinCustom' : 'wanPin', { pin: status.accessToken }),
                  customBtn('public'),
                  status?.publicPinCustom ? h('div', { style: { marginTop: 2, fontSize: 11, color: 'var(--dsw-alias-state-warn-primary,#b45309)' } }, t('pinCustomHint')) : null,
                ))
            : null,
          h('button', { style: styles.btn, 'data-dshp': 'ghost', onClick: stopTunnel }, t('stopTunnel')),
        )
        : h('div', null,
          h('button', { style: { ...styles.primary, margin: '8px 0' }, 'data-dshp': 'primary', onClick: startTunnel, disabled: busy || tunnelStarting }, busy ? t('opening') : t('enable')),
          tunnelStarting
            ? h('div', { style: { marginTop: 4, fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)' } },
              tunnelPhase === 'downloading'
                ? fmt(t, 'downloading', { s: elapsed(tunnelStateStarted) })
                : fmt(t, 'connecting', { s: elapsed(tunnelStateStarted), suffix: elapsed(tunnelStateStarted) > 30 ? t('slowHint') : '' }))
            : tunnelPhase === 'error'
              ? h('div', { style: { marginTop: 4, fontSize: 12, color: 'var(--dsw-alias-state-error-primary,#dc2626)' } },
                fmt(t, 'error', { detail: tunnelStateDetail || t('unknownError') }))
              : null,
        ),
    ),

    error ? h('div', { style: { color: 'var(--dsw-alias-state-error-primary,#dc2626)', fontSize: 12, marginTop: 8 } }, `❌ ${error}`) : null,

    // 安全免责声明弹框（issue #31）：每次开启公网访问前确认
    disclaimerOpen ? h('div', { role: 'dialog', 'aria-modal': true, 'aria-label': t('disclaimerTitle'), style: { position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--dsw-alias-bg-mask-1, rgba(15,17,21,.55))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 } },
      h('div', { style: { background: 'var(--dsw-alias-bg-layer-1,#fff)', borderRadius: 12, maxWidth: 420, width: '100%', padding: '20px 22px', boxShadow: '0 8px 32px rgba(0,0,0,.18)' } },
        h('div', { style: { fontWeight: 600, fontSize: 15, color: 'var(--dsw-alias-state-warn-primary,#b45309)', marginBottom: 10 } }, t('disclaimerTitle')),
        h('div', { style: { fontSize: 13, lineHeight: 1.7, color: 'var(--dsw-alias-label-primary,inherit)' } }, t('disclaimerBody')),
        h('label', { style: { display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 13, cursor: 'pointer' } },
          h('input', { type: 'checkbox', checked: disclaimerChecked, onChange: (e) => setDisclaimerChecked(e.target.checked), autoFocus: true, style: { width: 16, height: 16 } }),
          t('disclaimerAgree'),
        ),
        h('div', { style: { display: 'flex', gap: 8, marginTop: 16 } },
          h('button', { style: { ...styles.btn, flex: 1 }, 'data-dshp': 'ghost', onClick: () => setDisclaimerOpen(false) }, t('cancel')),
          h('button', {
            style: { ...styles.primary, flex: 1 },
            'data-dshp': 'primary',
            disabled: !disclaimerChecked,
            onClick: confirmDisclaimer,
          }, t('confirmEnable')),
        ),
        !disclaimerChecked ? h('div', { style: { marginTop: 8, fontSize: 12, color: 'var(--dsw-alias-state-error-primary,#dc2626)' } }, t('disclaimerHint')) : null,
      ),
    ) : null,

    // 页面最底部：反馈入口
    h('div', { style: { ...styles.block, textAlign: 'center' } },
      h('a', { href: 'https://github.com/IronManCantFix/dsh-pocket/issues', target: '_blank', rel: 'noreferrer', style: { fontSize: 12, color: 'var(--dsw-alias-label-secondary,#6b7280)', textDecoration: 'none' } },
        t('feedback')),
    ),
  );
}

// 侧边栏「手机访问」入口（仅桌面端）：注册在 sidebar.footer.action 槽位——
// dsh 侧边栏的渲染顺序是 footer.action（上）→ settings（设置按钮，下），
// 所以入口天然位于设置按钮上方。点击直接渲染完整配置页（自包含对话框，
// 不依赖 dsh 设置面板的内部状态：官方无 API 可从外部打开设置面板并定位
// 到指定 section，因此这里自渲染，同时从设置面板移除原 settings.section 入口）。
//
// 侧边栏收起时：宿主 SidebarRoot 给本槽位的每个条目传 `wide`（收起动画结束后
// 变为 false），官方条目此时都变成 36×36 圆形纯图标按钮（见 ui-settings-general
// 的 trigger.rail），这里跟随同一形态；Tooltip 也用官方原语（500ms 延迟，
// 与 New Session 一致），宿主缺该导出时回退为原生 title。
function PocketEntryButton({ rpcCall, t, wide = true }) {
  const [open, setOpen] = useState(false);
  const [narrow, setNarrow] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  useEffect(() => {
    const q = window.matchMedia('(max-width: 1023px)');
    const on = (e) => setNarrow(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  // Esc 关闭对话框
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [open]);
  // 对话框关闭后把焦点还给触发按钮
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement;
    return () => { try { prev?.focus?.(); } catch { /* 元素可能已移除 */ } };
  }, [open]);
  if (narrow) return null; // 仅桌面端显示入口

  const label = t('entryLabel');
  // 官方 rail 形态：36×36 圆形、图标居中、hover/focus 走注入的状态样式
  const railButton = h('button', {
    type: 'button',
    'data-dsh-pocket-entry': '',
    'aria-label': label,
    title: Tooltip == null ? label : undefined, // 官方 Tooltip 缺席时用原生 title 兜底
    onClick: () => setOpen(true),
    style: {
      width: 36, height: 36, margin: '4px 0', padding: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      border: 'none', borderRadius: '50%', background: 'transparent',
      color: 'var(--dsw-alias-label-primary, inherit)', cursor: 'pointer',
      font: 'inherit',
    },
  }, h('span', { 'aria-hidden': true, style: { fontSize: 16, lineHeight: 1, flex: 'none' } }, '📱'));

  return h(Fragment, null,
    wide ? h('button', {
      type: 'button',
      'data-dsh-pocket-entry': '',
      onClick: () => setOpen(true),
      style: {
        display: 'flex', alignItems: 'center', gap: 8,
        width: '100%', boxSizing: 'border-box', height: 42,
        padding: '0 10px 0 8px', margin: '4px -2px',
        border: 'none', borderRadius: 12, background: 'transparent',
        color: 'var(--dsw-alias-label-primary, inherit)',
        font: 'inherit', fontSize: 14, lineHeight: '22px',
        cursor: 'pointer', textAlign: 'left',
      },
    },
      h('span', { style: { fontSize: 16, flex: 'none', lineHeight: 1 } }, '📱'),
      h('span', { style: { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } }, label),
    ) : (Tooltip != null
      ? h(Tooltip, { label, delayMs: 500 }, railButton)
      : railButton),
    open ? h('div', {
      role: 'dialog',
      'aria-modal': 'true',
      'aria-label': t('section'),
      'data-dsh-pocket-dialog': '',
      'data-dsh-pocket-overlay': '',
      style: {
        position: 'fixed', inset: 0, zIndex: 10000,
        background: 'var(--dsw-alias-bg-mask-1, rgba(15,17,21,.55))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      },
      onClick: (e) => { if (e.target === e.currentTarget) setOpen(false); },
    },
      h('div', { 'data-dsh-pocket-panel': '', style: {
        background: 'var(--dsw-alias-bg-base, #fff)',
        borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,.25)',
        width: '100%', maxWidth: 560, maxHeight: 'min(88vh, 820px)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      } },
        h('div', { style: {
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px',
          borderBottom: '1px solid var(--dsw-alias-border-l2, #e5e7eb)',
          flex: 'none',
        } },
          h('strong', { style: { fontSize: 15, color: 'var(--dsw-alias-label-primary, inherit)' } }, t('section')),
          h('button', {
            type: 'button',
            'aria-label': t('closeDialog'),
            autoFocus: true, // 打开对话框即落在关闭钮上，Esc/Tab 从这里开始
            onClick: () => setOpen(false),
            style: {
              width: 30, height: 30, borderRadius: '50%', border: 'none',
              background: 'var(--dsw-alias-interactive-bg-hover, rgba(0,0,0,.06))',
              color: 'var(--dsw-alias-label-primary, inherit)',
              cursor: 'pointer', fontSize: 14, lineHeight: 1,
            },
          }, '✕'),
        ),
        h('div', { style: { padding: 18, overflowY: 'auto' } },
          h(PocketSettingsTab, { rpcCall, t }),
        ),
      ),
    ) : null,
  );
}

export function apply(ctx) {
  // 兜底：确保 connection.isLoopback 为 true（issue #58）。
  // 经代理（局域网 IP / 隧道域名）打开时，客户端认为自己是「非本机」，设置/模型平面
  // 会显示「此浏览器不可用」。宿主侧的特权栅栏由 lib/proxy.mjs 的 loopbackAuthority
  // 改写 Host/Origin/Referer/Sec-Fetch-Site 解决，这里只补客户端这一层的判定。
  // 注：上游用「代理注入 __ModuleLoader__ 补丁」实现同一目的的路子已在 #105 撤销
  // （与新版 DSH Desktop 客户端运行时不兼容，会导致 BootHandoff 阶段白屏），故不采用。
  if (ctx?.connection) {
    try {
      Object.defineProperty(ctx.connection, 'isLoopback', { value: true, writable: true, configurable: true });
    } catch {
      try { ctx.connection.isLoopback = true; } catch { /* 忽略 */ }
    }
  }

  // 移动端适配（dsh-web-mobile 移植）：抽屉布局/触控/安全区，仅窄屏生效
  mobileApply(ctx);

  const rpcCall = (endpoint, payload, signal) =>
    ctx.connection.rpc.call(POCKET_RPC_CHANNEL, endpoint, payload, signal);

  // 设置页签接入 DSH 本地化：注册 pocket 词典（zh/en），并绑定一个随当前 locale 切换的 t()。
  const translate = ctx.locale.bind(POCKET_NS);
  ctx.effect(() => ctx.locale.register(POCKET_NS, { zh: POCKET_ZH, en: POCKET_EN }), 'dsh-pocket: pocket locale dictionaries');

  // 桌面配置页的状态层样式（hover/focus/disabled/入场动画）：一次注入，
  // 卸载时移除；作用域全部钉在自有 data-* 钩子上。
  ctx.effect(() => {
    const tag = document.createElement('style');
    tag.dataset.plugin = name;
    tag.dataset.pluginCss = `${name}/ui.css`;
    tag.textContent = POCKET_UI_CSS;
    document.head.appendChild(tag);
    return () => tag.remove();
  }, 'dsh-pocket: client ui state styles');

  // 侧边栏「手机访问」入口（仅桌面端，位于设置按钮上方）；配置页自渲染对话框。
  // 注意：不再注册 settings.section——设置面板里不再出现「手机访问」tab。
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'pocket-entry',
        order: 0,
        locale: POCKET_NS,
        inject: () => ({ rpcCall, t: translate }),
      },
      PocketEntryButton,
    ),
  );
}

export { name, inject, redactStatus };
