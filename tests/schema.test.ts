import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schemaCode, schemaTypes } from "../src/schema.ts";
import { evaluate, ROOT } from "./helpers.ts";

const PATH = join(ROOT, "tests/fixtures/user.schema.json");
const SCHEMA = JSON.stringify({
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "User",
  type: "object",
  properties: { name: { type: "string", minLength: 1 }, tags: { type: "array", items: { type: "object" }, uniqueItems: true } },
  required: ["name"],
  additionalProperties: false,
});

test("the module validates with ajv's standalone code and imports nothing", async () => {
  const { code, problems } = schemaCode(SCHEMA, PATH);
  assert.deepEqual(problems, []);
  assert.doesNotMatch(code, /^import /m);
  const { default: user, raw } = await evaluate(code);
  assert.equal(raw, SCHEMA);
  assert.equal(user.is({ name: "Ada" }), true);
  assert.equal(user.is({ name: "" }), false);
  // uniqueItems over objects needs ajv's `equal` helper, which is inlined.
  assert.equal(user.is({ name: "Ada", tags: [{ a: 1 }, { a: 1 }] }), false);
  assert.deepEqual(user.parse({ name: "Ada" }), { name: "Ada" });
  assert.throws(() => user.parse({ name: "", extra: 1 }), (e: any) => e instanceof TypeError && (e as any).issues.length === 2);
  const result = user["~standard"].validate({ tags: [] });
  assert.equal(result.issues.length, 1);
  assert.equal(user["~standard"].vendor, "motherload");
  assert.equal(user.schema.title, "User");
});

test("an issue's path is the instance path, unescaped", async () => {
  const { code } = schemaCode(JSON.stringify({ type: "object", properties: { "a/b": { type: "array", items: { type: "number" } } } }), PATH);
  const { default: s } = await evaluate(code);
  const result = s["~standard"].validate({ "a/b": [1, "x"] });
  assert.deepEqual(result.issues[0].path, ["a/b", "1"]);
});

test("the types name the root Type whatever its title", async () => {
  const { types, problems } = await schemaTypes(SCHEMA, PATH);
  assert.deepEqual(problems, []);
  assert.match(types, /export interface Type \{/);
  assert.match(types, /declare const schema: __MotherloadSchema<Type, \{ readonly \$schema: "https:\/\/json-schema.org\/draft\/2020-12\/schema";/);
});

test("a $ref to another file is a problem, not a read", async () => {
  const { problems } = await schemaTypes(JSON.stringify({ type: "object", properties: { a: { $ref: "./other.schema.json" } } }), PATH);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.message, /resolve reference \.\/other\.schema\.json/);
});

test("an invalid schema is a problem in both texts", async () => {
  const invalid = JSON.stringify({ type: "object", properties: { a: { type: "strng" } } });
  assert.match((await schemaTypes(invalid, PATH)).problems[0]!.message, /not valid/);
  assert.match(schemaCode(invalid, PATH).problems[0]!.message, /not valid/);
});

test("draft-04 is refused with the drafts ajv validates", () => {
  const { problems } = schemaCode(JSON.stringify({ $schema: "http://json-schema.org/draft-04/schema#", type: "string" }), PATH);
  assert.match(problems[0]!.message, /drafts 06, 07, 2019-09 and 2020-12/);
});

test("outside a project with the peers, each text says what to install", async () => {
  const dir = mkdtempSync(join(tmpdir(), "motherload-no-peers-"));
  const path = join(dir, "a.schema.json");
  writeFileSync(path, SCHEMA);
  assert.match((await schemaTypes(SCHEMA, path)).problems[0]!.message, /needs json-schema-to-typescript/);
  assert.match(schemaCode(SCHEMA, path).problems[0]!.message, /needs ajv/);
});
