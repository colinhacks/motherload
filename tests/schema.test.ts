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
  assert.equal(user.validate({ name: "", extra: 1 }).issues.length, 2);
  assert.equal(user["~standard"].validate({ tags: [] }).issues.length, 1);
  assert.equal(user["~standard"].version, 1);
  assert.equal(user["~standard"].vendor, "motherload");
  assert.equal(user.schema.title, "User");
  assert.deepEqual(Object.keys(user), ["validate", "is", "schema", "~standard"]);
});

test("validate reports every issue, each with ajv's message, keyword, params and schema path, and never throws for an invalid value", async () => {
  const { default: user } = await evaluate(schemaCode(SCHEMA, PATH).code);
  // Three ways at once: an empty name, a duplicate tag, a property the schema closes out.
  assert.deepEqual(user.validate({ name: "", tags: [{}, {}], extra: 1 }), {
    issues: [
      { message: "must NOT have additional properties", path: ["extra"], keyword: "additionalProperties", params: { additionalProperty: "extra" }, schemaPath: "#/additionalProperties" },
      { message: "must NOT have fewer than 1 characters", path: ["name"], keyword: "minLength", params: { limit: 1 }, schemaPath: "#/properties/name/minLength" },
      { message: "must NOT have duplicate items (items ## 0 and 1 are identical)", path: ["tags"], keyword: "uniqueItems", params: { i: 1, j: 0 }, schemaPath: "#/properties/tags/uniqueItems" },
    ],
  });
  assert.deepEqual(user.validate(null).issues.map((i: any) => [i.path, i.keyword]), [[[], "type"]]);
});

test("validate gives back the value it was given, the same object, unchanged: ajv is set to change nothing", async () => {
  const source = JSON.stringify({ type: "object", properties: { n: { type: "number", default: 1 }, s: { type: "string" } }, additionalProperties: false });
  const { default: s } = await evaluate(schemaCode(source, PATH).code);
  const value = { s: "1" };
  const result = s.validate(value);
  assert.equal(result.value, value);
  assert.deepEqual(Object.keys(result), ["value"]);
  // No default filled in, no "1" coerced, no extra property removed.
  assert.deepEqual(value, { s: "1" });
  const extra = { s: 1, x: 2 };
  assert.equal(s.validate(extra).issues.length, 2);
  assert.deepEqual(extra, { s: 1, x: 2 });
  assert.equal(s["~standard"].validate(value).value, value);
});

test("an issue's path: object keys as strings, unescaped, and array indexes as numbers, read from the value", async () => {
  const source = JSON.stringify({
    type: "object",
    properties: {
      "a/b~c": { type: "array", items: { type: "number" } },
      grid: { type: "array", items: { type: "array", items: { type: "string" } } },
      map: { type: "object", properties: { "0": { type: "string" } } },
    },
  });
  const { default: s } = await evaluate(schemaCode(source, PATH).code);
  const result = s.validate({ "a/b~c": [1, "x"], grid: [[], ["a", 2]], map: { "0": 1 } });
  // The pointer writes `/1` for the index and `/0` for the key alike; the value tells them apart.
  assert.deepEqual(result.issues.map((i: any) => i.path), [["a/b~c", 1], ["grid", 1, 1], ["map", "0"]]);
  // An array that is not where the schema expects one is still an array in the path.
  const list = await evaluate(schemaCode(JSON.stringify({ items: { type: "object", properties: { "1": { type: "string" } } } }), PATH).code);
  assert.deepEqual(list.default.validate([{}, { 1: 2 }]).issues[0].path, [1, "1"]);
});

