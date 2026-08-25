# dsh-pocket NAS 端部署（frps + caddy）

把电脑上 dsh-pocket 代理（默认 3081）通过 **frp 反向隧道**发布到你家 NAS，
手机访问 `https://dsh.你的域名.com` 即达电脑上的 dsh——**URL 固定、国内直连最快、
不依赖任何第三方**（cloudflared 隧道连的是 Cloudflare 边缘，URL 每次重启变化；
frp 连的是你自己的 NAS，域名就是你的）。

## 架构

```
手机 ──https://dsh.你的域名.com──▶ NAS caddy:443（自动 HTTPS）
                                      │
                          NAS 127.0.0.1:7001（frps 转发端口，只听本机）
                                      ▲
                      frp 隧道（电脑上 dsh-pocket 自动下载并托管 frpc）
                                      ▼
                  电脑 127.0.0.1:3081（dsh-pocket 代理，8 位密码）──▶ dsh web
```

## 部署步骤

1. **上传文件**：把本目录三个文件（`docker-compose.yml`、`frps.toml`、`Caddyfile`）
   放到 NAS 的一个目录（如 `docker/dsh-pocket`）。

2. **生成连接令牌**（在电脑终端执行）：
   ```bash
   openssl rand -hex 16
   ```
   把输出填进 `frps.toml` 的 `auth.token`。

3. **改域名**：编辑 `Caddyfile`，把 `dsh.你的域名.com` 换成你的域名，
   并在 DNS 处把该域名解析到 NAS 公网 IP（A 记录）。

4. **启动容器**：
   - 群晖：Container Manager → 项目 → 新建 → 选择该目录 → 下一步启动
   - 威联通：Container Station → 创建 → docker-compose → 粘贴 `docker-compose.yml`
   - 任意 Linux：`docker compose up -d`

5. **防火墙放行**：443/80（caddy HTTPS）与 7000（frps 控制端口）。
   **SSH 不需要开放**。转发端口 7001 因 `proxyBindAddr = "127.0.0.1"` 只监听
   NAS 本机，公网无法直连——只能经 caddy 的 HTTPS 入口。

6. **电脑端开启隧道**：dsh-pocket 设置页 → 「NAS 反向隧道」→ 填 NAS 地址
   （域名或 IP，端口 7000）+ 连接令牌（与 `frps.toml` 一致）→ 保存 → 开启隧道。
   首次会自动下载 frpc（约 10MB，加速镜像），状态变「已连接」即通。

7. **手机访问**：打开 `https://dsh.你的域名.com` → 输入电脑设置页
   「局域网访问密码」（8 位数字）→ 看到的就是电脑上的 dsh，实时同步。

## 安全说明（三层纵深）

| 层 | 保护 |
|---|---|
| caddy | HTTPS（Let's Encrypt 自动证书），可选再加 `basic_auth` |
| frps | token 认证 + `proxyBindAddr=127.0.0.1`（转发端口不暴露公网）+ `allowPorts` 限范围 |
| dsh-pocket | 8 位访问密码 + loopback 信任栅栏（不改 dsh 任何配置） |

连接令牌存电脑本地 `$DSH_HOME/dsh-pocket/frp-token`（0600），设置页 RPC 不回传明文。

## 验证

```bash
# NAS 上：隧道通了应返回 dsh 页面 HTML（与电脑 3081 内容一致）
curl http://127.0.0.1:7001
# 手机：打开 https://dsh.你的域名.com → 输局域网密码 → 看到 dsh 界面
# 实时性：电脑上跑任务，手机看输出滚动
```

## 排障

| 现象 | 处理 |
|---|---|
| 电脑设置页状态「连接失败：login to server error」 | 检查 NAS 地址/端口是否可达（`telnet NAS_IP 7000`）、token 是否与 frps.toml 一致 |
| 手机打开报 502/超时 | 看 NAS 上 `docker logs frps` / `docker logs caddy`；确认 443/7000 防火墙放行 |
| frpc 下载失败 | 多镜像自动回退；也可手动 `brew install frpc`（插件优先用 PATH 里的） |
| dsh web 重启后隧道没自动恢复 | 插件会自动恢复（`tunnel-auto-frp.json` 标记）；等几秒再刷新设置页 |
| 提示版本不匹配 | frps 镜像 tag 必须与插件内置 frpc 版本一致（当前 snowdreamtech/frps:0.71.0-alpine），两端同步升级 |

## 可选：群晖/威联通用系统自带反向代理（免 caddy）

如果不想跑 caddy 容器：群晖「控制面板 → 登录门户 → 高级 → 反向代理」新增一条
「来源 `https://dsh.你的域名.com` → 目标 `http://127.0.0.1:7001`」，证书用群晖
自带的 Let's Encrypt；效果与 caddy 相同，NAS 端只需 frps 一个容器。
