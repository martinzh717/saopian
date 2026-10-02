import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { test } from "node:test";
import ts from "typescript";

const transpile = (source) => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const url = (source) => "data:text/javascript;base64," + Buffer.from(transpile(source)).toString("base64");
const defaultModule = url(await readFile(new URL("../src/lib/media/default-directory.ts", import.meta.url), "utf8"));
const source = (await readFile(new URL("../src/lib/media/path-guard.ts", import.meta.url), "utf8")).replace('"./default-directory"', JSON.stringify(defaultModule));
const { resolveMediaPath, allowSelectedMediaDirectory } = await import(url(source));

test("native selection grants only the selected folder and descendants", () => {
  const root = path.parse(os.homedir()).root;
  const selected = path.join(root, "saopian-test-external", "chosen");
  assert.throws(() => resolveMediaPath(selected));
  allowSelectedMediaDirectory(selected);
  assert.equal(resolveMediaPath(selected), selected);
  assert.equal(resolveMediaPath(path.join(selected, "clip.mp4")), path.join(selected, "clip.mp4"));
  assert.throws(() => resolveMediaPath(selected + "-other"));
  assert.throws(() => resolveMediaPath(path.join(selected, "..", "private")));
});
test("invalid dialog outputs cannot create grants", () => {
  assert.throws(() => allowSelectedMediaDirectory("relative"));
  assert.throws(() => allowSelectedMediaDirectory("/bad\0path"));
});
