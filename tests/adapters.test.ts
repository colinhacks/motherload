import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { plugin } from "../src/plugin.ts";
import { evaluate } from "./helpers.ts";
import { toEsbuildPlugin, toJestTransformer, toNodeHooks, toVitePlugin, toWebpackLoader, utf8Range, type LoaderPlugin } from "../packages/core/src/universal.ts";

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

/** The Vite plugin's `load` with a context that keeps what it is told to watch and throws what it is told is an error. */
function viteLoad(id: string) {
  const context = { watched: [] as string[], addWatchFile(file: string) { this.watched.push(file); }, error(message: string): never { throw new Error(message); } };
  return { result: toVitePlugin(plugin).load.call(context, id), watched: context.watched };
}

test("the Vite plugin loads a data file as JavaScript and leaves an id with a query to other plugins", () => {
  const { result } = viteLoad(join(dir, "app.toml"));
  assert.match(result!.code, /const data = \{"name": "x"\};/);
  assert.equal(result!.moduleType, "js");
  for (const query of ["?raw", "?url", "#x"]) assert.equal(viteLoad(join(dir, "app.toml") + query).result, null, query);
  assert.equal(viteLoad(join(dir, "app.ts")).result, null);
  writeFileSync(join(dir, "bad.toml"), "name = \n");
  assert.throws(() => viteLoad(join(dir, "bad.toml")), /motherload: .*bad\.toml: Invalid TOML document/);
});

const jest = toJestTransformer(plugin);
/** CommonJS code run as Node runs a module: its exports, given `require` and `__filename`. */
const commonJsModule = (code: string, filename: string) => {
  const module = { exports: {} as Record<string, any> };
  new Function("exports", "require", "module", "__filename", code)(module.exports, createRequire(filename), module, filename);
  return module.exports;
};

test("the Jest transformer makes ESM when Jest loads the file as ESM, and CommonJS otherwise", async () => {
  const source = 'name = "x"\n';
  const esm = jest.process(source, join(dir, "app.toml"), { supportsStaticESM: true }).code;
  assert.equal((await evaluate(esm)).default.name, "x");
  const cjs = jest.process(source, join(dir, "app.toml"), { supportsStaticESM: false }).code;
  assert.doesNotMatch(cjs, /^(import|export)\b/m);
  const exports = commonJsModule(cjs, join(dir, "app.toml"));
  assert.equal(exports.__esModule, true);
  assert.equal(exports.default.name, "x");
  // A .md file's named exports, and a string that reads like the code the rewrite changes, kept as it is.
  const md = jest.process('---\ntitle: "import.meta.url"\n---\nexport default 1\n', join(dir, "post.md"), { supportsStaticESM: false }).code;
  const post = commonJsModule(md, join(dir, "post.md"));
  assert.equal(post.frontmatter.title, "import.meta.url");
  assert.equal(post.md, "export default 1\n");
  assert.equal(post.default.md, post.md);
  assert.throws(() => jest.process("name = \n", join(dir, "bad.toml"), { supportsStaticESM: false }), /bad\.toml: Invalid TOML document/);
});

test("the Jest transformer's cache key follows the module and how Jest loads it", () => {
  const key = (source: string, esm: boolean) => jest.getCacheKey(source, join(dir, "app.toml"), { supportsStaticESM: esm, configString: "{}" });
  assert.equal(key('name = "x"\n', false), key('name = "x"\n', false));
  assert.notEqual(key('name = "x"\n', false), key('name = "y"\n', false));
  assert.notEqual(key('name = "x"\n', false), key('name = "x"\n', true));
});

test("ranges convert from UTF-16 code units to UTF-8 bytes", () => {
  assert.deepEqual(utf8Range("é = x", 4, 1), { start: 5, length: 1 });
  assert.deepEqual(utf8Range("a = 😀", 4, 2), { start: 4, length: 4 });
});
