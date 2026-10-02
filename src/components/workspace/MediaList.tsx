"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { ChevronLeft, ChevronRight, Folder } from "lucide-react";
import { holdThumbnailQueue } from "@/lib/media/preview-client";
import type { MediaEntry } from "@/lib/media/types";
import { MediaCard } from "./MediaCard";

/** Dwell before a non-selected card can take over the main preview. */
const HOVER_DWELL_MS = 200;
/** When the pointer is flying across the strip, wait longer. */
const HOVER_DWELL_FAST_MS = 340;
/** px/ms — above this, treat motion as transit, not intent to skim. */
const FAST_POINTER_PX_MS = 0.85;

type Props = {
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  folderControl: ReactNode;
  previewControl: ReactNode;
  autoPreview: boolean;
  thumbnailSize: number;
  onThumbnailSizeChange: (size: number) => void;
  entries: MediaEntry[];
  selectedPath: string | null;
  parent: string | null;
  loading: boolean;
  onSkim: (entry: MediaEntry, ratio: number) => void;
  onSelect: (entry: MediaEntry) => void;
  onOpenParent: () => void;
};

export function MediaList({ previewVideoRef, autoPreview, previewControl, folderControl, thumbnailSize, onThumbnailSizeChange, entries, selectedPath, parent, loading, onSelect, onOpenParent, onSkim }: Props) {
  const [activePath, setActivePath] = useState<string | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPath = useRef<string | null>(null);
  const selectedPathRef = useRef(selectedPath);
  const pointer = useRef({ x: 0, t: 0, speed: 0 });

  selectedPathRef.current = selectedPath;

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    pendingPath.current = null;
    setActivePath(null);
  }, []);

  const activate = useCallback((path: string) => {
    if (autoPreview) return;
    // Already previewing this clip — keep card overlay in sync without delay.
    if (path === selectedPathRef.current) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pendingPath.current = null;
      setActivePath(path);
      return;
    }
    if (pendingPath.current === path) return;
    if (timer.current) clearTimeout(timer.current);
    pendingPath.current = path;
    // Drop card overlay while waiting so fly-overs do not flash.
    setActivePath(null);
    const dwell = pointer.current.speed >= FAST_POINTER_PX_MS ? HOVER_DWELL_FAST_MS : HOVER_DWELL_MS;
    timer.current = setTimeout(() => {
      if (pendingPath.current !== path) return;
      setActivePath(path);
      timer.current = null;
    }, dwell);
  }, [autoPreview]);

  const deactivate = useCallback((path: string) => {
    if (pendingPath.current === path) {
      if (timer.current) clearTimeout(timer.current);
      timer.current = null;
      pendingPath.current = null;
    }
    setActivePath((current) => current === path ? null : current);
  }, []);

  const notePointer = useCallback((clientX: number) => {
    const now = performance.now();
    const dt = now - pointer.current.t;
    if (dt > 0 && dt < 120) {
      pointer.current.speed = Math.abs(clientX - pointer.current.x) / dt;
    } else if (dt >= 120) {
      pointer.current.speed = 0;
    }
    pointer.current.x = clientX;
    pointer.current.t = now;
  }, []);

  useEffect(() => {
    if (activePath || autoPreview) return holdThumbnailQueue();
  }, [activePath, autoPreview]);

  useEffect(() => {
    if (autoPreview) stripRef.current?.querySelector(".is-selected")?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [autoPreview, selectedPath]);

  useEffect(() => {
    const onVisibility = () => { if (document.hidden) stop(); };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", stop);
    return () => {
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", stop);
    };
  }, [stop]);

  useEffect(() => {
    const strip = stripRef.current;
    if (!strip) return;
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY)) return;
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? strip.clientWidth : 1);
      const canScroll = delta > 0 ? strip.scrollLeft < strip.scrollWidth - strip.clientWidth - 1 : strip.scrollLeft > 0;
      if (!canScroll) return;
      event.preventDefault();
      strip.scrollLeft += delta;
    };
    strip.addEventListener("wheel", onWheel, { passive: false });
    return () => strip.removeEventListener("wheel", onWheel);
  }, []);

  return (
    <div className="media-dock-content">
      <div className="media-dock-toolbar">
      <div className="media-dock-toolbar-start">
        <div className="flex shrink-0 items-center gap-3">
          <h2 className="text-sm font-medium">素材 <span className="ml-2 font-mono text-xs text-[var(--muted)]">{entries.filter((entry) => entry.kind !== "dir").length}</span></h2>
          {parent && (
            <button type="button" onClick={onOpenParent}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-[var(--muted)] hover:bg-white/5 hover:text-[var(--ink)]">
              <ChevronLeft className="h-3.5 w-3.5" />上级
            </button>
          )}
        </div>
        <div className="thumbnail-size-control">
          <label htmlFor="thumbnail-size">缩略图大小</label>
          <input id="thumbnail-size" type="range" min={110} max={300} step={5}
            value={thumbnailSize} aria-valuetext={thumbnailSize === 145 ? "标准大小" : thumbnailSize < 145 ? "较小，" + Math.round(thumbnailSize / 145 * 100) + "%" : "较大，" + Math.round(thumbnailSize / 145 * 100) + "%"}
            onChange={(e) => { stop(); onThumbnailSizeChange(Number(e.currentTarget.value)); }} />
        </div>
      </div>
      <div className="media-dock-preview-control">{previewControl}</div>
      <div className="media-dock-toolbar-end">
        <div className="media-folder-control">{folderControl}</div>
        <div className="media-strip-navigation">
          <button type="button" className="tool-button" aria-label="向前浏览素材" title="向前浏览素材"
            onClick={() => stripRef.current?.scrollBy({ left: -stripRef.current.clientWidth * 0.8 })}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" className="tool-button" aria-label="向后浏览素材" title="向后浏览素材"
            onClick={() => stripRef.current?.scrollBy({ left: stripRef.current.clientWidth * 0.8 })}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      </div>
      <div
        ref={stripRef}
        className="media-strip-scroll"
        aria-label="横向素材列表"
        onScroll={stop}
        onPointerMove={(event) => {
          if (event.pointerType === "mouse") notePointer(event.clientX);
        }}
      >
        {loading ? (
          <p role="status" className="px-2 py-6 text-center text-sm text-[var(--muted)]">读取中…</p>
        ) : entries.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-[var(--muted)]">此目录没有视频或图片</p>
        ) : (
          <div className="media-grid" style={{ "--thumbnail-size": thumbnailSize + "px" } as CSSProperties}>
            {entries.map((entry) => entry.kind === "dir" ? (
              <button key={entry.path} type="button" className="media-folder" title={entry.name} onClick={() => onSelect(entry)}>
                <Folder className="h-4 w-4 shrink-0 text-[var(--accent)]" />
                <span className="truncate">{entry.name}</span>
              </button>
            ) : (
              <MediaCard key={entry.path + ":" + entry.mtime} entry={entry}
                previewVideoRef={previewVideoRef} autoPlaying={autoPreview && entry.path === selectedPath}
                selected={entry.path === selectedPath} active={!autoPreview && activePath === entry.path}
                onActivate={activate} onDeactivate={deactivate} onSkim={onSkim}
                onSelect={(media) => { stop(); onSelect(media); }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
