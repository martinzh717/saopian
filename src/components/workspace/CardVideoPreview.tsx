"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { mediaPreviewUrl } from "@/lib/media/preview-client";
import { mediaCrossOrigin } from "@/lib/media/media-origin";
import type { MediaEntry } from "@/lib/media/types";

type Props = {
  entry: MediaEntry;
  ratio: number;
  onDuration: (duration: number) => void;
};

/** Only the active card mounts this decoder. Keep the newest pending seek. */
export function CardVideoPreview({ entry, ratio, onDuration }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const pendingRatio = useRef(ratio);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const flush = useCallback(() => {
    const video = ref.current;
    if (!video || !Number.isFinite(video.duration) || !video.duration || video.seeking) return;
    const target = Math.min(pendingRatio.current * video.duration, Math.max(0, video.duration - 0.04));
    if (Math.abs(video.currentTime - target) > 0.04) video.currentTime = target;
  }, []);

  useEffect(() => {
    pendingRatio.current = ratio;
    flush();
  }, [ratio, flush]);

  useEffect(() => {
    const video = ref.current;
    if (video) { video.src = mediaPreviewUrl(entry); video.load(); }
    return () => {
      if (!video) return;
      video.pause();
      video.removeAttribute("src");
      video.load();
    };
  }, [entry]);

  return (
    <>
      <video ref={ref} muted playsInline preload="auto" crossOrigin={entry.previewUrl ? undefined : mediaCrossOrigin()}
        aria-hidden="true" className="card-preview-video" style={{ opacity: ready && !failed ? 1 : 0 }}
        onLoadedMetadata={(e) => {
          const duration = e.currentTarget.duration;
          if (Number.isFinite(duration)) onDuration(duration);
          flush();
        }}
        onLoadedData={() => { setReady(true); flush(); }}
        onSeeked={() => { setReady(true); flush(); }}
        onError={() => setFailed(true)}
      />
      {!ready && !failed && <span className="card-preview-status">加载预览…</span>}
      {failed && <span className="card-preview-status">暂不可预览，点击打开</span>}
    </>
  );
}
