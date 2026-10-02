import { NextRequest } from "next/server";
import { browseDirectory } from "@/lib/media/list-media";
import { PathGuardError } from "@/lib/media/path-guard";
import { getDefaultMediaRoot } from "@/lib/media/default-directory";
import { corsPreflight, jsonWithCors } from "@/lib/media/cors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function OPTIONS(request: NextRequest) {
  return corsPreflight(request);
}

export async function GET(request: NextRequest) {
  const raw =
    request.nextUrl.searchParams.get("path")?.trim() || getDefaultMediaRoot();

  try {
    const result = await browseDirectory(raw);
    return jsonWithCors(request, result);
  } catch (err) {
    const message =
      err instanceof PathGuardError
        ? err.message
        : err instanceof Error
          ? err.message
          : "浏览失败";
    const status = err instanceof PathGuardError ? 400 : 500;
    return jsonWithCors(request, { error: message }, { status });
  }
}
