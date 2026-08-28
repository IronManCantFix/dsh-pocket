<p align="center">
  <img src="docs/banner.jpg" alt="DSH Pocket" width="100%">
</p>

<h1 align="center">DSH Pocket</h1>

<p align="center"><a href="README.en.md">English</a> | <a href="README.md">中文</a></p>

<p align="center">
  <a href="https://www.npmjs.com/package/dsh-pocket-nas"><img alt="npm" src="https://img.shields.io/npm/v/dsh-pocket-nas?color=4d6bfe&label=npm"></a>
  <a href="https://www.npmjs.com/package/dsh-pocket-nas"><img alt="downloads" src="https://img.shields.io/npm/dm/dsh-pocket-nas?color=4d6bfe"></a>
  <a href="https://github.com/IronManCantFix/dsh-pocket/actions"><img alt="CI" src="https://github.com/IronManCantFix/dsh-pocket/actions/workflows/npm-publish.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-GPL--2.0-red.svg"></a>
  <a href="https://github.com/IronManCantFix/dsh-pocket/stargazers"><img alt="GitHub stars" src="https://img.shields.io/github/stars/IronManCantFix/dsh-pocket"></a>
  <a href="https://awesome-dsh-plugin.com/zh/"><img alt="Awesome DSH Plugin" src="https://awesome-dsh-plugin.com/badge.svg"></a>
</p>

