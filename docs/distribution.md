# 扫片 · 分发

两条交付物：

| 形态 | 给谁 | 怎么用 |
|------|------|--------|
| **公开站** | 访客 | https://jishuba.cn/app/saopian/ **即工作台**；右上角 ? 下载本机程序 |
| **扫片本机程序** | 要用扫片库的人 | ? 对话框下载 zip → 解压 → 双击运行 |

对用户统一称作 **「扫片本机程序」**（避免 runner / server）。文案见 `src/lib/local-app-help.ts`。

## 用户流程（本机程序）

1. 打开 https://jishuba.cn/app/saopian/ （工作台；可拖入文件夹临时划览）。  
2. 点右上角 **?** → 下载对应系统的 zip。  
3. 解压后双击 `扫片.command`（macOS）或 `扫片.bat`（Windows）。  
4. 浏览器打开 `http://127.0.0.1:8025`；关闭启动窗口即停止。

包内是扫片服务本身；**默认不内嵌 Node**。首次启动若本机没有 Node 22+，会从 nodejs.org 下载到本机缓存（带校验），之后可离线用。也可选 `--full` 打离线完整包。

## 维护者：本机便携包

```bash
pnpm package:portable          # 轻量包（默认，首次可按需下载 Node）
pnpm package:portable:mac
pnpm package:portable:win      # 尽量在 Windows / CI 上打
pnpm package:portable:full     # 离线完整包（内嵌 Node）
```

产物：`dist/saopian-*.zip`（见下）。

## 维护者：公开静态站

```bash
# 先打好 zip（可选，会打进 downloads/）
pnpm package:portable && pnpm package:portable:win

pnpm build:web                 # → out/app/saopian/
pnpm deploy:web                # 同步到 mtt:.../wuwei-apps/saopian/
pnpm deploy:web --dry-run      # 预演
```

要点：

- `SAOPIAN_BUILD=web` → `output: 'export'` + `basePath: /app/saopian`  
- 构建时暂存 `src/app/api`（静态导出不支持 Route Handlers）  
- 部署**禁止**对共享目录 `rsync --delete`  
- Umami：`63358055-613e-4134-9940-e94e4c8f7dcf`（仅 jishuba.cn 生产加载）  
- 展厅登记：`app-gallery/src/data/apps.ts` slug `saopian`

## 与远程的关系

| 角色 | 形态 |
|------|------|
| `jishuba.cn/app/saopian/` | 与本机相同的扫片工作台（静态）；下载入口在右上角 ?；**不跑**读盘 API |
| 用户本机 | 便携包 — UI + 读盘 API 一体 |

媒体仍只在用户浏览器 ↔ 本机服务之间传输，不经远程中转。

## 后续可选

- 代码签名 / 公证，减少 Gatekeeper、SmartScreen 拦截（当前靠说明引导「仍要打开」）。
- `.app` / 安装程序或 Tauri 壳。  
- 展厅侧部署封面更新：在 `app-gallery` 执行其 `pnpm run deploy`。
