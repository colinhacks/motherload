// The end-to-end checks: the type check through TypeScript's content mapper, the preload, and the
// esbuild plugin, on lab/basic; the webpack loader under webpack and Rspack, on lab/bundlers, and
// under Next.js with Turbopack and with webpack, on lab/nextjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
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
});

test("a data file in a package with no \"type\" is an ES module all the same", () => {
  const { status, out } = run(TSC, ["-p", "tests/fixtures/commonjs/tsconfig.json", "--noEmit", "--runExternalCode"]);
  assert.equal(out, "");
  assert.equal(status, 0);
});

const EXPECTED = '"port":8080,"big":"9007199254740993","started":"1979-05-27T07:32:00.000Z","day":"1979-05-27","tags":2';
// lab/basic/.env, loaded into process.env when `import "./.env"` runs.
const GREETING = '"greeting":"hello world"';
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
  // The bundle reads .env when it runs; no value from the file is in it.
  assert.doesNotMatch(readFileSync(`${ROOT}lab/basic/dist/main.mjs`, "utf8"), /postgres:\/\/localhost\/app|hello world/);
  const ran = run(process.execPath, ["dist/main.mjs"], `${ROOT}lab/basic`);
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

// lab/bundlers: lab/basic's files through motherload/webpack-loader.
for (const bundler of ["webpack", "rspack"]) {
  test(`lab/bundlers bundles with ${bundler} through the webpack loader and runs with nothing installed`, () => {
    rmSync(`${ROOT}lab/bundlers/dist/${bundler}`, { recursive: true, force: true });
    const built = run(process.execPath, ["build.mjs", bundler], `${ROOT}lab/bundlers`);
    assert.equal(built.status, 0, built.out);
    assert.match(built.out, /errors=0 warnings=0 node_modules=0/);
    assert.doesNotMatch(readFileSync(`${ROOT}lab/bundlers/dist/${bundler}/main.cjs`, "utf8"), /postgres:\/\/localhost\/app|hello world/);
    const ran = run(process.execPath, [`dist/${bundler}/main.cjs`], `${ROOT}lab/bundlers`);
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