> **⚠️ 这是一个 fork 项目，不是独立项目**：本仓库 fork 自 [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket)（上游 v1.13.4），
> 保留了上游全部功能，并围绕一个核心目标迭代——**解决「NAS 访问电脑上 DSH」的方式**：
> 把电脑上的 DeepSeek Harness 通过 **frp 反向隧道**发布到自家 NAS，手机访问 NAS 的固定域名
> （如 `https://dsh.你的域名.com`）即达电脑——**URL 固定、国内直连最快、全程自建、不依赖 Cloudflare 等第三方**。
> 其余迭代（侧边栏入口重构、移动端布局优化、NAS 一键部署等）见下方 [🔄 本 Fork 的迭代](#-本-fork-的迭代相对上游-v1134)。

> 一句话：**通过你家 NAS，把电脑上的 DeepSeek Harness 装进口袋**——一个包、一个配置页，手机扫二维码就实时看到电脑上的同一个界面，人在外面也能用。

<p align="center">
  ⭐ 顺手留颗 Star，作者能高兴一整天 &nbsp;·&nbsp; <a href="https://github.com/IronManCantFix/dsh-pocket">行，给你一颗 Star</a>
</p>

## 这是什么

**本仓库是一个 fork 项目，核心场景是「NAS 访问电脑上的 DSH」。**

电脑上跑着 DeepSeek Harness（DSH），你不在电脑前也想用它。常见方案各有各的坑：

- 没有公网 IP、不想折腾路由器端口转发
- 用 Cloudflare 等第三方隧道：URL 每次重启都变、国内访问慢、依赖外部边缘节点
- 远程桌面 / SSH：手机操作体验差，还得开放危险端口

**NAS 是你家里/办公室 24 小时在线的设备**——本 fork 的思路：让它成为 DSH 的固定入口。

```
手机 ──https://dsh.你的域名.com──▶ NAS 反代（lucky/群晖自带等，自动 HTTPS）
                                      │
                          NAS 127.0.0.1:7001（frps 转发端口，只听本机）
                                      ▲
                      frp 隧道（电脑上 dsh-pocket-nas 自动下载并托管 frpc）
                                      ▼
                  电脑 127.0.0.1:3081（dsh-pocket-nas 代理，8 位密码）──▶ DSH
```

- 下班路上，agent 在电脑上跑任务，掏出手机打开 NAS 域名就能看它干到哪了、结果如何
- 出门在外，想让电脑上的 agent 查点资料、写段代码——不依赖公网 IP，也不用 Cloudflare
- 电脑在宿舍/办公室，人在外面，随时"操控你的 DeepSeek Harness"——发任务、看输出、点审批

装上它，手机访问 NAS 的固定域名（或同一 WiFi 扫二维码），就能实时看到并操控电脑上的 DeepSeek Harness 界面——人在外面也能用。

实际效果——手机上的界面就是电脑上的界面，实时同步：

<p align="center">
  <img src="docs/interface.jpg" alt="手机上的 DSH 界面" width="100%">
</p>

## 🔄 本 Fork 的迭代（相对上游 v1.13.4）

在保留上游全部功能的基础上，本 fork 围绕「NAS 访问电脑 DSH」这一核心目标迭代了以下内容
（**NAS 反向隧道是本 fork 的核心迭代**）：

| 迭代 | 说明 |
|---|---|
| 🏠 **NAS 反向隧道（frp）**（核心） | 新增 frp 隧道后端（`lib/frp-tunnel.mjs`）：插件**自动下载/托管 frpc**，把 dsh 反向发布到**自家 NAS**——固定域名、国内直连最快、不依赖 Cloudflare 边缘。NAS 端只需跑 frps 一个容器，HTTPS 入口用你现有的反代工具（lucky / 群晖自带反代等）。部署见 `deploy/nas/`，完整教程见 [docs/nas-frp-tutorial.md](docs/nas-frp-tutorial.md) |
| 🧭 **侧边栏入口重构** | 「手机访问」入口从设置面板（原第二个 tab）移到**桌面端侧边栏、设置按钮正上方**；点击直接弹出完整配置页（自包含对话框，不依赖 dsh 设置面板内部状态） |
| 📱 **移动端布局优化** | FAB 移到右下拇指区、触控目标扩至 44px、底部 home indicator 安全区、代码块横向滚动、横屏/320px 小屏适配（`client/mobile/mobile.css.ts`） |
| 📦 **NAS 一键部署** | `deploy/nas/`：仅 frps 容器的 docker-compose + frps.toml（安全项：转发端口只听本机 `proxyBindAddr=127.0.0.1`）+ 反代配置说明（WebSocket 必开） |
| 📖 **文档** | `docs/nas-frp-tutorial.md` 使用教程（安装/打包/NAS 部署/排障）、`PRODUCT.md` 设计上下文 |
| 🧪 **测试扩充** | 43 → 81：新增 frp 配置校验 / frpc.toml 渲染 / 隧道状态机 / settings 持久化 / service 集成 / 版本一致性 |

> **与上游的关系**：`upstream` 指向原仓库 `shaobeichen/dsh-pocket`，可随时同步上游更新：
> `git fetch upstream && git merge upstream/main`

## ✨ 特性

| 特性 | 说明 |
|---|---|
| 🏠 **NAS 反向隧道（frp）** | 本 fork 的核心特性：把 dsh 反向发布到自家 NAS（frp），手机访问 NAS 域名即达电脑——**URL 固定**、国内直连最快、不依赖第三方（NAS 端跑 frps + 反代容器，插件自动下载并托管 frpc） |
| 📶 局域网扫码 | 装好即用：侧边栏「手机访问」入口，打开就有局域网二维码，手机连同一 WiFi 扫码即开（自动识别本机局域网 IP，**WSL 环境自动取 Windows 物理网卡 IP**） |
| 🌐 公网扫码（人在外面） | 点「开启公网访问」→ cloudflared 隧道 → 出公网二维码，4G/任何网络都能访问（备选方案，NAS 隧道更推荐） |
| 🔐 访问密码 | 公网链接需输入 **8 位数字密码**（默认每次开启公网自动换新；**可自定义固定密码**——自定义后不再换新）；局域网有独立 **8 位数字密码**（默认开启，配置页可**一键关闭**——关闭后局域网扫码直连） |
| 🔑 自定义密码 | 公网/局域网密码都可在配置页**设成自己固定的 8 位数字**（自定义后公网不再自动换新） |
| 🧘 会话保持 | 手机输一次密码后**长期免输**（登录状态绑定电脑上的 dsh web 进程：只要它不重启，手机不用再输；**dsh web 重启/更新后需重新输入一次**） |
| ⚡ 实时同步 | 流式输出走 WebSocket 全透传——**电脑上在输出，手机上同步在滚**，可双向操作；内置心跳保活（防路由器 NAT/省电机制静默断链，断线自动重连） |
| 📱 移动端适配 | 窄屏自动变抽屉布局（移植 dsh-web-mobile，MIT）：侧栏抽屉、会话全宽、状态栏安全区、触控优化 |
| 📁 文件浏览 | 移动端「文件浏览」入口需要宿主提供 explorer 面板（dsh-web-ui 组件）；官方 DSH 未内置时入口自动隐藏，不会出现"点了没反应" |
| 🗜️ 传输压缩 | 大 JSON 响应自动 gzip/brotli（长会话 17MB → ~1MB，brotli 质量 6：快且省流量），手机加载更快、更省流量 |
| 🔁 隧道自动恢复 | DSH 重启后自动重新拉起之前开着的公网隧道，无需手动重开 |
| 🧩 零依赖安装 | 一个 npm 包、一个配置页，没有核心/适配器要分开装；无需账号、无需服务器 |

## 🚀 怎么用

**入口在哪**：安装完成并重启 `dsh web` 后，**桌面端侧边栏底部（设置按钮正上方）**会出现「📱 手机访问」入口，点击弹出完整配置页（局域网/公网/NAS 隧道/密码管理都在这一页）。

**前提**：电脑上已装好 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)。如果终端提示 `dsh: command not found`（找不到 dsh 命令），先安装：

