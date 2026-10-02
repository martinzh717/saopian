# 扫片 · 技术栈

选型原则：**扫片跟手 > 视觉炫技**。官网炫酷手册里的技术按层取用，不全盘照搬。

参考来源（外部知识库，非本仓依赖）：

`orgable-0820/0701-org-wiki/80-knowledge/10-品牌与体验/前端-炫酷官网技术栈选型.md`

以及工作区默认 Web 栈：Next.js + Tailwind + shadcn 气质 + 适量动效。

## 采用

| 层 | 技术 | 用途 |
|----|------|------|
| 应用 | **Next.js**（App Router）+ TypeScript | 本机一体：UI + API |
| 样式 | **Tailwind CSS** v4 | 布局与主题变量 |
| 图标 | **Lucide** | 克制线型图标 |
| 动效 | **Motion** | 轻量入场 / 过渡 |
| 工具函数 | clsx + tailwind-merge | `cn()` |
| 包管理 | **pnpm** | 与默认栈一致 |
| 媒体 | Node `fs` + HTTP **Range** | 目录列表、视频流、划览 seek |

UI 基座按 shadcn/Radix 方向演进；当前控件为手写，保持同样清晰度即可。

## 明确不采用（本工具）

| 技术 | 原因 |
|------|------|
| R3F / Three / Bloom | 与视频解码抢 GPU，扫片易卡 |
| Lenis / ScrollTrigger 长页叙事 | 产品是工作台，不是滚动官网 |
| Aceternity 招牌特效 | 易模板脸，干扰主任务 |
| anime.js | 已有 Motion，不叠第三套 |
| 纯静态前端（无本机 API） | 无法稳定按路径读本地片库；仅文件选择器不够用 |

## 可选后续

| 技术 | 何时 |
|------|------|
| shadcn/ui 组件 | 对话框、命令面板等变复杂时 |
| React Bits（少量） | 空状态 / 品牌页点缀，不进扫片主台 |
| ffmpeg 胶片条 / 代理片 | 大文件划览仍顿时 |
| MiSans / 阿里普惠 + cn-font-split | 正式远程中文站、文案频繁改时 |

## 运行

- 开发：`pnpm dev` → `127.0.0.1:8025`
- 生产本机：`pnpm build && pnpm start`
- 给最终用户：`pnpm package:portable` → `dist/saopian-*.zip`
- 公开站：`pnpm build:web` → `pnpm deploy:web` → `https://jishuba.cn/app/saopian/`
- Node：建议 ≥ 22；便携包自带 Node，用户侧无需安装
