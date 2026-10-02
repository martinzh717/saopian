"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, LogOut } from "lucide-react";
import { DroppedDirectory } from "@/lib/media/dropped-directory";
import { useDirectoryDrop } from "./useDirectoryDrop";
import { BRAND } from "@/lib/brand";
import { useWorkspacePreferences } from "./useWorkspacePreferences";
import { BackgroundMusicButton } from "./BackgroundMusicButton";
import { PreviewFullscreenButton } from "./PreviewFullscreenButton";
import { FolderBar } from "./FolderBar";
import { LocalAppHelpButton } from "./LocalAppHelpButton";
import { MediaList } from "./MediaList";
import { ScrubPlayer, type ScrubPlayerHandle } from "./ScrubPlayer";
import { useLocalServerStatus } from "./useLocalServerStatus";
import { withBasePath } from "@/lib/build-mode";
import { fetchApiJson } from "@/lib/media/fetch-api-json";
import { mediaApiUrl, mediaOrigin } from "@/lib/media/media-origin";
import type {
  BrowseResult,
  MediaEntry,
} from "@/lib/media/types";

type Props = {
  defaultMediaPath: string;
  initialBrowse: BrowseResult | null;
  initialError?: string | null;
};

const PLAYBACK_RATES = [1, 2, 4, 8, 16] as const;

