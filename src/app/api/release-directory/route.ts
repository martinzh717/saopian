import { NextRequest } from "next/server";
import { releaseMediaDirectory } from "@/lib/media/stream-file";
import { allowedCorsOrigin, corsPreflight, isLoopbackHost, jsonWithCors } from "@/lib/media/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function POST(request: NextRequest) {
  if (!isLoopbackHost(request.nextUrl.hostname) || !allowedCorsOrigin(request)) {
    return jsonWithCors(request, { error: "仅允许本机服务处理释放请求" }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (typeof body.path !== "string" || !body.path) {
      return jsonWithCors(request, { error: "缺少目录路径" }, { status: 400 });
    }
    await releaseMediaDirectory(body.path);
    return jsonWithCors(request, { released: true });
  } catch {
    return jsonWithCors(request, { error: "无法释放该目录" }, { status: 400 });
  }
}
