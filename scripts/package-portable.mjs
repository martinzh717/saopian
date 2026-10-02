#!/usr/bin/env node
/**
 * Build a download-and-run portable package (slim by default):
 *   dist/saopian-<platform>/
 *     扫片.command | 扫片.bat
 *     使用说明.txt
 *     app/   (Next.js standalone + static + public)
 *     runtime/node  (only with --full)
 *
 * First launch resolves Node in order:
 *   1) bundled runtime/ (offline --full packages)
 *   2) system node on PATH (major >= 22)
 *   3) cached download under Application Support / LocalAppData
 *   4) download from nodejs.org + SHASUMS256 verify, then cache
 *
 * Usage:
 *   node scripts/package-portable.mjs
 *   node scripts/package-portable.mjs --platform win-x64 --skip-build
 *   node scripts/package-portable.mjs --full   # embed Node for offline use
 */

import { spawn } from "node:child_process";
import {
  chmod,
  copyFile,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const PORT = "8025";
const NODE_VERSION = "22.20.0";
const NODE_MAJOR_MIN = "22";
const PROXY = "http://127.0.0.1:10802";

const PLATFORMS = {
  "darwin-arm64": {
    label: "macOS Apple Silicon",
    nodeArchive: `node-v${NODE_VERSION}-darwin-arm64.tar.gz`,
    nodeBinaryInArchive: `node-v${NODE_VERSION}-darwin-arm64/bin/node`,
    nodeBinaryName: "node",
    folder: "saopian-macos-arm64",
    launcher: "扫片.command",
  },
  "darwin-x64": {
    label: "macOS Intel",
    nodeArchive: `node-v${NODE_VERSION}-darwin-x64.tar.gz`,
    nodeBinaryInArchive: `node-v${NODE_VERSION}-darwin-x64/bin/node`,
    nodeBinaryName: "node",
    folder: "saopian-macos-x64",
    launcher: "扫片.command",
  },
  "win-x64": {
    label: "Windows x64",
    nodeArchive: `node-v${NODE_VERSION}-win-x64.zip`,
    nodeBinaryInArchive: `node-v${NODE_VERSION}-win-x64/node.exe`,
    nodeBinaryName: "node.exe",
    folder: "saopian-windows-x64",
    launcher: "扫片.bat",
  },
};

function detectPlatform() {
  const { platform, arch } = process;
  if (platform === "darwin" && arch === "arm64") return "darwin-arm64";
  if (platform === "darwin" && arch === "x64") return "darwin-x64";
  if (platform === "win32" && (arch === "x64" || arch === "arm64")) return "win-x64";
  throw new Error(`Unsupported host platform: ${platform}/${arch}. Pass --platform explicitly.`);
}

function parseArgs(argv) {
  const args = { platform: null, skipBuild: false, full: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--platform") args.platform = argv[++i];
    else if (argv[i] === "--skip-build") args.skipBuild = true;
    else if (argv[i] === "--full") args.full = true;
    else if (argv[i] === "--help" || argv[i] === "-h") args.help = true;
  }
  return args;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
      ...options,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited with ${code}`));
    });
  });
}

async function fetchBuffer(url) {
  const tryFetch = async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120_000);
    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
      return Buffer.from(await response.arrayBuffer());
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    return await tryFetch();
  } catch (directError) {
    console.warn(`Direct download failed (${directError.message}); retrying via local proxy…`);
    return await downloadViaCurl(url, PROXY);
  }
}

function downloadViaCurl(url, proxy) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const child = spawn(
      "curl",
      ["-fL", "--max-time", "180", "--proxy", proxy, url],
      { stdio: ["ignore", "pipe", "inherit"] },
    );
    child.stdout.on("data", (c) => chunks.push(c));
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(Buffer.concat(chunks));
      else reject(new Error(`curl proxy download failed (${code}) for ${url}`));
    });
  });
}

async function extractNodeBinary(archivePath, platformKey, destBinaryPath) {
  const meta = PLATFORMS[platformKey];
  const staging = await mkdtemp(path.join(tmpdir(), "saopian-node-"));
  try {
    if (archivePath.endsWith(".tar.gz")) {
      await run("tar", ["-xzf", archivePath, "-C", staging]);
    } else if (archivePath.endsWith(".zip")) {
      if (process.platform === "win32") {
        await run("powershell", [
          "-NoProfile",
          "-Command",
          `Expand-Archive -LiteralPath '${archivePath.replace(/'/g, "''")}' -DestinationPath '${staging.replace(/'/g, "''")}' -Force`,
        ]);
      } else {
        await run("unzip", ["-q", archivePath, "-d", staging]);
      }
    } else {
      throw new Error(`Unknown archive type: ${archivePath}`);
    }

    const source = path.join(staging, meta.nodeBinaryInArchive);
    if (!existsSync(source)) {
      throw new Error(`Node binary missing in archive: ${meta.nodeBinaryInArchive}`);
    }
    await mkdir(path.dirname(destBinaryPath), { recursive: true });
    await copyFile(source, destBinaryPath);
    if (!meta.nodeBinaryName.endsWith(".exe")) {
      await chmod(destBinaryPath, 0o755);
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
  }
}

function macLauncher(platformKey) {
  const meta = PLATFORMS[platformKey];
  const archive = meta.nodeArchive;
  const nodeUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${archive}`;
  const shasumUrl = `https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`;
  const cacheRel = meta.nodeBinaryInArchive; // e.g. node-v…-darwin-arm64/bin/node
  return `#!/bin/bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export HOSTNAME=127.0.0.1
export PORT=${PORT}
NODE_VERSION="${NODE_VERSION}"
NODE_MAJOR_MIN=${NODE_MAJOR_MIN}
ARCHIVE="${archive}"
NODE_URL="${nodeUrl}"
SHASUM_URL="${shasumUrl}"
CACHE_ROOT="\${HOME}/Library/Application Support/saopian/runtime"
CACHE_NODE="\$CACHE_ROOT/${cacheRel}"
BUNDLE_NODE="\$ROOT/runtime/node"

node_ok() {
  local bin="\$1"
  [[ -x "\$bin" ]] || return 1
  local major
  major="\$("\$bin" -p "process.versions.node.split('.')[0]" 2>/dev/null)" || return 1
  [[ "\$major" =~ ^[0-9]+$ ]] || return 1
  (( major >= NODE_MAJOR_MIN ))
}

resolve_node() {
  if node_ok "\$BUNDLE_NODE"; then
    printf '%s\\n' "\$BUNDLE_NODE"
    return 0
  fi
  if command -v node >/dev/null 2>&1 && node_ok "\$(command -v node)"; then
    command -v node
    return 0
  fi
  if node_ok "\$CACHE_NODE"; then
    printf '%s\\n' "\$CACHE_NODE"
    return 0
  fi
  return 1
}

ensure_node() {
  local bin
  if bin="\$(resolve_node)"; then
    printf '%s\\n' "\$bin"
    return 0
  fi

  echo "未检测到可用的 Node（需要 \${NODE_MAJOR_MIN}+）。" >&2
  echo "正在从 nodejs.org 下载运行时（约 30–50MB，仅首次）…" >&2
  mkdir -p "\$CACHE_ROOT"
  local tmp
  tmp="\$(mktemp -d "\${TMPDIR:-/tmp}/saopian-node.XXXXXX")"
  cleanup_tmp() { rm -rf "\$tmp"; }
  trap cleanup_tmp EXIT

  if ! curl -fL --progress-bar --connect-timeout 20 --max-time 300 -o "\$tmp/\$ARCHIVE" "\$NODE_URL"; then
    echo "下载失败。请检查网络后重试，或自行安装 Node \${NODE_MAJOR_MIN}+ 后再打开。" >&2
    exit 1
  fi
  if ! curl -fL --connect-timeout 20 --max-time 60 -o "\$tmp/SHASUMS256.txt" "\$SHASUM_URL"; then
    echo "无法获取校验文件，已中止。" >&2
    exit 1
  fi
  (
    cd "\$tmp"
    grep "  \$ARCHIVE\$" SHASUMS256.txt | shasum -a 256 -c -
  ) || {
    echo "校验失败，已中止下载。" >&2
    exit 1
  }

  tar -xzf "\$tmp/\$ARCHIVE" -C "\$CACHE_ROOT"
  cleanup_tmp
  trap - EXIT
  if ! node_ok "\$CACHE_NODE"; then
    echo "运行时安装后仍不可用，请重试。" >&2
    exit 1
  fi
  echo "运行时已就绪。" >&2
  printf '%s\\n' "\$CACHE_NODE"
}

NODE_BIN="\$(ensure_node)"
cd "\$ROOT/app"

echo "扫片启动中… http://127.0.0.1:${PORT}"
echo "关闭本窗口即停止扫片。"
echo

"\$NODE_BIN" server.js &
PID=\$!

cleanup() {
  kill "\$PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for i in \$(seq 1 60); do
  if curl -sf "http://127.0.0.1:${PORT}" >/dev/null 2>&1; then
    open "http://127.0.0.1:${PORT}"
    break
  fi
  sleep 0.25
done

wait "\$PID"
`;
}

function winLauncher(platformKey) {
  const meta = PLATFORMS[platformKey];
  const archive = meta.nodeArchive;
  const nodeUrl = `https://nodejs.org/dist/v${NODE_VERSION}/${archive}`;
  const shasumUrl = `https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt`;
  const cacheRel = meta.nodeBinaryInArchive.replace(/\//g, "\\"); // node-v…-win-x64\node.exe
  return `@echo off
chcp 65001 >nul
setlocal EnableExtensions
set "ROOT=%~dp0"
set "HOSTNAME=127.0.0.1"
set "PORT=${PORT}"
set "NODE_VERSION=${NODE_VERSION}"
set "NODE_MAJOR_MIN=${NODE_MAJOR_MIN}"
set "ARCHIVE=${archive}"
set "NODE_URL=${nodeUrl}"
set "SHASUM_URL=${shasumUrl}"
set "CACHE_ROOT=%LOCALAPPDATA%\\saopian\\runtime"
set "CACHE_NODE=%CACHE_ROOT%\\${cacheRel}"
set "BUNDLE_NODE=%ROOT%runtime\\node.exe"

for /f "usebackq delims=" %%i in (\`powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%ensure-node.ps1" -BundleNode "%BUNDLE_NODE%" -CacheNode "%CACHE_NODE%" -CacheRoot "%CACHE_ROOT%" -NodeVersion "%NODE_VERSION%" -NodeMajorMin %NODE_MAJOR_MIN% -Archive "%ARCHIVE%" -NodeUrl "%NODE_URL%" -ShasumUrl "%SHASUM_URL%"\`) do set "NODE_BIN=%%i"

if not defined NODE_BIN (
  echo 无法准备 Node 运行时。
  pause
  exit /b 1
)
if not exist "%NODE_BIN%" (
  echo 运行时路径无效：%NODE_BIN%
  pause
  exit /b 1
)

cd /d "%ROOT%app"
echo 扫片启动中… http://127.0.0.1:%PORT%
echo 关闭本窗口即停止扫片。
echo.
start "" "http://127.0.0.1:%PORT%"
"%NODE_BIN%" server.js
`;
}

function readmeText(platformKey, full) {
  const meta = PLATFORMS[platformKey];
  const launcher = meta.launcher;
  return `扫片 · 本机便携版（${meta.label}）

用法
1. 解压本文件夹到任意位置（不要删 app）。
2. 双击「${launcher}」启动。
3. 浏览器会打开 http://127.0.0.1:${PORT} ；关闭启动窗口即停止服务。

运行时
- 默认包不内嵌 Node，体积更小。
- 启动时依次使用：包内 runtime（若有）→ 系统已安装的 Node ${NODE_MAJOR_MIN}+ → 本机缓存 → 从 nodejs.org 下载并校验。
- 缓存位置：macOS 为 ~/Library/Application Support/saopian/runtime/ ；Windows 为 %LOCALAPPDATA%\\saopian\\runtime\\
- 首次无 Node 时需要联网下载一次；之后可离线使用。
${full ? "- 本包为离线完整版，已内嵌 Node。\n" : ""}
说明
- 无需 pnpm 或源码。
- 视频始终在本机读取，不会上传到远程服务器。
- Mac 首次打开（新系统常见「Not Opened / 未打开」）：
  1) 弹出框点「完成」，不要点「移到废纸篓」。
  2) 打开「系统设置 → 隐私与安全性」，向下找「已阻止…扫片.command」，点「仍要打开」。
  3) 或在访达中按住 Control 点「扫片.command」→ 打开 → 打开。
  这是未做 Apple 公证时的正常拦截，不是病毒。
- Windows 若被 SmartScreen 拦截：选择「仍要运行」。
`;
}

async function zipFolder(folderPath, zipPath) {
  await rm(zipPath, { force: true });
  const parent = path.dirname(folderPath);
  const name = path.basename(folderPath);
  if (process.platform === "win32") {
    await run("powershell", [
      "-NoProfile",
      "-Command",
      `Compress-Archive -Path '${folderPath.replace(/'/g, "''")}' -DestinationPath '${zipPath.replace(/'/g, "''")}' -Force`,
    ]);
  } else {
    await run("ditto", ["-c", "-k", "--sequesterRsrc", "--keepParent", name, zipPath], {
      cwd: parent,
    });
  }
}

async function stripSharp(appDir) {
  await rm(path.join(appDir, "node_modules", "sharp"), { recursive: true, force: true });
  await rm(path.join(appDir, "node_modules", "@img"), { recursive: true, force: true });
  const pnpmDir = path.join(appDir, "node_modules", ".pnpm");
  if (existsSync(pnpmDir)) {
    for (const name of await readdir(pnpmDir)) {
      if (name.startsWith("sharp@") || name.startsWith("@img+")) {
        await rm(path.join(pnpmDir, name), { recursive: true, force: true });
      }
    }
  }
  const { readlink } = await import("node:fs/promises");
  for (const linkPath of await listSymlinksDeepestFirst(appDir)) {
    const raw = await readlink(linkPath).catch(() => "");
    if (/(^|[\\/])(sharp|@img)([@\\/]|$)/.test(raw) || /sharp|@img/.test(linkPath)) {
      await rm(linkPath, { force: true });
    }
  }
}

/** Collect symlink paths deepest-first. */
async function listSymlinksDeepestFirst(dir) {
  const found = [];
  async function walk(current) {
    let entries;
    try {
      entries = await readdir(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        found.push(full);
        continue;
      }
      if (entry.isDirectory()) await walk(full);
    }
  }
  await walk(dir);
  found.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
  return found;
}

async function assertRelativeSymlinks(appDir) {
  const { readlink, access } = await import("node:fs/promises");
  const { constants } = await import("node:fs");
  for (const linkPath of await listSymlinksDeepestFirst(appDir)) {
    const raw = await readlink(linkPath);
    if (path.isAbsolute(raw)) {
      throw new Error(`Absolute symlink not allowed in portable app: ${path.relative(appDir, linkPath)} → ${raw}`);
    }
    const resolved = path.resolve(path.dirname(linkPath), raw);
    try {
      await access(resolved, constants.F_OK);
    } catch {
      throw new Error(`Broken symlink in portable app: ${path.relative(appDir, linkPath)} → ${raw}`);
    }
  }
}

async function smokeTestPortableApp(appDir) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["server.js"], {
      cwd: appDir,
      env: { ...process.env, NODE_ENV: "production", HOSTNAME: "127.0.0.1", PORT: "18025" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let err = "";
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`Portable server smoke timed out.\n${err}`));
    }, 15000);
    child.stderr.on("data", (c) => { err += c; });
    child.stdout.on("data", (c) => { err += c; });
    const tryCurl = () => {
      const probe = spawn("curl", ["-sf", "-o", "/dev/null", "http://127.0.0.1:18025/"], { stdio: "ignore" });
      probe.on("exit", (code) => {
        if (code === 0) {
          clearTimeout(timer);
          child.kill("SIGTERM");
          resolve();
        } else {
          setTimeout(tryCurl, 200);
        }
      });
    };
    setTimeout(tryCurl, 300);
    child.on("exit", (code, signal) => {
      if (signal === "SIGTERM") return;
      clearTimeout(timer);
      reject(new Error(`Portable server exited early (${code}): ${err}`));
    });
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(
      `Usage: node scripts/package-portable.mjs [--platform ${Object.keys(PLATFORMS).join("|")}] [--skip-build] [--full]`,
    );
    return;
  }

  const platformKey = args.platform || detectPlatform();
  const meta = PLATFORMS[platformKey];
  if (!meta) {
    throw new Error(`Unknown platform "${platformKey}". Choose: ${Object.keys(PLATFORMS).join(", ")}`);
  }

  console.log(`Packaging 扫片 for ${meta.label} (${platformKey})${args.full ? " [full/offline]" : " [slim]"}…`);

  const hostKey = (() => {
    try {
      return detectPlatform();
    } catch {
      return null;
    }
  })();
  if (hostKey && hostKey.split("-")[0] !== platformKey.split("-")[0]) {
    console.warn(
      `Warning: building on ${hostKey} for ${platformKey}. Prefer packaging on the target OS (or CI) so native deps match.`,
    );
  }

  if (!args.skipBuild) {
    await run("pnpm", ["build"]);
  }

  const standaloneDir = path.join(root, ".next", "standalone");
  const staticDir = path.join(root, ".next", "static");
  const publicDir = path.join(root, "public");
  if (!existsSync(standaloneDir)) {
    throw new Error("Missing .next/standalone — enable output:'standalone' and run pnpm build.");
  }
  if (!existsSync(staticDir)) {
    throw new Error("Missing .next/static — run pnpm build first.");
  }

  const outRoot = path.join(root, "dist", meta.folder);
  await rm(outRoot, { recursive: true, force: true });
  await mkdir(outRoot, { recursive: true });

  const appDir = path.join(outRoot, "app");
  // Preserve Next standalone's relative pnpm symlinks (do not dereference).
  await mkdir(appDir, { recursive: true });
  await run("rsync", ["-a", "--delete", `${standaloneDir}/`, `${appDir}/`]);
  await mkdir(path.join(appDir, ".next"), { recursive: true });
  await cp(staticDir, path.join(appDir, ".next", "static"), { recursive: true });
  if (existsSync(publicDir)) {
    await cp(publicDir, path.join(appDir, "public"), { recursive: true });
  }
  // BGM mp3s ship with the public web site only — keep portable zip slim.
  await rm(path.join(appDir, "public", "bgm"), { recursive: true, force: true });
  await stripSharp(appDir);
  await assertRelativeSymlinks(appDir);
  await smokeTestPortableApp(appDir);

  if (args.full) {
    const cacheDir = path.join(root, "dist", ".cache");
    await mkdir(cacheDir, { recursive: true });
    const archivePath = path.join(cacheDir, meta.nodeArchive);
    if (!existsSync(archivePath)) {
      const url = `https://nodejs.org/dist/v${NODE_VERSION}/${meta.nodeArchive}`;
      console.log(`Downloading Node ${NODE_VERSION} for --full package…`);
      const buffer = await fetchBuffer(url);
      await writeFile(archivePath, buffer);
    } else {
      console.log(`Using cached Node archive: ${meta.nodeArchive}`);
    }
    const runtimeBinary = path.join(outRoot, "runtime", meta.nodeBinaryName);
    await extractNodeBinary(archivePath, platformKey, runtimeBinary);
  }

  const launcherPath = path.join(outRoot, meta.launcher);
  if (platformKey.startsWith("darwin")) {
    await writeFile(launcherPath, macLauncher(platformKey), "utf8");
    await chmod(launcherPath, 0o755);
  } else {
    await writeFile(launcherPath, winLauncher(platformKey), "utf8");
  }

  await writeFile(path.join(outRoot, "使用说明.txt"), readmeText(platformKey, args.full), "utf8");

  if (platformKey.startsWith("win")) {
    await cp(
      path.join(root, "scripts", "portable", "ensure-node.ps1"),
      path.join(outRoot, "ensure-node.ps1"),
    );
  }

  const zipPath = path.join(root, "dist", `${meta.folder}.zip`);
  await zipFolder(outRoot, zipPath);

  const { stat } = await import("node:fs/promises");
  const zipStat = await stat(zipPath);
  console.log(`\nDone.`);
  console.log(`  Folder: ${outRoot}`);
  console.log(`  Zip:    ${zipPath} (${(zipStat.size / (1024 * 1024)).toFixed(1)} MiB)`);
  console.log(`  Open:   ${meta.launcher}`);
  if (!args.full) {
    console.log(`  Note:   slim package — Node downloaded on first run if missing`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
