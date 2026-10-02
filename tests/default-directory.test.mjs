import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const source = await readFile(new URL("../src/lib/media/default-directory.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { resolveDefaultMediaRoot } = await import("data:text/javascript;base64," + Buffer.from(outputText).toString("base64"));

test("macOS uses the current user's Movies folder", () => {
  assert.equal(resolveDefaultMediaRoot("darwin", "/Users/小明"), "/Users/小明/Movies");
});
test("Windows honors the actual redirected Videos folder", () => {
  assert.equal(resolveDefaultMediaRoot("win32", "C:\\Users\\User", " D:\\我的视频\r\n"), "D:\\我的视频");
  assert.equal(resolveDefaultMediaRoot("win32", "C:\\Users\\User", "\\\\server\\share\\Videos"), "\\\\server\\share\\Videos");
});
test("Windows falls back when the system query is empty or invalid", () => {
  for (const result of ["", "relative-folder"]) {
    assert.equal(resolveDefaultMediaRoot("win32", "C:\\Users\\User", result), "C:\\Users\\User\\Videos");
  }
});
test("other platforms use Videos under home", () => {
  assert.equal(resolveDefaultMediaRoot("linux", "/home/user"), "/home/user/Videos");
});
