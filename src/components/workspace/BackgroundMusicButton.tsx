"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Music } from "lucide-react";
import { bgmSrc, pickRandomBgmTrack } from "@/lib/bgm/tracks";

const BGM_VOLUME = 0.35;

type Props = {
  /** Music only audibly plays while auto-preview is running. */
  autoPreview: boolean;
};

/**
 * Opt-in BGM: the icon enables/disables wanting music.
 * Playback follows auto-preview — play with preview, pause with preview.
 * New random track when starting without a paused clip; track end advances randomly while both are on.
 */
export function BackgroundMusicButton({ autoPreview }: Props) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastIdRef = useRef<string | undefined>(undefined);
  const hasTrackRef = useRef(false);
  const enabledRef = useRef(false);
  const autoPreviewRef = useRef(autoPreview);
  const failStreakRef = useRef(0);
  const [enabled, setEnabled] = useState(false);

  enabledRef.current = enabled;
  autoPreviewRef.current = autoPreview;

  const ensureAudio = useCallback(() => {
    let audio = audioRef.current;
    if (!audio) {
      audio = new Audio();
      audio.preload = "auto";
      audio.volume = BGM_VOLUME;
      audioRef.current = audio;
    }
    return audio;
  }, []);

  const clearAudio = useCallback(() => {
    failStreakRef.current = 0;
    hasTrackRef.current = false;
    const audio = audioRef.current;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
  }, []);

  const playRandomRef = useRef<() => void>(() => {});
  playRandomRef.current = () => {
    if (!enabledRef.current || !autoPreviewRef.current) return;
    const track = pickRandomBgmTrack(lastIdRef.current);
    lastIdRef.current = track.id;
    const audio = ensureAudio();
    audio.onended = () => {
      failStreakRef.current = 0;
      hasTrackRef.current = false;
      if (enabledRef.current && autoPreviewRef.current) playRandomRef.current();
    };
    audio.onerror = () => {
      failStreakRef.current += 1;
      hasTrackRef.current = false;
      if (!enabledRef.current || !autoPreviewRef.current || failStreakRef.current >= 4) {
        clearAudio();
        return;
      }
      playRandomRef.current();
    };
    hasTrackRef.current = true;
    audio.src = bgmSrc(track.path);
    void audio.play().catch(() => {
      /* Autoplay may fail until a gesture; preview click usually counts. */
    });
  };

  const syncPlayback = useCallback(() => {
    if (!enabledRef.current) {
      clearAudio();
      return;
    }
    const audio = ensureAudio();
    if (!autoPreviewRef.current) {
      audio.pause();
      return;
    }
    if (hasTrackRef.current) {
      void audio.play().catch(() => {
        hasTrackRef.current = false;
        playRandomRef.current();
      });
      return;
    }
    playRandomRef.current();
  }, [clearAudio, ensureAudio]);

  useEffect(() => {
    syncPlayback();
  }, [enabled, autoPreview, syncPlayback]);

  useEffect(() => () => {
    enabledRef.current = false;
    const audio = audioRef.current;
    audioRef.current = null;
    if (!audio) return;
    audio.onended = null;
    audio.onerror = null;
    audio.pause();
    audio.removeAttribute("src");
  }, []);

  return (
    <button
      type="button"
      className={`tool-button folder-picker-trigger${enabled ? " is-open" : ""}`}
      aria-label={enabled ? "关闭背景音乐" : "启用背景音乐"}
      title={enabled ? "关闭背景音乐（随自动预览播放/暂停）" : "启用背景音乐（随自动预览播放/暂停）"}
      aria-pressed={enabled}
      onClick={() => setEnabled((value) => !value)}
    >
      <Music size={17} aria-hidden="true" />
    </button>
  );
}
