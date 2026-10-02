"use client";

import { useEffect, useState, type RefObject } from "react";
import { Maximize2, Minimize2 } from "lucide-react";

type Props = {
  /** Element to put into browser fullscreen (typically the preview stage). */
  targetRef: RefObject<HTMLElement | null>;
};

function requestFullscreen(element: HTMLElement) {
  const anyEl = element as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  if (typeof element.requestFullscreen === "function") return element.requestFullscreen();
  if (typeof anyEl.webkitRequestFullscreen === "function") return Promise.resolve(anyEl.webkitRequestFullscreen());
  return Promise.reject(new Error("Fullscreen API unavailable"));
}

function exitFullscreen() {
  const doc = document as Document & {
    webkitExitFullscreen?: () => Promise<void> | void;
  };
  if (typeof document.exitFullscreen === "function" && document.fullscreenElement) {
    return document.exitFullscreen();
  }
  if (typeof doc.webkitExitFullscreen === "function") return Promise.resolve(doc.webkitExitFullscreen());
  return Promise.resolve();
}

function currentFullscreenElement(): Element | null {
  const doc = document as Document & { webkitFullscreenElement?: Element | null };
  return document.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
}

/** Toolbar toggle: fullscreen the main preview only; auto-preview / BGM keep running. */
export function PreviewFullscreenButton({ targetRef }: Props) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const sync = () => setActive(currentFullscreenElement() === targetRef.current);
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync as EventListener);
    sync();
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync as EventListener);
    };
  }, [targetRef]);

  return (
    <button
      type="button"
      className={`tool-button folder-picker-trigger${active ? " is-open" : ""}`}
      aria-label={active ? "退出预览全屏" : "预览全屏"}
      title={active ? "退出预览全屏" : "预览全屏"}
      aria-pressed={active}
      onClick={() => {
        const target = targetRef.current;
        if (!target) return;
        if (currentFullscreenElement() === target) {
          void exitFullscreen().catch(() => {});
          return;
        }
        void requestFullscreen(target).catch(() => {});
      }}
    >
      {active ? <Minimize2 size={17} aria-hidden="true" /> : <Maximize2 size={17} aria-hidden="true" />}
    </button>
  );
}
