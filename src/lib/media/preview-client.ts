"use client";

import { mediaApiUrl, mediaCrossOrigin } from "./media-origin";
import type { MediaEntry } from "./types";

export function mediaPreviewUrl(entry: MediaEntry): string {
  if (entry.previewUrl) return entry.previewUrl;
  return mediaApiUrl("/api/media?path=" + encodeURIComponent(entry.path) + "&v=" + entry.mtime);
}

export type Thumbnail = { image: string; duration: number };
const cache = new Map<string, Thumbnail>();
let queue = Promise.resolve();
let previewHolds = 0;
const resumeWaiters = new Set<() => void>();

/** New poster jobs yield to interactive card previews. A running job stays bounded. */
export function holdThumbnailQueue(): () => void {
  previewHolds++;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    previewHolds--;
    if (!previewHolds) {
      for (const resume of resumeWaiters) resume();
      resumeWaiters.clear();
    }
  };
}

function waitForIdle(signal: AbortSignal): Promise<void> {
  if (!previewHolds || signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      resumeWaiters.delete(done);
      signal.removeEventListener("abort", done);
      resolve();
    };
    resumeWaiters.add(done);
    signal.addEventListener("abort", done, { once: true });
  });
}

function captureThumbnail(entry: MediaEntry, signal: AbortSignal): Promise<Thumbnail | null> {
  if (signal.aborted) return Promise.resolve(null);
  return new Promise((resolve) => {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    const cors = entry.previewUrl ? undefined : mediaCrossOrigin();
    if (cors) video.crossOrigin = cors;
    let finished = false;
    const finish = (result: Thumbnail | null) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      signal.removeEventListener("abort", abort);
      video.onloadeddata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      resolve(result);
    };
    const abort = () => finish(null);
    const timeout = setTimeout(abort, 10000);
    signal.addEventListener("abort", abort, { once: true });
    video.onerror = abort;
    video.onloadeddata = () => {
      if (!video.videoWidth || !video.videoHeight) return finish(null);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 320;
        canvas.height = Math.max(1, Math.round(320 * video.videoHeight / video.videoWidth));
        const context = canvas.getContext("2d");
        if (!context) return finish(null);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        finish({
          image: canvas.toDataURL("image/jpeg", 0.72),
          duration: Number.isFinite(video.duration) ? video.duration : 0,
        });
      } catch {
        finish(null);
      }
    };
    video.src = mediaPreviewUrl(entry);
    video.load();
  });
}

/** At most one poster decoder; offscreen/unmounted jobs are aborted by their owner. */
export function requestThumbnail(entry: MediaEntry, signal: AbortSignal): Promise<Thumbnail | null> {
  const key = entry.path + ":" + entry.mtime + ":" + entry.size;
  const cached = cache.get(key);
  if (cached) {
    cache.delete(key);
    cache.set(key, cached);
    return Promise.resolve(cached);
  }
  const job = queue.then(async () => {
    while (previewHolds && !signal.aborted) await waitForIdle(signal);
    if (signal.aborted) return null;
    const existing = cache.get(key);
    if (existing) return existing;
    const result = await captureThumbnail(entry, signal);
    if (result && !signal.aborted) {
      cache.set(key, result);
      if (cache.size > 120) cache.delete(cache.keys().next().value!);
    }
    return result;
  });
  queue = job.then(() => undefined, () => undefined);
  return job;
}
