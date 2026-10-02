"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { formatTimecode } from "@/lib/format";
import { cn } from "@/lib/cn";
import { mediaPreviewUrl, requestThumbnail, type Thumbnail } from "@/lib/media/preview-client";
import type { MediaEntry } from "@/lib/media/types";
import { AutoCardPreview } from "./AutoCardPreview";

type Props = {
  previewVideoRef: RefObject<HTMLVideoElement | null>;
  autoPlaying: boolean;
  entry: MediaEntry;
  selected: boolean;
  active: boolean;
  onActivate: (path: string) => void;
  onDeactivate: (path: string) => void;
  onSkim: (entry: MediaEntry, ratio: number) => void;
  onSelect: (entry: MediaEntry) => void;
};

export function MediaCard({ previewVideoRef, autoPlaying, entry, selected, active, onActivate, onDeactivate, onSelect, onSkim }: Props) {
  const cardRef = useRef<HTMLButtonElement>(null);
  const frame = useRef<number | null>(null);
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [duration, setDuration] = useState(0);
  const wantedRatio = useRef(0);
  const canSkimRef = useRef(selected || active);

  canSkimRef.current = selected || active;

  useEffect(() => {
    const card = cardRef.current;
    if (!card || entry.kind !== "video") return;
    let controller: AbortController | null = null;
    let done = false;
    const observer = new IntersectionObserver(([observation]) => {
      if (!observation.isIntersecting) {
        controller?.abort();
        return;
      }
      if (done || (controller && !controller.signal.aborted)) return;
      controller = new AbortController();
      const signal = controller.signal;
      void requestThumbnail(entry, signal).then((result) => {
        if (signal.aborted) return;
        done = true;
        setThumbnail(result);
        setPosterFailed(!result);
        if (result) setDuration(result.duration);
        observer.disconnect();
      });
    });
    observer.observe(card);
    return () => { controller?.abort(); observer.disconnect(); };
  }, [entry]);

  useEffect(() => () => {
    if (frame.current != null) cancelAnimationFrame(frame.current);
  }, []);

  // After dwell unlocks this card, push one skim so the main preview can switch.
  useEffect(() => {
    if (!active || autoPlaying) return;
    onSkim(entry, entry.kind === "video" ? wantedRatio.current : 0);
  }, [active, autoPlaying, entry, onSkim]);

  const updateRatio = useCallback((clientX: number, target: HTMLElement, commit: boolean) => {
    const rect = target.getBoundingClientRect();
    wantedRatio.current = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    if (!commit) return;
    if (frame.current != null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      if (!canSkimRef.current) return;
      onSkim(entry, wantedRatio.current);
    });
  }, [entry, onSkim]);

  const isVideo = entry.kind === "video";
  return (
    <button ref={cardRef} type="button" title={entry.name}
      aria-label={entry.name + (isVideo ? "，左右方向键预览，回车打开" : "，打开图片")}
      aria-pressed={selected}
      className={cn("media-card", selected && "is-selected", (active || autoPlaying) && "is-previewing")}
      onClick={() => onSelect(entry)}
      onFocus={() => { onSkim(entry, wantedRatio.current); if (isVideo) onActivate(entry.path); }}
      onBlur={() => onDeactivate(entry.path)}
      onKeyDown={(e) => {
        if (!isVideo || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
        e.preventDefault();
        onActivate(entry.path);
        const next = e.key === "Home" ? 0 : e.key === "End" ? 1 : Math.min(1, Math.max(0, wantedRatio.current + (e.key === "ArrowRight" ? 0.02 : -0.02)));
        wantedRatio.current = next;
        onSkim(entry, next);
      }}>
      <span className="media-card-picture"
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return;
          onActivate(entry.path);
          if (!isVideo) {
            if (selected || active) onSkim(entry, 0);
            return;
          }
          updateRatio(e.clientX, e.currentTarget, selected || active);
        }}
        onPointerMove={(e) => {
          if (e.pointerType !== "mouse") return;
          onActivate(entry.path);
          if (!isVideo) return;
          updateRatio(e.clientX, e.currentTarget, selected || active);
        }}
        onPointerLeave={() => {
          if (frame.current != null) cancelAnimationFrame(frame.current);
          frame.current = null;
          onDeactivate(entry.path);
        }}>
        <span className="media-card-placeholder" aria-hidden="true">
          {isVideo ? <Video className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
          <span>{posterFailed ? "预览不可用" : isVideo ? "读取封面…" : "图片"}</span>
        </span>
        {(thumbnail || !isVideo) && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img src={isVideo ? thumbnail!.image : mediaPreviewUrl(entry)} alt="" loading="lazy"
            className="media-card-poster" onError={(e) => { e.currentTarget.style.display = "none"; }} />
        )}
        {(autoPlaying || (active && selected)) && isVideo && <AutoCardPreview sourceRef={previewVideoRef} />}
        {!autoPlaying && !(active && selected) && isVideo && duration > 0 && <span className="media-card-time">{formatTimecode(duration)}</span>}
      </span>
    </button>
  );
}
