import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { CODES } from "../packages/core/src/problems.ts";
import { schemaCode, schemaTypes } from "../packages/schema/src/schema.ts";
import { evaluate, ROOT } from "./helpers.ts";

const PATH = join(ROOT, "tests/fixtures/user.schema.jsonc");
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
  const { default: user, ...rest } = await evaluate(code);
  assert.deepEqual(Object.keys(rest), []);
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

test("the types name the root Type whatever its title", () => {
  const { types, problems } = schemaTypes(SCHEMA, PATH);
  assert.deepEqual(problems, []);
  assert.match(types, /export interface Type \{/);
  assert.match(types, /declare const schema: __MotherloadSchema<Type, \{ readonly \$schema: "https:\/\/json-schema.org\/draft\/2020-12\/schema";/);
});

test("a schema is JSONC: comments and trailing commas are read in both texts", async () => {
  const source = '{\n  // a user\n  "type": "object",\n  "properties": { "name": { "type": "string" }, },\n  "required": ["name"], /* closed */ "additionalProperties": false,\n}';
  const typed = schemaTypes(source, PATH);
  assert.deepEqual(typed.problems, []);
  assert.match(typed.types, /export interface Type \{\n  name: string;\n\}/);
  const { code, problems } = schemaCode(source, PATH);
  assert.deepEqual(problems, []);
  const { default: user } = await evaluate(code);
  assert.equal(user.is({ name: "Ada" }), true);
  assert.equal(user.is({ name: "Ada", extra: 1 }), false);
});

test("a .schema.json5 schema is JSON5 in both texts, and the suffix names the dialect", async () => {
  const path = join(ROOT, "tests/fixtures/user.schema.json5");
  const source = "// a user\n{\n  type: 'object',\n  properties: { name: { type: 'string', maxLength: 0x4 }, },\n  required: ['name'],\n  additionalProperties: false,\n}\n";
  const typed = schemaTypes(source, path);
  assert.deepEqual(typed.problems, []);
  assert.match(typed.types, /export interface Type \{\n  name: string;\n\}/);
  const { code, problems } = schemaCode(source, path);
  assert.deepEqual(problems, []);
  const { default: user } = await evaluate(code);
  assert.equal(user.is({ name: "Ada" }), true);
  assert.equal(user.is({ name: "Grace" }), false);
  assert.equal(user.is({ name: "Ada", extra: 1 }), false);
  // The same text in a .schema.jsonc file is JSON with comments, where an unquoted key is an error.
  assert.equal(schemaTypes(source, PATH).problems[0]!.code, CODES.syntax);
  const broken = schemaCode("{\n  type: 'object',,\n}", path).problems;
  assert.equal(broken[0]!.code, CODES.syntax);
  assert.equal(broken[0]!.start, 19);
});

/** A directory of schema files, each written as JSON (JSON5 for `.schema.json5`), with the root's path and text. */
function project(files: Record<string, unknown>, root = "user.schema.jsonc") {
  const dir = mkdtempSync(join(tmpdir(), "motherload-refs-"));
  for (const [name, schema] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), JSON.stringify(schema, null, 2));
  }
  return { dir, path: join(dir, root), source: readFileSync(join(dir, root), "utf8") };
}

