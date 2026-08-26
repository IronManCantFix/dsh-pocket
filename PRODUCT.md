# Product

## Register

product

## Users

DSH（DeepSeek Harness）用户在电脑前运行 agent 任务，通过手机在**局域网或公网**远程查看和操作同一个 DSH 界面。使用场景：通勤路上看任务进度、出门在外发指令、随手审批。单手竖持手机，网络可能是 WiFi 或 4G/5G。

## Product Purpose

dsh-pocket-nas 让手机扫码即可访问电脑上的 DSH 界面（局域网直连 / cloudflared 公网隧道 / frp NAS 反向隧道）。移动端适配（移植自 dsh-web-mobile）把 DSH 的桌面 UI 在手机上变得可用：侧栏变抽屉、会话全宽、触控优化、安全区适配。成功标准：手机上的 DSH 与电脑完全同步、可双向操作、单手可完成主要任务。

## Brand Personality

跟随 DSH 官方设计系统（`--dsw-alias-*` 设计变量）。克制、功能优先、工具感。移动端是桌面 UI 的**适配**而非重构：不引入独立视觉风格，让用户感觉"同一个 DSH，只是换了个屏幕"。

## Anti-references

- 不做消费级 App 的炫酷风格（渐变、玻璃拟态、装饰性动效）
- 不改变 DSH 桌面端的信息架构（会话列表/消息流/composer 的层级关系保持一致）
- 不用移动端特有模式替换桌面端能力（只做渐进披露，不隐藏核心功能）
- 不依赖哈希类名做关键布局（dsh 升级即碎，历史上已有 dark-theme 回归教训）

## Design Principles

1. **功能优先**：布局为"查看/操作 agent 会话"服务，信息密度与可读性优先于装饰
2. **跟随官方系统**：颜色、圆角、字体全部走 DSH 设计变量，移动端只改布局与交互
3. **单手可及**：高频控件（抽屉开关、composer、返回）落在拇指区，触控目标 ≥40-44px
4. **不丢能力**：手机上的 DSH 与电脑等价，仅按屏宽渐进披露
5. **稳定钩子优先**：用 `data-*`/语义化选择器，少依赖哈希类名，降低 dsh 升级破碎风险

## Accessibility & Inclusion

- 对比度、字体、颜色全部继承 DSH 官方 token（跟随官方 WCAG 基线）
- `prefers-reduced-motion` 已有动画降级（设置页 sheet 入场）
- 触控目标以 ≥44px 为目标；视口按手机实际宽度适配（≥320px）
- 深色模式跟随官方 `data-ds-dark-theme` 切换（已实现，需回归测试）
