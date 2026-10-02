import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/media/preview-client.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
let moduleId = 0;
const tick = () => new Promise((resolve) => setImmediate(resolve));
const entry = (name, mtime = 1) => ({ name, path: "/tmp/" + name, kind: "video", mtime, size: 100 });

async function fixture() {
  const videos = [];
  const original = globalThis.document;
  globalThis.document = {
    createElement(tag) {
      if (tag === "canvas") return { getContext: () => ({ drawImage() {} }), toDataURL: () => "data:image/jpeg;base64,test" };
      const video = {
        videoWidth: 1920, videoHeight: 1080, duration: 60, src: "",
        pause() {}, load() {},
        removeAttribute() { this.src = ""; },
      };
      videos.push(video);
      return video;
    },
  };
  const api = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64") + "#" + moduleId++);
  return { api, videos, restore: () => { globalThis.document = original; } };
}

test("visible poster requests decode serially, reuse cache, and invalidate changed files", async () => {
  const f = await fixture();
  try {
    const first = f.api.requestThumbnail(entry("a.mp4"), new AbortController().signal);
    const second = f.api.requestThumbnail(entry("b.mp4"), new AbortController().signal);
    await tick();
    assert.equal(f.videos.length, 1, "one poster decoder at a time");
    f.videos[0].onloadeddata();
    assert.equal((await first).duration, 60);
    await tick();
    assert.equal(f.videos[0].src, "", "finished decoder releases its media source");
    assert.equal(f.videos.length, 2);
    f.videos[1].onloadeddata();
    await second;
    await f.api.requestThumbnail(entry("a.mp4"), new AbortController().signal);
    assert.equal(f.videos.length, 2, "cached file does not decode again");
    const updated = f.api.requestThumbnail(entry("a.mp4", 2), new AbortController().signal);
    await tick();
    assert.equal(f.videos.length, 3);
    f.videos[2].onloadeddata();
    await updated;
  } finally { f.restore(); }
});

test("offscreen cancellation releases active decoder and skips cancelled queued requests", async () => {
  const f = await fixture();
  try {
    const active = new AbortController();
    const queued = new AbortController();
    const first = f.api.requestThumbnail(entry("a.mp4"), active.signal);
    const second = f.api.requestThumbnail(entry("b.mp4"), queued.signal);
    await tick();
    queued.abort();
    active.abort();
    assert.equal(await first, null);
    assert.equal(await second, null);
    assert.equal(f.videos.length, 1);
    assert.equal(f.videos[0].src, "");
    assert.equal(f.videos[0].onloadeddata, null);
  } finally { f.restore(); }
});

test("interactive preview pauses poster work; cancelled waiters do not block resume", async () => {
  const f = await fixture();
  try {
    const release = f.api.holdThumbnailQueue();
    const abort = new AbortController();
    const cancelled = f.api.requestThumbnail(entry("a.mp4"), abort.signal);
    await tick();
    assert.equal(f.videos.length, 0);
    abort.abort();
    assert.equal(await cancelled, null);
    const next = f.api.requestThumbnail(entry("b.mp4"), new AbortController().signal);
    await tick();
    assert.equal(f.videos.length, 0);
    release();
    release(); // Cleanup is idempotent.
    await tick();
    assert.equal(f.videos.length, 1);
    f.videos[0].onloadeddata();
    assert.ok(await next);
  } finally { f.restore(); }
});

test("unsupported media does not prevent subsequent poster generation", async () => {
  const f = await fixture();
  try {
    const failed = f.api.requestThumbnail(entry("bad.mp4"), new AbortController().signal);
    const good = f.api.requestThumbnail(entry("good.mp4"), new AbortController().signal);
    await tick();
    f.videos[0].onerror();
    assert.equal(await failed, null);
    await tick();
    f.videos[1].onloadeddata();
    assert.ok(await good);
  } finally { f.restore(); }
});