test("a $ref to another file is followed: its type is imported from that file's module, and the validator is compiled from both", async () => {
  const { dir, path, source } = project({
    "user.schema.jsonc": {
      type: "object",
      properties: {
        tag: { $ref: "./shared/tag.schema.jsonc#/$defs/tag" },
        group: { $ref: "shared/tag.schema.jsonc" },
        label: { $ref: "./shared/tag.schema.jsonc#/properties/name" },
        at: { $ref: "./point.schema.json5" },
      },
      required: ["tag"],
      additionalProperties: false,
    },
    // It refers back to the root: a cycle through two files.
    "shared/tag.schema.jsonc": { $defs: { tag: { type: "string", minLength: 2 } }, type: "object", properties: { name: { $ref: "#/$defs/tag" }, parent: { $ref: "../user.schema.jsonc" } }, required: ["name"], additionalProperties: false },
    "point.schema.json5": { type: "object", properties: { x: { type: "integer" } }, required: ["x"] },
  });
  const typed = schemaTypes(source, path);
  assert.deepEqual(typed.problems, []);
  // The definition keeps the name its own module gives it; the other files' roots are named for their files.
  assert.match(typed.types, /^import type \{ Tag, Type as Tag2 \} from "\.\/shared\/tag\.schema\.jsonc";\nimport type \{ Type as Point \} from "\.\/point\.schema\.json5";$/m);
  // A pointer that is not a definition is inlined from the other file, its own references imported.
  assert.match(typed.types, /export interface Type \{\n  tag: Tag;\n  group\?: Tag2;\n  label\?: Tag;\n  at\?: Point;\n\}/);
  const tag = join(dir, "shared/tag.schema.jsonc");
  const tagTypes = schemaTypes(readFileSync(tag, "utf8"), tag);
  assert.match(tagTypes.types, /^import type \{ Type as User \} from "\.\.\/user\.schema\.jsonc";$/m);

  const { code, problems, watchFiles } = schemaCode(source, path);
  assert.deepEqual(problems, []);
  assert.deepEqual(watchFiles.sort(), [join(dir, "point.schema.json5"), tag]);
  // ajv's standalone code embeds each schema's id; none is a path on the machine that built it.
  assert.ok(!code.includes(dir), "the module names no path");
  assert.doesNotMatch(code, /^import /m);
  const { default: user } = await evaluate(code);
  assert.equal(user.is({ tag: "ab" }), true);
  assert.equal(user.is({ tag: "a" }), false); // the other file's minLength
  assert.equal(user.is({ tag: "ab", group: { name: "cd", parent: { tag: "ef" } } }), true);
  assert.equal(user.is({ tag: "ab", group: { name: "cd", parent: { tag: "e" } } }), false); // back through the cycle
  assert.equal(user.is({ tag: "ab", label: "x" }), false);
  assert.equal(user.is({ tag: "ab", at: { x: 1.5 } }), false);
  assert.deepEqual(schemaCode(readFileSync(tag, "utf8"), tag).problems, []);
});

test("a $ref that cannot be followed is a problem at the $ref, in both texts, and its type is unknown", () => {
  const { path, source } = project({
    "user.schema.jsonc": {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      type: "object",
      properties: {
        missing: { $ref: "./missing.schema.jsonc" },
        data: { $ref: "./data.json" },
        nope: { $ref: "./tag.schema.jsonc#/$defs/nope" },
        old: { $ref: "./old.schema.jsonc" },
        via: { $ref: "./via.schema.jsonc" },
      },
    },
    "tag.schema.jsonc": { $defs: { tag: { type: "string" } } },
    "old.schema.jsonc": { $schema: "http://json-schema.org/draft-07/schema#", type: "string" },
    "via.schema.jsonc": { $ref: "./gone.schema.jsonc" },
  });
  const { types, problems } = schemaTypes(source, path);
  const at = (ref: string) => source.indexOf(`"${ref}"`) + 1;
  assert.deepEqual(
    problems.map((p) => [p.message, p.start, p.length, p.code]),
    [
      ['The $ref "./missing.schema.jsonc" names a file that does not exist.', at("./missing.schema.jsonc"), 22, CODES.schema],
      ['The $ref "./data.json" names a file that is not a schema: a $ref to another file names a .schema.jsonc or .schema.json5 file.', at("./data.json"), 11, CODES.schema],
      ['The $ref "./tag.schema.jsonc#/$defs/nope" points to nothing: ./tag.schema.jsonc has no #/$defs/nope.', at("./tag.schema.jsonc#/$defs/nope"), 30, CODES.schema],
      ['The $ref "./old.schema.jsonc" names a schema whose $schema is "http://json-schema.org/draft-07/schema#", and this schema\'s is "https://json-schema.org/draft/2020-12/schema": a schema and the files it refers to are compiled in one draft.', at("./old.schema.jsonc"), 18, CODES.schema],
      // A problem in a file reached through another is placed at the root's reference to that file.
      ['./via.schema.jsonc: The $ref "./gone.schema.jsonc" names a file that does not exist.', at("./via.schema.jsonc"), 18, CODES.schema],
    ],
  );
  assert.match(types, /missing\?: unknown;\n  data\?: unknown;\n  nope\?: unknown;/);
  assert.deepEqual(schemaCode(source, path).problems, problems);
});

test("a $ref to a URL is not followed: ajv reports it, and its type is unknown", () => {
  const { types, problems } = schemaTypes(JSON.stringify({ type: "object", properties: { a: { $ref: "https://example.com/other.json" } } }), PATH);
  assert.equal(problems.length, 1);
  assert.match(problems[0]!.message, /resolve reference https:\/\/example\.com\/other\.json/);
  assert.match(types, /a\?: unknown;/);
});

test("an invalid schema is a problem in both texts", () => {
  const invalid = JSON.stringify({ type: "object", properties: { a: { type: "strng" } } });
  assert.match(schemaTypes(invalid, PATH).problems[0]!.message, /not valid/);
  assert.match(schemaCode(invalid, PATH).problems[0]!.message, /not valid/);
});

