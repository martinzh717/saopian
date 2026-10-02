import assert from "node:assert/strict";
import fs from "node:fs";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import ts from "typescript";

const moduleUrl = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString("base64");
const sourceAt = (file) => readFile(new URL("../src/lib/media/" + file, import.meta.url), "utf8");
const defaults = moduleUrl(await sourceAt("default-directory.ts"));
const guard = moduleUrl((await sourceAt("path-guard.ts")).replace('"./default-directory"', JSON.stringify(defaults)));
const { allowSelectedMediaDirectory } = await import(guard);
const { streamLocalFile, releaseMediaDirectory } = await import(moduleUrl((await sourceAt("stream-file.ts")).replace('"./path-guard"', JSON.stringify(guard))));

test("media transport: bounded read-ahead, cancellation, HEAD and byte ranges", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "saopian-stream-"));
  allowSelectedMediaDirectory(dir);
  const filename = path.join(dir, "sample.mp4");
  const bytes = Buffer.alloc(8 * 1024 * 1024, 7);
  bytes[bytes.length - 1] = 9;
  await writeFile(filename, bytes);
  const original = fs.createReadStream;
  let latest;
  let opens = 0;
  fs.createReadStream = (...args) => { opens++; latest = original(...args); return latest; };
  try {
    const response = await streamLocalFile(filename, "bytes=0-");
    await delay(80);
    assert.ok(latest.bytesRead <= 256 * 1024, `unconsumed response read ${latest.bytesRead} bytes`);
    assert.equal(response.status, 206);
    await response.body.cancel();
    await delay(20);
    assert.equal(latest.destroyed, true);

    const held = await streamLocalFile(filename, null);
    await delay(20);
    const heldStream = latest;
    await releaseMediaDirectory(dir);
    assert.equal(heldStream.closed, true, "explicit directory release closes paused file handles");
    await held.body.cancel().catch(() => {});

    const beforeHead = opens;
    const head = await streamLocalFile(filename, null, { headOnly: true });
    assert.equal(head.body, null);
    assert.equal(head.headers.get("content-length"), String(bytes.length));
    assert.equal(opens, beforeHead, "HEAD must not open a read stream");

    const suffix = await streamLocalFile(filename, "bytes=-3");
    assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), Buffer.from([7, 7, 9]));
    const clamped = await streamLocalFile(filename, `bytes=${bytes.length - 2}-${bytes.length + 100}`);
    assert.deepEqual(Buffer.from(await clamped.arrayBuffer()), Buffer.from([7, 9]));
    for (const range of ["bytes=-", "bytes=-0", "bytes=99-1", `bytes=${bytes.length}-`]) {
      assert.equal((await streamLocalFile(filename, range)).status, 416, range);
    }

    const controller = new AbortController();
    const aborted = await streamLocalFile(filename, null, { signal: controller.signal });
    controller.abort();
    await assert.rejects(aborted.arrayBuffer());
    assert.equal(latest.destroyed, true);
  } finally {
    fs.createReadStream = original;
    await rm(dir, { recursive: true, force: true });
  }
});