test("the key of a missing, unexpected or misnamed property ends the path", async () => {
  const D07 = "http://json-schema.org/draft-07/schema#";
  const D2020 = "https://json-schema.org/draft/2020-12/schema";
  const paths = async (schema: object, value: unknown) => (await evaluate(schemaCode(JSON.stringify(schema), PATH).code)).default.validate(value).issues.map((i: any) => [i.keyword, i.path]);
  const inner = (schema: object) => ({ $schema: D2020, type: "object", properties: { inner: schema } });
  assert.deepEqual(await paths(inner({ required: ["a", "b"] }), { inner: { b: 1 } }), [["required", ["inner", "a"]]]);
  assert.deepEqual(await paths(inner({ properties: { a: true }, additionalProperties: false }), { inner: { a: 1, b: 1, c: 1 } }), [["additionalProperties", ["inner", "b"]], ["additionalProperties", ["inner", "c"]]]);
  assert.deepEqual(await paths(inner({ properties: { a: true }, unevaluatedProperties: false }), { inner: { a: 1, b: 1 } }), [["unevaluatedProperties", ["inner", "b"]]]);
  assert.deepEqual(await paths(inner({ dependentRequired: { a: ["b", "c"] } }), { inner: { a: 1 } }), [["dependentRequired", ["inner", "b"]], ["dependentRequired", ["inner", "c"]]]);
  assert.deepEqual(await paths({ $schema: D07, properties: { inner: { dependencies: { a: ["b"] } } } }, { inner: { a: 1 } }), [["dependencies", ["inner", "b"]]]);
  // propertyNames: ajv's error for the name's own rule names no key, and the error that follows does.
  assert.deepEqual(await paths(inner({ propertyNames: { pattern: "^a" } }), { inner: { ab: 1, b: 1 } }), [["pattern", ["inner"]], ["propertyNames", ["inner", "b"]]]);
  // A property named as an index, in an array of objects.
  assert.deepEqual(await paths({ type: "array", items: { required: ["0"] } }, [{}]), [["required", [0, "0"]]]);
});

test("is stops at the first failure: it is a second validator, compiled without allErrors, beside validate's", async () => {
  const source = JSON.stringify({ type: "object", properties: { a: { type: "string" }, b: { type: "string" } } });
  const { code } = schemaCode(source, PATH);
  // One table of run-time modules, two validators.
  assert.equal(code.match(/^const __modules = /gm)?.length, 1);
  assert.match(code, /^const __validateAll = /m);
  assert.match(code, /^const __validateFirst = /m);
  const { default: s } = await evaluate(code);
  const read: string[] = [];
  const value = {
    get a() {
      read.push("a");
      return 1;
    },
    get b() {
      read.push("b");
      return 2;
    },
  };
  assert.equal(s.is(value), false);
  // `a` fails, and `b` is never read.
  assert.deepEqual([...new Set(read)], ["a"]);
  read.length = 0;
  assert.equal(s.validate(value).issues.length, 2);
  assert.deepEqual([...new Set(read)], ["a", "b"]);
  assert.equal(s.validate, s["~standard"].validate);
});

