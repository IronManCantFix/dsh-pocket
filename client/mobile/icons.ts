// 图标解析：兼容 DSH 的两套图标命名。
//
// 背景（真机实测，dsh 0.1.7-rc.2）：新版 primitives 不再导出 `*16` 后缀的名字，
// 改成了 `IconXxxOutline` + 尺寸变体（Regular/Medium/Artwork）。而 pocket 的移动端
// 三个组件是**直接 import** `IconPanelLeftOutline16` 这类旧名：
//
//   import { IconPanelLeftOutline16 } from '@deepseek-ai/dsh-client-ui-primitives'
//   → undefined → React error #130（"组件是 undefined"）→ slot 崩溃
//
// 而且三个组件分别挂在三个 slot 上（header actions / shell overlay / sidebar footer），
// 一起崩掉就等于**整个移动端布局从未挂载**：没有抽屉、没有浮动按钮、没有移动端 CSS 标记，
// 用户看到的仍是桌面布局 —— 表现为「左侧一直有一条挡着对话」。
//
// 设置页之所以没崩，是因为 client/index.jsx 里对 IconRefreshOutline16 已经写了
// `typeof ... === 'function'` 守卫（见该文件 refresh 按钮处）。这里把同样的防御
// 做成统一模块，供移动端三个组件复用。
//
// 设计取舍：**永不抛错**。两个名字都拿不到时返回 undefined，由调用方回退到文本字形。

import * as primitives from '@deepseek-ai/dsh-client-ui-primitives'

/**
 * 按顺序取第一个是函数的候选。
 *
 * 用 `import * as` 命名空间而不是具名 import：具名 import 一个不存在的导出时，
 * 打包器可能产出 undefined（本次故障）也可能整个模块报错，取决于打包方式；
 * 命名空间访问在这两种情况下都不会抛。
 */
const pick = (...candidates) => candidates.find((c) => typeof c === 'function')

/** 侧边栏 / 抽屉图标。新版 `IconPanelLeftOutline`；旧版 `IconPanelLeftOutline16`。 */
export const PanelLeftIcon = pick(
  primitives?.IconPanelLeftOutline,
  primitives?.IconPanelLeftOutline16,
  primitives?.IconPanelLeftOutlineRegular,
)

/** 文件浏览图标。新版 `IconFolderOpenOutline`；旧版 `IconFolderOpenOutline16`。 */
export const FolderOpenIcon = pick(
  primitives?.IconFolderOpenOutline,
  primitives?.IconFolderOpenOutline16,
  primitives?.IconFolderOpenOutlineRegular,
)

/** 下载 / 会话日志图标。新版 `IconDownloadOutline`；旧版 `IconDownloadOutline16`。 */
export const DownloadIcon = pick(
  primitives?.IconDownloadOutline,
  primitives?.IconDownloadOutline16,
  primitives?.IconDownloadOutlineRegular,
)
