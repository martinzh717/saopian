"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Folder, FolderOpen, LoaderCircle } from "lucide-react";
import { fetchApiJson } from "@/lib/media/fetch-api-json";
import { mediaApiUrl } from "@/lib/media/media-origin";

type Props = {
  path: string;
  onSubmit: (path: string) => void;
  error?: string | null;
};

export function FolderBar({ path, onSubmit, error }: Props) {
  const [picking, setPicking] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const pickingRef = useRef(false);
  const [draft, setDraft] = useState(path.startsWith("drop:") ? "" : path);
  const [expanded, setExpanded] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const Icon = path ? FolderOpen : Folder;
  const displayPath = path.replace(/^drop:[^/]+\//, "拖入：");

  const chooseDirectory = async () => {
    if (pickingRef.current) return;
    pickingRef.current = true;
    setPicking(true);
    setPickerError(null);
    setExpanded(false);
    try {
      const { ok, data } = await fetchApiJson(mediaApiUrl("/api/pick-directory"), { method: "POST" });
      if (!ok) throw new Error(typeof data.error === "string" ? data.error : "无法选择目录");
      if (typeof data.path === "string" && data.path) {
        setDraft(data.path);
        onSubmit(data.path);
      }
    } catch (err) {
      setPickerError(err instanceof Error ? err.message : "无法选择目录");
      setExpanded(true);
    } finally {
      pickingRef.current = false;
      setPicking(false);
    }
  };

  useEffect(() => {
    if (!expanded) return;
    inputRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setExpanded(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setExpanded(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [expanded]);

  return (
    <div className="folder-picker" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`tool-button folder-picker-trigger${path ? " is-open" : ""}`}
        aria-label={path ? "更换本地文件夹" : "打开本地文件夹"}
        disabled={picking}
        aria-busy={picking}
        aria-keyshortcuts="ArrowDown"
        aria-expanded={expanded}
        aria-controls={`${id}-editor`}
        aria-describedby={expanded ? undefined : `${id}-tooltip`}
        onClick={() => void chooseDirectory()}
        onContextMenu={(event) => { event.preventDefault(); setExpanded((value) => !value); }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") { event.preventDefault(); setExpanded(true); }
        }}
      >
        {picking ? <LoaderCircle size={19} className="animate-spin" aria-hidden="true" /> : <Icon size={19} aria-hidden="true" />}
      </button>
      {!expanded && (
        <span id={`${id}-tooltip`} role="tooltip" className="folder-picker-tooltip">
          {error ? `${error}；点击选择文件夹${path ? `（当前：${displayPath}）` : ""}` : displayPath || "未打开文件夹，点击打开"}
          <span className="mt-1 block text-[var(--muted)]">点击选择目录 · 右键或 ↓ 输入路径</span>
        </span>
      )}
      {expanded && (
        <form
          id={`${id}-editor`}
          className="folder-picker-editor"
          onSubmit={(event) => {
            event.preventDefault();
            if (draft.trim()) onSubmit(draft.trim());
          }}
        >
          <label htmlFor={`${id}-path`} className="text-xs text-[var(--muted)]">本地文件夹</label>
          <div className="flex gap-2">
            <input
              ref={inputRef}
              id={`${id}-path`}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              spellCheck={false}
              required
              className="h-9 min-w-0 flex-1 rounded-md border border-white/10 bg-black/25 px-3 font-mono text-sm text-[var(--ink)] outline-none focus:border-[var(--accent)]/50 focus:ring-2 focus:ring-[var(--accent)]/20"
              placeholder="/path/to/videos"
            />
            <button type="submit" className="tool-button shrink-0" disabled={!draft.trim()}>打开</button>
          </div>
          {pickerError || error ? <p role="alert" className="text-xs text-rose-300">{pickerError || error}</p> : null}
        </form>
      )}
    </div>
  );
}