export function Workspace({ defaultMediaPath, initialBrowse, initialError = null }: Props) {
  const directoryKey = `saopian:preferences:v1:directory:${defaultMediaPath}`;
  const loadSequence = useRef(0);
  const droppedDirectory = useRef<DroppedDirectory | null>(null);
  const [dropError, setDropError] = useState<string | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewStageRef = useRef<HTMLElement>(null);
  const playerRef = useRef<ScrubPlayerHandle>(null);
  const [initialPreviewRatio, setInitialPreviewRatio] = useState(0);
  const [dirPath, setDirPath] = useState(
    initialBrowse?.path ?? "",
  );
  const [browse, setBrowse] = useState<BrowseResult | null>(initialBrowse);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [selected, setSelected] = useState<MediaEntry | null>(() =>
    initialBrowse?.entries.find((entry) => entry.kind !== "dir") ?? null,
  );
  const { thumbnailSize, setThumbnailSize, playbackRate, setPlaybackRate } = useWorkspacePreferences();
  const [autoPreview, setAutoPreview] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const serverStatus = useLocalServerStatus();
  const pauseAutoPreview = useCallback(() => setAutoPreview(false), []);
  const nextMedia = useCallback(() => {
    if (!autoPreview) return;
    const media = browse?.entries.filter((entry) => entry.kind !== "dir") ?? [];
    const next = media[media.findIndex((entry) => entry.path === selected?.path) + 1];
    if (!next) { setAutoPreview(false); return; }
    setInitialPreviewRatio(0);
    setSelected(next);
  }, [autoPreview, browse, selected?.path]);

  const toggleAutoPreview = () => {
    if (autoPreview) { setAutoPreview(false); return; }
    const first = selected ?? browse?.entries.find((entry) => entry.kind !== "dir");
    if (!first) return;
    if (!selected) {
      setInitialPreviewRatio(0);
      setSelected(first);
    }
    setAutoPreview(true);
  };

  const loadDir = useCallback(async (path: string) => {
    const sequence = ++loadSequence.current;
    setAutoPreview(false);
    setLoading(true);
    setError(null);
    try {
      let result: BrowseResult;
      if (droppedDirectory.current?.owns(path)) {
        result = await droppedDirectory.current.browse(path);
      } else {
        const query = path ? `?path=${encodeURIComponent(path)}` : "";
        const { ok, data } = await fetchApiJson(mediaApiUrl(`/api/browse${query}`));
        if (!ok) throw new Error(typeof data.error === "string" ? data.error : "无法打开目录");
        result = data as BrowseResult;
      }
      if (sequence !== loadSequence.current) return;
      if (!result.path.startsWith("drop:")) {
        droppedDirectory.current?.dispose();
        droppedDirectory.current = null;
      }
      const firstMedia = result.entries.find((entry) => entry.kind !== "dir") ?? null;
      setBrowse(result);
      setDirPath(result.path);
      if (!result.path.startsWith("drop:")) {
        try { localStorage.setItem(directoryKey, result.path); } catch { /* Storage is optional. */ }
      }
      setInitialPreviewRatio(0);
      setSelected(firstMedia);
      if (firstMedia) playerRef.current?.skim(firstMedia.path, 0);



    } catch (err) {
      if (sequence !== loadSequence.current) return;
      setError(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [directoryKey]);

  useEffect(() => {
    let cancelled = false;
    const sequence = loadSequence.current;
    // Read after hydration; do not let startup restoration replace a user action.
    void Promise.resolve().then(() => {
      if (cancelled || sequence !== loadSequence.current) return;
      try {
        const saved = localStorage.getItem(directoryKey)?.trim();
        if (saved && saved !== initialBrowse?.path) void loadDir(saved);
        else if (mediaOrigin() && !initialBrowse) void loadDir("");
      } catch { /* Use the system directory when storage is unavailable. */ }
    });
    return () => { cancelled = true; };
  }, [directoryKey, initialBrowse?.path, loadDir]);

  const openDroppedDirectory = async (root: FileSystemDirectoryEntry) => {
    const sequence = ++loadSequence.current;
    const session = new DroppedDirectory(root);
    setAutoPreview(false);
    setLoading(true);
    setDropError(null);
    try {
      const result = await session.browse(session.rootPath);
      if (sequence !== loadSequence.current) { session.dispose(); return; }
      droppedDirectory.current?.dispose();
      droppedDirectory.current = session;
      setBrowse(result);
      setDirPath(result.path);
      setInitialPreviewRatio(0);
      setSelected(result.entries.find((entry) => entry.kind !== "dir") ?? null);
      setError(null);
      try { localStorage.removeItem(directoryKey); } catch { /* Storage is optional. */ }
    } catch (err) {
      session.dispose();
      if (sequence === loadSequence.current) setDropError(err instanceof Error ? err.message : "无法读取拖入的目录");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  const { dragging, handlers: dropHandlers } = useDirectoryDrop({
    onDirectory: (directory) => void openDroppedDirectory(directory), onError: setDropError,
  });

  useEffect(() => () => { loadSequence.current++; droppedDirectory.current?.dispose(); }, []);

  const releaseDirectory = async () => {
    const path = dirPath;
    // Invalidate directory requests so a late response cannot reopen the card.
    const sequence = ++loadSequence.current;
    setAutoPreview(false);
    const video = previewVideoRef.current;
    if (video) {
      video.pause();
      video.removeAttribute("src");
      video.load();
    }
    droppedDirectory.current?.dispose();
    droppedDirectory.current = null;
    setDropError(null);
    setSelected(null);
    setBrowse(null);
    setInitialPreviewRatio(0);
    setLoading(true);
    setError(null);
    try { localStorage.removeItem(directoryKey); } catch { /* Storage is optional. */ }
    try {
      if (path && !path.startsWith("drop:")) {
        const { ok } = await fetchApiJson(mediaApiUrl("/api/release-directory"), {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ path }),
        });
        if (!ok) throw new Error("释放素材失败，请重试");
      }
      if (sequence === loadSequence.current) setDirPath("");
    } catch (err) {
      if (sequence === loadSequence.current) setError(err instanceof Error ? err.message : "释放失败");
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  };

  const onSelect = (entry: MediaEntry) => {
    setAutoPreview(false);
    if (entry.kind === "dir") {
      void loadDir(entry.path);
      return;
    }
    if (entry.path === selected?.path) return;
    setInitialPreviewRatio(0);
    setSelected(entry);



  };

  const onCardSkim = useCallback((entry: MediaEntry, ratio: number) => {
    if (autoPreview || entry.kind === "dir") return;
    if (entry.path !== selected?.path) {
      setInitialPreviewRatio(ratio);
      setSelected(entry);



    } else {
      playerRef.current?.skim(entry.path, ratio);
    }
  }, [autoPreview, selected?.path]);

  return (
    <div className="workspace-shell" {...dropHandlers}>
      {dragging && <div className="directory-drop-overlay" aria-hidden="true">松开以打开文件夹</div>}
      {dropError && <div className="directory-drop-error" role="alert">
        {dropError}<button type="button" className="tool-button" onClick={() => setDropError(null)}>关闭</button>
      </div>}
      <header className="workspace-header">
        <div className="flex shrink-0 items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={withBasePath("/brand/mark.svg")} width={28} height={28} alt="" className="shrink-0" />
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
            <h1 className="text-lg font-semibold tracking-tight">{BRAND.name}</h1>
            <p className="text-xs text-[var(--muted)]">{BRAND.slogan}</p>
          </div>
        </div>
        <div className="workspace-header-actions">
          <LocalAppHelpButton open={helpOpen} onOpenChange={setHelpOpen} serverStatus={serverStatus} />
        </div>
      </header>
      <main className="workspace-grid">
        <section ref={previewStageRef} className="preview-workspace" aria-label="素材预览">
          <ScrubPlayer previewVideoRef={previewVideoRef} initialRatio={initialPreviewRatio} ref={playerRef}
            key={selected?.path ?? "empty"} media={selected} autoPreview={autoPreview}
            playbackRate={playbackRate} onAdvance={nextMedia} onPlaybackBlocked={pauseAutoPreview}
            serverStatus={serverStatus} onOpenLocalHelp={() => setHelpOpen(true)} />
        </section>
        <aside id="media-panel" className="media-dock" aria-label="素材胶片带">
          <MediaList previewVideoRef={previewVideoRef} autoPreview={autoPreview} previewControl={
            <div className="flex items-center gap-1">
              <button type="button" className={`tool-button folder-picker-trigger${autoPreview ? " is-open" : ""}`}
                disabled={loading || !browse?.entries.some((entry) => entry.kind !== "dir")}
                aria-label={autoPreview ? "暂停自动预览" : "从当前位置继续自动预览"}
                title={autoPreview ? "暂停自动预览" : "从当前位置继续自动预览"}
                aria-pressed={autoPreview} onClick={toggleAutoPreview}>
                {autoPreview ? <Pause size={17} /> : <Play size={17} />}
              </button>
              <div className="playback-rate-control">
                <input
                  id="playback-rate"
                  type="range"
                  min={0}
                  max={PLAYBACK_RATES.length - 1}
                  step={1}
                  value={Math.max(0, PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]))}
                  aria-label="自动预览倍速"
                  title={`自动预览倍速 ${playbackRate}×`}
                  aria-valuetext={`${playbackRate}×`}
                  onChange={(event) => setPlaybackRate(PLAYBACK_RATES[Number(event.currentTarget.value)] ?? 16)}
                />
                <span className="playback-rate-value" aria-hidden="true">{playbackRate}×</span>
              </div>
              <BackgroundMusicButton autoPreview={autoPreview} />
              <PreviewFullscreenButton targetRef={previewStageRef} />
            </div>
          } folderControl={
            <div className="flex items-center gap-1">
              <FolderBar key={dirPath} path={dirPath} error={error}
                onSubmit={(p) => void loadDir(p)} />
              <button type="button" className="tool-button folder-picker-trigger"
                disabled={!dirPath && !loading} onClick={() => void releaseDirectory()}
                title="关闭目录并释放素材，然后可在系统中推出磁盘"
                aria-label="关闭目录并释放素材">
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          } onSkim={onCardSkim} thumbnailSize={thumbnailSize} onThumbnailSizeChange={setThumbnailSize} key={browse?.path ?? "empty"} entries={browse?.entries ?? []} selectedPath={selected?.path ?? null}
            parent={browse?.parent ?? null} loading={loading} onSelect={onSelect}
            onOpenParent={() => { if (browse?.parent) void loadDir(browse.parent); }} />
        </aside>
      </main>
    </div>
  );
}
