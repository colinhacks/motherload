// The `strict` option: an import of a `.env` file that does not exist fails, as any missing module
// does, unless the project's tsconfig entry turns `strict` off, when it loads as the module of an
// empty file, which reads the file when it runs. Each host finds the setting in tsconfig itself,
// from the importer's directory; a missing file of any other format always fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { build } from "esbuild";
import { rolldown } from "rolldown";
import { rollup } from "rollup";
import { build as viteBuild } from "vite";
import { isStrict } from "../packages/core/src/tsconfig.ts";
import motherloadEsbuild from "../src/esbuild.ts";
import motherloadVite from "../src/vite.ts";
import { ROOT, run } from "./helpers.ts";

/** A directory outside the repository holding `files`, by path, at its real path, as the hosts name a module. */
function project(files: Record<string, string>): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "motherload-strict-")));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
  }
  return dir;
}

const entry = (strict?: unknown) => JSON.stringify({ package: "motherload", extensions: [".env", ".toml"], ...(strict === undefined ? {} : { options: { strict } }) });

test("the setting is read from the nearest tsconfig.json, the configs it extends and the configs it references", () => {
  const off = `{ "contentMappers": [${entry(false)}] }`;
  // In tsconfig.json itself, written as JSONC, from a directory below it.
  assert.equal(isStrict(join(project({ "tsconfig.json": `{\n  // comment\n  "contentMappers": [${entry(false)},], /* comment */\n}\n`, "src/a.ts": "" }), "src")), false);
  // Behind `references`, as Vite's template keeps its config in tsconfig.app.json, and in a referenced directory.
  assert.equal(isStrict(project({ "tsconfig.json": '{ "files": [], "references": [{ "path": "./tsconfig.node.json" }, { "path": "./tsconfig.app.json" }] }', "tsconfig.node.json": "{}", "tsconfig.app.json": off })), false);
  assert.equal(isStrict(project({ "tsconfig.json": '{ "references": [{ "path": "./app" }] }', "app/tsconfig.json": off })), false);
  // Through `extends`, a path with or without `.json`, a list, and a package's config.
  assert.equal(isStrict(project({ "tsconfig.json": '{ "extends": "./base" }', "base.json": off })), false);
  assert.equal(isStrict(project({ "tsconfig.json": '{ "extends": ["./other.json", "./base.json"] }', "other.json": "{}", "base.json": off })), false);
  assert.equal(isStrict(project({ "tsconfig.json": '{ "extends": "shared" }', "node_modules/shared/tsconfig.json": off })), false);
  // The `.env` file's packages only.
  assert.equal(isStrict(project({ "tsconfig.json": `{ "contentMappers": [{ "package": "@motherload/env", "extensions": [".env"], "options": { "strict": false } }] }` })), false);
  assert.equal(isStrict(project({ "tsconfig.json": `{ "contentMappers": [{ "package": "@motherload/toml", "extensions": [".toml"], "options": { "strict": false } }] }` })), true);
  // Strict: no options, `strict: true`, a `strict` that is not false, no tsconfig.
  assert.equal(isStrict(project({ "tsconfig.json": `{ "contentMappers": [${entry()}] }` })), true);
  assert.equal(isStrict(project({ "tsconfig.json": `{ "contentMappers": [${entry(true)}] }` })), true);
  assert.equal(isStrict(project({ "tsconfig.json": `{ "contentMappers": [${entry("no")}] }` })), true);
  assert.equal(isStrict(project({ "a.ts": "" })), true);
});

// Two projects that import a missing `local.env`, `.env.toml` and `gone.toml`, each entry printing a
// variable no file sets: one that turns `strict` off behind `references`, and one with no options.
const PRINT = 'console.log("X=" + (process.env.MOTHERLOAD_STRICT_PROBE ?? "unset"));\n';
function hostProject(strict: boolean): string {
  const tsconfig = strict
    ? { "tsconfig.json": `{ "contentMappers": [${entry()}] }` }
    : { "tsconfig.json": '{ "files": [], "references": [{ "path": "./tsconfig.app.json" }] }', "tsconfig.app.json": `{ "contentMappers": [${entry(false)}] }` };
  const dir = project({
    ...tsconfig,
    "package.json": '{ "private": true, "type": "module" }\n',
    "local.js": `import "./local.env";\n${PRINT}`,
    "envtoml.js": `import "./.env.toml";\n${PRINT}`,
    "toml.js": `import "./gone.toml";\n${PRINT}`,
    "nub.jsonc": '{ "preload": ["motherload/register"] }\n',
    "bun-build.mjs": 'import motherload from "motherload/esbuild";\nawait Bun.build({ entrypoints: [process.argv[2]], outdir: "dist/bun", target: "node", plugins: [motherload()], throw: true });\n',
    "vitest.config.mjs": 'import motherload from "motherload/vite";\nexport default { plugins: [motherload()], test: { include: ["probe.test.js"], globals: true } };\n',
  });
  mkdirSync(join(dir, "node_modules"));
  symlinkSync(ROOT, join(dir, "node_modules", "motherload"));
  return dir;
}
const LENIENT = hostProject(false);
const STRICT = hostProject(true);

