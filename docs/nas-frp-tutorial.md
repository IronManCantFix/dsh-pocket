# dsh-pocket NAS 反向隧道（frp）使用教程

> 目标：把电脑上 dsh-pocket 代理（3081）通过 frp 反向发布到自家 NAS，
> 手机访问 `https://dsh.你的域名.com` 即达电脑上的 dsh——**URL 固定、国内直连最快、
> 不依赖第三方**（对比：cloudflared 公网隧道 URL 每次重启变化，且依赖 Cloudflare 边缘）。

```
手机 ──https://dsh.你的域名.com──▶ NAS caddy:443（自动 HTTPS）
                                      │
                          NAS 127.0.0.1:7001（frps 转发端口，只听本机）
                                      ▲
                      frp 隧道（电脑上 dsh-pocket 自动下载并托管 frpc）
                                      ▼
                  电脑 127.0.0.1:3081（dsh-pocket 代理，8 位密码）──▶ dsh web
```

---

## 一、插件安装（在 Mac 电脑上）

### 1.1 前提

- Node.js ≥ 22（dsh 要求）
- 已安装 dsh：`npm install -g @deepseek-ai/dsh`，验证 `dsh --version`
- dsh web 能正常跑起来（`npx @deepseek-ai/dsh web`）

### 1.2 构建改造版插件

本教程使用的「NAS 反向隧道」功能在 `feat/frp-tunnel` 分支上（尚未发布到 npm），
需要从源码构建：

```bash
# 1) 拉代码并切换分支
git clone https://github.com/shaobeichen/dsh-pocket.git
cd dsh-pocket
git checkout feat/frp-tunnel

# 2) 安装依赖
npm install

# 3) 打包前端（改过 client/ 目录后必须重新打包，产物是 client/client.js）
node client/build.mjs

# 4) 可选：跑全部测试（81 个，应全绿）
npm test

# 5) 打 npm 包（生成 dsh-pocket-1.13.4.tgz，版本号以实际输出为准）
npm pack
```

### 1.3 安装到 dsh

```bash
# 安装本地构建包（-w = --workspace-root，pnpm 9 必需）
dsh plugin --profile web add "$PWD/dsh-pocket-1.13.4.tgz" -w
```

> 如果 CLI 不识别本地 tgz，两种备选：
> 1. 用绝对路径再试：`dsh plugin --profile web add /Users/你/.../dsh-pocket-1.13.4.tgz -w`
> 2. 把 `dsh-pocket-1.13.4.tgz` 临时发布到 npm（或私有 registry），再按包名安装：
>    `dsh plugin --profile web add dsh-pocket -w`

### 1.4 重启并验证

```bash
npx @deepseek-ai/dsh web   # 必须重启：运行中的进程仍加载旧代码
```

打开设置 → 左侧边栏「**手机访问**」→ 应看到新增的「**🏠 NAS 反向隧道（frp）**」卡片。

### 1.5 改了代码后如何重新安装

```bash
# 重新构建 + 打包 + 重装（旧包先移除再装新的）
cd dsh-pocket
node client/build.mjs
npm pack
dsh plugin --profile web remove dsh-pocket -w
dsh plugin --profile web add "$PWD/dsh-pocket-1.13.4.tgz" -w
npx @deepseek-ai/dsh web
```

---

## 二、NAS 部署（frps + caddy）

### 2.1 准备文件

把仓库 `deploy/nas/` 目录下的三个文件放到 NAS 的一个目录（如 `docker/dsh-pocket`）：

```
deploy/nas/
├── docker-compose.yml   # frps + caddy 两个容器
├── frps.toml            # frp 服务端配置
└── Caddyfile            # 域名 + 自动 HTTPS
```

### 2.2 修改配置

**a) 生成连接令牌**（在电脑终端执行）：

```bash
openssl rand -hex 16
```

把输出填进 `frps.toml` 的 `auth.token`（**与电脑设置页填的令牌必须一致**）。

**b) 改域名**：编辑 `Caddyfile`，把 `dsh.你的域名.com` 换成你的域名，并在 DNS 处把
该域名解析到 NAS 公网 IP（A 记录）。

### 2.3 启动容器

- **群晖**：Container Manager → 项目 → 新建 → 选择该目录 → 下一步 → 启动
- **威联通**：Container Station → 创建 → docker-compose → 粘贴 `docker-compose.yml`
- **任意 Linux**：`docker compose up -d`

### 2.4 防火墙放行

NAS 防火墙放行三个端口：

| 端口 | 用途 |
|---|---|
| 443 / 80 | caddy HTTPS（手机访问入口） |
| 7000 | frps 控制端口（电脑 frpc 连入） |

