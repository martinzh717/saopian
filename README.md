# 扫片 / saopian

**扫一遍，好片就出现。**

卡里两百条无人机、活动跟拍、课堂录屏。进剪辑软件一条条双击、拖进度条、关掉、再打开下一条——大半天过去，好镜头还没挑完。

扫片不做时间线、不做成片。它只做一件事：让你在大量本地视频里**尽快看见画面**，把能用的镜头找出来。

公开工作台：https://jishuba.cn/app/saopian/

## 谁会用

- 飞完一整个下午，存储卡里全是长镜、空镜，不知道哪几秒能进片。
- 活动/课程素材按文件夹堆着，文件名看不出内容，只能靠播。
- 硬盘里「待剪」越积越多，打开 Premiere / 剪映的成本太高，只想先过一遍。

片子始终在本机。公开页也可以拖入文件夹临时看；要按路径扫整库，下载右上角 **?** 里的本机程序。

## 怎么用

1. 打开 [扫片](https://jishuba.cn/app/saopian/)，拖入文件夹；或运行本机程序后打开目录。
2. 鼠标移到胶片带上的小画面，主预览立刻跟上；左右移动即划览时间。路过不停留不会误切正在看的片子。
3. 想过完全库：点播放，倍速扫（默认 16×）。可开背景音乐、可把预览全屏。自动预览与音乐在全屏时照常。

不打点、不导出。选词在这里，组句回你的剪辑软件。

本机程序说明：[docs/distribution.md](./docs/distribution.md)

## 开发

```bash
pnpm install
pnpm dev          # http://127.0.0.1:8025
```

```bash
pnpm package:portable   # 本机 zip（不含 BGM）
pnpm build:web          # 公开静态站
pnpm deploy:web         # 发布到 jishuba.cn/app/saopian/
```

BGM 只放在 `https://jishuba.cn/app/saopian/bgm/`，播放时直接请求该地址。

| 文档 | 内容 |
|------|------|
| [PRODUCT.md](./PRODUCT.md) | 产品边界与功能 |
| [DESIGN.md](./DESIGN.md) | 视觉与交互 |
| [docs/architecture.md](./docs/architecture.md) | 架构 |
| [docs/tech-stack.md](./docs/tech-stack.md) | 技术选型 |
| [AGENTS.md](./AGENTS.md) | 协作者约定 |

测试：`node --test tests/media-preview.test.mjs`

## License

MIT
