// dsh-pocket Web RPC（loopback-only）：设置页 ⇄ Host 的手机访问通道

import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { POCKET_RPC_CHANNEL, POCKET_ENDPOINTS, redactStatus } from '../client/api.js';

/** 单次读取上限：4 MB，避免把大文件塞进剪贴板 / 内存（issue #17）。 */
const FILE_READ_MAX = 4 * 1024 * 1024;

function ok(value) {
  return { ok: true, value };
}

/**
 * 构造符合 DSH rpcErrorSchema 的错误（按 code 的 discriminated union，
 * details 必填且分分支定形；'internal' 不在合法 code 集合里）。
 */
function fail(code, message) {
  if (code === 'cancelled') return { ok: false, error: { code: 'cancelled', message, details: {} } };
  // 其余一律归入 bad-request（issues 是自由数组）
  return { ok: false, error: { code: 'bad-request', message, details: { issues: [{ message }] } } };
}

/** 各平台停止 dsh web 进程的命令（Windows 没有 lsof/kill）。 */
export function killHint(port) {
  if (process.platform === 'win32') {
    return `netstat -ano | findstr :${port}（找 LISTENING 的 PID）→ taskkill /PID <PID> /F`;
  }
  return `lsof -ti :${port} | xargs kill -9`;
}

// cordis 用 Symbol.for 暴露服务的原始实例（跨 cordis 副本也稳定）。
const CORDIS_ORIGINAL = Symbol.for('cordis.original');

/** 某个 ctx 能否解析服务 name（不能解析时 cordis 会抛错）。 */
function resolvesService(ctx, name) {
  try {
    return ctx?.[name] !== undefined;
  } catch {
    return false;
  }
}

/**
 * 取一个可用的逻辑通道注册器。
 *
 * 背景（DSH 0.9.0 / dsh 0.1.5-rc.2 起）：connection 插件把 webServer 从自身
 * inject 里摘掉，改成 `ctx.inject(['webServer'], ...)` 懒加载。而
 * `connection.rpc.handle()` 内部用服务自身 ctx 解析 `owner.webServer`，于是抛
 * `cannot get property "webServer" without inject` —— 插件 apply 直接失败，
 * 整个插件树都加载不起来。
 *
 * 所以这里两级兼容：
 *   1) 公开 API `connection.rpc.handle(channel, handler)`（旧版 DSH / 上游修好后走这条）；
 *   2) 退回 `connection.register(owner, channel, handler)`，owner 用插件自己的 ctx
 *      （webServer 在插件 fiber 上可正常解析）。注册逻辑、Host/Origin 栅栏、
 *      浏览器鉴权、RPC 信封协议全部复用 DSH 实现，行为一致。
 *
 * @returns {(channel: string, handler: Function, options?: object) => Function} 注册器；无 Connection 服务时返回 null。
 */
function channelRegistrar(ctx, log) {
  const connection = ctx?.connection;
  const handle = connection?.rpc?.handle;
  const register = connection?.register;
  if (typeof handle !== 'function' && typeof register !== 'function') return null;

  const viaRegister = typeof register === 'function'
    ? (channel, handler) => register.call(connection, ctx, channel, handler)
    : null;

  // 先探测：connection 服务注册时的 ctx 能否解析 webServer。
  // 新版 DSH 解析不了 → 公开 API 必然失败，直接走退回路径，免得先制造一次失败的 effect。
  const ownCtx = connection[CORDIS_ORIGINAL]?.ctx;
  if (viaRegister && ownCtx !== undefined && !resolvesService(ownCtx, 'webServer')) {
    log?.warn?.('dsh-pocket: connection.rpc.handle cannot resolve webServer (new DSH) — registering the channel via connection.register | 新版 DSH 下退回 connection.register 注册通道');
    return viaRegister;
  }

  return (channel, handler, options) => {
    if (typeof handle !== 'function') return viaRegister(channel, handler);
    try {
      // 第三参（authority 等）旧版 DSH 认，新版直接忽略——照旧传，不回退行为。
      return handle.call(connection, channel, handler, options);
    } catch (err) {
      if (!viaRegister) throw err;
      log?.warn?.('dsh-pocket: connection.rpc.handle failed (%s) — falling back to connection.register | 退回 connection.register 注册通道', err?.message ?? err);
      return viaRegister(channel, handler);
    }
  };
}

