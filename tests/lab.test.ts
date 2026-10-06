// The end-to-end checks: the type check through TypeScript's content mapper, the preload, and the
// esbuild plugin, on lab/basic.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, rmSync } from "node:fs";
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
  assert.match(out, /broken\.schema\.json\(1,1\): error motherload4: The schema is not valid/);
  // The row after "Émile" starts on line 3; the repeated frontmatter key on line 3 of the file, not of the frontmatter.
  assert.match(out, /broken\.csv\(3,1\): error motherload1: This row has 3 fields; the header has 2\./);
  assert.match(out, /broken\.md\(3,1\): error motherload1: Map keys must be unique/);
});

const EXPECTED = '"port":8080,"big":"9007199254740993","started":"1979-05-27T07:32:00.000Z","day":"1979-05-27","raw":"# A TOML file with each kind of value.","tags":2';
// lab/basic/.env, loaded into process.env when `import "./.env"` runs.
const GREETING = '"greeting":"hello world"';
// lab/basic/users.csv, scores.tsv, notes.txt and post.md: strings as written ("02134" keeps its zero), a quoted field with a comma, the frontmatter and the body apart, and `?raw` the whole file.
const TABLES = '"zip":"02134","grace":"Hopper, Grace","score":"37","notes":"Notes from the lab.","title":"Hello, Motherload","body":"# Hello","postRaw":"---"';

test("lab/basic runs under the preload", () => {
  const { status, out } = run(process.execPath, ["--import", "motherload/register", "main.ts"], `${ROOT}lab/basic`);
  assert.equal(status, 0, out);
  assert.ok(out.includes(EXPECTED), out);
  assert.ok(out.includes(GREETING), out);
  assert.ok(out.includes(TABLES), out);
  assert.ok(out.includes('"invalid":"name: must NOT have fewer than 1 characters; email: must match format \\"email\\"; role: must be equal to one of the allowed values"'), out);
});

test("lab/basic bundles with the esbuild plugin and runs with nothing installed", () => {
  rmSync(`${ROOT}lab/basic/dist`, { recursive: true, force: true });
  const built = run(process.execPath, ["build-esbuild.ts"], `${ROOT}lab/basic`);
  assert.equal(built.status, 0, built.out);
  assert.match(built.out, /errors=0 inputs=14 node_modules=0/);
  // The bundle reads .env when it runs; no value from the file is in it.
  assert.doesNotMatch(readFileSync(`${ROOT}lab/basic/dist/main.mjs`, "utf8"), /postgres:\/\/localhost\/app|hello world/);
  const ran = run(process.execPath, ["dist/main.mjs"], `${ROOT}lab/basic`);
  assert.equal(ran.status, 0, ran.out);
  assert.ok(ran.out.includes(EXPECTED), ran.out);
  assert.ok(ran.out.includes(GREETING), ran.out);
  assert.ok(ran.out.includes(TABLES), ran.out);
});
