/** Set the public origin when a public site is deployed; local installs have none. */
export function getSiteUrl(): URL | undefined {
  const value = process.env.SITE_URL?.trim();
  if (!value) return undefined;
  const url = new URL(value);
  if (!["https:", "http:"].includes(url.protocol)) {
    throw new Error("SITE_URL must be an absolute HTTP(S) URL.");
  }
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
    throw new Error("SITE_URL must contain only the public origin, without credentials, path, query or hash.");
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]") {
    throw new Error("Leave SITE_URL unset for local installations.");
  }
  return url;
}
