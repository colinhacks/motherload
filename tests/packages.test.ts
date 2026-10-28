// The package family (DESIGN.md, "Packaging"): @motherload/core, a package per format, and
// motherload, which combines them. Each format package's manifest, and the rule
// that of two Motherload packages in one host the one claiming the longer suffix of a file loads
// it, in whatever order the host was given them, as TypeScript routes it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { rspack } from "@rspack/core";
import { rolldown } from "rolldown";
import { rollup } from "rollup";
import { build as viteBuild } from "vite";
import webpack from "webpack";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { standalone, toBunPlugin, toEsbuildPlugin, toNodeHooks, toVitePlugin, type LoaderPlugin } from "../packages/core/src/index.ts";
import { loader as jsonc } from "../packages/jsonc/src/loader.ts";
import { loader as json5 } from "../packages/json5/src/loader.ts";
import { loaders, plugin } from "../src/plugin.ts";
import { ROOT } from "./helpers.ts";

const FORMATS = ["toml", "yaml", "json5", "jsonc", "env", "csv", "txt", "md"];
type NodeHooks = ReturnType<typeof toNodeHooks>;
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

test("each format package has its loader, preload, bundler plugins, Jest transformer and mapper", () => {
  for (const name of FORMATS) {
    const pkg = manifest(name);
    const dir = `${ROOT}packages/${name}/`;
    for (const entry of ["./loader", "./register", "./esbuild", "./webpack", "./turbopack", "./vite", "./jest"]) assert.ok(existsSync(dir + pkg.exports[entry]), `${name} ${entry}`);
    assert.deepEqual(pkg.typescript.contentMapper.exec, ["node", "src/mapper.ts"], name);
    assert.ok(existsSync(`${dir}src/mapper.ts`), name);
  }
});

test("motherload reads every format package's extensions", () => {
  assert.deepEqual(plugin.extensions, loaders.flatMap((l) => l.extensions));
});

const dir = mkdtempSync(join(tmpdir(), "motherload-packages-"));
writeFileSync(join(dir, "user.schema.jsonc"), '{ "type": "string" }\n');
writeFileSync(join(dir, "user.schema.json5"), "{ type: 'string' }\n");
writeFileSync(join(dir, "app.jsonc"), '{ "a": 1 }\n');
writeFileSync(join(dir, "app.json5"), "{ a: 1 }\n");
const JSONC = standalone(jsonc);
const JSON5 = standalone(json5);

// A loader of another package that claims a longer suffix, as dotschema claims `.schema.jsonc` and
// `.schema.json5`. It is written here with nothing from @motherload/core, as a package with its own
// copy of the contract would be: it joins Motherload's loaders through the two global keys alone,
// the process-wide set of registered loaders and the key an esbuild plugin object carries its loader under.
const STAND_IN: LoaderPlugin = {
  name: "stand-in",
  extensions: [".schema.jsonc", ".schema.json5"],
  filter: /\.schema\.json[c5]$/,
  load: () => ({ code: 'export default "stand-in";\n', problems: [] }),
  types: () => ({ types: "declare const data: string;\nexport default data;\n", problems: [] }),
};
const registered = (globalThis as Record<symbol, unknown>)[Symbol.for("motherload.registered")] as Set<LoaderPlugin>;
const standInHooks: NodeHooks = {
  load: (url, context, nextLoad) => (STAND_IN.filter.test(url) ? { format: "module", source: STAND_IN.load("", fileURLToPath(url)).code, shortCircuit: true } : nextLoad(url, context)),
};
const standInEsbuild = {
  name: "stand-in",
  [Symbol.for("motherload.plugin")]: STAND_IN,
  setup(build: { onLoad(options: { filter: RegExp }, callback: () => { contents: string; loader: "js" }): void }) {
    build.onLoad({ filter: STAND_IN.filter }, () => ({ contents: STAND_IN.load("", "").code, loader: "js" }));
  },
};

/** Node's chain of load hooks, the one registered last first, each one's next the one before it. */
function chain(hooks: NodeHooks[], url: string): { format: string; source: string } {
  const at = (i: number): any => (i < 0 ? { format: "end", source: "" } : hooks[i]!.load!(url, {} as any, () => at(i - 1)));
  return at(hooks.length - 1);
}

test("Node: the JSONC and JSON5 packages' hooks leave a longer suffix to the loader registered for it, in either order", () => {
  registered.add(JSONC).add(JSON5).add(STAND_IN);
  try {
    const ours = [toNodeHooks(JSONC), toNodeHooks(JSON5)];
    for (const hooks of [[...ours, standInHooks], [standInHooks, ...ours]]) {
      const load = (file: string) => chain(hooks, pathToFileURL(join(dir, file)).href).source;
      assert.equal(load("user.schema.jsonc"), 'export default "stand-in";\n');
      assert.equal(load("user.schema.json5"), 'export default "stand-in";\n');
      assert.match(load("app.jsonc"), /const data = \{"a": 1\};/);
      assert.match(load("app.json5"), /const data = \{"a": 1\};/);
    }
  } finally {
    registered.clear();
  }
  // With nothing registered for the longer suffix, a schema file is JSONC or JSON5 data, as TypeScript routes it with no entry for that suffix.
  assert.match(chain([toNodeHooks(JSONC, [JSONC])], pathToFileURL(join(dir, "user.schema.jsonc")).href).source, /const data = \{"type": "string"\};/);
  assert.match(chain([toNodeHooks(JSON5, [JSON5])], pathToFileURL(join(dir, "user.schema.json5")).href).source, /const data = \{"type": "string"\};/);
});