```sh
npm install -g @deepseek-ai/dsh     # 全局安装；验证：dsh --version
# 不想全局装？每次命令前加 npx：npx @deepseek-ai/dsh <命令>
```

```sh
# 1. 装插件（一个包全都有；git 方式按 tag 拉取安装，pnpm 不会缓存旧包；最新版本号见 Releases 页）
dsh plugin --profile web add github:IronManCantFix/dsh-pocket#v1.15.4 -w

# 2. 重启 dsh web
npx @deepseek-ai/dsh web
```

### 🏠 NAS 反向隧道（本 fork 的核心场景）

三步走，把电脑上的 DSH 发布到自家 NAS，手机访问 NAS 的固定域名即达电脑：

1. **NAS 端**（一次性）：把 `deploy/nas/` 里的 `docker-compose.yml` + `frps.toml` 放到 NAS（只需 frps 一个容器），生成连接令牌 `openssl rand -hex 16` 填入 `frps.toml`，`docker compose up -d` 启动；再用 NAS 现有的反代工具（lucky / 群晖自带等）加一条规则：**`https://dsh.你的域名.com` → `http://127.0.0.1:7001`**（⚠️ 务必开启 WebSocket 支持）
2. **电脑端**：配置页「🏠 NAS 反向隧道（frp）」→ 填 **NAS 地址**（域名或 IP）、**服务端口 7000**、**转发端口 7001**、**连接令牌**（与 frps.toml 一致）→ 保存 → 开启隧道（首次自动下载 frpc）→ 状态「✅ 已连接」
3. **手机访问**：打开 `https://dsh.你的域名.com` → 输入 8 位访问密码 → 看到的就是电脑上的 DSH，实时同步

> 完整教程（安装/打包/NAS 部署/排障）见 [docs/nas-frp-tutorial.md](docs/nas-frp-tutorial.md)；NAS 端一键部署见 [deploy/nas/](deploy/nas/)。

### 局域网（同一 WiFi）

侧边栏「📱 手机访问」入口 → 手机扫「📶 局域网」二维码 → 打开链接**输入局域网密码**（显示在配置页局域网区块，点「刷新」可换新，或点「自定义」设成自己固定的 8 位数字）→ 打开的就是电脑上的 DSH，实时同步。

