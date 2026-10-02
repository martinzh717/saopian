"use client";

import { IMAGE_EXTS, VIDEO_EXTS, type BrowseResult, type MediaEntry } from "./types";

/** Browser-granted files stay in memory; no upload, disk copy or absolute path lookup. */
export class DroppedDirectory {
  readonly rootPath: string;
  private directories = new Map<string, FileSystemDirectoryEntry>();
  private results = new Map<string, BrowseResult>();
  private urls = new Set<string>();
  private disposed = false;

  constructor(root: FileSystemDirectoryEntry) {
    this.rootPath = `drop:${crypto.randomUUID()}/${root.name}`;
    this.directories.set(this.rootPath, root);
  }

  owns(path: string) { return this.directories.has(path); }

  async browse(path: string): Promise<BrowseResult> {
    this.ensureActive();
    const cached = this.results.get(path);
    if (cached) return cached;
    const directory = this.directories.get(path);
    if (!directory) throw new Error("拖入的目录已释放，请重新拖入");
    const reader = directory.createReader();
    const children: FileSystemEntry[] = [];
    // Chromium may return only 100 entries per batch.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve, reject) => reader.readEntries(resolve, reject));
      this.ensureActive();
      if (!batch.length) break;
      children.push(...batch);
    }
    const entries: MediaEntry[] = [];
    let index = 0;
    const worker = async () => {
      while (index < children.length) {
        this.ensureActive();
        const child = children[index++];
        if (child.name.startsWith(".")) continue;
        const childPath = `${path}/${child.name}`;
        if (child.isDirectory) {
          this.directories.set(childPath, child as FileSystemDirectoryEntry);
          entries.push({ name: child.name, path: childPath, kind: "dir", size: 0, mtime: 0 });
          continue;
        }
        const extension = child.name.slice(child.name.lastIndexOf(".")).toLowerCase();
        const kind = VIDEO_EXTS.has(extension) ? "video" : IMAGE_EXTS.has(extension) ? "image" : null;
        if (!kind) continue;
        const file = await new Promise<File>((resolve, reject) => (child as FileSystemFileEntry).file(resolve, reject));
        this.ensureActive();
        const previewUrl = URL.createObjectURL(file);
        this.urls.add(previewUrl);
        entries.push({ name: child.name, path: childPath, kind, size: file.size, mtime: file.lastModified, previewUrl });
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    this.ensureActive();
    entries.sort((a, b) => (a.kind === "dir" ? 0 : 1) - (b.kind === "dir" ? 0 : 1) || a.name.localeCompare(b.name, "zh-CN", { numeric: true }));
    const result = { path, parent: path === this.rootPath ? null : path.slice(0, path.lastIndexOf("/")), entries };
    this.results.set(path, result);
    return result;
  }

  dispose() {
    this.disposed = true;
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
    this.directories.clear();
    this.results.clear();
  }

  private ensureActive() {
    if (this.disposed) throw new Error("目录已释放，请重新拖入");
  }
}
