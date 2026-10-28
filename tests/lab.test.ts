// The end-to-end checks: the type check through TypeScript's content mapper, the preload, and the
// esbuild plugin, on lab/basic; the webpack loader under webpack and Rspack and the Vite plugin under
// Vite, Rollup and Rolldown, on lab/bundlers; the loader under Next.js with Turbopack and with
// webpack, on lab/nextjs; and the Jest transformer and the Vite plugin under Vitest, on lab/jest.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stripVTControlCharacters } from "node:util";
import { ROOT, run, TSC } from "./helpers.ts";

test("lab/basic type-checks through the content mapper", () => {
  const { status, out } = run(TSC, ["-p", "lab/basic/tsconfig.json", "--noEmit", "--runExternalCode"]);
  assert.equal(out, "");
  assert.equal(status, 0);
});

test("control: without --runExternalCode the imports do not resolve", () => {
  const { status, out } = run(TSC, ["-p", "lab/basic/tsconfig.json", "--noEmit"]);
  assert.equal(status, 2);
  assert.match(out, /TS2307: Cannot find module '\.\/config\.toml'/);
});

test("a broken file is a diagnostic at its place in the file", () => {
  const { status, out } = run(TSC, ["-p", "tests/fixtures/errors/tsconfig.json", "--noEmit", "--runExternalCode"]);
  assert.equal(status, 2);
  assert.match(out, /broken\.toml\(2,8\): error motherload1: Invalid TOML document: invalid value/);
  assert.match(out, /broken\.yaml\(2,1\): error motherload1: Map keys must be unique/);
  // The row after "Émile" starts on line 3; the repeated frontmatter key on line 3 of the file, not of the frontmatter.
  assert.match(out, /broken\.csv\(3,1\): error motherload1: This row has 3 fields; the header has 2\./);
  assert.match(out, /broken\.md\(3,1\): error motherload1: Map keys must be unique/);
  // A broken .md file keeps its default export, so `import md from "./broken.md"` adds no error.
  assert.doesNotMatch(out, /TS1192/);
  // A syntax error at the very end of a cut-off or empty file is placed there: until 2026-10-26 its
  // span ran a byte past the end, and TypeScript refused the module (TS18069), then the mapper (TS18070).
  assert.match(out, /truncated\.toml\(3,8\): error motherload1: Invalid TOML document: invalid value/);
  assert.match(out, /truncated\.yaml\(3,1\): error motherload1: Flow sequence in block collection must be sufficiently indented/);
  assert.match(out, /truncated\.jsonc\(3,1\): error motherload1: Close Brace Expected/);
  assert.match(out, /truncated\.json5\(3,1\): error motherload1: invalid end of input at 3:1/);
  assert.match(out, /empty\.jsonc\(1,1\): error motherload1: Value Expected/);
  assert.match(out, /empty\.json5\(1,1\): error motherload1: invalid end of input at 1:1/);
  assert.doesNotMatch(out, /TS1806[89]|TS18070/);
});

test("a data file in a package with no \"type\" is an ES module all the same", () => {
  const { status, out } = run(TSC, ["-p", "tests/fixtures/commonjs/tsconfig.json", "--noEmit", "--runExternalCode"]);
  assert.equal(out, "");
  assert.equal(status, 0);
});

const EXPECTED = '"port":8080,"big":"9007199254740993","started":"1979-05-27T07:32:00.000Z","day":"1979-05-27","tags":2';
// lab/basic/.env, loaded into process.env when `import "./.env"` runs under the preload; a bundle
// takes it from the environment, here Node's `--env-file`, and fails without it.
const GREETING = '"greeting":"hello world"';
const UNSET = /Motherload: \.env declares DATABASE_URL, GREETING, PORT, which the environment does not set\./;
// lab/basic/users.csv, scores.tsv, notes.txt and post.md: strings as written ("02134" keeps its zero), a quoted field with a comma, and the frontmatter and the body apart.
const TABLES = '"zip":"02134","grace":"Hopper, Grace","score":"37","notes":"Notes from the lab.","title":"Hello, Motherload","body":"# Hello"';
test("lab/basic runs under the preload", () => {
  const { status, out } = run(process.execPath, ["--import", "motherload/register", "main.ts"], `${ROOT}lab/basic`);
  assert.equal(status, 0, out);
  assert.ok(out.includes(EXPECTED), out);
  assert.ok(out.includes(GREETING), out);
  assert.ok(out.includes(TABLES), out);
});

