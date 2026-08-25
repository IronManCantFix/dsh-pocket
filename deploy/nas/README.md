# dsh-pocket NAS 端部署（仅 frps）

把电脑上 dsh-pocket 代理（默认 3081）通过 **frp 反向隧道**发布到你家 NAS，
手机访问 `https://dsh.你的域名.com` 即达电脑上的 dsh——**URL 固定、国内直连最快、
不依赖任何第三方**（cloudflared 隧道连的是 Cloudflare 边缘，URL 每次重启变化；
frp 连的是你自己的 NAS，域名就是你的）。

## 架构

```
手机 ──https://dsh.你的域名.com──▶ NAS 反代工具（lucky / 系统自带 / nginx…）
                                      │
                          NAS 127.0.0.1:7001（frps 转发端口，只听本机）
                                      ▲
                      frp 隧道（电脑上 dsh-pocket 自动下载并托管 frpc）
                                      ▼
                  电脑 127.0.0.1:3081（dsh-pocket 代理，8 位密码）──▶ dsh web
```

**NAS 上只需要跑 frps 一个容器。** HTTPS 域名入口（反向代理）由你 NAS 上现有的
工具承担——lucky、群晖/威联通系统自带反代、nginx、traefik、caddy 任选其一，
它们只做「域名 → 127.0.0.1:7001」这一件事。

## 部署步骤

### 1. 上传文件

把本目录的 `docker-compose.yml` 和 `frps.toml` 放到 NAS 一个目录（如 `docker/dsh-pocket`）。

### 2. 生成连接令牌（电脑终端执行）

```bash
openssl rand -hex 16
```

把输出填进 `frps.toml` 的 `auth.token`（**与电脑设置页填的令牌必须一致**）。

### 3. 启动 frps

```bash
docker compose up -d
```
（群晖：Container Manager → 项目 → 新建 → 选择该目录 → 下一步 → 启动；
威联通：Container Station → 创建 → docker-compose → 粘贴本文件）

确认容器 Running：`docker ps | grep frps`

### 4. 配反代入口（任选其一）

新增一条规则：**前端 `https://dsh.你的域名.com` → 后端 `http://127.0.0.1:7001`**

- **lucky**（推荐）：Web 服务/反代 → 新增 → 前端 HTTPS 域名 `dsh.你的域名.com` → 后端
  `127.0.0.1:7001`；证书在 lucky 证书管理里申请 Let's Encrypt（80 被占时选 **DNS 验证**）
- **群晖**：控制面板 → 登录门户 → 高级 → 反向代理 → 新增（来源 HTTPS `dsh.你的域名.com`
  :443 → 目的地 HTTP localhost:7001）；证书在「安全性 → 证书 → 从 Let's Encrypt 获取」
- **威联通**：控制台 → 应用服务 → 反向代理，同样「来源 https 域名 → 目标 http://localhost:7001」

⚠️ **务必开启该规则的 WebSocket 支持**（lucky 反代配置里有 WebSocket 开关）——
dsh 的流式输出走 WebSocket，不开则手机界面不实时、会话打不开。
Host 头无需特殊处理（dsh-pocket 按「非 trycloudflare → 局域网密码」验证）。

### 5. 防火墙放行

| 端口 | 用途 |
|---|---|
| 443 / 80 | 反代工具 HTTPS（手机访问入口） |
| 7000 | frps 控制端口（电脑 frpc 连入） |

**SSH 不需要开放**。转发端口 7001 因 `proxyBindAddr = "127.0.0.1"` 只监听 NAS
本机，公网无法直连——只能经反代的 HTTPS 入口。

### 6. 电脑端开启隧道

dsh 设置 → 「手机访问」→「NAS 反向隧道」→ 填 **NAS 地址**（域名或 IP）、
**服务端口 7000**、**转发端口 7001**、**连接令牌**（与 frps.toml 一致）→
保存 → 开启隧道（首次自动下载 frpc）→ 状态「✅ 已连接」。

### 7. 手机访问

打开 `https://dsh.你的域名.com` → 输入电脑设置页「局域网访问密码」（8 位数字）
→ 看到的就是电脑上的 dsh，实时同步。

## 安全说明（三层纵深）

| 层 | 保护 |
|---|---|
| 反代工具 | HTTPS（Let's Encrypt 自动证书），可选再加 `basic_auth` |
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
| 手机打开报 502/超时 | NAS 上 `docker logs frps`；确认 443/7000 防火墙放行、反代规则后端端口是 7001 |
| 手机界面不实时/会话打不开 | 反代规则没开 **WebSocket 支持**（lucky 反代配置里开启） |
| frpc 下载失败 | 多镜像自动回退；也可手动 `brew install frpc`（插件优先用 PATH 里的） |
| dsh web 重启后隧道没自动恢复 | 插件会自动恢复（`tunnel-auto-frp.json` 标记）；等几秒再刷新设置页 |
| 提示版本不匹配 | frps 镜像 tag 必须与插件内置 frpc 版本一致（当前 snowdreamtech/frps:0.71.0-alpine），两端同步升级 |
