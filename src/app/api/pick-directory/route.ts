import { NextRequest } from "next/server";
import { pickDirectory } from "@/lib/media/pick-directory";
import { allowedCorsOrigin, corsPreflight, isLoopbackHost, jsonWithCors } from "@/lib/media/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function POST(request: NextRequest) {
  // Native dialog only on the machine running this server.
  if (!isLoopbackHost(request.nextUrl.hostname) || !allowedCorsOrigin(request)) {
    return jsonWithCors(request, { error: "请在运行扫片的电脑上选择目录" }, { status: 403 });
  }
  try {
    return jsonWithCors(request, { path: await pickDirectory() });
  } catch (error) {
    return jsonWithCors(request, { error: error instanceof Error ? error.message : "无法选择目录" }, { status: 500 });
  }
}
