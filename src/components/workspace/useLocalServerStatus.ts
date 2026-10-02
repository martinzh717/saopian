"use client";

import { useEffect, useState } from "react";
import {
  localServerMode,
  probeLocalServer,
  type LocalServerStatus,
} from "@/lib/media/local-server-status";

const OFFLINE_POLL_MS = 4000;
const ONLINE_POLL_MS = 12000;

/** Polls 127.0.0.1 media origin on the public site; embedded/portable is always online. */
export function useLocalServerStatus(): LocalServerStatus {
  const mode = localServerMode();
  const [state, setState] = useState<LocalServerStatus["state"]>(
    mode === "embedded" ? "online" : "checking",
  );

  useEffect(() => {
    if (mode === "embedded") {
      setState("online");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = { current: null as AbortController | null };

    const schedule = (delay: number) => {
      timer = setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      const online = await probeLocalServer(abort.signal);
      if (cancelled || abort.signal.aborted) return;
      setState(online ? "online" : "offline");
      schedule(online ? ONLINE_POLL_MS : OFFLINE_POLL_MS);
    };

    void tick();

    const onVisible = () => {
      if (document.hidden) return;
      if (timer) clearTimeout(timer);
      void tick();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller.current?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [mode]);

  return { mode, state };
}