**SSH 不需要开放**。转发端口 7001 因 `proxyBindAddr = "127.0.0.1"` 只监听 NAS 本机，
公网无法直连——只能经 caddy 的 HTTPS 入口。

### 2.5 验证 NAS 端

```bash
# 在 NAS 上执行（SSH 到 NAS 或 NAS 终端）：
# 隧道未开时该命令会连接拒绝，属正常；先确认 frps 容器在跑：
docker ps | grep frps
```

NAS 端验证要等电脑端开启隧道后做（见第三节第 4 步）。

---

## 三、电脑端开启隧道

1. 打开 dsh 设置 → 「手机访问」→「**NAS 反向隧道（frp）**」卡片
2. 填写：
   - **NAS 地址**：你的 NAS 域名或公网 IP（如 `nas.example.com`）
   - **服务端口**：`7000`（与 frps.toml 的 `bindPort` 一致）
   - **转发端口**：`7001`（与 frps.toml 的 `allowPorts` 范围内一致）
   - **连接令牌**：与 frps.toml 的 `auth.token` 一致（≥ 8 位）
3. 点「保存配置」→ 点「开启隧道」
   - 首次会自动下载 frpc（约 10MB，多镜像加速），状态依次显示
     `下载中 → 连接中 → ✅ 隧道就绪`
   - 若显示 ❌，点「查看日志」看具体原因（token 不一致 / 地址不通 / frps 未运行）
4. **NAS 上验证**（隧道就绪后）：

   ```bash
   curl http://127.0.0.1:7001
   # 应返回 dsh 页面 HTML（与电脑 127.0.0.1:3081 内容一致）
   ```

---

## 四、手机访问

1. 手机打开 `https://dsh.你的域名.com`（HTTPS 证书由 caddy 自动申请）
2. 输入电脑设置页「**局域网访问密码**」（8 位数字，局域网区块显示的那个）
3. 看到的界面与电脑完全一致，实时同步（可双向操作）

> 密码说明：手机访问的 Host 是 NAS 域名（非 trycloudflare），dsh-pocket 会按
> **局域网密码**验证——所以输的是局域网区块的密码，不是公网密码。
> **局域网密码请保持开启**，它是这条链路的最后一道闸。

---

## 五、如何打包（速查）

```bash
npm install              # 首次
node client/build.mjs    # 改 client/ 后重打包前端（必须，否则设置页不更新）
npm test                 # 跑测试（81 个）
npm pack                 # 产出 dsh-pocket-<版本>.tgz，供安装/分发
```

打包产物 = `dsh-pocket-1.13.4.tgz`（一个文件，含 `bin/`、`lib/`、`client/`、
`deploy/` 不需要随包分发，但 `package.json` 的 `files` 白名单决定了打包内容）。

---

## 六、常见问题

| 现象 | 处理 |
|---|---|
| 设置页没有「NAS 反向隧道」卡片 | 插件未更新/未重启：重新 `npm pack` + 重装 + 重启 dsh web |
| 状态「连接失败：login to server error」 | NAS 地址/端口是否可达（`telnet NAS_IP 7000`）；token 与 frps.toml 是否一致 |
| 手机打开 502 / 超时 | NAS 上 `docker logs frps` / `docker logs caddy`；确认 443/7000 防火墙放行 |
| frpc 下载失败 | 多镜像自动回退；或手动 `brew install frpc`（插件优先用 PATH 里的） |
| dsh web 重启后隧道没恢复 | 插件会自动恢复（`tunnel-auto-frp.json` 标记）；等几秒刷新设置页 |
| 提示版本不匹配 | frps 镜像 tag 必须与插件内置 frpc 版本一致（当前 0.71.0），两端同步升级 |
| 手机页面"假活"（看起来开着、不刷新） | 公网长连接被运营商 NAT 静默掐断：刷新页面即可，数据在服务端不丢 |

---

## 七、安全清单

1. **局域网密码保持开启**——最后一层闸门，手机输入的就是它
2. frps token 用 `openssl rand -hex 16` 的强随机值，别用默认/弱口令
3. NAS 防火墙只放行 443/80/7000，**SSH 保持关闭**（frps 端口无 shell、无登录面，
   攻击面远小于 SSH）
4. 连接令牌存电脑本地 `$DSH_HOME/dsh-pocket/frp-token`（0600 权限），设置页
   RPC 不回传明文
5. 想更保险：Caddyfile 加 `basic_auth` 双认证，或勾选设置页「传输加密（TLS）」
   （需 frps.toml 同步开 `transport.tls.force = true`）
