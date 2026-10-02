import { mediaApiUrl, mediaOrigin } from "./media-origin";

export type LocalServerMode = "embedded" | "remote";

export type LocalServerStatus = {
  /** embedded = page is the portable/local app; remote = public site expecting :8025 */
  mode: LocalServerMode;
  /** Prefer online/offline after first probe; checking only while first remote probe runs. */
  state: "checking" | "online" | "offline";
};

/** Same-origin portable/dev has no MEDIA_ORIGIN — the page itself is the local app. */
export function localServerMode(): LocalServerMode {
  return mediaOrigin() ? "remote" : "embedded";
}

/** True if anything answers at the media API (CORS/network errors mean offline). */
export async function probeLocalServer(signal?: AbortSignal): Promise<boolean> {
  const url = mediaApiUrl("/api/browse");
  try {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      signal,
      mode: mediaOrigin() ? "cors" : "same-origin",
      credentials: "omit",
    });
    // Any HTTP reply means the local process is up (browse may 4xx/5xx for path reasons).
    return response.status > 0;
  } catch {
    return false;
  }
}
