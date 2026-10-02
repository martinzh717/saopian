/** User-facing copy for the local download-and-run package (shown in the ? dialog). */
export const LOCAL_APP_HELP = {
  /** Short name everyone can understand — avoid “runner / server”. */
  productName: "扫片本机程序",
  buttonLabel: "如何在本机使用",
  dialogTitle: "下载本机程序，才能扫本地片库",
  lead:
    "当前网页可以拖入文件夹临时划览。要按路径打开本机目录、稳定扫片库，请下载并运行「扫片本机程序」。本机程序启动后，可继续留在本页使用：目录和视频走本机 http://127.0.0.1:8025，片子不会上传。",
  downloadTitle: "下载",
  stepsTitle: "怎么做",
  steps: [
    "点击下方对应系统的压缩包下载并解压（不要删里面的文件）。",
    "Mac：先看下方「首次打开」；Windows：双击 扫片.bat，若被拦截选「仍要运行」。",
    "启动后保持启动窗口开着。回到本页刷新，即可打开本机文件夹、划览素材。也可以直接打开 http://127.0.0.1:8025 。",
  ],
  macOpenTitle: "Mac 首次打开（很重要）",
  macOpenSteps: [
    "若弹出「扫片.command Not Opened / 未打开」且只有「移到废纸篓」「完成」：先点「完成」，不要移到废纸篓。",
    "打开「系统设置 → 隐私与安全性」，向下滚动，找到「已阻止使用扫片.command」一类提示，点「仍要打开」。",
    "也可在访达中按住 Control 点「扫片.command」→ 打开 → 再确认打开。",
    "以后同一份文件一般可直接双击，无需再确认。",
  ],
  notesTitle: "说明",
  notes: [
    "这是系统对「未公证」下载文件的正常拦截，不是病毒提示；扫片尚未做 Apple 开发者签名。",
    "默认安装包不含 Node；若本机没有，首次启动会自动下载到本机缓存（需联网一次）。",
    "无需安装 pnpm 或源码；视频只在本机读取，不经远程服务器中转。",
    "不装本机程序时，仍可把文件夹拖进本页临时浏览（刷新后需重新拖入）。",
  ],
  /** Tooltip-only status (no visible status copy in the chrome) */
  statusEmbedded: "本机程序运行中",
  statusOnline: "本机程序已连接",
  statusOffline: "未检测到本机程序",
  statusChecking: "正在检测本机程序…",
  emptyOfflineTitle: "未检测到本机程序",
  emptyOfflineBody: "要按路径打开本机目录并稳定扫片，请先下载并运行「扫片本机程序」。也可先拖入文件夹临时划览。",
  emptyOfflineCta: "查看如何下载与使用",
  emptyOnlineHint: "本机程序已连接。拖入文件夹，或点击底部文件夹图标选择目录。",
} as const;
