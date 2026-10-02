/** Local media server origin. Empty = same-origin (portable / pnpm start). */
export function mediaOrigin(): string {
  return (process.env.NEXT_PUBLIC_MEDIA_ORIGIN ?? "").replace(/\/$/, "");
}

export function mediaApiUrl(path: string): string {
  const origin = mediaOrigin();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return origin ? `${origin}${normalized}` : normalized;
}

export const LOCAL_SERVER_HINT =
  "本机扫片程序未启动，或浏览器拦了本地连接。请先双击「扫片」打开本地服务，再在本页打开目录。";

export function mediaCrossOrigin(): "anonymous" | undefined {
  return mediaOrigin() ? "anonymous" : undefined;
}
