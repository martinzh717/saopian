# 扫片 · 架构

## 阶段一（当前）：单机一体

```text
浏览器
  └─ http://127.0.0.1:8025
        ├─ 页面（扫片 UI）
        └─ API（同进程）
              ├─ GET /api/browse?path=…
              └─ GET /api/media?path=…   （支持 Range）
                    └─ 读本机磁盘视频
```

- 开发：`pnpm dev` / `pnpm start`（Next.js）
- 给最终用户：`pnpm package:portable` 打出的 zip（内嵌 Node + standalone 服务），双击启动；见 [distribution.md](./distribution.md)。
- 好处：无 CORS / 混合内容问题；验证体验最快；用户无需源码环境。

## 阶段二：远程公开站 + 本机程序（当前公开交付）

```text
用户浏览器
  ├─ https://jishuba.cn/app/saopian/   （静态工作台 UI）
  └─ browse / media / 选目录 ──直连──→ http://127.0.0.1:8025
                                      （本机程序必须在运行）
```

公开站构建写入 `NEXT_PUBLIC_MEDIA_ORIGIN=http://127.0.0.1:8025`。本机服务对 `https://jishuba.cn` 开放 CORS（含 Private Network Access）。视频不经远程中转。

Chrome 一般允许 HTTPS 页访问 `http://127.0.0.1`；若仍被拦截，请用本机打开的 `http://127.0.0.1:8025`。

| 角色 | 职责 |
|------|------|
| 远程站 | UI、逻辑、账号、项目；**不中转**大视频预览流量 |
| 本机服务 | 今天的 `/api/browse`、`/api/media`（及日后胶片条） |

前端用配置区分来源，例如：

- 阶段一：`mediaBaseUrl = ""`（同域）
- 阶段二：`mediaBaseUrl = "http://127.0.0.1:<port>"`（或本机 HTTPS）

### 阶段二注意

1. **CORS**：本机服务允许远程站域名；视频需支持 `Range`。
2. **HTTPS 网页 + HTTP 本机**：可能被混合内容拦截；本机宜 HTTPS（如 mkcert）或其它桥接方案。
3. **带宽**：预览数据走浏览器 ↔ 本机；勿 `本机 → 远程 → 浏览器`。

## 模块边界（代码）

便于后期拆分，当前已按职责分开：

| 区域 | 路径 | 将来归属 |
|------|------|----------|
| 媒体类型 | `src/lib/media/types.ts` | 共享契约 |
| 系统视频目录 | `src/lib/media/default-directory.ts` | 本机服务 |
| 路径校验 | `src/lib/media/path-guard.ts` | 本机服务 |
| 列目录 | `src/lib/media/list-media.ts` | 本机服务 |
| Range 流 | `src/lib/media/stream-file.ts` | 本机服务 |
| HTTP 入口 | `src/app/api/*` | 本机服务 |
| 扫片 UI | `src/components/workspace/*` | 远程或同仓前端 |

## 路径安全

本机可读路径经 `resolveMediaPath` 约束，默认允许：

- 用户 home
- 系统视频目录（包括 Windows 重定向到其他盘的视频目录）
- `/Volumes`
- `/tmp`
- 进程 `cwd`

禁止空路径、空字节、越出允许根。此为本地工具防护，不是多租户云安全模型。

## 默认媒体根

默认目录在运行时由本机服务解析，首页使用动态渲染，避免把构建机器路径打包为默认值。
macOS 使用 ~/Movies；Windows 通过 Environment.GetFolderPath('MyVideos') 查询系统实际位置（支持重定向），查询失败回退 ~/Videos；其他系统回退 ~/Videos。
目录读取仍统一经过 resolveMediaPath。目录不存在或无权限时显示错误，不自动创建目录。
用户成功打开的路径存入浏览器 localStorage，按服务端默认目录区分本机环境；加载后优先恢复，失败则保留默认目录及错误提示。并发打开目录以最后一次请求为准。

