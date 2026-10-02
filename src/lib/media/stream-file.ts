import fs from "node:fs";
import { Readable } from "node:stream";
import fsp from "node:fs/promises";
import path from "node:path";
import { PathGuardError, resolveMediaPath } from "./path-guard";

const streamState = globalThis as typeof globalThis & {
  saopianOpenStreams?: Map<fs.ReadStream, string>;
};
const openStreams = streamState.saopianOpenStreams ??= new Map<fs.ReadStream, string>();

function trackStream(filePath: string, stream: fs.ReadStream): fs.ReadStream {
  openStreams.set(stream, filePath);
  stream.once("close", () => openStreams.delete(stream));
  return stream;
}

export async function releaseMediaDirectory(rawPath: string): Promise<void> {
  const directory = resolveMediaPath(rawPath);
  const pending: Promise<void>[] = [];
  for (const [stream, filePath] of openStreams) {
    const relative = path.relative(directory, filePath);
    if (path.isAbsolute(relative) || relative === ".." || relative.startsWith(".." + path.sep)) continue;
    if (stream.closed) continue;
    pending.push(new Promise((resolve) => {
      stream.once("close", resolve);
      stream.destroy();
    }));
  }
  await Promise.all(pending);
}

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".m4v": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".mkv": "video/x-matroska",
  ".avi": "video/x-msvideo",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function contentTypeFor(filePath: string): string {
  return MIME[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function streamLocalFile(
  rawPath: string,
  rangeHeader: string | null,
  options: { signal?: AbortSignal; headOnly?: boolean } = {},
): Promise<Response> {
  const filePath = resolveMediaPath(rawPath);
  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    throw new PathGuardError("文件不存在或无法访问");
  }
  if (!stat.isFile()) {
    throw new PathGuardError("路径不是文件");
  }

  const size = stat.size;
  const type = contentTypeFor(filePath);
  const commonHeaders: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": type,
    "Cache-Control": "private, max-age=0, must-revalidate",
  };

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader);
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: { ...commonHeaders, "Content-Range": `bytes */${size}` },
      });
    }

    const suffix = !match[1];
    const first = Number(match[1]);
    const last = Number(match[2]);
    const start = suffix ? Math.max(0, size - last) : first;
    const end = suffix || !match[2] ? size - 1 : Math.min(last, size - 1);

    if (
      (!match[1] && !match[2]) ||
      !Number.isSafeInteger(start) || !Number.isSafeInteger(end) ||
      (suffix && (!Number.isSafeInteger(last) || last <= 0)) ||
      (!suffix && match[2] && !Number.isSafeInteger(last)) ||
      start < 0 || start >= size || start > end
    ) {
      return new Response(null, {
        status: 416,
        headers: { ...commonHeaders, "Content-Range": `bytes */${size}` },
      });
    }

    const chunkSize = end - start + 1;
    const webStream = options.headOnly ? null : nodeToWebStream(
      trackStream(filePath, fs.createReadStream(filePath, { start, end, signal: options.signal })),
    );

    return new Response(webStream, {
      status: 206,
      headers: {
        ...commonHeaders,
        "Content-Range": `bytes ${start}-${end}/${size}`,
        "Content-Length": String(chunkSize),
      },
    });
  }

  const body = options.headOnly ? null : nodeToWebStream(
    trackStream(filePath, fs.createReadStream(filePath, { signal: options.signal })),
  );
  return new Response(body, {
    status: 200,
    headers: {
      ...commonHeaders,
      "Content-Length": String(size),
    },
  });
}

function nodeToWebStream(
  nodeStream: fs.ReadStream,
): ReadableStream<Uint8Array> {
  // Byte-based backpressure: a slow/paused client must not drain an entire SD-card file.
  // Node's adapter also propagates reader cancellation to destroy the file stream.
  return Readable.toWeb(nodeStream, {
    strategy: { highWaterMark: 64 * 1024, size: (chunk: Uint8Array) => chunk.byteLength },
  }) as ReadableStream<Uint8Array>;
}
