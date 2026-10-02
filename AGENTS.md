# AGENTS · 扫片 / saopian

给在本仓库工作的人与 AI 代理的短约定。产品与设计细节以根目录文档为准。

## 先读

1. [PRODUCT.md](./PRODUCT.md) — 目标与边界  
2. [DESIGN.md](./DESIGN.md) — 视觉与动效  
3. [docs/architecture.md](./docs/architecture.md) — 两阶段架构  
4. [docs/tech-stack.md](./docs/tech-stack.md) — 选用 / 不用  
5. [docs/distribution.md](./docs/distribution.md) — 本机便携包 + 公开站  

跨工作区发布约定见上级 [`../AGENTS.md`](../AGENTS.md) 与 [`../_standards/`](../_standards/)。

## 硬优先级

1. **划览跟手**：时间轴 hover seek 是主路径，任何改动不得明显拖慢扫片。  
2. **媒体不经远程中转**（公开站与本机程序均遵守）。  
3. **模块边界**：读写盘逻辑留在 `src/lib/media` + `src/app/api`；UI 在 `components/workspace`；公开落地页在 `components/landing`。  
4. **公开站**：`/app/saopian/` 只做介绍与下载；禁止把读盘 API 部署到 `jishuba.cn`。

## 改代码时

- 包管理只用 **pnpm**（`pnpm dlx`，不用 npx）。  
- 新功能按目录拆分，避免把 I/O 与 UI 堆进单个大文件。  
- 不要引入 R3F / 全屏 WebGL / Lenis 长页来「美化」工作台。  
- 路径访问必须走 `resolveMediaPath`，不要直接拼用户输入读盘。  
- 公开站构建：`pnpm build:web`；部署：`pnpm deploy:web`（禁止对 `wuwei-apps/` 使用 `rsync --delete`）。  
- Umami Website ID 仅公开 ID；管理 Key 走本机 `umami-ops`。

## 文档

行为或架构变更时，同步更新对应的 PRODUCT / DESIGN / docs，保持仓库自描述。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