type Outcome = { status: number | null; out: string };
/** A bundler's build of one entry, run when it builds. */
async function bundled(dir: string, file: string, make: (out: string) => Promise<unknown>): Promise<Outcome> {
  const out = join(dir, "dist", `${file}.mjs`);
  try {
    await make(out);
  } catch (error: any) {
    return { status: 1, out: stripVTControlCharacters(error.errors?.map((e: { text: string }) => e.text).join("\n") || String(error.message)) };
  }
  return run(process.execPath, [out], dir);
}

/** nub with the project's nub.jsonc, which nub reads only without the NODE_COMPAT that `node --test` runs under here. */
function nub(file: string, dir: string): Outcome {
  const { NODE_COMPAT, ...env } = process.env;
  const result = spawnSync("nub", [file], { cwd: dir, encoding: "utf8", env: { ...env, NODE_OPTIONS: "" } });
  return { status: result.status, out: `${result.stdout}${result.stderr}` };
}

const bun = spawnSync("bun", ["--version"]).status === 0 || "Bun is not installed";
const VITEST = `${ROOT}lab/jest/node_modules/.bin/vitest`;
const vitest = spawnSync(VITEST, ["--version"]).status === 0 || "lab/jest is not installed: run `nub install` in lab/jest";

const HOSTS: [name: string, skip: true | string, attempt: (dir: string, file: string) => Outcome | Promise<Outcome>, notFound: RegExp][] = [
  ["Node", true, (dir, file) => run(process.execPath, ["--import", "motherload/register", file], dir), /ERR_MODULE_NOT_FOUND\]: Cannot find module '.*\/local\.env' imported from/],
  ["nub", true, (dir, file) => nub(file, dir), /ERR_MODULE_NOT_FOUND\]: Cannot find module '.*\/local\.env' imported from/],
  ["Bun", bun, (dir, file) => run("bun", ["--preload", "motherload/register", file], dir), /Cannot find module '\.\/local\.env' from/],
  [
    "Bun.build",
    bun,
    (dir, file) => {
      const built = run("bun", ["bun-build.mjs", file], dir);
      return built.status === 0 ? run(process.execPath, [`dist/bun/${file}`], dir) : built;
    },
    /Could not resolve: "\.\/local\.env"/,
  ],
  ["esbuild", true, (dir, file) => bundled(dir, file, (out) => build({ entryPoints: [join(dir, file)], bundle: true, platform: "node", format: "esm", outfile: out, plugins: [motherloadEsbuild()], logLevel: "silent" })), /Could not resolve "\.\/local\.env"/],
  [
    "Vite",
    true,
    (dir, file) =>
      bundled(dir, file, (out) =>
        viteBuild({ configFile: false, logLevel: "silent", root: dir, plugins: [motherloadVite()], build: { ssr: join(dir, file), outDir: join(out, ".."), emptyOutDir: false, rollupOptions: { output: { entryFileNames: `${file}.mjs` } } } }),
      ),
    /Could not resolve '\.\/local\.env' in .*local\.js/,
  ],
  ["Rollup", true, (dir, file) => bundled(dir, file, async (out) => (await rollup({ input: join(dir, file), plugins: [motherloadVite()], onLog: () => {} })).write({ file: out, format: "es" })), /Could not resolve "\.\/local\.env" from ".*local\.js"/],
  ["Rolldown", true, (dir, file) => bundled(dir, file, async (out) => (await rolldown({ input: join(dir, file), plugins: [motherloadVite()], onLog: () => {} })).write({ file: out, format: "es" })), /Could not resolve '\.\/local\.env' in .*local\.js/],
  [
    "Vitest",
    vitest,
    (dir, file) => {
      writeFileSync(join(dir, "probe.test.js"), `import "./${file}";\ntest("probe", () => {});\n`);
      return run(VITEST, ["run"], dir);
    },
    // Vitest hands the plugin's cache key the import as written, which the plugin reads as it did before `strict`.
    /ENOENT: no such file or directory, open '\.\/local\.env'/,
  ],
];

for (const [name, skip, attempt, notFound] of HOSTS) {
  test(`${name}: a missing local.env loads nothing under strict: false and fails by default; a missing .env.toml or .toml fails either way`, { skip: skip !== true && skip }, async () => {
    const lenient = await attempt(LENIENT, "local.js");
    assert.equal(lenient.status, 0, lenient.out);
    assert.match(stripVTControlCharacters(lenient.out), name === "Vitest" ? /Tests\s+1 passed/ : /X=unset/);
    const strict = await attempt(STRICT, "local.js");
    assert.notEqual(strict.status, 0, strict.out);
    assert.match(strict.out, notFound);
    for (const [file, missing] of [["envtoml.js", /\.env\.toml/], ["toml.js", /gone\.toml/]] as const) {
      const other = await attempt(LENIENT, file);
      assert.notEqual(other.status, 0, other.out);
      assert.match(other.out, missing);
    }
  });
}