test("draft-04 is refused with the drafts ajv validates, by the type check as well as the build", () => {
  const draft04 = JSON.stringify({ $schema: "http://json-schema.org/draft-04/schema#", type: "string" });
  assert.match(schemaCode(draft04, PATH).problems[0]!.message, /drafts 06, 07, 2019-09 and 2020-12/);
  assert.match(schemaTypes(draft04, PATH).problems[0]!.message, /drafts 06, 07, 2019-09 and 2020-12/);
});

test("each draft ajv validates compiles, draft-06 with the meta-schema ajv's default class lacks", async () => {
  for (const $schema of ["http://json-schema.org/draft-06/schema#", "http://json-schema.org/draft-07/schema#", "https://json-schema.org/draft/2019-09/schema", "https://json-schema.org/draft/2020-12/schema"]) {
    const schema = JSON.stringify({ $schema, type: "integer", minimum: 1 });
    assert.deepEqual(schemaTypes(schema, PATH).problems, [], $schema);
    const { code, problems } = schemaCode(schema, PATH);
    assert.deepEqual(problems, [], $schema);
    const { default: s } = await evaluate(code);
    assert.deepEqual([s.is(2), s.is(0)], [true, false], $schema);
  }
});

test("a schema with no $schema is draft-07, and a later draft's keyword, which ajv ignores there, is a problem at the keyword", () => {
  const source = '{\n  "type": "array",\n  "prefixItems": [{ "type": "string" }],\n  "contains": { "const": 1 },\n  "minContains": 2\n}';
  const typed = schemaTypes(source, PATH);
  assert.deepEqual(
    typed.problems.map((p) => [p.message, source.slice(p.start, p.start + p.length)]),
    [
      ['"prefixItems" is a JSON Schema 2020-12 keyword, which draft-07, the draft of a schema with no "$schema", ignores: declare "$schema": "https://json-schema.org/draft/2020-12/schema".', "prefixItems"],
      ['"minContains" is a JSON Schema 2019-09 keyword, which draft-07, the draft of a schema with no "$schema", ignores: declare "$schema": "https://json-schema.org/draft/2019-09/schema".', "minContains"],
    ],
  );
  // The type is what draft-07 validates: prefixItems makes no tuple.
  assert.match(typed.types, /export type Type = unknown\[\];/);
  assert.deepEqual(schemaCode(source, PATH).problems, typed.problems);
  // Declared, the same keywords need no problem in 2020-12, and prefixItems still does in 2019-09.
  const declared = (draft: string) => source.replace("{", `{\n  "$schema": "https://json-schema.org/draft/${draft}/schema",`);
  assert.deepEqual(schemaTypes(declared("2020-12"), PATH).problems, []);
  assert.deepEqual(schemaTypes(declared("2019-09"), PATH).problems.map((p) => p.message), ['"prefixItems" is a JSON Schema 2020-12 keyword, which this schema\'s draft, 2019-09, ignores: declare "$schema": "https://json-schema.org/draft/2020-12/schema".']);
  // A schema with no $schema that uses only draft-07's keywords is fine, as before.
  assert.deepEqual(schemaTypes(JSON.stringify({ type: "array", items: [{ type: "string" }] }), PATH).problems, []);
});

test("a format ajv-formats checks with a function, such as date-time or uri, is inlined: the module requires nothing", async () => {
  const { code, problems } = schemaCode(JSON.stringify({ type: "object", properties: { at: { type: "string", format: "date-time" }, url: { type: "string", format: "uri" } } }), PATH);
  assert.deepEqual(problems, []);
  assert.doesNotMatch(code, /[^_\w]require\(/);
  const { default: s } = await evaluate(code);
  assert.equal(s.is({ at: "2026-10-20T22:14:00Z", url: "https://example.com/a" }), true);
  assert.equal(s.is({ at: "yesterday" }), false);
  assert.equal(s.is({ url: "not a uri" }), false);
});

test("a schema outside any project that installs ajv still validates: ajv is Motherload's own dependency", async () => {
  const dir = mkdtempSync(join(tmpdir(), "motherload-no-ajv-"));
  const path = join(dir, "a.schema.jsonc");
  writeFileSync(path, SCHEMA);
  const { types, problems } = schemaTypes(SCHEMA, path);
  assert.deepEqual(problems, []);
  assert.match(types, /export interface Type \{\n  name: string;\n  tags\?: \{\n    \[key: string\]: unknown;\n  \}\[\];\n\}/);
  const { code, problems: codeProblems } = schemaCode(SCHEMA, path);
  assert.deepEqual(codeProblems, []);
  assert.doesNotMatch(code, /^import /m);
  const { default: user } = await evaluate(code);
  assert.equal(user.is({ name: "Ada" }), true);
  assert.equal(user.is({ name: "" }), false);
});
