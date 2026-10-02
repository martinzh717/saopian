"use client";

import { useEffect, useRef, type RefObject } from "react";
import { formatTimecode } from "@/lib/format";

type Props = { sourceRef: RefObject<HTMLVideoElement | null> };

/** Mirror the main decoder, so the thumbnail never seeks or plays independently. */
export function AutoCardPreview({ sourceRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const timeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d", { alpha: false });
    if (!canvas || !context) return;
    let frame = 0;
    let lastDraw = -Infinity;
    let lastTimecode = "";
    let lastVideo: HTMLVideoElement | null = null;
    let lastMediaTime = -1;
    const draw = (now: number) => {
      frame = requestAnimationFrame(draw);
      const video = sourceRef.current;
      if (!video || video.seeking || video.readyState < 2 || !video.videoWidth || now - lastDraw < 1000 / 30) return;
      if (video === lastVideo && video.currentTime === lastMediaTime) return;
      lastVideo = video;
      lastMediaTime = video.currentTime;
      lastDraw = now;
      const scale = Math.min(canvas.width / video.videoWidth, canvas.height / video.videoHeight);
      const width = video.videoWidth * scale;
      const height = video.videoHeight * scale;
      context.fillStyle = "#08090a";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(video, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
      canvas.style.opacity = "1";
      const ratio = Number.isFinite(video.duration) && video.duration > 0
        ? Math.min(1, Math.max(0, video.currentTime / video.duration)) : 0;
      if (cursorRef.current) cursorRef.current.style.left = `clamp(0px, ${ratio * 100}%, calc(100% - 2px))`;
      const timecode = formatTimecode(video.currentTime);
      if (timeRef.current && timecode !== lastTimecode) {
        timeRef.current.textContent = timecode;
        lastTimecode = timecode;
      }
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [sourceRef]);

  return (
    <>
      <canvas ref={canvasRef} width={600} height={338} aria-hidden="true"
        className="media-card-poster" style={{ opacity: 0 }} />
      <span ref={timeRef} className="media-card-time">00:00:00</span>
      <span ref={cursorRef} className="media-card-cursor" style={{ left: 0 }} />
    </>
  );
}
