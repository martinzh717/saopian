import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function resolveDefaultMediaRoot(platform: string, home: string, windowsVideos = ""): string {
  if (platform === "win32") {
    const knownFolder = windowsVideos.trim();
    return knownFolder && path.win32.isAbsolute(knownFolder)
      ? path.win32.normalize(knownFolder)
      : path.win32.join(home, "Videos");
  }
  return path.posix.join(home, platform === "darwin" ? "Movies" : "Videos");
}

let cachedRoot: string | undefined;

/** Runs on the local media server, never inferred from the browser's OS. */
export function getDefaultMediaRoot(): string {
  if (cachedRoot !== undefined) return cachedRoot;
  let windowsVideos = "";
  if (process.platform === "win32") {
    try {
      windowsVideos = execFileSync("powershell.exe", [
        "-NoLogo", "-NoProfile", "-NonInteractive", "-Command",
        "[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; [Environment]::GetFolderPath('MyVideos')",
      ], { encoding: "utf8", timeout: 3000, windowsHide: true }).trim();
    } catch {
      // A restricted PowerShell environment falls back to the standard location.
    }
  }
  cachedRoot = resolveDefaultMediaRoot(process.platform, os.homedir(), windowsVideos);
  return cachedRoot;
}
