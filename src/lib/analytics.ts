/**
 * Umami loader for 扫片 public site on jishuba.cn.
 * Management API keys never belong here — only the public Website ID.
 */

export const UMAMI_WEBSITE_ID = "63358055-613e-4134-9940-e94e4c8f7dcf";
export const UMAMI_SCRIPT_URL = "https://jishuba.cn/um/script.js";
const TRACKER_ID = "saopian-umami";

declare global {
  interface Window {
    umami?: { track: (name: string, data?: Record<string, string>) => void | Promise<unknown> };
  }
}

function isProdBuild(): boolean {
  return process.env.NODE_ENV === "production";
}

function enabled() {
  return isProdBuild() && typeof window !== "undefined" && window.location.hostname === "jishuba.cn";
}

export function loadAnalytics() {
  if (!enabled() || document.getElementById(TRACKER_ID)) return;
  const script = document.createElement("script");
  script.id = TRACKER_ID;
  script.defer = true;
  script.src = UMAMI_SCRIPT_URL;
  script.dataset.websiteId = UMAMI_WEBSITE_ID;
  script.dataset.domains = "jishuba.cn";
  script.dataset.hostUrl = "https://jishuba.cn/um";
  script.dataset.excludeHash = "true";
  document.head.appendChild(script);
}

/** Optional helper for custom events. Never throw into UX. */
export function trackEvent(name: string, data: Record<string, string> = {}) {
  if (!enabled()) return;
  try {
    void Promise.resolve(window.umami?.track(name, data)).catch(() => {});
  } catch {
    // Analytics is optional.
  }
}
