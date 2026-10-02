"use client";

import { useCallback, useSyncExternalStore } from "react";

const CHANGE_EVENT = "saopian:preferences-changed";
const memory = new Map<string, number>();
const settings = {
  thumbnailSize: {
    fallback: 145,
    valid: (value: number) => Number.isInteger(value) && value >= 110 && value <= 300 && value % 5 === 0,
  },
  playbackRate: {
    fallback: 16,
    valid: (value: number) => [1, 2, 4, 8, 16].includes(value),
  },
};

function subscribe(onChange: () => void) {
  const onStorage = () => { memory.clear(); onChange(); };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function usePreference(name: keyof typeof settings) {
  const key = `saopian:preferences:v1:${name}`;
  const { fallback, valid } = settings[name];
  const getSnapshot = useCallback(() => {
    if (memory.has(key)) return memory.get(key)!;
    try {
      const raw = window.localStorage.getItem(key);
      const value = raw === null ? fallback : Number(raw);
      return valid(value) ? value : fallback;
    } catch {
      // Keep controls usable when browser storage is unavailable.
      return memory.get(key) ?? fallback;
    }
  }, [key, fallback, valid]);
  const getServerSnapshot = useCallback(() => fallback, [fallback]);
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const setValue = useCallback((next: number) => {
    if (!valid(next)) return;
    try {
      window.localStorage.setItem(key, String(next));
      memory.delete(key);
    } catch {
      memory.set(key, next);
      // Private mode or quota restrictions must not interrupt browsing.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, [key, valid]);
  return [value, setValue] as const;
}

export function useWorkspacePreferences() {
  const [thumbnailSize, setThumbnailSize] = usePreference("thumbnailSize");
  const [playbackRate, setPlaybackRate] = usePreference("playbackRate");
  return { thumbnailSize, setThumbnailSize, playbackRate, setPlaybackRate };
}