test("a helper both validators require is inlined once", async () => {
  const source = JSON.stringify({ type: "object", properties: { at: { type: "string", format: "date-time" }, name: { type: "string", minLength: 1 }, tags: { type: "array", uniqueItems: true } } });
  const { code } = schemaCode(source, PATH);
  // ajv-formats' formats, ucs2length and fast-deep-equal, each once, though both validators use them:
  // as many modules as distinct ids required, ucs2length and fast-deep-equal among them.
  const modules = code.match(/^function \(module, exports\) \{$/gm)!.length;
  assert.equal(modules, new Set(code.match(/__require\(\d+\)/g)).size);
  assert.ok(modules >= 3, String(modules));
  assert.equal(code.match(/function ucs2length/g)!.length, 1);
  assert.equal(code.match(/module\.exports = function equal/g)!.length, 1);
  const { default: s } = await evaluate(code);
  assert.deepEqual([s.is({ at: "2026-10-20T22:14:00Z", name: "a", tags: [{}, { a: 1 }] }), s.is({ at: "yesterday" }), s.is({ name: "" }), s.is({ tags: [{}, {}] })], [true, false, false, false]);
  assert.deepEqual(s.validate({ at: "yesterday", name: "", tags: [{}, {}] }).issues.map((i: any) => i.keyword), ["format", "minLength", "uniqueItems"]);
});

test("neither method throws for a value that is not JSON, and a path that cannot be read again is kept as keys", async () => {
  const source = JSON.stringify({ type: "object", properties: { n: { type: "integer" }, list: { type: "array", items: { type: "string" } } }, required: ["n"] });
  const { default: s } = await evaluate(schemaCode(source, PATH).code);
  const hostile = [undefined, Symbol("x"), () => 1, 1n, NaN, new Date(), new Map([["n", 1]]), [, 1], Object.create(null), JSON.parse('{"__proto__": {"n": 1}}'), { n: 1n }, { n: NaN }, new Proxy({ n: "x" }, {}), { n: 1, list: Object.assign([1], { extra: true }) }];
  for (const [index, value] of hostile.entries()) {
    assert.equal(s.is(value), false, `value ${index}`);
    assert.ok(s.validate(value).issues.length > 0, `value ${index}`);
  }
  assert.equal(s.is(Object.assign(Object.create(null), { n: 1 })), true);
  // ajv reads `list` twice; a getter that throws from the third read on fails the path walk alone,
  // whose segments past it stay keys.
  let reads = 0;
  const changing = {
    n: 1,
    get list() {
      if (++reads > 2) throw new Error("read again");
      return [1];
    },
  };
  assert.deepEqual(s.validate(changing).issues.map((i: any) => i.path), [["list", "0"]]);
});

test("a value ajv's recursion cannot finish throws ajv's RangeError, from validate and is alike", async () => {
  // Recorded in DESIGN.md: a cyclic value against a recursive schema, or nesting deeper than the stack.
  const tree = JSON.stringify({ $defs: { node: { type: "object", properties: { kids: { type: "array", items: { $ref: "#/$defs/node" } } } } }, $ref: "#/$defs/node" });
  const { default: s } = await evaluate(schemaCode(tree, PATH).code);
  const cyclic: any = { kids: [] };
  cyclic.kids.push(cyclic);
  assert.throws(() => s.validate(cyclic), RangeError);
  assert.throws(() => s.is(cyclic), RangeError);
  // A cycle the schema does not descend into is validated as any other value.
  const flat: any = { kids: [] };
  flat.self = flat;
  assert.equal(s.validate(flat).value, flat);
});

test("the types name the root Type whatever its title", () => {
  const { types, problems } = schemaTypes(SCHEMA, PATH);
  assert.deepEqual(problems, []);
  assert.match(types, /export interface Type \{/);
  assert.match(types, /\ntype Json = \{ readonly \$schema: "https:\/\/json-schema.org\/draft\/2020-12\/schema";/);
  // The schema as written is a type of its own, so an error or a hover prints `Schema<Type, Json>`.
  assert.match(types, /\ndeclare const schema: __MotherloadSchema<Type, Json>;\n/);
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
  assert.match(typed.types, /export interface Type \{\n  tag: Tag;\n  group\?: Tag2 \| undefined;\n  label\?: Tag \| undefined;\n  at\?: Point \| undefined;\n\}/);
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

test("a schema with no $schema is draft-07, and a later draft's keyword is ignored there, by the validator and the type alike", async () => {
  const source = JSON.stringify({ type: "array", prefixItems: [{ type: "string" }], contains: { const: 1 }, minContains: 2 });
  const typed = schemaTypes(source, PATH);
  assert.deepEqual(typed.problems, []);
  assert.match(typed.types, /export type Type = unknown\[\];/);
  const built = schemaCode(source, PATH);
  assert.deepEqual(built.problems, []);
  // draft-07 reads `contains` and neither `prefixItems` nor `minContains`.
  const { default: s } = await evaluate(built.code);
  assert.deepEqual([s.is([1]), s.is([2])], [true, false]);
  // Without `type`, a keyword the draft ignores does not make the type an array.
  assert.match(schemaTypes(JSON.stringify({ prefixItems: [{ type: "string" }] }), PATH).types, /export type Type = unknown;/);
  // Declared 2020-12, both are read.
  const declared = JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", ...JSON.parse(source) });
  assert.match(schemaTypes(declared, PATH).types, /export type Type = \[string\?, \.\.\.unknown\[\]\];/);
  const { default: t } = await evaluate(schemaCode(declared, PATH).code);
  assert.deepEqual([t.is([1]), t.is(["a", 1]), t.is(["a", 1, 1])], [false, false, true]);
});

test("a keyword no draft defines is ignored in every draft: a vendor's, an unknown format, and one that holds a $ref", async () => {
  const unknown = {
    "x-foo": 1,
    tsType: "Foo",
    errorMessage: "must be a user",
    markdownDescription: "**user**",
    discriminator: { propertyName: "kind" },
    "x-ref": { $ref: "./missing.schema.jsonc" },
    "x-nested": { type: "number", required: ["nope"] },
    type: "object",
    properties: { name: { type: "string", "x-label": "Name", format: "my-own-format" }, tags: { type: "array", items: { type: "string" }, uniqueItemProperties: ["id"] } },
    required: ["name"],
    additionalProperties: false,
  };
  for (const $schema of [undefined, "http://json-schema.org/draft-06/schema#", "http://json-schema.org/draft-07/schema#", "https://json-schema.org/draft/2019-09/schema", "https://json-schema.org/draft/2020-12/schema"]) {
    const source = JSON.stringify($schema ? { $schema, ...unknown } : unknown);
    const draft = $schema ?? "no $schema";
    const typed = schemaTypes(source, PATH);
    assert.deepEqual(typed.problems, [], draft);
    assert.match(typed.types, /export interface Type \{\n  name: string;\n  tags\?: string\[\] \| undefined;\n\}/, draft);
    const { code, problems } = schemaCode(source, PATH);
    assert.deepEqual(problems, [], draft);
    const { default: s } = await evaluate(code);
    assert.deepEqual([s.is({ name: "a", tags: ["x"] }), s.is({}), s.is({ name: 1 }), s.is({ name: "a", other: 1 })], [true, false, false, false], draft);
  }
});

test("a keyword ajv reads that the schema's draft does not define is ignored: $async, nullable, id, and another draft's", async () => {
  const D07 = "http://json-schema.org/draft-07/schema#";
  const D2019 = "https://json-schema.org/draft/2019-09/schema";
  const D2020 = "https://json-schema.org/draft/2020-12/schema";
  /** Each schema compiles with no problem, and the validator gives `expected` for `values`. */
  const check = async (schema: object, values: unknown[], expected: boolean[], type?: RegExp) => {
    const source = JSON.stringify(schema);
    const typed = schemaTypes(source, PATH);
    assert.deepEqual(typed.problems, [], source);
    if (type) assert.match(typed.types, type, source);
    const { code, problems } = schemaCode(source, PATH);
    assert.deepEqual(problems, [], source);
    const { default: s } = await evaluate(code);
    assert.deepEqual(values.map((value) => s.is(value)), expected, source);
  };
  // ajv's `$async: true` made the validator return a promise, which `is` took for a pass; nested, ajv refused the schema.
  await check({ $async: true, type: "object", properties: { name: { type: "string" } }, required: ["name"] }, [{ name: "a" }, { name: 1 }], [true, false]);
  await check({ type: "object", properties: { inner: { $async: true, type: "string" } } }, [{ inner: "a" }, { inner: 1 }], [true, false]);
  // OpenAPI 3.0's `nullable`: null is refused as `type` says, and the shapes ajv refused compile.
  await check({ type: "string", nullable: true }, ["a", null], [true, false], /export type Type = string;/);
  await check({ nullable: true, const: "a" }, ["a", null], [true, false]);
  await check({ type: ["string", "null"], nullable: false }, ["a", null], [true, true]);
  await check({ type: "string", nullable: "yes" }, ["a", null], [true, false]);
  // Draft-04's `id`, which ajv refused as "NOT SUPPORTED".
  await check({ $schema: D07, id: "user", type: "string" }, ["a", 1], [true, false]);
  // 2020-12's `$dynamicRef` in 2019-09, and 2019-09's `$recursiveRef` in 2020-12.
  await check({ $schema: D2019, $defs: { s: { $dynamicAnchor: "s", type: "string" } }, $dynamicRef: "#s" }, ["a", 1], [true, true]);
  await check({ $schema: D2020, $recursiveAnchor: true, type: "object", properties: { c: { $recursiveRef: "#" } } }, [{ c: 1 }], [true]);
  // Draft-07's `dependencies`, which 2019-09 replaced, is read in draft-07 alone.
  await check({ $schema: D07, dependencies: { a: ["b"] } }, [{ a: 1 }, { a: 1, b: 1 }], [false, true]);
  await check({ $schema: D2019, dependencies: { a: ["b"] } }, [{ a: 1 }], [true]);
  await check({ $schema: D2020, dependencies: { a: { required: ["b"] } } }, [{ a: 1 }], [true]);
});

test("a keyword ajv reads that the draft does not define is ignored in a file the schema refers to, as in the schema", async () => {
  const { path, source } = project({
    "user.schema.jsonc": { type: "object", properties: { tag: { $ref: "./tag.schema.jsonc" } }, required: ["tag"] },
    "tag.schema.jsonc": { $async: true, type: "string", nullable: true, id: "tag" },
  });
  const typed = schemaTypes(source, path);
  assert.deepEqual(typed.problems, []);
  const { code, problems } = schemaCode(source, path);
  assert.deepEqual(problems, []);
  const { default: s } = await evaluate(code);
  assert.deepEqual([s.is({ tag: "a" }), s.is({ tag: null }), s.is({ tag: 1 })], [true, false, false]);
});

test("a 2020-12 $dynamicRef ajv resolves to the root in place of its anchor is a problem at the reference", async () => {
  const S = "https://json-schema.org/draft/2020-12/schema";
  const message = (ref: string, fix: string) => `ajv resolves the $dynamicRef "${ref}" to the root of its schema, not where it points: ${fix}.`;
  const anchored = (name: string) => `declare "$dynamicAnchor": "${name}" at the root of the schema, or write it as a $ref`;
  // The anchor in `$defs`: the validator checked the root's rules, and at the root recursed until the stack ran out.
  for (const [schema, ref, fix] of [
    [{ $schema: S, $defs: { content: { $dynamicAnchor: "content", type: "string" } }, type: "array", items: { $dynamicRef: "#content" } }, "#content", anchored("content")],
    [{ $schema: S, $defs: { s: { $dynamicAnchor: "s", type: "string" } }, $dynamicRef: "#s" }, "#s", anchored("s")],
    [{ $schema: S, $defs: { s: { type: "string" } }, type: "array", items: { $dynamicRef: "#/$defs/s" } }, "#/$defs/s", "write it as a $ref"],
  ] as const) {
    const source = JSON.stringify(schema, null, 2);
    for (const problems of [schemaTypes(source, PATH).problems, schemaCode(source, PATH).problems]) {
      assert.deepEqual(problems.map((p) => [p.message, source.slice(p.start, p.start + p.length)]), [[message(ref, fix), ref]]);
    }
  }
  // An anchor at the root of the file is resolved as the spec says. ajv resolves one at the root of a
  // schema with an $id too, but an $id below a file's root is refused (embeddedIdProblems), anchor or not.
  const tree = (extra: object) => ({ $dynamicAnchor: "node", type: "object", properties: { kids: { type: "array", items: { $dynamicRef: "#node" } } }, ...extra });
  const { code, problems } = schemaCode(JSON.stringify({ $schema: S, ...tree({}) }), PATH);
  assert.deepEqual(problems, []);
  const { default: s } = await evaluate(code);
  assert.deepEqual([s.is({ kids: [{ kids: [] }] }), s.is({ kids: [1] })], [true, false]);
  const embedded = JSON.stringify({ $schema: S, $ref: "https://example.com/tree", $defs: { tree: tree({ $id: "https://example.com/tree" }) } });
  assert.deepEqual(schemaCode(embedded, PATH).problems.map((p) => embedded.slice(p.start, p.start + p.length)), ["https://example.com/tree"]);
  // In another file, placed at the root's reference to it; in draft-07, which ignores $dynamicRef, no problem.
  const { path, source } = project({
    "user.schema.jsonc": { $schema: S, type: "object", properties: { list: { $ref: "./list.schema.jsonc" } } },
    "list.schema.jsonc": { $defs: { item: { $dynamicAnchor: "item" } }, type: "array", items: { $dynamicRef: "#item" } },
  });
  assert.deepEqual(schemaTypes(source, path).problems.map((p) => [p.message, source.slice(p.start, p.start + p.length)]), [[`./list.schema.jsonc: ${message("#item", anchored("item"))}`, "./list.schema.jsonc"]]);
  assert.deepEqual(schemaCode(JSON.stringify({ type: "array", items: { $dynamicRef: "#item" } }), PATH).problems, []);
});

test("an $id below a file's root is a problem at that $id, in the type check and the build: ajv resolves the $refs inside it against the $id", async () => {
  const S = "https://json-schema.org/draft/2020-12/schema";
  const message = (id: string) => `The $id "${id}" gives a schema inside the file a base URI of its own, against which ajv resolves the $refs inside it and Motherload's types do not: move that schema to a .schema.jsonc file of its own and $ref the file, or remove the $id.`;
  const inner = "https://example.com/inner";
  for (const schema of [
    // ajv validated 1 and refused "s" here, where the type was the root's `x`, a string.
    { $schema: S, $defs: { x: { type: "string" }, inner: { $id: inner, $defs: { x: { type: "number" } }, allOf: [{ $ref: "#/$defs/x" }] } }, allOf: [{ $ref: "#/$defs/inner" }] },
    { definitions: { x: { type: "string" }, inner: { $id: inner, definitions: { x: { type: "number" } }, allOf: [{ $ref: "#/definitions/x" }] } }, allOf: [{ $ref: "#/definitions/inner" }] },
    // With the $ref beside the $id, ajv recursed until the stack ran out while compiling.
    { $schema: S, $defs: { x: { type: "string" }, inner: { $id: inner, $defs: { x: { type: "number" } }, $ref: "#/$defs/x" } }, $ref: "#/$defs/inner" },
    // Placed at the $id, not at a $ref that names the same URI first.
    { $schema: S, $ref: inner, $defs: { inner: { $id: inner, type: "number" } } },
  ]) {
    const source = JSON.stringify(schema, null, 2);
    for (const problems of [schemaTypes(source, PATH).problems, schemaCode(source, PATH).problems]) {
      assert.deepEqual(problems.map((p) => [p.message, source.slice(p.start - 8, p.start + p.length + 1)]), [[message(inner), `"$id": "${inner}"`]]);
    }
  }
  // The root's own $id, a plain-name $id (draft-07's anchor), and "$id" as data or as a property's name stay.
  for (const schema of [
    { $id: "https://example.com/root", type: "object", properties: { $id: { type: "string" } }, required: ["$id"] },
    { definitions: { p: { $id: "#pos", type: "integer" } }, items: { $ref: "#pos" } },
    { const: { nested: { $id: "https://example.com/data" } }, examples: [{ $id: "https://example.com/data" }] },
  ]) {
    const source = JSON.stringify(schema);
    assert.deepEqual(schemaTypes(source, PATH).problems, [], source);
    assert.deepEqual(schemaCode(source, PATH).problems, [], source);
  }
  // In another file, placed at the root's reference to it.
  const { path, source } = project({
    "user.schema.jsonc": { type: "object", properties: { tag: { $ref: "./tag.schema.jsonc" } } },
    "tag.schema.jsonc": { definitions: { t: { $id: inner, type: "string" } }, $ref: "#/definitions/t" },
  });
  for (const problems of [schemaTypes(source, path).problems, schemaCode(source, path).problems]) {
    assert.deepEqual(problems.map((p) => [p.message, source.slice(p.start, p.start + p.length)]), [[`./tag.schema.jsonc: ${message(inner)}`, "./tag.schema.jsonc"]]);
  }
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
  assert.match(types, /export interface Type \{\n  name: string;\n  tags\?: \{\n    \[key: string\]: unknown;\n  \}\[\] \| undefined;\n\}/);
  const { code, problems: codeProblems } = schemaCode(SCHEMA, path);
  assert.deepEqual(codeProblems, []);
  assert.doesNotMatch(code, /^import /m);
  const { default: user } = await evaluate(code);
  assert.equal(user.is({ name: "Ada" }), true);
  assert.equal(user.is({ name: "" }), false);
});

test("the module is a Standard JSON Schema: each target's draft from `~standard.jsonSchema`, a fresh copy, and a throw for another target", async () => {
  const { code, problems } = schemaCode(SCHEMA, PATH);
  assert.deepEqual(problems, []);
  const { default: user } = await evaluate(code);
  const { jsonSchema } = user["~standard"];
  const latest = jsonSchema.input({ target: "draft-2020-12" });
  assert.equal(latest.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.deepEqual(latest.properties, JSON.parse(SCHEMA).properties);
  assert.deepEqual(jsonSchema.output({ target: "draft-2020-12" }), latest);
  assert.equal(jsonSchema.input({ target: "draft-07" }).$schema, "http://json-schema.org/draft-07/schema#");
  // Each call gives a copy, so a caller that changes one changes neither the module nor the next.
  latest.properties.name.minLength = 99;
  assert.equal(jsonSchema.input({ target: "draft-2020-12" }).properties.name.minLength, 1);
  assert.equal(user.schema.properties.name.minLength, 1);
  assert.throws(() => jsonSchema.input({ target: "openapi-3.0" }), /converts a schema to the "draft-07" and "draft-2020-12" targets, not "openapi-3.0"/);
  assert.throws(() => jsonSchema.input({ target: "toString" }), /not "toString"/);
});

test("a keyword the target cannot express makes that target throw, naming it, while the other still converts", async () => {
  const source = JSON.stringify({ $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", properties: { a: { type: "string" } }, unevaluatedProperties: false });
  const { code, problems } = schemaCode(source, PATH);
  assert.deepEqual(problems, []);
  const { default: closed } = await evaluate(code);
  assert.equal(closed["~standard"].jsonSchema.input({ target: "draft-2020-12" }).unevaluatedProperties, false);
  assert.throws(() => closed["~standard"].jsonSchema.input({ target: "draft-07" }), /"unevaluatedProperties" at .*has no equivalent in draft-07/);
});
