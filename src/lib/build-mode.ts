/** Public web build vs local/portable app. */
export function isWebPublicBuild(): boolean {
  return process.env.SAOPIAN_BUILD === "web";
}

/** Next basePath for the jishuba static site. Empty for local/portable. */
export function getAppBasePath(): string {
  if (process.env.NEXT_PUBLIC_BASE_PATH) {
    return process.env.NEXT_PUBLIC_BASE_PATH.replace(/\/$/, "");
  }
  return isWebPublicBuild() ? "/app/saopian" : "";
}

/** Prefix a site-root path with basePath (for <img href>, downloads, etc.). */
export function withBasePath(path: string): string {
  const base = getAppBasePath();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}