test("Bun: a file the JSONC or JSON5 package's plugin is asked for is loaded with the loader that claims its longer suffix", () => {
  registered.add(STAND_IN);
  try {
    for (const ours of [JSONC, JSON5]) {
      const loads: ((args: { path: string }) => { contents: string })[] = [];
      toBunPlugin(ours).setup({ onResolve: () => {}, onLoad: (_options, callback) => void loads.push(callback) });
      const ext = ours === JSONC ? "jsonc" : "json5";
      assert.equal(loads[0]!({ path: join(dir, `user.schema.${ext}`) }).contents, 'export default "stand-in";\n');
      assert.match(loads[0]!({ path: join(dir, `app.${ext}`) }).contents, /const data = \{"a": 1\};/);
    }
  } finally {
    registered.clear();
  }
});

test("esbuild: the JSONC and JSON5 plugins leave a longer suffix to the plugin that claims it, before or after them", async () => {
  writeFileSync(join(dir, "main.ts"), 'import a from "./user.schema.jsonc"; import b from "./user.schema.json5"; import c from "./app.jsonc"; import d from "./app.json5"; console.log(a, b, c.a, d.a);');
  const ours = [toEsbuildPlugin(JSONC), toEsbuildPlugin(JSON5)];
  for (const plugins of [[...ours, standInEsbuild], [standInEsbuild, ...ours]]) {
    const out = await build({ entryPoints: [join(dir, "main.ts")], bundle: true, write: false, format: "esm", plugins: plugins as any, logLevel: "silent" });
    const text = out.outputFiles[0]!.text;
    assert.equal(text.match(/"stand-in"/g)?.length, 2);
    assert.doesNotMatch(text, /"string"/);
    assert.match(text, /\{ "a": 1 \}|a: 1/);
  }
});

// The stand-in as a webpack loader: a module whose function carries its loader under the key.
writeFileSync(
  join(dir, "stand-in-loader.cjs"),
  'module.exports = Object.assign(() => \'export default "stand-in";\\n\', { [Symbol.for("motherload.plugin")]: { name: "stand-in", extensions: [".schema.jsonc", ".schema.json5"], filter: /\\.schema\\.json[c5]$/ } });\n',
);

for (const [name, bundler] of [["webpack", webpack], ["Rspack", rspack]] as const) {
  test(`${name}: the JSONC and JSON5 loaders pass a longer suffix through to the loader whose rule claims it, before or after theirs`, async () => {
    writeFileSync(join(dir, "main.js"), 'import a from "./user.schema.jsonc"; import b from "./user.schema.json5"; import c from "./app.jsonc"; import d from "./app.json5"; console.log(a, b, c.a, d.a);');
    const ours = [
      { test: /\.jsonc$/, use: `${ROOT}packages/jsonc/src/webpack.ts` },
      { test: /\.json5$/, use: `${ROOT}packages/json5/src/webpack.ts` },
    ];
    const standIn = { test: /\.schema\.json[c5]$/, use: join(dir, "stand-in-loader.cjs") };
    for (const [i, rules] of [[...ours, standIn], [standIn, ...ours]].entries()) {
      const output = join(dir, `${name}-${i}`);
      const config = { mode: "none", context: dir, entry: "./main.js", target: "node", output: { path: output, filename: "main.js" }, module: { rules } };
      const stats: any = await new Promise((resolve, reject) => (bundler as any)(config, (error: Error | null, stats: unknown) => (error ? reject(error) : resolve(stats))));
      assert.equal(stats.hasErrors(), false, stats.toString());
      const text = readFileSync(join(output, "main.js"), "utf8");
      assert.equal(text.match(/"stand-in"/g)?.length, 2, text);
      assert.doesNotMatch(text, /"type": "string"|type: 'string'/);
      assert.equal(text.match(/\{"a": 1\}/g)?.length, 2, text);
    }
  });
}

// The stand-in as a Rollup-shaped plugin, its object marked with its loader as an esbuild plugin object is.
const standInVite = {
  name: "stand-in",
  [Symbol.for("motherload.plugin")]: STAND_IN,
  load: (id: string) => (STAND_IN.filter.test(id) ? { code: STAND_IN.load("", id).code, moduleType: "js" } : null),
};

for (const name of ["Rollup", "Rolldown", "Vite"] as const) {
  test(`${name}: the JSONC and JSON5 plugins leave a longer suffix to the plugin that claims it, before or after them`, async () => {
    writeFileSync(join(dir, "main.js"), 'import a from "./user.schema.jsonc"; import b from "./user.schema.json5"; import c from "./app.jsonc"; import d from "./app.json5"; console.log(a, b, c.a, d.a);');
    const ours = [toVitePlugin(JSONC), toVitePlugin(JSON5)];
    for (const plugins of [[...ours, standInVite], [standInVite, ...ours]]) {
      let text: string;
      if (name === "Vite") {
        const out: any = await viteBuild({ configFile: false, logLevel: "silent", root: dir, plugins: plugins as any, build: { write: false, ssr: join(dir, "main.js"), minify: false } });
        text = out.output[0].code;
      } else {
        const bundle = await (name === "Rollup" ? rollup : rolldown)({ input: join(dir, "main.js"), plugins: plugins as any, onLog: () => {} } as any);
        text = (await bundle.generate({ format: "es" })).output[0].code;
      }
      assert.equal(text.match(/"stand-in"/g)?.length, 2, text);
      assert.doesNotMatch(text, /"type": "string"/);
      assert.equal(text.match(/\{\s*"?a"?: 1\s*\}/g)?.length, 2, text);
    }
  });
}