> 局域网密码**默认开启**（安全优先）。如果只有自己用、嫌每次输密码麻烦，可在配置页局域网区块把「局域网访问密码」切到**关**——之后局域网扫码直连、无需密码（仅同一局域网设备可访问；**公网始终要密码**，不受影响）。
>
> 手机登录一次后**长期免输**：只要电脑上的 dsh web 不重启，再次打开手机不用再输入（**dsh web 重启/更新后需重新输入一次**）。
>
> 高级选项：自动识别在 Tailscale/VPN 等场景下可能选不到可达地址。可在「局域网地址」下拉框手动选择已检测到的 IP；一般不需要修改。

### 公网（人在外面）

同一页点「**开启公网访问**」→ **每次都会先弹出安全免责声明**，勾选「我已知情」后才能开启（公司/涉密网络请先确认合规）→ 等隧道建立（首次会下载 cloudflared，macOS/Linux 走清华镜像秒下）→ 手机扫「🌐 公网」二维码 → 打开链接**输入 8 位访问密码**（密码显示在配置页公网区块，默认**每次开启公网变新**，也可点「自定义」设成固定密码——自定义后不再换新）→ 人在外面（4G/公司网）也能访问。

> 更新到新版本：把命令里 `#v1.15.4` 的版本号换成最新版（见 [Releases 页](https://github.com/IronManCantFix/dsh-pocket/releases)），重新执行上面的 `add` 命令即可——git 方式按 tag 拉取，pnpm 不会按 URL 缓存旧包；而 tgz 下载链接 / `releases/latest` 固定 URL 会被 pnpm 缓存成旧包，装完还是旧版（这就是配置页命令改用 git 安装的原因）。从旧名插件 `dsh-pocket` 升级，先 `dsh plugin --profile web remove dsh-pocket -w` 再 add。

## ⚠️ 安全（必读）

- **DSH 能执行你电脑上的代码**。**局域网**二维码/URL 配上独立 **8 位数字密码**才是钥匙（密码**默认开启**，可关——关闭后局域网扫码直连，仅同一网络设备可访问），**请勿把局域网二维码、URL 或密码发给别人**
- **开启公网访问前必须阅读并勾选免责声明**（每次开启都会弹框；服务端强制校验，无法绕过）：公网 = 把能执行代码的 DSH 暴露到互联网，请使用强密码、用完即关、涉密网络勿用
- **公网**有 **8 位数字密码**保护：链接随机分配、默认每次开启换新密码、旧链接立即作废——泄露了也进不来，改密码/重开即可作废；**自定义密码后不再自动换新**（你设的值即稳定密码）
- 手机登录状态与电脑上的 dsh web 进程绑定：**电脑 dsh web 一直开着就不用重复输入；重启/更新后需重新输入一次**
- **登录限速**（防暴力破解）：同一 IP 连续输错 **5 次**锁定 **60 秒**；全局失败超阈值时短暂全锁（防换 IP 分布式扫描）；输对密码后计数清零
- 公网 URL 由 cloudflared 随机分配，**每次重启会变化**（旧链接自动失效，相当于天然轮换）
- 局域网模式不暴露公网，只有同一网络内的设备能访问
- 适合个人自用；公网密码存本机 `$DSH_HOME/dsh-pocket/token`（默认每次开启公网自动换新，**自定义后不换**），局域网密码存 `$DSH_HOME/dsh-pocket/token-lan`（配置页手动刷新），开关/自定义标记存 `$DSH_HOME/dsh-pocket/settings.json`

## 💻 DSH Desktop（桌面版）

- 桌面版里 dsh-pocket-nas 的**扫码同屏**正常可用；**更新/重启由桌面版管理**（插件内这两项自动停用）
- ⚠️ 桌面端 **advanced 模式**暂不支持手机访问（该模式禁用网页布局、手机拿不到 layout 服务，会白屏）——请切回 **compatibility** 模式后重启；advanced 模式下手机打开会看到明确的提示层

## 🩹 常见问题（别踩的坑）

| 现象 | 原因与解决 |
|---|---|
| `dsh: command not found` / 提示 DSH 未定义 | dsh CLI 没装：`npm install -g @deepseek-ai/dsh`，或命令前加 `npx @deepseek-ai/dsh` |
| `ERR_PNPM_ADDING_TO_ROOT` | pnpm 9 对 workspace 根的限制：安装/更新命令**末尾加 `-w`**（`--workspace-root`） |
| 装完/更新了但界面没变化 | **必须重启 `dsh web`** 才生效；运行中的进程仍加载旧代码 |
| `listen EADDRINUSE ... :3081` | 旧 dsh-pocket-nas 进程还占着端口：macOS/Linux `lsof -ti :3081 \| xargs kill -9`；Windows `netstat -ano \| findstr :3081`（找 LISTENING 的 PID）→ `taskkill /PID <PID> /F`，后重试 |
| 版本停在 0.x 升不上去 | 用「安装/更新到最新版」的 git add 命令（见上文「更新到新版本」），`releases/latest` 固定 URL / tgz 下载链接会被 pnpm 缓存旧包 |
| 公网 `error 1033` | 见下方「公网隧道常见问题」——多半是本机代理/VPN（Clash 等 TUN 模式）掐断了隧道 |
| 点「重启 dsh web」后页面提示进程在后台运行 | 自重启的新进程是 detached 后台进程（不挂终端），是页内更新的标准做法；停止它：macOS/Linux `lsof -ti :3080 \| xargs kill -9`；Windows `netstat -ano \| findstr :3080` → `taskkill /PID <PID> /F`（日志在 `$DSH_HOME` 下 `dsh-pocket-restart-*.log`） |

## ⚠️ 公网隧道常见问题（必读）

**现象**：点「开启公网访问」后，手机上打开公网地址报 `error 1033`（Tunnel error）。

**最常见原因：本机开着代理/VPN（Clash、Surge、v2ray、sing-box 等，尤其 TUN 模式）**。
这类工具会接管全部流量，并常常把 cloudflared 的隧道边缘连接
（`*.argotunnel.com`、Cloudflare 边缘 IP）掐断，导致隧道注册成功但数据面连不上。

**解决（从轻到重，按顺序试）**：

1. 先**只关闭代理的 TUN 模式**，不用退出代理软件——多数情况这一步就够：
   - Clash：设置里关掉「**TUN 模式**」开关（或右键菜单栏图标 → 取消勾选 TUN 模式）
   - Surge：关「**增强模式**」；v2ray/sing-box：关「**虚拟网卡/路由接管**」
   - 然后回配置页重新点「开启公网访问」
2. 仍不行就**彻底退出代理软件**（不只是关界面：Clash 要右键菜单栏图标 → 退出；若装有
   后台服务还要在服务管理器里停掉，`ps aux | grep clash` 确认进程消失），再重试
3. 给代理加**直连规则**，放行隧道域名与 Cloudflare 边缘（Clash 规则示例）：
   ```yaml
   - DOMAIN-SUFFIX,argotunnel.com,DIRECT
   - DOMAIN-SUFFIX,trycloudflare.com,DIRECT
   - IP-CIDR,198.41.192.0/24,DIRECT,no-resolve
   ```
4. 网络实在不通时，改用**局域网模式**：手机开热点 → 电脑连手机热点 → 扫局域网码，
   效果完全一样（人在外面也能用）

**其他可能**：企业防火墙/校园网拦截出站；此时请让 IT 放行或改用热点。

**首次开启时「下载 cloudflared」失败/卡住**：
- **macOS/Linux**：优先走**清华镜像**（实测 ~3MB/s，几秒下完）；失败自动回退官方 GitHub + 加速源。
- **Windows**：无清华镜像（Homebrew 不支持 Windows），走官方直连下载（约 50MB，**单线程会慢，属正常**，耐心等几分钟；也可挂代理加速）。
- 全部失败时配置页会给出提示。备选方案（任选其一）：
1. 手动装好命令行 cloudflared 后重试（装好后 dsh-pocket-nas 直接用 PATH 里的，不再下载）：
   - macOS：`brew install cloudflared`；Linux：`sudo apt install cloudflared` 或官网下载
   - Windows：`winget install cloudflared` 或官网下载
   - 任何平台：`npm i -g cloudflared`
2. 挂代理（系统代理/Clash 等）后重新点「开启公网访问」
3. 手动下载二进制放到 `$DSH_HOME/dsh-pocket/bin/` 目录（`$DSH_HOME` 一般是 `~/.dsh`，Windows 是 `%USERPROFILE%\.dsh`；文件名用 `cloudflared`（Windows 加 `.exe`）或发布资产名均可，插件都认）

## 🗂 架构（单包）

| 文件 | 说明 |
|---|---|
| `lib/index.js` | 插件入口：自动起代理 + 注册 RPC + 访问密码管理（公网 8 位每次开启变新；局域网独立 8 位可手动刷新/开关）+ 桌面端环境适配 |
| `lib/settings.mjs` | 设置持久化：局域网密码开关（默认开启）存 `$DSH_HOME/dsh-pocket/settings.json` |
| `lib/service.mjs` | 服务：代理生命周期（端口自适应）、公网隧道（自动恢复）、状态快照（含二维码） |
| `lib/proxy.mjs` | 改头反向代理：Host/Origin → loopback，HTTP + WebSocket 透传 + polyfill 注入 + gzip/brotli 压缩 + 按 Host 区分的访问令牌认证（公网必验；局域网按开关） |
| `lib/tunnel.mjs` | cloudflared：多镜像源下载（清华优先）/自适应多线程/启动/解析公网 URL（HTTP/2） |
| `lib/frp-tunnel.mjs` | frp 反向隧道：自动下载/托管 frpc（多镜像）、渲染 frpc.toml、连接状态机——把代理反向发布到自家 NAS（固定域名、国内直连最快），NAS 端部署见 `deploy/nas/` |
| `lib/web-rpc.js` | loopback RPC：`status` / `tunnel.start` / `tunnel.stop` / `frp.*` / `version` / `update` / `restart` |
| `client/` | 侧边栏「手机访问」入口 + 配置页（含 NAS 反向隧道配置）+ 移动端适配（dsh-web-mobile 移植） |
| `bin/dsh-pocket-nas.mjs` | CLI：局域网/公网模式，打印 URL + 二维码 |
| `deploy/nas/` | NAS 端一键部署：仅 frps 容器 + 说明文档（HTTPS 入口用 NAS 现有反代工具，如 lucky/系统自带反代；完整使用教程见 [docs/nas-frp-tutorial.md](docs/nas-frp-tutorial.md)） |

## 🛠 开发

```sh
npm install
node client/build.mjs   # 改 client/ 后重新打包
npm test                # 代理 / 认证 / 压缩 / 隧道 / frp / 服务 / RPC（81 测试）
```

## 🤝 致谢

- 移动端适配移植自 [mexiaosqwq/dsh-web-mobile](https://github.com/mexiaosqwq/dsh-web-mobile)（MIT）
- 公网隧道基于 [cloudflared](https://github.com/cloudflare/cloudflared)

## 📄 License

[GPL-2.0](LICENSE) —— 自由软件许可：可自由使用、修改、分发，但**修改版必须同样以 GPL 开源**并保留版权声明；商用同样适用。

> 说明：移动端适配部分移植自 [dsh-web-mobile](https://github.com/mexiaosqwq/dsh-web-mobile)（MIT 许可，兼容 GPL），其版权声明保留在 `client/mobile/LICENSE.dsh-web-mobile`。

---

**有问题？欢迎反馈**：遇到 Bug、有想法、想提需求，请到 [GitHub Issues](https://github.com/shaobeichen/dsh-pocket/issues) 告诉我们 🙏
