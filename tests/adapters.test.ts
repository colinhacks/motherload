import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { plugin } from "../src/plugin.ts";
import { toEsbuildPlugin, toNodeHooks, toWebpackLoader, utf8Range, type LoaderPlugin } from "../packages/core/src/universal.ts";

const dir = mkdtempSync(join(tmpdir(), "motherload-adapters-"));
writeFileSync(join(dir, "app.toml"), 'name = "x"\n');

test("the Node hook loads a data file and leaves a query or hash to the next hook", () => {
  const hooks = toNodeHooks(plugin);
  const next = () => ({ format: "next", source: "", shortCircuit: true }) as any;
  const url = pathToFileURL(join(dir, "app.toml")).href;
  const loaded = hooks.load!(url, {} as any, next) as any;
  assert.equal(loaded.format, "module");
  assert.match(loaded.source, /const data = \{"name": "x"\};/);
  for (const suffix of ["?raw", "?url", "#raw"]) assert.equal((hooks.load!(url + suffix, {} as any, next) as any).format, "next", suffix);
});

test("esbuild leaves a query to other plugins", async () => {
  writeFileSync(join(dir, "raw.ts"), 'import text from "./app.toml?raw"; console.log(text);');
  await assert.rejects(build({ entryPoints: [join(dir, "raw.ts")], bundle: true, write: false, plugins: [toEsbuildPlugin(plugin)], logLevel: "silent" }), /No loader is configured for ".toml" files/);
});

// Every extension Motherload reads (plugin.ts names them in its unknown-extension message).
const EXTENSIONS = [".toml", ".yaml", ".yml", ".json5", ".jsonc", ".env", ".csv", ".tsv", ".txt", ".md"];

test("the plugin's filter, which the Node hook and esbuild match on, takes every extension Motherload reads", () => {
  for (const ext of EXTENSIONS) assert.ok(plugin.filter.test(`every${ext}`), ext);
});

test("esbuild watches the other files a loader names, and still does when the module fails", () => {
  // No Motherload format reads another file; the contract carries them for a loader that does.
  const reader: LoaderPlugin = {
    name: "reader",
    extensions: [".ref"],
    filter: /\.ref$/,
    load: (source, path) => {
      const other = join(dirname(path), source.trim());
      return existsSync(other) ? { code: `export default ${JSON.stringify(readFileSync(other, "utf8"))};`, problems: [], watchFiles: [other] } : { code: "", problems: [{ message: `${source.trim()} does not exist.`, start: 0, length: 1, code: 1 }], watchFiles: [other] };
    },
    types: () => ({ types: "", problems: [] }),
  };
  writeFileSync(join(dir, "tag.txt"), "x");
  writeFileSync(join(dir, "good.ref"), "tag.txt");
  writeFileSync(join(dir, "lost.ref"), "gone.txt");
  let onLoad: ((args: { path: string; suffix?: string }) => any) | undefined;
  toEsbuildPlugin(reader).setup({ onLoad: (_options, callback) => void (onLoad = callback) });
  const good = onLoad!({ path: join(dir, "good.ref") });
  assert.equal(good.loader, "js");
  assert.deepEqual(good.watchFiles, [join(dir, "tag.txt")]);
  const lost = onLoad!({ path: join(dir, "lost.ref") });
  assert.match(lost.errors[0].text, /gone\.txt does not exist\./);
  assert.deepEqual(lost.watchFiles, [join(dir, "gone.txt")]);
  let data: ((args: { path: string; suffix?: string }) => any) | undefined;
  toEsbuildPlugin(plugin).setup({ onLoad: (_options, callback) => void (data = callback) });
  assert.deepEqual(data!({ path: join(dir, "app.toml") }).watchFiles, []);
});

/** A webpack loader's context for one file: its path, its query, and the files it was told to watch. */
const loaderContext = (path: string, resourceQuery = "") => ({ resourcePath: path, resourceQuery, watched: [] as string[], addDependency(file: string) { this.watched.push(file); } });

test("the webpack loader makes a data file's module and passes a file with a query through as it came", () => {
  const loader = toWebpackLoader(plugin);
  const path = join(dir, "app.toml");
  assert.match(loader.call(loaderContext(path), 'name = "x"\n'), /const data = \{"name": "x"\};/);
  for (const query of ["?raw", "?url"]) assert.equal(loader.call(loaderContext(path, query), 'name = "x"\n'), 'name = "x"\n', query);
  assert.throws(() => loader.call(loaderContext(path), "name = \n"), /motherload: .*app\.toml: Invalid TOML document/);
});

test("the webpack loader watches the other files a loader names, and still does when the module fails", () => {
  const reader: LoaderPlugin = {
    name: "reader",
    extensions: [".ref"],
    filter: /\.ref$/,
    load: (source, path) => ({ code: "export default 1;", problems: source ? [] : [{ message: "empty", start: 0, length: 1, code: 1 }], watchFiles: [join(dirname(path), "tag.txt")] }),
    types: () => ({ types: "", problems: [] }),
  };
  const loader = toWebpackLoader(reader);
  const good = loaderContext(join(dir, "good.ref"));
  loader.call(good, "tag.txt");
  assert.deepEqual(good.watched, [join(dir, "tag.txt")]);
  const lost = loaderContext(join(dir, "lost.ref"));
  assert.throws(() => loader.call(lost, ""), /reader: .*lost\.ref: empty/);
  assert.deepEqual(lost.watched, [join(dir, "tag.txt")]);
});

test("ranges convert from UTF-16 code units to UTF-8 bytes", () => {
  assert.deepEqual(utf8Range("é = x", 4, 1), { start: 5, length: 1 });
  assert.deepEqual(utf8Range("a = 😀", 4, 2), { start: 4, length: 4 });
});
