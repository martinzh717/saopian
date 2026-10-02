import { LOCAL_SERVER_HINT, mediaOrigin } from "./media-origin";

export async function fetchApiJson(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch {
    throw new Error(mediaOrigin() ? LOCAL_SERVER_HINT : "无法连接本机服务");
  }
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, data: JSON.parse(text) as Record<string, unknown> };
  } catch {
    throw new Error(mediaOrigin() ? LOCAL_SERVER_HINT : "本机服务返回了无效响应");
  }
}
