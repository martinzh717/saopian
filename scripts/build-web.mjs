#!/usr/bin/env node
/**
 * Build the public static site for https://jishuba.cn/app/saopian/
 * Stashes src/app/api (Route Handlers are incompatible with output: 'export').
 */

import { spawn } from "node:child_process";
import { cp, mkdir, rename, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const apiDir = path.join(root, "src", "app", "api");
const pageFile = path.join(root, "src", "app", "page.tsx");
const pageWeb = path.join(root, "src", "app", "page.web.tsx");
const stashRoot = path.join(root, ".web-build-stash");
const stashApi = path.join(stashRoot, "api");
const stashPage = path.join(stashRoot, "page.tsx");
const outDir = path.join(root, "out");
const exportRoot = outDir;

function run(command, args, env = process.env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

async function restoreStash() {
  if (existsSync(stashApi) && !existsSync(apiDir)) {
    await rename(stashApi, apiDir);
  }
  if (existsSync(stashPage)) {
    await cp(stashPage, pageFile);
  }
}

async function main() {
  await restoreStash();
  await rm(stashRoot, { recursive: true, force: true });
  await mkdir(stashRoot, { recursive: true });

  if (!existsSync(apiDir)) {
    throw new Error("Missing src/app/api — aborting web build.");
  }
  if (!existsSync(pageWeb)) {
    throw new Error("Missing src/app/page.web.tsx — aborting web build.");
  }

  await rename(apiDir, stashApi);
  await cp(pageFile, stashPage);
  await cp(pageWeb, pageFile);

  try {
    await rm(outDir, { recursive: true, force: true });
    await run("pnpm", ["exec", "next", "build"], {
      ...process.env,
      SAOPIAN_BUILD: "web",
      NEXT_PUBLIC_BASE_PATH: "/app/saopian",
      NEXT_PUBLIC_MEDIA_ORIGIN: "http://127.0.0.1:8025",
      SITE_URL: "https://jishuba.cn",
      NODE_ENV: "production",
    });
  } finally {
    await restoreStash();
    await rm(stashRoot, { recursive: true, force: true });
  }

  if (!existsSync(path.join(exportRoot, "index.html"))) {
    throw new Error(`Expected ${exportRoot}/index.html after export.`);
  }

  const downloadsDest = path.join(exportRoot, "downloads");
  await mkdir(downloadsDest, { recursive: true });
  const distDir = path.join(root, "dist");
  const zipNames = [
    "saopian-macos-arm64.zip",
    "saopian-macos-x64.zip",
    "saopian-windows-x64.zip",
  ];
  for (const name of zipNames) {
    const source = path.join(distDir, name);
    if (existsSync(source)) {
      await cp(source, path.join(downloadsDest, name));
      console.log(`Included download: ${name}`);
    } else {
      console.warn(`Missing download (skip): dist/${name}`);
    }
  }

  // Tiny placeholder so empty downloads/ is still intentional in deploys without zips.
  const notePath = path.join(downloadsDest, "README.txt");
  if (!existsSync(path.join(downloadsDest, zipNames[0]))) {
    await writeFile(
      notePath,
      "本机程序压缩包由此目录提供。维护者请先 pnpm package:portable（及 win），再 pnpm build:web。\n",
      "utf8",
    );
  }

  console.log(`\nWeb export ready: ${exportRoot}`);
  console.log("Deploy with: pnpm deploy:web");
}

main().catch(async (error) => {
  await restoreStash().catch(() => {});
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
