import { NextRequest } from "next/server";
import { PathGuardError } from "@/lib/media/path-guard";
import { streamLocalFile } from "@/lib/media/stream-file";
import { applyCors, corsPreflight, jsonWithCors } from "@/lib/media/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("path")?.trim();
  if (!raw) {
    return jsonWithCors(request, { error: "缺少 path" }, { status: 400 });
  }

  try {
    const response = await streamLocalFile(raw, request.headers.get("range"), {
      signal: request.signal, headOnly: request.method === "HEAD",
    });
    return applyCors(response, request);
  } catch (err) {
    const message =
      err instanceof PathGuardError
        ? err.message
        : err instanceof Error
          ? err.message
          : "读取失败";
    const status = err instanceof PathGuardError ? 400 : 500;
    return jsonWithCors(request, { error: message }, { status });
  }
}

export async function HEAD(request: NextRequest) {
  return GET(request);
}
