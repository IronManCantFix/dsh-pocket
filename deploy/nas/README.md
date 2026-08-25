# dsh-pocket NAS 端部署

把电脑上 dsh-pocket 代理（默认 3081）通过 **frp 反向隧道**发布到你家 NAS，
手机访问 `https://dsh.你的域名.com` 即达电脑上的 dsh——**URL 固定、国内直连最快、
不依赖任何第三方**（cloudflared 隧道连的是 Cloudflare 边缘，URL 每次重启变化；
frp 连的是你自己的 NAS，域名就是你的）。

## 架构

```
手机 ──https://dsh.你的域名.com──▶ NAS 反向代理（系统自带 或 caddy）
                                      │
                          NAS 127.0.0.1:7001（frps 转发端口，只听本机）
                                      ▲
                      frp 隧道（电脑上 dsh-pocket 自动下载并托管 frpc）
                                      ▼
                  电脑 127.0.0.1:3081（dsh-pocket 代理，8 位密码）──▶ dsh web
```

## 选哪套部署？先看你的 NAS

| NAS 类型 | 推荐 | 原因 |
|---|---|---|
| **群晖 / 威联通**（系统自带反向代理） | **仅 frps + 系统自带反代**（`docker-compose.frps-only.yml`） | 系统 Web 界面默认占用 80/443，caddy 用 host 网络会报 `address already in use`；系统自带反代同样支持 HTTPS + Let's Encrypt，还省一个容器 |
| 纯 Linux / 无自带反代能力 | frps + caddy（`docker-compose.yml`） | 80/443 空闲，caddy 一行配置自动 HTTPS |

---

## 路线 A：群晖 / 威联通（推荐）

### 1. 上传文件

把本目录的 `docker-compose.frps-only.yml` 和 `frps.toml` 放到 NAS 一个目录
（如 `docker/dsh-pocket`）。

### 2. 生成连接令牌（电脑终端执行）

```bash
openssl rand -hex 16
```

把输出填进 `frps.toml` 的 `auth.token`（**与电脑设置页填的令牌必须一致**）。

### 3. 启动 frps

- 群晖：Container Manager → 项目 → 新建 → 选择该目录 → 下一步 → 启动
- 威联通：Container Station → 创建 → docker-compose → 粘贴 `docker-compose.frps-only.yml`
- 任意 Linux：`docker compose -f docker-compose.frps-only.yml up -d`

确认容器 Running：`docker ps | grep frps`

### 4. 配系统自带反向代理（以群晖 DSM 7 为例）

控制面板 → **登录门户** → **高级** → **反向代理** → **新增**：

```
来源：
  协议    HTTPS
  主机名  dsh.你的域名.com
  端口    443
目的地：
  协议    HTTP
  主机名  localhost
  端口    7001
```

> 威联通：控制台 → 应用服务 → 反向代理（或 myQNAPcloud 里配），同样「来源 https 域名 → 目标 http://localhost:7001」。

### 5. 申请证书

控制面板 → **安全性** → **证书** → **新增** → **从 Let's Encrypt 获取**，
域名填 `dsh.你的域名.com`。申请成功后，反向代理按主机名自动匹配该证书。

> 前提：`dsh.你的域名.com` 的 A 记录已解析到 NAS 公网 IP，且 NAS 防火墙放行了 80/443。

### 6. 防火墙

放行 **443/80**（NAS 系统）与 **7000**（frps 控制端口，电脑 frpc 连入）。
**SSH 不需要开放**。转发端口 7001 因 `proxyBindAddr = "127.0.0.1"` 只监听 NAS
本机，公网无法直连——只能经反向代理的 HTTPS 入口。

---

## 路线 B：纯 Linux NAS（frps + caddy）

用 `docker-compose.yml`（frps + caddy 两个容器）：

1. 生成 token 填进 `frps.toml`
2. 编辑 `Caddyfile`：`dsh.你的域名.com` 换成你的域名（A 记录指向 NAS 公网 IP）
3. `docker compose up -d`
4. 防火墙放行 443/80 与 7000

caddy 自动申请/续期 Let's Encrypt 证书，无需手动管理。

---

## 电脑端开启隧道（两种路线相同）

1. dsh 设置 → 「手机访问」→「NAS 反向隧道」卡片
2. 填 **NAS 地址**（域名或 IP）、**服务端口 7000**、**转发端口 7001**、
   **连接令牌**（与 frps.toml 一致）
3. 保存 → 开启隧道 → 首次自动下载 frpc → 状态变「✅ 已连接」

## 手机访问

打开 `https://dsh.你的域名.com` → 输入电脑设置页「局域网访问密码」（8 位数字）
→ 看到的就是电脑上的 dsh，实时同步。

## 安全说明（三层纵深）

| 层 | 保护 |
|---|---|
| 反向代理 / caddy | HTTPS（Let's Encrypt 自动证书），可选再加 `basic_auth` |
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
| caddy 报 `bind: address already in use`（80/443） | 端口被 NAS 系统占用：改用路线 A（系统自带反代），或给 caddy 换端口 |
| 电脑设置页状态「连接失败：login to server error」 | 检查 NAS 地址/端口是否可达（`telnet NAS_IP 7000`）、token 是否与 frps.toml 一致 |
| 手机打开报 502/超时 | NAS 上 `docker logs frps`；确认 443/7000 防火墙放行、反向代理目的地端口是 7001 |
| frpc 下载失败 | 多镜像自动回退；也可手动 `brew install frpc`（插件优先用 PATH 里的） |
| dsh web 重启后隧道没自动恢复 | 插件会自动恢复（`tunnel-auto-frp.json` 标记）；等几秒再刷新设置页 |
| 提示版本不匹配 | frps 镜像 tag 必须与插件内置 frpc 版本一致（当前 snowdreamtech/frps:0.71.0-alpine），两端同步升级 |