test("lab/basic bundles with the esbuild plugin and runs with nothing installed", () => {
  rmSync(`${ROOT}lab/basic/dist`, { recursive: true, force: true });
  const built = run(process.execPath, ["build-esbuild.ts"], `${ROOT}lab/basic`);
  assert.equal(built.status, 0, built.out);
  assert.match(built.out, /errors=0 inputs=11 node_modules=0/);
  // The bundle holds no value from .env and reads no file: its variables come from where it runs.
  assert.doesNotMatch(readFileSync(`${ROOT}lab/basic/dist/main.mjs`, "utf8"), /postgres:\/\/localhost\/app|hello world|file:\/\/|readFileSync/);
  const unset = run(process.execPath, ["dist/main.mjs"], `${ROOT}lab/basic`);
  assert.notEqual(unset.status, 0);
  assert.match(unset.out, UNSET);
  const ran = run(process.execPath, ["--env-file=.env", "dist/main.mjs"], `${ROOT}lab/basic`);
  assert.equal(ran.status, 0, ran.out);
  assert.ok(ran.out.includes(EXPECTED), ran.out);
  assert.ok(ran.out.includes(GREETING), ran.out);
  assert.ok(ran.out.includes(TABLES), ran.out);
});

// lab/packages: two formats, each from its own package.
const PACKAGES = '{"name":"packages","port":8080,"fontSize":14}';

test("lab/packages type-checks through two format packages' mappers", () => {
  const { status, out } = run(TSC, ["-p", "lab/packages/tsconfig.json", "--noEmit", "--runExternalCode"]);
  assert.equal(out, "");
  assert.equal(status, 0);
});

test("lab/packages runs under the two packages' preloads", () => {
  const { status, out } = run(process.execPath, ["--import", "@motherload/jsonc/register", "--import", "@motherload/toml/register", "main.ts"], `${ROOT}lab/packages`);
  assert.equal(status, 0, out);
  assert.equal(out.trim(), PACKAGES);
});

test("lab/packages bundles with the two packages' esbuild plugins and runs with nothing installed", () => {
  rmSync(`${ROOT}lab/packages/dist`, { recursive: true, force: true });
  const built = run(process.execPath, ["build-esbuild.ts"], `${ROOT}lab/packages`);
  assert.equal(built.status, 0, built.out);
  assert.match(built.out, /errors=0 inputs=3 node_modules=0/);
  const ran = run(process.execPath, ["dist/main.mjs"], `${ROOT}lab/packages`);
  assert.equal(ran.status, 0, ran.out);
  assert.equal(ran.out.trim(), PACKAGES);
});

// lab/bundlers: lab/basic's files through motherload/webpack and motherload/vite.
for (const [bundler, through, file] of [["webpack", "the webpack loader", "main.cjs"], ["rspack", "the webpack loader", "main.cjs"], ["vite", "the Vite plugin", "main.mjs"], ["rollup", "the Vite plugin", "main.mjs"], ["rolldown", "the Vite plugin", "main.mjs"]] as const) {
  test(`lab/bundlers bundles with ${bundler} through ${through} and runs with nothing installed`, () => {
    rmSync(`${ROOT}lab/bundlers/dist/${bundler}`, { recursive: true, force: true });
    const built = run(process.execPath, ["build.mjs", bundler], `${ROOT}lab/bundlers`);
    assert.equal(built.status, 0, built.out);
    assert.match(built.out, /errors=0 warnings=0 node_modules=0/);
    assert.doesNotMatch(readFileSync(`${ROOT}lab/bundlers/dist/${bundler}/${file}`, "utf8"), /postgres:\/\/localhost\/app|hello world|file:\/\/|readFileSync/);
    const unset = run(process.execPath, [`dist/${bundler}/${file}`], `${ROOT}lab/bundlers`);
    assert.notEqual(unset.status, 0);
    assert.match(unset.out, UNSET);
    const ran = run(process.execPath, ["--env-file=../basic/.env", `dist/${bundler}/${file}`], `${ROOT}lab/bundlers`);
    assert.equal(ran.status, 0, ran.out);
    assert.ok(ran.out.includes(EXPECTED), ran.out);
    assert.ok(ran.out.includes(GREETING), ran.out);
    assert.ok(ran.out.includes(TABLES), ran.out);
  });
}

