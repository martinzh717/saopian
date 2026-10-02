#!/usr/bin/env node
/**
 * Deploy public static site to mtt:/home/mt/mt-app/wuwei-apps/saopian/
 * Never uses rsync --delete on the shared apps root.
 */

import { spawnSync } from "node:child_process";
import { existsSync, lstatSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
process.chdir(root);

const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("用法：pnpm deploy:web [--dry-run] [--skip-build]\n构建静态站 → 同步到 wuwei-apps/saopian/ → 刷新 CDN → 检查入口。");
  process.exit(0);
}
const dryRun = args.includes("--dry-run");
const skipBuild = args.includes("--skip-build");
if (args.some((arg) => !["--dry-run", "--skip-build", "--help"].includes(arg))) {
  console.error("未知参数。支持 --dry-run、--skip-build、--help。");
  process.exit(1);
}

const sourceDir = join(root, "out");
const destination = "mtt:/home/mt/mt-app/wuwei-apps/saopian/";
const origin = "https://jishuba.cn";
const tccli = existsSync("/Library/Frameworks/Python.framework/Versions/3.11/bin/tccli")
  ? "/Library/Frameworks/Python.framework/Versions/3.11/bin/tccli"
  : "tccli";
let uploaded = false;

function run(command, argv, capture = false) {
  console.log(`\n> ${command} ${argv.join(" ")}`);
  const result = spawnSync(command, argv, {
    cwd: root,
    encoding: "utf8",
    stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${command} 执行失败：${result.error?.message ?? result.stderr ?? result.status}`);
  }
  return result.stdout;
}

function outputFiles(directory, prefix = "") {
  return readdirSync(directory).flatMap((name) => {
    const relative = `${prefix}${name}`;
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (stat.isSymbolicLink()) throw new Error(`构建产物含符号链接，停止发布：${relative}`);
    return stat.isDirectory() ? outputFiles(path, `${relative}/`) : [relative];
  });
}

try {
  run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=10", "mtt",
    "mkdir -p /home/mt/mt-app/wuwei-apps/saopian && test -w /home/mt/mt-app/wuwei-apps/saopian"]);
  if (!dryRun) run(tccli, ["--version"]);

  if (!skipBuild) {
    run("pnpm", ["build:web"]);
  }
  if (!existsSync(join(sourceDir, "index.html"))) {
    throw new Error("缺少 out/index.html，请先 pnpm build:web");
  }

  const files = outputFiles(sourceDir);
  const allowedRoots = new Set([
    "index.html", "index.txt", "404.html", "_next", "_not-found", "_not-found.html", "_not-found.txt",
    "brand", "bgm", "downloads", "favicon.ico", "icon.svg", "apple-icon.png",
    "manifest.webmanifest", "robots.txt", "sitemap.xml",
    "window.svg", "globe.svg", "next.svg", "vercel.svg", "file.svg",
  ]);
  for (const file of files) {
    if (file.startsWith("__next.")) continue; // Next 16 export debug/text sidecars
    const rootName = file.split("/")[0];
    if (rootName === "_next" || rootName === "brand" || rootName === "downloads" || rootName === "bgm") continue;
    if (allowedRoots.has(rootName)) continue;
    if (/\.(html|txt|ico|svg|png|webmanifest|xml)$/i.test(file)) continue;
    if (/(?:^|\/)\.|\.(?:md|mdx|map)$/i.test(file)) {
      throw new Error(`非预期发布文件：${file}。请确认发布边界后修改白名单。`);
    }
    throw new Error(`非预期发布文件：${file}。请确认发布边界后修改白名单。`);
  }

  const sync = ["-az", "--itemize-changes", "-e", "ssh -o BatchMode=yes -o ConnectTimeout=10"];
  if (dryRun) {
    run("rsync", [...sync, "--dry-run", `${sourceDir}/`, destination]);
    console.log("\n预演完成：未写服务器、未刷新 CDN。执行 pnpm deploy:web 正式发布。");
    process.exit(0);
  }

  run("ssh", ["-o", "BatchMode=yes", "mtt", `set -eu
backup=/home/mt/mt-app/app-gallery-backups
mkdir -p "$backup"
if [ -d /home/mt/mt-app/wuwei-apps/saopian ] && [ "$(ls -A /home/mt/mt-app/wuwei-apps/saopian 2>/dev/null)" ]; then
  archive="$backup/saopian-$(date +%Y%m%d-%H%M%S)-$$.tar.gz"
  tar -czf "$archive" -C /home/mt/mt-app/wuwei-apps saopian
  printf '上一版备份：%s\\n' "$archive"
fi`]);

  // Sync into slug directory only. Never --delete on wuwei-apps parent.
  uploaded = true;
  run("rsync", [...sync, `${sourceDir}/`, destination]);

  const urls = [...new Set([
    `${origin}/app/saopian`,
    `${origin}/app/saopian/`,
    ...files
      .filter((file) => !file.startsWith("_next/"))
      .map((file) => `${origin}/app/saopian/${file.split("/").map(encodeURIComponent).join("/")}`),
  ])];
  for (let offset = 0; offset < urls.length; offset += 50) {
    const output = run(tccli, ["teo", "CreatePurgeTask", "--cli-unfold-argument",
      "--ZoneId", "zone-367j8sxwv92a", "--Type", "purge_url",
      "--Targets", ...urls.slice(offset, offset + 50)], true);
    const parsed = JSON.parse(output);
    const result = parsed.Response ?? parsed;
    if (result.Error || result.FailedList?.length || !result.JobId) {
      throw new Error(`CDN 刷新未成功受理：${JSON.stringify(result)}`);
    }
    console.log(`CDN 刷新任务已提交：${result.JobId}`);
  }

  const response = await fetch(`${origin}/app/saopian/`, { signal: AbortSignal.timeout(20000) });
  await response.body?.cancel();
  if (response.status !== 200) throw new Error(`上线检查失败：/app/saopian/ HTTP ${response.status}`);
  console.log("入口检查：/app/saopian/ HTTP 200");
  console.log("\n部署完成。CDN 刷新为异步任务；请在浏览器检查新页面。");
} catch (error) {
  console.error(`\n部署中止：${error.message}`);
  if (uploaded) console.error("同步阶段已开始，线上可能已更新；请检查备份和失败步骤，脚本不会自动回退。");
  process.exitCode = 1;
}
