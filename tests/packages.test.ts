// The package family (DESIGN.md, "Packaging"): @motherload/core, a package per format, and
// motherload, which combines them. Each format package's manifest, and the rule
// that of two Motherload packages in one host the one claiming the longer suffix of a file loads
// it, in whatever order the host was given them, as TypeScript routes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { standalone, toBunPlugin, toEsbuildPlugin, toNodeHooks, type LoaderPlugin } from "../packages/core/src/index.ts";
import { loader as jsonc } from "../packages/jsonc/src/loader.ts";
import { loader as schema } from "../packages/schema/src/loader.ts";
import { loaders, plugin } from "../src/plugin.ts";
import { ROOT } from "./helpers.ts";

const FORMATS = ["toml", "yaml", "json5", "jsonc", "env", "csv", "txt", "md", "schema"];
const root = JSON.parse(readFileSync(`${ROOT}package.json`, "utf8"));
const manifest = (name: string) => JSON.parse(readFileSync(`${ROOT}packages/${name}/package.json`, "utf8"));

test("each package is private in the repository, at motherload's version, and linked into it", () => {
  for (const name of ["core", ...FORMATS]) {
    const pkg = manifest(name);
    assert.equal(pkg.name, `@motherload/${name}`);
    assert.equal(pkg.version, root.version, name);
    assert.equal(pkg.private, true, name);
    assert.equal(root.dependencies[pkg.name], `link:packages/${name}`, name);
    for (const [dep, version] of Object.entries(pkg.dependencies ?? {})) {
      // A package's own dependencies are installed at the root, from which its sources resolve them.
      if (dep.startsWith("@motherload/")) assert.equal(version, root.version, `${name}: ${dep}`);
      else assert.equal(root.dependencies[dep], version, `${name}: ${dep}`);
    }
  }
});

test("each format package has its loader, preload, esbuild plugin and mapper", () => {
  for (const name of FORMATS) {
    const pkg = manifest(name);
    const dir = `${ROOT}packages/${name}/`;
    for (const entry of ["./loader", "./register", "./esbuild"]) assert.ok(existsSync(dir + pkg.exports[entry]), `${name} ${entry}`);
    assert.deepEqual(pkg.typescript.contentMapper.exec, ["node", "src/mapper.ts"], name);
    assert.ok(existsSync(`${dir}src/mapper.ts`), name);
  }
});

test("motherload reads every format package's extensions", () => {
  assert.deepEqual(plugin.extensions, loaders.flatMap((l) => l.extensions));
});

const dir = mkdtempSync(join(tmpdir(), "motherload-packages-"));
writeFileSync(join(dir, "user.schema.jsonc"), '{ "type": "string" }\n');
writeFileSync(join(dir, "app.jsonc"), '{ "a": 1 }\n');
const JSONC = standalone(jsonc);
const SCHEMA = standalone(schema);
const next = () => ({ format: "next", source: "", shortCircuit: true }) as any;
const nodeLoad = (p: LoaderPlugin, registered: LoaderPlugin[], file: string) => toNodeHooks(p, registered).load!(pathToFileURL(join(dir, file)).href, {} as any, next) as any;

test("Node: the JSONC package's hook leaves a schema file to the schema package's, whichever was registered first", () => {
  for (const registered of [[JSONC, SCHEMA], [SCHEMA, JSONC]]) {
    assert.equal(nodeLoad(JSONC, registered, "user.schema.jsonc").format, "next");
    assert.match(nodeLoad(SCHEMA, registered, "user.schema.jsonc").source, /vendor: "motherload"/);
    assert.match(nodeLoad(JSONC, registered, "app.jsonc").source, /const data = \{"a": 1\};/);
  }
  // Alone, the JSONC package reads a schema file as data, as TypeScript routes it with no schema entry.
  assert.match(nodeLoad(JSONC, [JSONC], "user.schema.jsonc").source, /const data = \{"type": "string"\};/);
});

test("Bun: a schema file the JSONC package's plugin is asked for is loaded with the schema package", () => {
  const loads: ((args: { path: string }) => { contents: string })[] = [];
  toBunPlugin(JSONC, [JSONC, SCHEMA]).setup({ onLoad: (_options, callback) => void loads.push(callback) });
  assert.match(loads[0]!({ path: join(dir, "user.schema.jsonc") }).contents, /vendor: "motherload"/);
  assert.match(loads[0]!({ path: join(dir, "app.jsonc") }).contents, /const data = \{"a": 1\};/);
});

test("esbuild: the schema plugin loads a schema file, before or after the JSONC plugin", async () => {
  writeFileSync(join(dir, "main.ts"), 'import user from "./user.schema.jsonc"; import app from "./app.jsonc"; console.log(user.is("x"), user.is(1), app.a);');
  for (const plugins of [[toEsbuildPlugin(JSONC), toEsbuildPlugin(SCHEMA)], [toEsbuildPlugin(SCHEMA), toEsbuildPlugin(JSONC)]]) {
    const out = await build({ entryPoints: [join(dir, "main.ts")], bundle: true, write: false, format: "esm", plugins, logLevel: "silent" });
    const text = out.outputFiles[0]!.text;
    assert.match(text, /vendor: "motherload"/);
    assert.match(text, /\{ "a": 1 \}|a: 1/);
  }
});
