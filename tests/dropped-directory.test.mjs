import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const moduleUrl = (source) => "data:text/javascript;base64," + Buffer.from(ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText).toString("base64");
const types = moduleUrl(await readFile(new URL("../src/lib/media/types.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/media/dropped-directory.ts", import.meta.url), "utf8")).replace('"./types"', JSON.stringify(types));
const { DroppedDirectory } = await import(moduleUrl(source));
const file = (name) => ({ name, isDirectory: false, file(resolve) { resolve(new File(["video"], name, { lastModified: 100 })); } });
const directory = (name, batches) => ({
  name, isDirectory: true,
  createReader() { let i = 0; return { readEntries(resolve) { resolve(batches[i++] ?? []); } }; },
});

test("dropped folders read every batch, sort/filter media and support subdirectories", async () => {
  const root = directory("相机素材", [Array.from({ length: 100 }, (_, i) => file(`clip${i + 1}.MP4`)), [file("cover.jpg"), file("notes.txt"), directory("子目录", [[file("child.MOV")]])]]);
  const session = new DroppedDirectory(root);
  try {
    const result = await session.browse(session.rootPath);
    assert.equal(result.entries.length, 102);
    assert.equal(result.parent, null);
    assert.equal(result.entries[0].kind, "dir");
    assert.equal(result.entries[1].name, "clip1.MP4");
    assert.ok(result.entries[1].previewUrl.startsWith("blob:"));
    assert.equal((await fetch(result.entries[1].previewUrl)).status, 200);
    assert.equal(await session.browse(session.rootPath), result, "revisit reuses object URLs");
    const child = await session.browse(result.entries[0].path);
    assert.equal(child.parent, session.rootPath);
    assert.equal(child.entries[0].name, "child.MOV");
    const url = child.entries[0].previewUrl;
    session.dispose();
    await assert.rejects(fetch(url), "release revokes browser file access");
    await assert.rejects(session.browse(session.rootPath));
  } finally { session.dispose(); }
});

test("release during async enumeration prevents new object URLs from being created", async () => {
  let finish;
  const session = new DroppedDirectory({ name: "slow", createReader() { return { readEntries(resolve) { finish = resolve; } }; } });
  const pending = session.browse(session.rootPath);
  session.dispose();
  finish([file("video.mp4")]);
  await assert.rejects(pending);
});
