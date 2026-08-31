# 📱 给 DeepSeek Harness 加个「NAS 穿透」：手机打开 NAS App 就能用电脑上的 DSH

> 我 fork 了开源的 dsh-pocket 插件，给它加上了 **frp NAS 反向隧道**——现在电脑上的 DeepSeek Harness 可以挂到自家 NAS 上，出门在外，手机打开你的人 NAS App（群晖 / 威联通等）就能访问电脑上的 DSH，实时同步、可双向操作。

## 链路就是这么简单

```
手机（NAS App / 门户入口）
   │  https://dsh.你的域名.com
   ▼
NAS：反代工具（群晖/威联通自带或 lucky，自动 HTTPS）→ 127.0.0.1:7001
   ▲
frp 隧道（电脑端插件自动下载并托管 frpc）
   ▼
电脑：dsh-pocket-nas → dsh web
```

一句话：**DSH 变成你 NAS 生态里的一个入口**，用你平时访问 NAS 的方式就能进电脑上的 agent。

## 为什么选自家 NAS 而不是公共隧道

- **入口固定**：URL 就是你的 NAS 域名，不像 cloudflared 每次重启换个新链接
- **国内直连最快**：走自己的 NAS，不绕第三方边缘节点，不依赖外部服务
- **NAS 端极轻**：只需跑一个 frps 容器（docker-compose 一键起），HTTPS 反代用 NAS 现成的，加一条规则即可
- **电脑端省心**：插件自动下载托管 frpc，填 NAS 地址 / 端口 / 令牌，点「开启隧道」就通，重启自动恢复
- **安全**：8 位访问密码 + frp token 认证，转发端口只听 NAS 本机、SSH 不用开

局域网扫码和 cloudflared 公网隧道也都在，三条路按场景随便选。

## 装一下试试

```sh
dsh plugin --profile web add github:IronManCantFix/dsh-pocket#v1.15.3 -w
npx @deepseek-ai/dsh web
```

重启后侧边栏「📱 手机访问」→「🏠 NAS 反向隧道（frp）」填 4 项配置，NAS 上跑容器加反代就通了（教程见下）。

- 项目：[IronManCantFix/dsh-pocket](https://github.com/IronManCantFix/dsh-pocket)（fork 自开源 [shaobeichen/dsh-pocket](https://github.com/shaobeichen/dsh-pocket)）
- 完整 NAS 教程：[docs/nas-frp-tutorial.md](https://github.com/IronManCantFix/dsh-pocket/blob/main/docs/nas-frp-tutorial.md)
- npm：[dsh-pocket-nas](https://www.npmjs.com/package/dsh-pocket-nas)

有问题欢迎 [Issues](https://github.com/IronManCantFix/dsh-pocket/issues) 反馈，觉得好用来个 ⭐ 👋