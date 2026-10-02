"use client";

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref, type RefObject } from "react";
import { Film } from "lucide-react";
import { mediaPreviewUrl } from "@/lib/media/preview-client";
import { mediaCrossOrigin } from "@/lib/media/media-origin";
import type { LocalServerStatus } from "@/lib/media/local-server-status";
import { LOCAL_APP_HELP } from "@/lib/local-app-help";
import { BRAND } from "@/lib/brand";
import type { MediaEntry } from "@/lib/media/types";

export type ScrubPlayerHandle = {
  skim: (path: string, ratio: number) => void;
};

type Props = {
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  initialRatio?: number;
  ref?: Ref<ScrubPlayerHandle>;
  media: MediaEntry | null;
  autoPreview: boolean;
  playbackRate: number;
  onAdvance: () => void;
  onPlaybackBlocked: () => void;
  serverStatus: LocalServerStatus;
  onOpenLocalHelp: () => void;
};

export function ScrubPlayer({
  ref,
  previewVideoRef: videoRef,
  initialRatio = 0,
  media,
  autoPreview,
  playbackRate,
  onAdvance,
  onPlaybackBlocked,
  serverStatus,
  onOpenLocalHelp,
}: Props) {
  const [mediaError, setMediaError] = useState(false);
  const [imageReady, setImageReady] = useState(false);
  const imageRemaining = useRef(3000);
  const seekPending = useRef<number | null>(null);
  const seeking = useRef(false);
  const pendingCardRatio = useRef<number | null>(initialRatio);

  const flushSeek = useCallback(() => {
    const video = videoRef.current;
    if (!video || seekPending.current == null) return;
    if (seeking.current) return;
    const t = seekPending.current;
    seekPending.current = null;
    if (Math.abs(video.currentTime - t) < 0.04) return;
    seeking.current = true;
    video.currentTime = t;
  }, [videoRef]);

  const seekTo = useCallback(
    (t: number) => {
      const video = videoRef.current;
      const length = video?.duration ?? 0;
      if (!video || !Number.isFinite(length) || !length) return;
      const clamped = Math.min(Math.max(t, 0), Math.max(0, length - 0.04));


      seekPending.current = clamped;

      if (!seeking.current) flushSeek();
    },
    [flushSeek, videoRef],
  );

  useImperativeHandle(ref, () => ({
    skim(path, ratio) {
      const video = videoRef.current;
      if (!video || media?.path !== path || !Number.isFinite(ratio)) return;
      video.pause();

      const clamped = Math.min(1, Math.max(0, ratio));
      if (Number.isFinite(video.duration) && video.duration > 0) {
        pendingCardRatio.current = null;
        seekTo(clamped * video.duration);
      } else {
        pendingCardRatio.current = clamped;
      }
    },
  }), [media?.path, seekTo, videoRef]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || media?.kind !== "video") return;
    // Restore after Strict Mode's setup/cleanup rehearsal as well.
    if (!video.getAttribute("src")) {
      video.src = mediaPreviewUrl(media);
      video.load();
    }
    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [media, videoRef]);

  useEffect(() => {
    if (!autoPreview) {
      videoRef.current?.pause();
      return;
    }
    if (mediaError) {
      const timer = window.setTimeout(onAdvance, 0);
      return () => window.clearTimeout(timer);
    }
    if (media?.kind === "image") {
      if (!imageReady) return;
      const started = performance.now();
      const timer = window.setTimeout(onAdvance, imageRemaining.current / playbackRate);
      return () => {
        window.clearTimeout(timer);
        imageRemaining.current = Math.max(0, imageRemaining.current - (performance.now() - started) * playbackRate);
      };
    }
    const video = videoRef.current;
    if (!video) return;
    let cancelled = false;
    video.muted = true;
    video.playbackRate = playbackRate;
    void video.play().catch((error: unknown) => {
      if (!cancelled && !(error instanceof DOMException && error.name === "AbortError")) onPlaybackBlocked();
    });
    return () => { cancelled = true; video.pause(); };
  }, [autoPreview, playbackRate, media?.kind, imageReady, mediaError, onAdvance, onPlaybackBlocked, videoRef]);

  if (!media) {
    const remote = serverStatus.mode === "remote";
    const offline = remote && serverStatus.state === "offline";
    const checking = remote && serverStatus.state === "checking";
    const onlineRemote = remote && serverStatus.state === "online";
    const attention = offline || checking;
    return (
      <div className={`preview-empty${attention ? " is-attention" : ""}`}>
        <Film className={`mb-4 h-8 w-8 ${attention ? "text-[var(--accent)]" : "text-[var(--muted)]"}`} />
        <p className="text-base font-medium">{BRAND.slogan}</p>
        {offline ? (
          <>
            <p className="preview-empty-alert" role="status">{LOCAL_APP_HELP.emptyOfflineTitle}</p>
            <p className="mt-2 max-w-md text-sm text-[var(--muted)]">{LOCAL_APP_HELP.emptyOfflineBody}</p>
            <button type="button" className="preview-empty-cta" onClick={onOpenLocalHelp}>
              {LOCAL_APP_HELP.emptyOfflineCta}
            </button>
            <p className="mt-3 text-xs text-[var(--muted)]">或拖入文件夹临时划览；鼠标移到素材即可预览</p>
          </>
        ) : checking ? (
          <>
            <p className="preview-empty-alert is-checking" role="status">{LOCAL_APP_HELP.statusChecking}</p>
            <button type="button" className="preview-empty-cta is-secondary" onClick={onOpenLocalHelp}>
              {LOCAL_APP_HELP.emptyOfflineCta}
            </button>
          </>
        ) : (
          <>
            {onlineRemote && (
              <p className="preview-empty-ready" role="status">{LOCAL_APP_HELP.emptyOnlineHint}</p>
            )}
            {!onlineRemote && (
              <p className="mt-2 text-sm text-[var(--muted)]">拖入文件夹即可打开，或点击底部文件夹图标选择</p>
            )}
            <p className="mt-2 text-xs text-[var(--muted)]">鼠标移到素材即可预览，左右移动划览画面</p>
          </>
        )}
      </div>
    );
  }

  if (media.kind === "image") {
    return (
      <div className="video-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={mediaPreviewUrl(media)} alt={media.name} className="preview-image" crossOrigin={media.previewUrl ? undefined : mediaCrossOrigin()} onLoad={() => setImageReady(true)} onError={() => setMediaError(true)} />
      </div>
    );
  }

  return (
    <div className="player-layout">
      <div className="video-stage">
        <video ref={videoRef} key={media.path} src={mediaPreviewUrl(media)}
          className="preview-video" preload={autoPreview ? "auto" : "metadata"} playsInline
          crossOrigin={media.previewUrl ? undefined : mediaCrossOrigin()}
          onLoadedMetadata={(e) => {
            const d = e.currentTarget.duration;

            if (pendingCardRatio.current != null && Number.isFinite(d) && d > 0) {
              seekTo(pendingCardRatio.current * d);
              pendingCardRatio.current = null;
            }
          }}
          onSeeked={() => { seeking.current = false; flushSeek(); }}
          onEnded={() => { if (autoPreview) onAdvance(); }}
          onError={() => setMediaError(true)}
        />
      </div>
      {mediaError && <p role="alert" className="text-sm text-rose-300">无法播放此视频，请选择其他素材或检查视频编码是否受浏览器支持。</p>}
    </div>
  );
}
