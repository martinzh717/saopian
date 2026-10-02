"use client";

import { useRef, useState, type DragEvent } from "react";

type Options = {
  onDirectory: (directory: FileSystemDirectoryEntry) => void;
  onError: (message: string) => void;
};

export function useDirectoryDrop({ onDirectory, onError }: Options) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hasFiles = (event: DragEvent) => event.dataTransfer.types.includes("Files");
  return {
    dragging,
    handlers: {
      onDragEnter(event: DragEvent) {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current++;
        setDragging(true);
      },
      onDragOver(event: DragEvent) {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      },
      onDragLeave(event: DragEvent) {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = Math.max(0, depth.current - 1);
        if (!depth.current) setDragging(false);
      },
      onDrop(event: DragEvent) {
        if (!hasFiles(event)) return;
        event.preventDefault();
        depth.current = 0;
        setDragging(false);
        const items = Array.from(event.dataTransfer.items).filter((item) => item.kind === "file");
        if (items.length !== 1) { onError("请一次拖入一个文件夹"); return; }
        const entry = items[0].webkitGetAsEntry?.();
        if (!entry?.isDirectory) { onError("请拖入文件夹；也可以点击文件夹图标选择目录"); return; }
        onDirectory(entry as FileSystemDirectoryEntry);
      },
    },
  };
}