// lab/nextjs has its own dependencies, installed with `nub install` in lab/nextjs.
const NEXT = `${ROOT}lab/nextjs/node_modules/.bin/next`;
const nextInstalled = existsSync(NEXT) || "lab/nextjs is not installed: run `nub install` in lab/nextjs";
/** The page's two blocks of JSON as the build prerendered them: what the server component and the client component printed. */
function prerendered(): { server: string; client: string } {
  const html = readFileSync(`${ROOT}lab/nextjs/.next/server/app/index.html`, "utf8").replaceAll("&quot;", '"');
  return { server: html.match(/id="server">([^<]*)/)![1]!, client: html.match(/id="client">([^<]*)/)![1]! };
}

test("lab/nextjs type-checks through the content mapper after next typegen", { skip: nextInstalled !== true && nextInstalled }, () => {
  const typegen = run(NEXT, ["typegen"], `${ROOT}lab/nextjs`);
  assert.equal(typegen.status, 0, typegen.out);
  const { status, out } = run(TSC, ["-p", "lab/nextjs/tsconfig.json", "--noEmit", "--runExternalCode"]);
  assert.equal(out, "");
  assert.equal(status, 0);
});

for (const args of [[], ["--webpack"]]) {
  test(`lab/nextjs builds with ${args.length ? "webpack" : "Turbopack"}, the data in the server's and the browser's modules`, { skip: nextInstalled !== true && nextInstalled }, () => {
    rmSync(`${ROOT}lab/nextjs/.next`, { recursive: true, force: true });
    const built = run(NEXT, ["build", ...args], `${ROOT}lab/nextjs`);
    assert.equal(built.status, 0, built.out);
    const { server, client } = prerendered();
    assert.ok(server.includes(EXPECTED), server);
    assert.ok(server.includes(TABLES), server);
    assert.equal(client, '["Ada Lovelace","Hopper, Grace"]');
    // The client component's module is in a browser chunk.
    const chunks = readdirSync(`${ROOT}lab/nextjs/.next/static/chunks`, { recursive: true, encoding: "utf8" }).filter((f) => f.endsWith(".js"));
    assert.ok(chunks.some((f) => readFileSync(`${ROOT}lab/nextjs/.next/static/chunks/${f}`, "utf8").includes("Hopper, Grace")));
  });
}

// lab/jest has its own dependencies, installed with `nub install` in lab/jest. Vitest coloured its
// summary on CI's runners, and Jest colours its own under FORCE_COLOR, so the summaries are matched
// without colour codes.
const JEST = `${ROOT}lab/jest/node_modules/.bin/jest`;
const jestInstalled = existsSync(JEST) || "lab/jest is not installed: run `nub install` in lab/jest";
const jestRun = (config: string, env: Record<string, string> = {}) =>
  spawnSync(JEST, ["-c", config, "--ci", "--no-cache"], { cwd: `${ROOT}lab/jest`, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "", ...env } });

test("lab/jest: a CommonJS test requires lab/basic's files through the Jest transformer", { skip: jestInstalled !== true && jestInstalled }, () => {
  const result = jestRun("jest.cjs.config.cjs");
  assert.equal(result.status, 0, result.stderr);
  assert.match(stripVTControlCharacters(result.stderr), /Tests:\s+1 passed, 1 total/);
});

