import fs from "node:fs/promises";
import path from "node:path";
import {
  IMAGE_EXTS,
  VIDEO_EXTS,
  type BrowseResult,
  type MediaEntry,
  type MediaKind,
} from "./types";
import { PathGuardError, resolveMediaPath } from "./path-guard";

function extOf(name: string): string {
  return path.extname(name).toLowerCase();
}

function kindOf(name: string, isDir: boolean): MediaKind | null {
  if (isDir) return "dir";
  const ext = extOf(name);
  if (VIDEO_EXTS.has(ext)) return "video";
  if (IMAGE_EXTS.has(ext)) return "image";
  return null;
}

export async function browseDirectory(rawPath: string): Promise<BrowseResult> {
  const dir = resolveMediaPath(rawPath);
  let stat;
  try {
    stat = await fs.stat(dir);
  } catch {
    throw new PathGuardError("目录不存在或无法访问");
  }
  if (!stat.isDirectory()) {
    throw new PathGuardError("路径不是目录");
  }

  const names = await fs.readdir(dir);
  const entries: MediaEntry[] = [];

  await Promise.all(
    names.map(async (name) => {
      if (name.startsWith(".")) return;
      const full = path.join(dir, name);
      try {
        const s = await fs.stat(full);
        const kind = kindOf(name, s.isDirectory());
        if (!kind) return;
        entries.push({
          name,
          path: full,
          kind,
          size: s.isDirectory() ? 0 : s.size,
          mtime: s.mtimeMs,
        });
      } catch {
        // skip unreadable entries
      }
    }),
  );

  entries.sort((a, b) => {
    if (a.kind === "dir" && b.kind !== "dir") return -1;
    if (a.kind !== "dir" && b.kind === "dir") return 1;
    return a.name.localeCompare(b.name, "zh-CN", { numeric: true });
  });

  const parent = path.dirname(dir);
  return {
    path: dir,
    parent: parent !== dir ? parent : null,
    entries,
  };
}
