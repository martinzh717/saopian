export type MediaKind = "video" | "image" | "dir";

export type MediaEntry = {
  name: string;
  path: string;
  kind: MediaKind;
  size: number;
  mtime: number;
  /** Browser-only URL for explicitly dropped local files. Never sent to the server. */
  previewUrl?: string;
};

export type BrowseResult = {
  path: string;
  parent: string | null;
  entries: MediaEntry[];
};

export const VIDEO_EXTS = new Set([
  ".mp4",
  ".mov",
  ".m4v",
  ".webm",
  ".mkv",
  ".avi",
]);

export const IMAGE_EXTS = new Set([
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
  ".heic",
]);
