import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { plugin } from "../src/plugin.ts";
import { toEsbuildPlugin, toNodeHooks, utf8Range } from "../src/universal.ts";

const dir = mkdtempSync(join(tmpdir(), "motherload-adapters-"));
writeFileSync(join(dir, "app.toml"), 'name = "x"\n');

test("the Node hook loads a data file and leaves a query to the next hook", () => {
  const hooks = toNodeHooks(plugin);
  const next = () => ({ format: "next", source: "", shortCircuit: true }) as any;
  const url = pathToFileURL(join(dir, "app.toml")).href;
  const loaded = hooks.load!(url, {} as any, next) as any;
  assert.equal(loaded.format, "module");
  assert.match(loaded.source, /const data = \{"name": "x"\};/);
  assert.equal((hooks.load!(`${url}?raw`, {} as any, next) as any).format, "next");
});

test("esbuild leaves an import with a query to other plugins", async () => {
  writeFileSync(join(dir, "main.ts"), 'import text from "./app.toml?raw"; console.log(text);');
  await assert.rejects(build({ entryPoints: [join(dir, "main.ts")], bundle: true, write: false, plugins: [toEsbuildPlugin(plugin)], logLevel: "silent" }), /No loader is configured for ".toml" files/);
});

test("ranges convert from UTF-16 code units to UTF-8 bytes", () => {
  assert.deepEqual(utf8Range("é = x", 4, 1), { start: 5, length: 1 });
  assert.deepEqual(utf8Range("a = 😀", 4, 2), { start: 4, length: 4 });
});