/** 注册 /dsh-pocket 逻辑通道（仅本机 loopback 可调）。 */
export function installPocketRpc(ctx, { service, log = console, desktop = false, runUpdate = null, restart = null, restartNotice = null, getToken = null, getLanToken = null, refreshLanToken = null, getLanAuthEnabled = null, setLanAuthEnabled = null, getLanIpOverride = null, setLanIpOverride = null, getPinCustom = null, setCustomPin = null, getFrpConfig = null, setFrpConfig = null, setFrpToken = null, getGithubLatest = null, resetPocket = null }) {
  const registrar = channelRegistrar(ctx, log);
  if (!registrar) {
    log.warn?.('dsh-pocket: DSH Host Connection RPC unavailable — settings tab disabled | 无 Connection RPC，设置页不可用');
    return () => {};
  }
  const handler = async (endpoint, payload = {}, signal) => {
    if (signal?.aborted) return fail('cancelled', 'The request was cancelled.');

    // status 响应：服务状态 + 重启提示 + 停止命令 + 桌面端标志 + 公网/局域网访问密码 + 局域网密码开关
    const statusPayload = async () => {
      let notice = null;
      try { notice = (await restartNotice?.()) ?? null; } catch { notice = null; }
      const s = await service.status();
      return ok({
        ...redactStatus(s),
        desktop,
        restartNotice: notice,
        killHint: killHint(s.dshPort ?? 3080),
        accessToken: getToken?.() ?? null,
        lanToken: getLanToken?.() ?? null,
        lanAuthEnabled: getLanAuthEnabled?.() ?? true,
        publicPinCustom: getPinCustom?.('public') ?? false,
        lanPinCustom: getPinCustom?.('lan') ?? false,
        // frp 连接令牌（设置页输入框回显用；与 accessToken/lanToken 同级，仅 loopback RPC 可见）
        frpToken: getFrpConfig?.()?.token ?? null,
      });
    };

    try {
      if (endpoint === POCKET_ENDPOINTS.status) {
        return await statusPayload();
      }
      if (endpoint === POCKET_ENDPOINTS.lanTokenRefresh) {
        const fresh = refreshLanToken?.() ?? null;
        if (!fresh) return fail('bad-request', '局域网密码刷新不可用 | LAN PIN refresh unavailable');
        return ok({ lanToken: fresh });
      }
      if (endpoint === POCKET_ENDPOINTS.lanAuthSetEnabled) {
        const enabled = setLanAuthEnabled?.(payload?.on === true);
        if (enabled === undefined) return fail('bad-request', '局域网密码开关不可用 | LAN PIN switch unavailable');
        return ok({ lanAuthEnabled: enabled });
      }
      if (endpoint === POCKET_ENDPOINTS.lanSetOverride) {
        // 返回完整 status：前端 setStatus(await call(...)) 直接替换 status 对象，
        // 若只返回 { lanIpOverride } 会丢掉 accessToken/lanToken/tunnelUrl 等字段，
        // 且 lanUrl/二维码不会随新 IP 刷新（PR #47 的客户端写法依赖完整 status）。
        try {
          const ip = setLanIpOverride?.(payload?.ip ?? '');
          if (ip === undefined) return fail('bad-request', '局域网地址设置不可用 | LAN address setting unavailable');
          return await statusPayload();
        } catch (err) {
          return fail('bad-request', err?.message ?? String(err));
        }
      }
      if (endpoint === POCKET_ENDPOINTS.pinSetCustom) {
        const which = payload?.which === 'public' || payload?.which === 'lan' ? payload.which : null;
        if (!which) return fail('bad-request', '未知密码类型 | unknown PIN kind');
        try {
          const pin = setCustomPin?.(which, payload?.value);
          if (pin === undefined) return fail('bad-request', '自定义密码不可用 | custom PIN unavailable');
          return ok({ which, pin, custom: true });
        } catch (err) {
          return fail('bad-request', err?.message ?? String(err));
        }
      }
      // ---------- NAS 反向隧道（frp） ----------
      if (endpoint === POCKET_ENDPOINTS.frpConfigGet) {
        const cfg = getFrpConfig?.() ?? null;
        if (!cfg) return fail('bad-request', 'frp 配置不可用 | frp config unavailable');
        // token 回传用于设置页输入框回显（仅 loopback）；未设置时 null
        return ok({
          config: { serverAddr: cfg.serverAddr, serverPort: cfg.serverPort, remotePort: cfg.remotePort, tls: cfg.tls === true, token: cfg.token ?? null },
          hasToken: Boolean(cfg.token),
        });
      }
      if (endpoint === POCKET_ENDPOINTS.frpConfigSet) {
        try {
          if (!setFrpConfig) return fail('bad-request', 'frp 配置不可用 | frp config unavailable');
          const cfg = setFrpConfig({
            serverAddr: payload?.serverAddr,
            serverPort: payload?.serverPort,
            remotePort: payload?.remotePort,
            tls: payload?.tls,
          });
          // token 单独写（可选：不传则保留旧值）；响应回传生效后的 token（设置页回显）
          if (payload?.token !== undefined && payload?.token !== null && String(payload.token).trim() !== '') {
            setFrpToken?.(String(payload.token).trim());
          }
          const effectiveToken = getFrpConfig?.()?.token ?? null;
          return ok({ config: cfg, hasToken: Boolean(effectiveToken), token: effectiveToken });
        } catch (err) {
          return fail('bad-request', err?.message ?? String(err));
        }
      }
      if (endpoint === POCKET_ENDPOINTS.frpStart) {
        try {
          await service.startFrpTunnel();
          return await statusPayload();
        } catch (err) {
          return fail('bad-request', err?.message ?? String(err));
        }
      }
      if (endpoint === POCKET_ENDPOINTS.frpStop) {
        service.stopFrpTunnel();
        return await statusPayload();
      }
      if (endpoint === POCKET_ENDPOINTS.tunnelStart) {
        // 安全免责声明（issue #31）：每次开启公网都必须先确认（前端弹框勾选）。
        // 服务端强制校验，防止绕过前端直接调 RPC。
        if (payload?.disclaimer !== true) {
          return fail('bad-request', '开启公网前请先阅读并勾选安全免责声明 | please accept the security disclaimer before enabling public access');
        }
        await service.startTunnel();
        return await statusPayload();
      }
      if (endpoint === POCKET_ENDPOINTS.tunnelStop) {
        service.stopTunnel();
        return await statusPayload();
      }
      if (endpoint === POCKET_ENDPOINTS.version) {
        // githubLatest：注入的缓存获取器（lib/index.js 提供）；未注入（测试）时保持 null、不发起网络
        return ok({
          current: runUpdate?.currentVersion?.() ?? null,
          loaded: runUpdate?.loadedVersion?.() ?? null,
          githubLatest: (await getGithubLatest?.()) ?? null,
        });
      }
      if (endpoint === POCKET_ENDPOINTS.fileRead) {
        // 移动端「复制文件内容」（issue #17，移植上游 06f69fd）：手机点复制按钮 →
        // 主机读文件正文返回。路径三种形态：
        //   - 绝对路径：直接用；
        //   - ~/ 开头：展开为用户 HOME；
        //   - 相对路径：相对「客户端传入的 cwd」或「DSH 主机进程 cwd = 工作目录」
        //     （用户从自己项目里 `dsh web` 时二者一致，与 dsh-web 的
        //     resolveWorkspacePath(cwd, path) 行为对齐）。安全边界同既有 RPC：
        //     仅本机/隧道经 PIN 可达，等同于你自己操作这台机器。
        const raw = String(payload?.path ?? '').trim();
        if (!raw) return fail('bad-request', '缺少文件路径 | missing path');
        let abs;
        try {
          if (/^~[/\\]?/.test(raw)) {
            // 去掉 ~ 及其后的可选斜杠，再相对 HOME 解析
            abs = path.resolve(os.homedir(), raw.replace(/^~[/\\]?/, ''));
          } else if (path.isAbsolute(raw)) {
            abs = path.resolve(raw);
          } else {
            const base = typeof payload?.cwd === 'string' && payload.cwd ? payload.cwd : process.cwd();
            abs = path.resolve(base, raw);
          }
        } catch {
          return fail('bad-request', '路径非法 | invalid path');
        }
        let stat;
        try {
          stat = await fs.stat(abs);
        } catch {
          return fail('bad-request', `文件不存在：${abs} | file not found`);
        }
        if (stat.isDirectory()) return fail('bad-request', '这是目录，不是文件 | it is a directory');
        if (stat.size > FILE_READ_MAX) {
          return fail('bad-request', `文件过大（${(stat.size / 1024 / 1024).toFixed(1)} MB），无法复制 | file too large`);
        }
        let buf;
        try {
          buf = await fs.readFile(abs);
        } catch (err) {
          return fail('bad-request', `读取失败：${err?.message ?? String(err)} | read failed`);
        }
        // 二进制检测：前 8KB 含 NUL 字节即视为二进制，文本复制无意义。
        if (buf.subarray(0, 8192).includes(0)) {
          return fail('bad-request', '二进制文件，无法复制文本 | binary file');
        }
        return ok({ content: buf.toString('utf8'), path: abs, size: stat.size });
      }
      if (endpoint === POCKET_ENDPOINTS.pocketReset) {
        // 恢复出厂设置（672b31b）：必须显式确认（payload.confirm === true），
        // 先停掉正在运行的隧道再清空设置与密码，返回完整 status 供前端直接替换
        // （旧密码立即作废，手机需重新输入）。
        // 本 fork 多一条 NAS 反向隧道（frp）：配置与令牌都在重置范围内，运行中的
        // frpc 也必须停掉，否则重置后它还按旧配置连着别人的 frps。
        if (payload?.confirm !== true) {
          return fail('bad-request', '恢复出厂设置需要确认 | factory reset requires confirmation');
        }
        if (!resetPocket) return fail('bad-request', '恢复出厂设置不可用 | factory reset unavailable');
        try {
          service.stopTunnel();
          service.stopFrpTunnel?.();
          resetPocket();
          return await statusPayload();
        } catch (err) {
          return fail('bad-request', err?.message ?? String(err));
        }
      }
      if (endpoint === POCKET_ENDPOINTS.update) {
        // 桌面端：更新由 DSH Desktop 管理，这里关闭（不删除，仅禁用）
        if (desktop) return fail('bad-request', '桌面版更新由 DSH Desktop 管理，已在此环境停用 | updates are managed by DSH Desktop here');
        if (!runUpdate) return fail('bad-request', '更新不可用 | update unavailable');
        const result = await runUpdate.perform(payload?.profile ?? 'web');
        // 更新成功 → 自动重启生效（用户只点一次；helper 拉起失败则保持现状，可手动重启）
        if (result?.ok && restart) {
          const rr = restart();
          result.autoRestart = rr?.helperPid != null;
        }
        return ok(result);
      }
      if (endpoint === POCKET_ENDPOINTS.restart) {
        // 桌面端：重启由 DSH Desktop 管理，这里关闭（不删除，仅禁用）
        if (desktop) return fail('bad-request', '桌面版重启由 DSH Desktop 管理，已在此环境停用 | restart is managed by DSH Desktop here');
        if (!restart) return fail('bad-request', '重启不可用 | restart unavailable');
        const result = restart();
        // 重启拉起失败（helper 都没 spawn 出来）→ 如实报错，别让 UI 误报成功
        if (!result || result.helperPid == null) {
          return fail('bad-request', `重启失败：${result?.error ?? '未知'} | restart failed`);
        }
        const dshPort = service.dshPort ?? 3080;
        return ok({ ...result, hint: `重启后进程在后台运行；如需停止：${killHint(dshPort)}` });
      }
      return fail('bad-request', `Unknown endpoint: ${endpoint}`);
    } catch (err) {
      log.error?.('dsh-pocket: rpc %s failed | RPC 失败: %s', endpoint, err?.message ?? err);
      return fail('bad-request', err?.message ?? String(err));
    }
  };

  // 通道注册失败不能让整个插件树挂掉：代理/隧道照常跑，只有设置页不可用。
  let dispose;
  try {
    dispose = registrar(POCKET_RPC_CHANNEL, handler, { authority: 'loopback' });
  } catch (err) {
    log.error?.('dsh-pocket: RPC channel registration failed — settings tab disabled | RPC 通道注册失败，设置页不可用: %s', err?.message ?? err);
    return () => {};
  }
  return typeof dispose === 'function' ? dispose : () => {};
}
