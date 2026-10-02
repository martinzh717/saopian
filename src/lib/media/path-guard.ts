import path from "node:path";
import os from "node:os";
import { getDefaultMediaRoot } from "./default-directory";

const grants = globalThis as typeof globalThis & { saopianDirectoryGrants?: Set<string> };
const selectedDirectories = grants.saopianDirectoryGrants ??= new Set<string>();

export function allowSelectedMediaDirectory(selected: string) {
  if (!path.isAbsolute(selected) || selected.includes("\0")) throw new PathGuardError("非法路径");
  selectedDirectories.add(path.resolve(selected));
}

/**
 * Resolve a user-supplied path for local-only media serving.
 * Blocks null bytes and path tricks; keeps absolute paths under home
 * (or optionally under an allowlist root).
 */
export function resolveMediaPath(input: string): string {
  if (!input || typeof input !== "string") {
    throw new PathGuardError("缺少路径");
  }
  if (input.includes("\0")) {
    throw new PathGuardError("非法路径");
  }

  const resolved = path.resolve(input);
  const home = os.homedir();
  const allowedRoots = [
    ...selectedDirectories,
    home,
    getDefaultMediaRoot(),
    "/Volumes",
    "/tmp",
    process.cwd(),
  ].map((p) => path.resolve(p));

  const ok = allowedRoots.some(
    (root) => {
      const relative = path.relative(root, resolved);
      return !path.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + path.sep);
    },
  );

  if (!ok) {
    throw new PathGuardError("路径不在允许访问的目录内");
  }

  return resolved;
}

export class PathGuardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PathGuardError";
  }
}
