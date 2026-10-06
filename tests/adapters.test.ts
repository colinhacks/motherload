import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { FILTER } from "../src/formats.ts";
import { plugin } from "../src/plugin.ts";
import { toEsbuildPlugin, toNodeHooks, utf8Range } from "../src/universal.ts";

const dir = mkdtempSync(join(tmpdir(), "motherload-adapters-"));
writeFileSync(join(dir, "app.toml"), 'name = "x"\n');

test("the Node hook loads a data file, gives `?raw` its text and leaves another query to the next hook", () => {
  const hooks = toNodeHooks(plugin);
  const next = () => ({ format: "next", source: "", shortCircuit: true }) as any;
  const url = pathToFileURL(join(dir, "app.toml")).href;
  const loaded = hooks.load!(url, {} as any, next) as any;
  assert.equal(loaded.format, "module");
  assert.match(loaded.source, /const data = \{"name": "x"\};/);
  const raw = hooks.load!(`${url}?raw`, {} as any, next) as any;
  assert.equal(raw.format, "module");
  assert.equal(raw.source, 'export default "name = \\"x\\"\\n";\n');
  assert.equal((hooks.load!(`${url}?url`, {} as any, next) as any).format, "next");
});

test("esbuild gives `?raw` the file's text and leaves another query to other plugins", async () => {
  writeFileSync(join(dir, "raw.ts"), 'import text from "./app.toml?raw"; console.log(text);');
  const raw = await build({ entryPoints: [join(dir, "raw.ts")], bundle: true, write: false, format: "esm", plugins: [toEsbuildPlugin(plugin)], logLevel: "silent" });
  assert.ok(raw.outputFiles[0]!.text.includes('name = "x"\\n'), raw.outputFiles[0]!.text);
  writeFileSync(join(dir, "url.ts"), 'import text from "./app.toml?url"; console.log(text);');
  await assert.rejects(build({ entryPoints: [join(dir, "url.ts")], bundle: true, write: false, plugins: [toEsbuildPlugin(plugin)], logLevel: "silent" }), /No loader is configured for ".toml" files/);
});

// Every extension Motherload reads (plugin.ts names them in its unknown-extension message).
const EXTENSIONS = [".toml", ".yaml", ".yml", ".json5", ".jsonc", ".env", ".csv", ".tsv", ".txt", ".md", ".schema.json"];

test("`?raw` is typed by client.d.ts and served by the Node hook and esbuild for every extension", async () => {
  const client = readFileSync(new URL("../src/client.d.ts", import.meta.url), "utf8");
  const hooks = toNodeHooks(plugin);
  const next = () => ({ format: "next", source: "", shortCircuit: true }) as any;
  for (const ext of EXTENSIONS) {
    assert.ok(FILTER.test(`every${ext}`), ext);
    assert.ok(client.includes(`declare module "*${ext}?raw"`), ext);
    writeFileSync(join(dir, `every${ext}`), `the text of ${ext}\n`);
    const raw = hooks.load!(`${pathToFileURL(join(dir, `every${ext}`)).href}?raw`, {} as any, next) as any;
    assert.equal(raw.source, `export default ${JSON.stringify(`the text of ${ext}\n`)};\n`, ext);
  }
  writeFileSync(join(dir, "every.ts"), EXTENSIONS.map((ext, i) => `import t${i} from "./every${ext}?raw";\nconsole.log(t${i});`).join("\n"));
  const bundle = await build({ entryPoints: [join(dir, "every.ts")], bundle: true, write: false, format: "esm", plugins: [toEsbuildPlugin(plugin)], logLevel: "silent" });
  for (const ext of EXTENSIONS) assert.ok(bundle.outputFiles[0]!.text.includes(`the text of ${ext}`), ext);
});

test("ranges convert from UTF-16 code units to UTF-8 bytes", () => {
  assert.deepEqual(utf8Range("é = x", 4, 1), { start: 5, length: 1 });
  assert.deepEqual(utf8Range("a = 😀", 4, 2), { start: 4, length: 4 });
});
