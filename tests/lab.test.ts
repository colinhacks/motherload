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
  assert.match(out, /broken\.schema\.jsonc\(1,1\): error motherload4: The schema is not valid/);
  assert.match(out, /broken\.schema\.json5\(3,44\): error motherload1: invalid character ','/);
  // A $ref to a file that is not there is placed at the reference.
  assert.match(out, /broken-ref\.schema\.jsonc\(4,35\): error motherload4: The \$ref "\.\/missing\.schema\.jsonc" names a file that does not exist\./);
  // The row after "Émile" starts on line 3; the repeated frontmatter key on line 3 of the file, not of the frontmatter.
  assert.match(out, /broken\.csv\(3,1\): error motherload1: This row has 3 fields; the header has 2\./);
  assert.match(out, /broken\.md\(3,1\): error motherload1: Map keys must be unique/);
  // A broken .md file keeps its default export, so `import md from "./broken.md"` adds no error.
  assert.doesNotMatch(out, /TS1192/);
});

const EXPECTED = '"port":8080,"big":"9007199254740993","started":"1979-05-27T07:32:00.000Z","day":"1979-05-27","tags":2';
// lab/basic/.env, loaded into process.env when `import "./.env"` runs.
const GREETING = '"greeting":"hello world"';
// lab/basic/users.csv, scores.tsv, notes.txt and post.md: strings as written ("02134" keeps its zero), a quoted field with a comma, and the frontmatter and the body apart.
const TABLES = '"zip":"02134","grace":"Hopper, Grace","score":"37","notes":"Notes from the lab.","title":"Hello, Motherload","body":"# Hello"';
// lab/basic/point.schema.json5: an integer, and a label of at most 0x10 characters.
const POINTS = '"points":[true,false,false]';
// lab/basic/team.schema.jsonc: valid, then failing user.schema.jsonc's and shared/place.schema.jsonc's rules through its $refs.
const TEAM = '"team":[true,false,false]';
// lab/basic/event.schema.jsonc: a click and a visit, then a bad date-time, a bad uri and a click with a visit's field; then main.ts's narrowing functions.
// lab/basic/team.schema.jsonc through Standard JSON Schema, in 2020-12 and draft-07: the other two files folded in, its $refs pointers.
const JSON_SCHEMA = '"teamJsonSchema":[["https://json-schema.org/draft/2020-12/schema","#/$defs/user","user,place"],["http://json-schema.org/draft-07/schema#","#/definitions/user","user,place"]]';
const EVENTS = '"events":[true,true,false,false,false],"described":"3,4","clickX":5';
// lab/basic/user.schema.jsonc's validate: the value, then every issue with its path and keyword; `~standard.validate` the same function, a missing property's key ending the path; an array index a number, through team.schema.jsonc's $ref.
const VALIDATE = '"valid":"Ada","invalid":"name: must NOT have fewer than 1 characters; email: must match format \\"email\\"; role: must be equal to one of the allowed values","keywords":["minLength","format","enum"],"standard":[true,["role"]],"memberPath":["members",1,"name"]';

test("lab/basic runs under the preload", () => {
  const { status, out } = run(process.execPath, ["--import", "motherload/register", "main.ts"], `${ROOT}lab/basic`);
  assert.equal(status, 0, out);
  assert.ok(out.includes(EXPECTED), out);
  assert.ok(out.includes(GREETING), out);
  assert.ok(out.includes(TABLES), out);
  assert.ok(out.includes(POINTS), out);
  assert.ok(out.includes(TEAM), out);
  assert.ok(out.includes(EVENTS), out);
  assert.ok(out.includes(JSON_SCHEMA), out);
  assert.ok(out.includes(VALIDATE), out);
});

test("lab/basic bundles with the esbuild plugin and runs with nothing installed", () => {
  rmSync(`${ROOT}lab/basic/dist`, { recursive: true, force: true });
  const built = run(process.execPath, ["build-esbuild.ts"], `${ROOT}lab/basic`);
  assert.equal(built.status, 0, built.out);
  // team.schema.jsonc is one input: the schemas it refers to are compiled into its validator.
  assert.match(built.out, /errors=0 inputs=15 node_modules=0/);
  // The bundle reads .env when it runs; no value from the file is in it.
  assert.doesNotMatch(readFileSync(`${ROOT}lab/basic/dist/main.mjs`, "utf8"), /postgres:\/\/localhost\/app|hello world/);
  const ran = run(process.execPath, ["dist/main.mjs"], `${ROOT}lab/basic`);
  assert.equal(ran.status, 0, ran.out);
  assert.ok(ran.out.includes(EXPECTED), ran.out);
  assert.ok(ran.out.includes(GREETING), ran.out);
  assert.ok(ran.out.includes(TABLES), ran.out);
  assert.ok(ran.out.includes(POINTS), ran.out);
  assert.ok(ran.out.includes(TEAM), ran.out);
  assert.ok(ran.out.includes(EVENTS), ran.out);
  assert.ok(ran.out.includes(JSON_SCHEMA), ran.out);
  assert.ok(ran.out.includes(VALIDATE), ran.out);
});

// lab/packages: three formats, each from its own package, with the JSONC package's hook and plugin
// ahead of the schema package's for a file that ends in both suffixes.
const PACKAGES = '{"name":"packages","fontSize":14,"ada":{"name":"Ada","role":"admin"},"valid":true,"invalid":false}';

test("lab/packages type-checks through three format packages' mappers", () => {
  const { status, out } = run(TSC, ["-p", "lab/packages/tsconfig.json", "--noEmit", "--runExternalCode"]);
  assert.equal(out, "");
  assert.equal(status, 0);
});

test("lab/packages runs under the three packages' preloads", () => {
  const { status, out } = run(process.execPath, ["--import", "@motherload/schema/register", "--import", "@motherload/jsonc/register", "--import", "@motherload/toml/register", "main.ts"], `${ROOT}lab/packages`);
  assert.equal(status, 0, out);
  assert.equal(out.trim(), PACKAGES);
});

test("lab/packages bundles with the three packages' esbuild plugins and runs with nothing installed", () => {
  rmSync(`${ROOT}lab/packages/dist`, { recursive: true, force: true });
  const built = run(process.execPath, ["build-esbuild.ts"], `${ROOT}lab/packages`);
  assert.equal(built.status, 0, built.out);
  assert.match(built.out, /errors=0 inputs=4 node_modules=0/);
  const ran = run(process.execPath, ["dist/main.mjs"], `${ROOT}lab/packages`);
  assert.equal(ran.status, 0, ran.out);
  assert.equal(ran.out.trim(), PACKAGES);
});
