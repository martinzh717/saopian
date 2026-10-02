# 扫片 / saopian

**扫一遍，好片就出现。**

本地视频 **划览预览（hover scrubbing）** 小工具：鼠标在素材上移动即可预览画面，方便从大量素材里挑出想要的场景。

## 在线使用

- 公开工作台：https://jishuba.cn/app/saopian/
- 点右上角 **?** 可下载「扫片本机程序」，在本机打开目录、稳定扫片库（视频不出本机）

## 文档地图

| 文档 | 内容 |
|------|------|
| [PRODUCT.md](./PRODUCT.md) | 为什么做、为谁做、核心体验、路线图 |
| [DESIGN.md](./DESIGN.md) | 视觉与动效规范（好看但不抢扫片） |
| [docs/architecture.md](./docs/architecture.md) | 单机 → 云端+本机 的两阶段架构与 API 边界 |
| [docs/distribution.md](./docs/distribution.md) | 最终用户便携包：下载 → 双击运行 |
| [docs/tech-stack.md](./docs/tech-stack.md) | 技术选型：用什么、不用什么、原因 |
| [AGENTS.md](./AGENTS.md) | 给后续协作者 / AI 的工作约定 |

## 最终用户（无开发环境）

1. 打开 [扫片公开页](https://jishuba.cn/app/saopian/)（工作台，可拖入文件夹临时划览）。
2. 需要按路径扫本机片库时：右上角 **?** → 下载对应系统的 zip → 解压 → 双击运行。
3. 详见 [docs/distribution.md](./docs/distribution.md)。

维护者打包 / 发布：

```bash
pnpm package:portable   # 本机程序（不含 BGM）
pnpm build:web          # 公开静态站（含 bgm/）
pnpm deploy:web         # 发布到 jishuba.cn/app/saopian/
```

背景音乐文件只随公开站部署在 `https://jishuba.cn/app/saopian/bgm/`，不打进本机 zip；播放时直接请求该地址。

## 开发启动

```bash
pnpm install
pnpm dev
```

浏览器打开 [http://127.0.0.1:8025](http://127.0.0.1:8025)

## 用法

1. 在底部工具栏打开本地目录（或拖入文件夹）。
2. 鼠标移到素材小画面即可在主预览查看，左右移动划览。
3. 滚轮横向浏览更多素材；用缩略图大小滑块调整素材尺寸。
4. 可启用背景音乐：随自动预览播放 / 暂停。

当前只提供素材浏览与划览，不包含选段、打点或保存片段功能。

## 品牌与 SEO

统一品牌文案在 `src/lib/brand.ts`：**扫片 · 扫一遍，好片就出现。**

已配置页面标题、描述、Open Graph、Twitter 分享元信息、深色主题色、Web App Manifest、
SVG/ICO favicon、Apple touch icon、应用图标和 1200×630 分享图片。

本地工作台不设置 `SITE_URL` 时保持 noindex。公开站构建会写入正式站点地址。

图标源：`public/brand/mark.svg`；分享图：`public/brand/share.png`。

预览队列检查：`node --test tests/media-preview.test.mjs`。

## License

MIT