[Windows 系统目录接口](https://learn.microsoft.com/dotnet/api/system.environment.specialfolder)

## 客户端素材预览

`src/lib/media/preview-client.ts` 复用同源 `/api/media` 的 Range 流，在浏览器生成封面，
不写入原素材、不引入远程媒体服务，也不要求 ffmpeg。
可见卡片通过 IntersectionObserver 提交可取消的封面任务；单队列最多一个封面视频解码器，
完成或取消后清除 src 并 load 释放资源。120 条 LRU 内存缓存按路径、mtime、size 区分。

`MediaList` 统一管理活动卡片；`MediaCard` 负责封面、指针映射、键盘交互；
手动划览与自动预览均由 `AutoCardPreview` 复用主视频画面；小卡片不再启动独立视频解码器。
活动预览会暂停新的封面任务；一个已经启动的封面任务可以完成。
活动卡片的划览比例通过播放器句柄同步到主预览，共用播放器 seek 队列并保留最新目标；主画面随卡片位置更新。镜像画面仅在时间变化且 seek 完成后绘制，最高 30fps，静止画面不重复绘制。

素材卡片支持鼠标与键盘划览联动主预览，离开后停留在最后位置。切换文件时校验素材路径，防止旧卡片请求影响新素材。

## 无需点击预览

鼠标进入底部视频或图片的小画面即切换主预览；视频左右划览同步主画面，不再要求先点击选择。键盘聚焦卡片同样触发主预览。切换时保留目标比例，元数据加载后自动定位；离开卡片停留在最后预览画面。

## 当前功能边界

选段面板、MarkedClip 类型、打点快捷键及选段状态已移除。Workspace 只管理目录、活动素材和缩略图尺寸，ScrubPlayer 只负责画面与 seek 队列。

## 本机目录选择框

POST /api/pick-directory 仅接受本机地址上的同源请求。macOS 通过 osascript choose folder，Windows 通过 PowerShell STA 的 FolderBrowserDialog 弹出系统窗口，120 秒超时。取消返回空路径，不改变当前目录；失败时 UI 回退手动输入。命令不拼接用户输入。
系统对话框返回的目录作为用户明确授权加入进程内访问范围，后续读盘仍经过 resolveMediaPath；授权不放宽其他目录，服务重启后外部目录需重新选择授权。网页必须在运行本机服务的电脑上使用。

## 大文件与 SD 卡读盘

媒体流使用 Node Readable.toWeb，队列按字节限为 64KiB，遵守消费端背压；客户端取消或请求中止会关闭文件流。HEAD 只返回头，不打开数据流。Range 支持末尾区间和超出文件末尾的合法区间截断。
主预览和缩略图统一使用带 mtime 的素材 URL；非自动播放时主预览采用 metadata 预加载。划览主画面与卡片共用一个视频解码器，避免双份 4K seek。

2026-10-02，对 SD_Card/DCIM/DJI_001 的只读抽样：47 个 MP4 共 44.19GB；前 3 个为 3840×2160、约 59.94fps、HEVC 10-bit，视频码率约 72–74Mbps，容器总码率约 89–90Mbps。单文件中部 64MiB 顺序读取约 41.3MB/s（抽样，可能受缓存影响）。16× 全帧播放的原始视频流吞吐需求约 144–149MB/s，仍超过此次读取速度；流传输修复不等同于消除此物理瓶颈。进一步可选本机 SSD 上的低分辨率预览代理与持久化缩略图缓存，原片保持不变。

## 释放可移动磁盘

关闭目录会卸载主预览并 remove src + load，取消卡片封面任务，清除目录恢复记录。POST /api/release-directory 接受同源请求，按目录关闭服务端追踪的文件流并等待 close，以释放暂停消费时仍打开的文件句柄。该操作只释放扫片占用，不替代操作系统推出磁盘。

## 浏览器拖入目录

useDirectoryDrop 在 drop 事件同步取得 FileSystemDirectoryEntry，DroppedDirectory 分批读取目录项（直到 readEntries 返回空批次），最多 4 个文件元数据读取并行。文件使用 URL.createObjectURL，由 mediaPreviewUrl 统一选择 Blob 或本机 API 地址，主预览/封面/自动预览复用现有流程。拖入根目录不允许向上越出授权范围。
不上传文件，不新增磁盘缓存；浏览器不暴露磁盘绝对路径，因此使用会话内虚拟路径，不将其持久化为本机服务路径。释放、切换为本机目录或卸载时 revokeObjectURL，待处理请求通过序号失效检查防止重新打开已释放目录。
参考：[目录拖放 API](https://developer.mozilla.org/en-US/docs/Web/API/DataTransferItem/webkitGetAsEntry)。