test("lab/jest: CommonJS and ES module tests load lab/basic's files under --experimental-vm-modules", { skip: jestInstalled !== true && jestInstalled }, () => {
  const result = jestRun("jest.esm.config.cjs", { NODE_OPTIONS: "--experimental-vm-modules" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(stripVTControlCharacters(result.stderr), /Tests:\s+2 passed, 2 total/);
});

test("lab/jest: Vitest imports lab/basic's files through the Vite plugin", { skip: jestInstalled !== true && jestInstalled }, () => {
  const result = spawnSync(`${ROOT}lab/jest/node_modules/.bin/vitest`, ["run"], { cwd: `${ROOT}lab/jest`, encoding: "utf8", env: { ...process.env, NODE_OPTIONS: "" } });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(stripVTControlCharacters(result.stdout), /Tests\s+1 passed \(1\)/);
});

// Vitest keeps each module on disk across runs, keyed by its file's text, its own version, the config
// and the lockfile it can find, so until 2026-10-26 a module came back from the cache as it was when
// the loader's output changed under an unchanged file: a new version of the loader where Vitest sees
// no lockfile, as under nub's layout, and a change to a file the module was made from (`watchFiles`),
// in one run after another and in watch mode. No Motherload format reads a second file, so a project
// outside the repository holds a stand-in on the real adapter, installed as a package: a `.tag` file
// names a file beside it, and its module is the stand-in's version and that file's text.
function vitestProject(): { dir: string; seen: () => string; version: (v: string) => void; name: (text: string) => void } {
  const dir = mkdtempSync(join(tmpdir(), "motherload-vitest-"));
  mkdirSync(join(dir, "node_modules", "@motherload"), { recursive: true });
  symlinkSync(`${ROOT}packages/core`, join(dir, "node_modules", "@motherload", "core"));
  mkdirSync(join(dir, "node_modules", "stand-in"));
  writeFileSync(join(dir, "node_modules", "stand-in", "package.json"), '{ "name": "stand-in", "type": "module", "exports": "./index.mjs" }\n');
  const version = (v: string) =>
    writeFileSync(
      join(dir, "node_modules", "stand-in", "index.mjs"),
      `import { readFileSync } from "node:fs";\nimport { dirname, join } from "node:path";\nimport { toVitePlugin } from "@motherload/core";\n` +
        `const load = (source, path) => { const other = join(dirname(path), source.trim()); return { code: \`export default \${JSON.stringify("${v}:" + readFileSync(other, "utf8"))};\`, problems: [], watchFiles: [other] }; };\n` +
        `export default () => toVitePlugin({ name: "stand-in", extensions: [".tag"], filter: /\\.tag$/, load, types: () => ({ types: "", problems: [] }) });\n`,
    );
  const name = (text: string) => writeFileSync(join(dir, "name.txt"), text);
  writeFileSync(join(dir, "package.json"), '{ "private": true, "type": "module" }\n');
  writeFileSync(join(dir, "vitest.config.mjs"), 'import standIn from "stand-in";\nexport default { plugins: [standIn()], test: { include: ["tag.test.mjs"], globals: true } };\n');
  writeFileSync(join(dir, "app.tag"), "name.txt\n");
  writeFileSync(join(dir, "tag.test.mjs"), 'import { writeFileSync } from "node:fs";\nimport tag from "./app.tag";\ntest("tag", () => writeFileSync(new URL("seen.txt", import.meta.url), tag));\n');
  version("1");
  name("a");
  return { dir, version, name, seen: () => (existsSync(join(dir, "seen.txt")) ? readFileSync(join(dir, "seen.txt"), "utf8") : "") };
}

test("lab/jest: Vitest makes a module again when the loader's output changes between runs", { skip: jestInstalled !== true && jestInstalled }, () => {
  const project = vitestProject();
  try {
    const seen = [];
    for (const [version, name] of [["1", "a"], ["1", "b"], ["2", "b"], ["2", "b"]] as const) {
      project.version(version);
      project.name(name);
      const { status, out } = run(`${ROOT}lab/jest/node_modules/.bin/vitest`, ["run"], project.dir);
      assert.equal(status, 0, out);
      seen.push(project.seen());
    }
    assert.deepEqual(seen, ["1:a", "1:b", "2:b", "2:b"]);
  } finally {
    rmSync(project.dir, { recursive: true, force: true });
  }
});

test("lab/jest: Vitest's watch mode makes a module again when a file it was made from changes", { skip: jestInstalled !== true && jestInstalled }, async () => {
  const project = vitestProject();
  const child = spawn(`${ROOT}lab/jest/node_modules/.bin/vitest`, ["watch"], { cwd: project.dir, env: { ...process.env, NODE_OPTIONS: "" } });
  let out = "";
  child.stdout.on("data", (chunk) => (out += chunk));
  child.stderr.on("data", (chunk) => (out += chunk));
  // Waits for what a run writes, up to 30 seconds.
  const seen = async (expected: string) => {
    for (const end = Date.now() + 30_000; Date.now() < end; await new Promise((resolve) => setTimeout(resolve, 100))) if (project.seen() === expected) return;
    assert.fail(`never ${expected}, the last ${project.seen() || "none"}:\n${out}`);
  };
  try {
    await seen("1:a");
    // Vitest watches files once it has run, so the change comes after the first run's summary.
    for (const end = Date.now() + 30_000; !/Waiting for file changes/.test(out) && Date.now() < end; ) await new Promise((resolve) => setTimeout(resolve, 100));
    project.name("b");
    await seen("1:b");
  } finally {
    if (child.exitCode === null && child.signalCode === null) {
      child.kill();
      await once(child, "exit");
    }
    rmSync(project.dir, { recursive: true, force: true });
  }
});
