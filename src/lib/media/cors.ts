import { NextResponse } from "next/server";

const NAMED_ORIGINS = new Set([
  "https://jishuba.cn",
  "http://127.0.0.1:8025",
  "http://localhost:8025",
]);

export function allowedCorsOrigin(request: Request): string | null {
  const origin = request.headers.get("origin");
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (NAMED_ORIGINS.has(origin)) return origin;
    if (["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) return origin;
  } catch {
    return null;
  }
  return null;
}

export function isLoopbackHost(hostname: string): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
}

export function corsHeaders(request: Request): Record<string, string> {
  const origin = allowedCorsOrigin(request) ?? "https://jishuba.cn";
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Range, Access-Control-Request-Private-Network",
    "Access-Control-Expose-Headers": "Accept-Ranges, Content-Length, Content-Range, Content-Type",
    "Access-Control-Allow-Private-Network": "true",
    Vary: "Origin",
  };
}

export function corsPreflight(request: Request): Response {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
}

export function applyCors(response: Response, request: Request): Response {
  const headers = corsHeaders(request);
  for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
  return response;
}

export function jsonWithCors(request: Request, body: unknown, init?: { status?: number }) {
  const response = NextResponse.json(body, init);
  return applyCors(response, request);
}
