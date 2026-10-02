import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { allowSelectedMediaDirectory, resolveMediaPath } from "./path-guard";

const run = promisify(execFile);
let choosing = false;

/** Only OS dialog output is trusted as an explicit user directory grant. */
export async function pickDirectory(): Promise<string | null> {
  if (choosing) throw new Error("目录选择框已打开，请先完成选择");
  choosing = true;
  try {
    let selected: string;
    if (process.platform === "darwin") {
      const { stdout } = await run("/usr/bin/osascript", ["-e", `
        tell application "System Events"
          activate
          try
            set picked to choose folder with prompt "选择扫片素材文件夹"
            return POSIX path of picked
          on error number -128
            return ""
          end try
        end tell
      `], { timeout: 120000, maxBuffer: 65536 });
      selected = stdout.trim();
    } else if (process.platform === "win32") {
      const { stdout } = await run("powershell.exe", ["-NoLogo", "-NoProfile", "-NonInteractive", "-STA", "-Command", `
        [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
        Add-Type -AssemblyName System.Windows.Forms
        $picker = New-Object System.Windows.Forms.FolderBrowserDialog
        $picker.Description = '选择扫片素材文件夹'
        $picker.ShowNewFolderButton = $false
        try {
          if ($picker.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
            [Console]::Write($picker.SelectedPath)
          }
        } finally { $picker.Dispose() }
      `], { timeout: 120000, maxBuffer: 65536, windowsHide: true });
      selected = stdout.trim();
    } else {
      throw new Error("当前系统暂不支持目录选择框，请手动输入路径");
    }
    if (!selected) return null;
    allowSelectedMediaDirectory(selected);
    return resolveMediaPath(selected);
  } catch (error) {
    if (error instanceof Error && !('code' in error) && !('killed' in error)) throw error;
    throw new Error("无法打开系统目录选择框或选择已超时，请重试或手动输入路径");
  } finally {
    choosing = false;
  }
}
