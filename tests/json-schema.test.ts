// A schema as a self-contained JSON Schema in draft-07 and in 2020-12 (packages/schema/src/json-schema.ts):
// each conversion on a small schema, each refusal, and the proof: Motherload's own validator (the
// module's `is`) and ajv compiling each produced schema for its target give the same verdict on
// every value, for the fixtures in tests/fixtures/json-schema and lab/basic's schemas.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseSchemaFile } from "../packages/schema/src/refs.ts";
import { draftOf, filesOf, schemaCode } from "../packages/schema/src/schema.ts";
import { jsonSchemas, TARGET_URIS, type JsonSchemaResult, type JsonSchemaTarget } from "../packages/schema/src/json-schema.ts";
import { evaluate, ROOT } from "./helpers.ts";

const require = createRequire(import.meta.url);
const TARGETS: JsonSchemaTarget[] = ["draft-07", "draft-2020-12"];
const FIXTURES = join(ROOT, "tests/fixtures/json-schema");
/** A schema given as text; the file is never read, as it refers to no other. */
const VIRTUAL = join(FIXTURES, "virtual.schema.jsonc");
const D07 = "http://json-schema.org/draft-07/schema#";
const D2019 = "https://json-schema.org/draft/2019-09/schema";
const D2020 = "https://json-schema.org/draft/2020-12/schema";

const fromSource = (source: string, path: string) => {
  const parsed = parseSchemaFile(source, path);
  assert.ok(parsed.ok);
  return jsonSchemas(filesOf(source, path, parsed.value), path, draftOf(parsed.value)!);
};
const convert = (schema: unknown) => fromSource(JSON.stringify(schema), VIRTUAL);
const fromFile = (path: string) => fromSource(readFileSync(path, "utf8"), path);

const schemaOf = (result: JsonSchemaResult): any => {
  if ("error" in result) assert.fail(result.error);
  return result.schema;
};
const errorOf = (result: JsonSchemaResult): string => {
  if ("schema" in result) assert.fail(`expected an error, got ${JSON.stringify(result.schema)}`);
  return result.error;
};

/** Writes `files` (path to schema) into a new directory and returns it. */
function project(files: Record<string, unknown>): string {
  const dir = mkdtempSync(join(tmpdir(), "motherload-json-schema-"));
  for (const [name, schema] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), typeof schema === "string" ? schema : JSON.stringify(schema));
  }
  return dir;
}

/** ajv's entry point for a target, as a consumer of the produced schema would compile it: every error, ajv-formats, and strict about keywords, so a keyword left behind that the target ignores fails the compile. */
function compileFor(target: JsonSchemaTarget, schema: unknown, strictSchema = true): (value: unknown) => boolean {
  const mod = require(target === "draft-07" ? "ajv" : "ajv/dist/2020");
  const Ajv = mod.default ?? mod;
  const ajv = new Ajv({ allErrors: true, strictSchema, strictTypes: false, strictTuples: false, strictRequired: false, logger: false });
  const formats = require("ajv-formats");
  (formats.default ?? formats)(ajv);
  // ajv resolves `$anchor` in every draft without declaring it a keyword, which strict mode then refuses.
  if (!ajv.getKeyword("$anchor")) ajv.addKeyword("$anchor");
  return ajv.compile(schema);
}

/** Motherload's own validator: the `is` of the module the schema becomes. */
async function motherload(source: string, path: string): Promise<(value: unknown) => boolean> {
  const { code, problems } = schemaCode(source, path);
  assert.deepEqual(problems, []);
  return (await evaluate(code)).default.is;
}

const ONE = ["additionalProperties", "unevaluatedProperties", "items", "additionalItems", "unevaluatedItems", "contains", "propertyNames", "not", "if", "then", "else", "contentSchema"];
const LIST = ["allOf", "anyOf", "oneOf", "prefixItems", "items"];
const MAP = ["properties", "patternProperties", "$defs", "definitions", "dependentSchemas", "dependencies"];
const ANNOTATIONS = new Set(["title", "description", "$comment", "default", "examples", "readOnly", "writeOnly", "deprecated"]);
const NOT_IN: Record<JsonSchemaTarget, string[]> = {
  "draft-07": ["$defs", "prefixItems", "dependentRequired", "dependentSchemas", "$anchor", "$dynamicRef", "$dynamicAnchor", "$recursiveRef", "$recursiveAnchor", "unevaluatedProperties", "unevaluatedItems", "minContains", "maxContains", "$vocabulary", "nullable"],
  "draft-2020-12": ["definitions", "dependencies", "additionalItems", "$recursiveRef", "$recursiveAnchor", "nullable"],
};

/** What every produced schema holds to: its target's `$schema` at the root alone, no keyword of the other draft, no `$id` below the root but a draft-07 anchor, every `$ref` a pointer into the document or a URL, and in draft-07 no `$ref` beside a keyword that validates. */
function wellFormed(target: JsonSchemaTarget, schema: any): void {
  assert.equal(schema.$schema, TARGET_URIS[target]);
  const walk = (s: any, at: string, root: boolean) => {
    if (typeof s !== "object" || s === null || Array.isArray(s)) return;
    if (!root) assert.ok(!("$schema" in s), `$schema at ${at}`);
    if (!root && "$id" in s) assert.ok(target === "draft-07" && /^#[A-Za-z]/.test(s.$id), `$id at ${at}`);
    for (const keyword of NOT_IN[target]) assert.ok(!(keyword in s), `${keyword} at ${at} in ${target}`);
    if ("$ref" in s) {
      assert.match(s.$ref, /^(#|[A-Za-z][A-Za-z0-9+.-]*:)/, `$ref at ${at}`);
      if (target === "draft-07") assert.deepEqual(Object.keys(s).filter((k) => k !== "$ref" && !ANNOTATIONS.has(k)), [], `$ref with siblings at ${at}`);
    }
    if (target === "draft-2020-12") assert.ok(!Array.isArray(s.items), `a list of items at ${at}`);
    for (const key of ONE) if (key in s && !Array.isArray(s[key])) walk(s[key], `${at}/${key}`, false);
    for (const key of LIST) if (Array.isArray(s[key])) s[key].forEach((item: any, i: number) => walk(item, `${at}/${key}/${i}`, false));
    for (const key of MAP) if (s[key] && typeof s[key] === "object") for (const [name, item] of Object.entries(s[key])) if (!Array.isArray(item)) walk(item, `${at}/${key}/${name}`, false);
  };
  walk(schema, "#", true);
}

const JUNK = [null, true, false, 0, -1, 1.5, "", "x", [], [1], ["a", "b"], {}, { a: 1 }];

/**
 * The equivalence: Motherload's validator accepts `valid` and refuses `invalid` (so the values do
 * test the schema), and the schema produced for each target, compiled by ajv for that target, gives
 * the same verdict on each of them and on a handful of unrelated values.
 */
async function equivalent(source: string, path: string, valid: unknown[], invalid: unknown[], targets = TARGETS, strictSchema = true) {
  const is = await motherload(source, path);
  for (const value of valid) assert.equal(is(value), true, `Motherload refuses ${JSON.stringify(value)}`);
  for (const value of invalid) assert.equal(is(value), false, `Motherload accepts ${JSON.stringify(value)}`);
  const results = fromSource(source, path);
  for (const target of targets) {
    const schema = schemaOf(results[target]);
    wellFormed(target, schema);
    const validate = compileFor(target, schema, strictSchema);
    for (const value of [...valid, ...invalid, ...JUNK]) assert.equal(validate(value), is(value), `${target} on ${JSON.stringify(value)}: ${JSON.stringify(schema)}`);
  }
}
const equivalentFile = (path: string, valid: unknown[], invalid: unknown[], targets = TARGETS) => equivalent(readFileSync(path, "utf8"), path, valid, invalid, targets);
const equivalentSchema = (schema: unknown, valid: unknown[], invalid: unknown[], targets = TARGETS, strictSchema = true) => equivalent(JSON.stringify(schema), VIRTUAL, valid, invalid, targets, strictSchema);

// ---- conversions --------------------------------------------------------------------------------

test("definitions and $defs trade places, with the pointers that name them", async () => {
  const defs = { a: { type: "string" }, "b/c": { $ref: "#/definitions/a" } };
  const results = convert({ definitions: defs, properties: { x: { $ref: "#/definitions/b~1c" } } });
  assert.deepEqual(schemaOf(results["draft-07"]), { $schema: D07, definitions: defs, properties: { x: { $ref: "#/definitions/b~1c" } } });
  assert.deepEqual(schemaOf(results["draft-2020-12"]), { $schema: D2020, $defs: { a: { type: "string" }, "b/c": { $ref: "#/$defs/a" } }, properties: { x: { $ref: "#/$defs/b~1c" } } });
  const back = convert({ $schema: D2020, $defs: { n: { type: "number" } }, items: { $ref: "#/$defs/n" } });
  assert.deepEqual(schemaOf(back["draft-07"]), { $schema: D07, definitions: { n: { type: "number" } }, items: { $ref: "#/definitions/n" } });
  // ajv reads both containers in every draft; a draft-07 schema's `$defs` joins `definitions`.
  const both = convert({ definitions: { a: { type: "string" } }, $defs: { b: { $ref: "#/definitions/a" } }, $ref: "#/$defs/b" });
  assert.deepEqual(schemaOf(both["draft-2020-12"]), { $schema: D2020, $defs: { a: { type: "string" }, b: { $ref: "#/$defs/a" } }, $ref: "#/$defs/b" });
  await equivalentSchema({ definitions: { a: { type: "string" } }, $defs: { b: { $ref: "#/definitions/a" } }, $ref: "#/$defs/b" }, ["x"], [1]);
});

test("a tuple: a list of items and additionalItems in draft-07, prefixItems and items in 2020-12", async () => {
  const s = { type: "string" };
  const n = { type: "number" };
  const legacy = {
    properties: {
      closed: { items: [s, n], additionalItems: false },
      open: { items: [s] },
      rest: { items: [s], additionalItems: n },
      // additionalItems beside a single items schema is ignored (draft-07 validation 6.4.2).
      list: { items: s, additionalItems: n },
      to: { $ref: "#/properties/closed/items/1" },
    },
  };
  const results = convert(legacy);
  assert.deepEqual(schemaOf(results["draft-07"]), { $schema: D07, properties: { ...legacy.properties, list: { items: s } } });
  assert.deepEqual(schemaOf(results["draft-2020-12"]), {
    $schema: D2020,
    properties: { closed: { prefixItems: [s, n], items: false }, open: { prefixItems: [s] }, rest: { prefixItems: [s], items: n }, list: { items: s }, to: { $ref: "#/properties/closed/prefixItems/1" } },
  });
  await equivalentSchema(legacy, [{ closed: ["a", 1], open: ["a", true], rest: ["a", 1, 2], list: ["a", "b"], to: 3 }], [{ closed: ["a", 1, 2] }, { open: [1] }, { rest: ["a", "b"] }, { list: [1] }, { to: "x" }]);

  const modern = {
    $schema: D2020,
    properties: {
      closed: { prefixItems: [s, n], items: false },
      open: { prefixItems: [s] },
      rest: { prefixItems: [s], items: n },
      list: { items: s },
      // 2020-12 has no additionalItems, so it is ignored beside prefixItems and left out.
      dead: { prefixItems: [s], additionalItems: false },
      to: { $ref: "#/properties/rest/items" },
    },
  };
  assert.deepEqual(schemaOf(convert(modern)["draft-07"]), {
    $schema: D07,
    properties: { closed: { items: [s, n], additionalItems: false }, open: { items: [s] }, rest: { items: [s], additionalItems: n }, list: { items: s }, dead: { items: [s] }, to: { $ref: "#/properties/rest/additionalItems" } },
  });
  await equivalentSchema(modern, [{ closed: ["a", 1], open: ["a", 2], rest: ["a", 1, 2], list: ["a"], dead: ["a", 1, 2], to: 5 }], [{ closed: ["a", 1, 2] }, { open: [1] }, { rest: ["a", "b"] }, { list: [1] }, { to: "x" }]);
});

test("dependencies splits into dependentRequired and dependentSchemas, and joins back", async () => {
  const legacy = { dependencies: { a: ["b"], c: { required: ["d"] } } };
  assert.deepEqual(schemaOf(convert(legacy)["draft-2020-12"]), { $schema: D2020, dependentRequired: { a: ["b"] }, dependentSchemas: { c: { required: ["d"] } } });
  assert.deepEqual(schemaOf(convert(legacy)["draft-07"]), { $schema: D07, ...legacy });
  await equivalentSchema(legacy, [{ a: 1, b: 1 }, { c: 1, d: 1 }, { b: 1, d: 1 }], [{ a: 1 }, { c: 1 }]);

  // A property with both: a schema that requires the names and applies the schema.
  const modern = { $schema: D2020, dependentRequired: { a: ["b"], c: ["e"] }, dependentSchemas: { c: { required: ["d"] }, f: { minProperties: 3 } } };
  assert.deepEqual(schemaOf(convert(modern)["draft-07"]), { $schema: D07, dependencies: { a: ["b"], c: { allOf: [{ required: ["e"] }, { required: ["d"] }] }, f: { minProperties: 3 } } });
  await equivalentSchema(modern, [{ a: 1, b: 1 }, { c: 1, d: 1, e: 1 }, { f: 1, g: 1, h: 1 }], [{ a: 1 }, { c: 1, d: 1 }, { c: 1, e: 1 }, { f: 1 }]);
});

test("a $ref beside other keywords: draft-07 moves it into allOf; 2020-12 keeps it as ajv applied it", async () => {
  const modern = {
    $schema: D2020,
    $defs: { n: { type: "number" } },
    properties: {
      a: { $ref: "#/$defs/n", minimum: 1, description: "d" },
      b: { $ref: "#/$defs/n", allOf: [{ maximum: 9 }] },
      c: { $ref: "#/$defs/n", title: "annotations only" },
    },
  };
  assert.deepEqual(schemaOf(convert(modern)["draft-07"]), {
    $schema: D07,
    definitions: { n: { type: "number" } },
    properties: {
      a: { minimum: 1, description: "d", allOf: [{ $ref: "#/definitions/n" }] },
      b: { allOf: [{ maximum: 9 }, { $ref: "#/definitions/n" }] },
      c: { $ref: "#/definitions/n", title: "annotations only" },
    },
  });
  await equivalentSchema(modern, [{ a: 2, b: 5, c: 0 }], [{ a: 0 }, { a: "x" }, { b: 10 }, { b: "x" }, { c: "x" }]);
  // Draft-07's text ignores a $ref's siblings; ajv, Motherload's validator, applies them, and so does the 2020-12 schema.
  const legacy = { definitions: { n: { type: "number" } }, $ref: "#/definitions/n", minimum: 1 };
  assert.deepEqual(schemaOf(convert(legacy)["draft-2020-12"]), { $schema: D2020, $defs: { n: { type: "number" } }, $ref: "#/$defs/n", minimum: 1 });
  // At the root, $schema is beside it too.
  assert.deepEqual(schemaOf(convert(legacy)["draft-07"]), { $schema: D07, definitions: { n: { type: "number" } }, minimum: 1, allOf: [{ $ref: "#/definitions/n" }] });
  assert.deepEqual(schemaOf(convert({ $ref: "#/definitions/n", definitions: { n: {} } })["draft-07"]), { $schema: D07, definitions: { n: {} }, allOf: [{ $ref: "#/definitions/n" }] });
  await equivalentSchema(legacy, [1, 2], [0, "x"]);
});

test("a plain-name $id is an $anchor, and a reference to an anchor becomes a pointer", async () => {
  const legacy = { definitions: { p: { $id: "#pos", type: "integer", minimum: 0 } }, items: { $ref: "#pos" } };
  assert.deepEqual(schemaOf(convert(legacy)["draft-2020-12"]), { $schema: D2020, $defs: { p: { $anchor: "pos", type: "integer", minimum: 0 } }, items: { $ref: "#/$defs/p" } });
  assert.deepEqual(schemaOf(convert(legacy)["draft-07"]), { $schema: D07, definitions: { p: { $id: "#pos", type: "integer", minimum: 0 } }, items: { $ref: "#/definitions/p" } });
  await equivalentSchema(legacy, [[0, 1]], [[-1], [1.5]]);
  const modern = { $schema: D2020, $defs: { p: { $anchor: "pos", type: "integer" } }, items: { $ref: "#pos" } };
  assert.deepEqual(schemaOf(convert(modern)["draft-07"]), { $schema: D07, definitions: { p: { $id: "#pos", type: "integer" } }, items: { $ref: "#/definitions/p" } });
  await equivalentSchema(modern, [[1]], [["x"]]);
});

test("every other file is folded under the root's container, by its base name, de-duplicated, without its $id", () => {
  const dir = project({
    "team.schema.jsonc": { definitions: { user: { type: "string" } }, properties: { a: { $ref: "./user.schema.jsonc" }, b: { $ref: "more/user.schema.json5#/properties/x" }, c: { $ref: "#/definitions/user" } } },
    "user.schema.jsonc": { $id: "https://example.com/user", $schema: D07, type: "object", properties: { back: { $ref: "./team.schema.jsonc" } } },
    "more/user.schema.json5": "{ properties: { x: { type: 'string' } } }",
  });
  const results = fromFile(join(dir, "team.schema.jsonc"));
  assert.deepEqual(schemaOf(results["draft-2020-12"]), {
    $schema: D2020,
    $defs: { user: { type: "string" }, user2: { type: "object", properties: { back: { $ref: "#" } } }, user3: { properties: { x: { type: "string" } } } },
    properties: { a: { $ref: "#/$defs/user2" }, b: { $ref: "#/$defs/user3/properties/x" }, c: { $ref: "#/$defs/user" } },
  });
  // A root with no definitions of its own gets the container.
  const alone = project({ "a.schema.jsonc": { $schema: D2020, items: { $ref: "./b.schema.jsonc" } }, "b.schema.jsonc": { type: "number" } });
  assert.deepEqual(schemaOf(fromFile(join(alone, "a.schema.jsonc"))["draft-07"]), { $schema: D07, items: { $ref: "#/definitions/b" }, definitions: { b: { type: "number" } } });
});

test("a URL is left as written, the root keeps its own $id, and a pointer is escaped as a fragment", async () => {
  const urls = convert({ $id: "https://example.com/root.json#", properties: { x: { $ref: "https://example.com/elsewhere.json#/a" } } });
  assert.deepEqual(schemaOf(urls["draft-2020-12"]), { $schema: D2020, $id: "https://example.com/root.json", properties: { x: { $ref: "https://example.com/elsewhere.json#/a" } } });
  assert.deepEqual(schemaOf(urls["draft-07"]), { $schema: D07, $id: "https://example.com/root.json#", properties: { x: { $ref: "https://example.com/elsewhere.json#/a" } } });
  const odd = { $schema: D2020, $defs: { "a b%~/é": { type: "string" } }, properties: { p: { $ref: "#/$defs/a%20b%25~0~1%C3%A9" } } };
  assert.deepEqual(schemaOf(convert(odd)["draft-07"]).properties.p, { $ref: "#/definitions/a%20b%25~0~1%C3%A9" });
  await equivalentSchema(odd, [{ p: "x" }], [{ p: 1 }]);
});

test("a boolean schema declares its draft as an object", () => {
  assert.deepEqual(schemaOf(convert(true)["draft-2020-12"]), { $schema: D2020 });
  assert.deepEqual(schemaOf(convert(false)["draft-07"]), { $schema: D07, not: {} });
  assert.deepEqual(schemaOf(convert({ properties: { a: false } })["draft-07"]), { $schema: D07, properties: { a: false } });
});

test("a keyword the schema's draft does not define is left out, as ajv ignored it, and a vendor's keyword is kept", async () => {
  const legacy = { type: "array", prefixItems: [{ type: "string" }], unevaluatedItems: false, minContains: 2, dependentRequired: { a: ["b"] }, "x-vendor": { $ref: "./nowhere.schema.jsonc" } };
  for (const target of TARGETS) assert.deepEqual(schemaOf(convert(legacy)[target]), { $schema: TARGET_URIS[target], type: "array", "x-vendor": { $ref: "./nowhere.schema.jsonc" } });
  await equivalentSchema(legacy, [[1], [1, "a"]], [{}], TARGETS, false);
  // Without `contains`, minContains and maxContains do nothing, so draft-07 can do without them.
  assert.deepEqual(schemaOf(convert({ $schema: D2020, minContains: 2, maxContains: 3 })["draft-07"]), { $schema: D07 });
});

test("2020-12's $dynamicRef stays in a schema of one file", async () => {
  const tree = { $schema: D2020, $dynamicAnchor: "node", type: "object", properties: { value: { type: "number" }, children: { type: "array", items: { $dynamicRef: "#node" } } } };
  assert.deepEqual(schemaOf(convert(tree)["draft-2020-12"]), tree);
  await equivalentSchema(tree, [{ value: 1, children: [{ value: 2, children: [] }] }], [{ children: [{ value: "x" }] }, { children: [1] }], ["draft-2020-12"]);
});

// ---- refusals -----------------------------------------------------------------------------------

test("draft-07 refuses the keywords it has no equivalent of, naming each and where it is; 2020-12 keeps them", () => {
  const cases: [unknown, string][] = [
    [{ $schema: D2020, properties: { a: { unevaluatedProperties: false } } }, `"unevaluatedProperties" at ./virtual.schema.jsonc#/properties/a/unevaluatedProperties has no equivalent in draft-07.`],
    [{ $schema: D2020, items: { unevaluatedItems: false } }, `"unevaluatedItems" at ./virtual.schema.jsonc#/items/unevaluatedItems has no equivalent in draft-07.`],
    [{ $schema: D2020, contains: { type: "string" }, minContains: 2 }, `"minContains" at ./virtual.schema.jsonc#/minContains has no equivalent in draft-07.`],
    [{ $schema: D2019, contains: { type: "string" }, maxContains: 2 }, `"maxContains" at ./virtual.schema.jsonc#/maxContains has no equivalent in draft-07.`],
    [{ $schema: D2020, $dynamicAnchor: "node", items: { $dynamicRef: "#node" } }, `"$dynamicAnchor" at ./virtual.schema.jsonc#/$dynamicAnchor has no equivalent in draft-07. "$dynamicRef" at ./virtual.schema.jsonc#/items/$dynamicRef has no equivalent in draft-07.`],
  ];
  for (const [schema, error] of cases) {
    const results = convert(schema);
    assert.equal(errorOf(results["draft-07"]), error);
    schemaOf(results["draft-2020-12"]);
  }
});

test("2019-09's $recursiveRef and $recursiveAnchor have no exact equivalent in either target", () => {
  const results = convert({ $schema: D2019, $recursiveAnchor: true, items: { $recursiveRef: "#" } });
  assert.match(errorOf(results["draft-07"]), /"\$recursiveAnchor" at \.\/virtual\.schema\.jsonc#\/\$recursiveAnchor has no equivalent in draft-07\. "\$recursiveRef" at \.\/virtual\.schema\.jsonc#\/items\/\$recursiveRef/);
  assert.match(errorOf(results["draft-2020-12"]), /"\$recursiveAnchor" at \.\/virtual\.schema\.jsonc#\/\$recursiveAnchor is 2019-09's, and 2020-12's "\$dynamicRef" and "\$dynamicAnchor", which replaced it, do not resolve the same way\./);
});

test("2019-09's unevaluatedItems is refused for 2020-12 when the schema uses contains, which 2020-12 counts and 2019-09 does not", () => {
  const counted = convert({ $schema: D2019, allOf: [{ contains: { type: "string" } }], unevaluatedItems: false });
  assert.equal(errorOf(counted["draft-2020-12"]), `"unevaluatedItems" at ./virtual.schema.jsonc#/unevaluatedItems counts the items "contains" matches as evaluated in 2020-12 and not in 2019-09, and this schema uses "contains".`);
  // A property named "contains" is data, not the keyword.
  schemaOf(convert({ $schema: D2019, properties: { contains: { type: "string" } }, unevaluatedItems: false })["draft-2020-12"]);
});

test("an $id inside a schema, a $dynamicRef across files, and a pointer to no schema are refused in both targets", () => {
  const embedded = convert({ definitions: { a: { $id: "https://example.com/a", type: "string" } } });
  for (const target of TARGETS) assert.match(errorOf(embedded[target]), /^"\$id" at \.\/virtual\.schema\.jsonc#\/definitions\/a\/\$id gives a schema inside the file a base URI of its own/);
  const dir = project({ "a.schema.jsonc": { $schema: D2020, $dynamicAnchor: "x", items: { $ref: "./b.schema.jsonc" } }, "b.schema.jsonc": { $dynamicAnchor: "x", items: { $dynamicRef: "#x" } } });
  const dynamic = fromFile(join(dir, "a.schema.jsonc"));
  assert.match(errorOf(dynamic["draft-2020-12"]), /"\$dynamicAnchor" at \.\/a\.schema\.jsonc#\/\$dynamicAnchor resolves through the schema files it was written across.*"\$dynamicRef" at \.\/b\.schema\.jsonc#\/items\/\$dynamicRef/);
  const vendor = convert({ "x-defs": { a: { type: "string" } }, properties: { p: { $ref: "#/x-defs/a" } } });
  for (const target of TARGETS) assert.equal(errorOf(vendor[target]), `"$ref" at ./virtual.schema.jsonc#/properties/p/$ref: "#/x-defs/a" points to something that is not a schema, or to a schema the conversion leaves out.`);
  const clash = convert({ definitions: { a: { type: "string" } }, $defs: { a: { type: "number" } } });
  assert.match(errorOf(clash["draft-2020-12"]), /"\$defs" at \.\/virtual\.schema\.jsonc#\/\$defs and "definitions" both define "a"\./);
});

test("a reference that cannot be followed is the module's problem, and both targets' error", () => {
  const dir = project({ "a.schema.jsonc": { items: { $ref: "./missing.schema.jsonc" } } });
  for (const target of TARGETS) assert.match(errorOf(fromFile(join(dir, "a.schema.jsonc"))[target]), /names a file that does not exist/);
});

// ---- equivalence across files -------------------------------------------------------------------

test("equivalence: a 2020-12 schema across two files (tests/fixtures/json-schema/order.schema.jsonc)", async () => {
  const line = { sku: "ABC-1", qty: 2, price: 9.99 };
  const order = { id: "o-1", lines: [line] };
  await equivalentFile(
    join(FIXTURES, "order.schema.jsonc"),
    [order, { ...order, point: [1, 2], tags: ["first", "a"], total: 10.5, placed: "2026-10-20T10:00:00Z" }, { ...order, gift: true, note: "for you" }, { ...order, lines: [{ ...line, order }] }, { ...order, code: "abcd" }],
    [
      { id: "x-1", lines: [line] },
      { id: "o-1", lines: [] },
      { ...order, lines: [{ ...line, sku: "abc" }] },
      { ...order, lines: [{ ...line, price: 1.001 }] },
      { ...order, point: [1, 2, 3] },
      { ...order, tags: ["second"] },
      { ...order, tags: ["first", 1] },
      { ...order, total: -1 },
      { ...order, total: 1.234 },
      { ...order, gift: true },
      { ...order, gift: true, note: "hi" },
      { ...order, placed: "2026-10-20T10:00:00Z" },
      { ...order, placed: "yesterday", total: 1 },
      { ...order, lines: [{ ...line, order: { id: "nope" } }] },
      { ...order, code: "abcde" },
    ],
  );
});

test("equivalence: a draft-07 schema across two files, one referred to by its absolute $id (legacy.schema.jsonc)", async () => {
  const tree = { value: 1, children: [{ value: 2, children: [] }] };
  await equivalentFile(
    join(FIXTURES, "legacy.schema.jsonc"),
    [{}, { pair: ["a", 1], head: ["a", true, false], list: [1, 2], tree, owner: "Ada", contact: { name: "Ada", boss: { name: "Grace" } } }, { a: 1, b: 2 }, { c: 1, d: 1 }],
    [{ pair: ["a", 1, 2] }, { pair: [1, 1] }, { head: ["a", 1] }, { list: ["x"] }, { tree: { value: 1, children: [{}] } }, { owner: "" }, { owner: "x".repeat(11) }, { contact: { name: "Ada", boss: {} } }, { contact: { name: "Ada", email: "nope" } }, { a: 1 }, { c: 1 }],
  );
});

test("equivalence: a 2019-09 schema in 2020-12 (shape.schema.jsonc); draft-07 refuses its unevaluated keywords", async () => {
  await equivalentFile(
    join(FIXTURES, "shape.schema.jsonc"),
    [{ kind: "circle", center: [0, 0], radius: 1 }, { kind: "polygon", vertices: [[0, 0], [1, 0], [0, 1]] }, { labels: ["a"] }],
    [{ center: [0, 0] }, { center: [0, 0], radius: 0 }, { vertices: [[0, 0], [1, 0]] }, { vertices: [[0, 0], [1, 0], [0, 1, 2]] }, { labels: ["a", "b"] }, { other: 1 }],
    ["draft-2020-12"],
  );
  const error = errorOf(fromFile(join(FIXTURES, "shape.schema.jsonc"))["draft-07"]);
  assert.match(error, /"unevaluatedItems" at \.\/shape\.schema\.jsonc#\/properties\/labels\/unevaluatedItems has no equivalent in draft-07\./);
  assert.match(error, /"unevaluatedProperties" at \.\/shape\.schema\.jsonc#\/unevaluatedProperties has no equivalent in draft-07\./);
});

test("equivalence: lab/basic's schemas, team's references to user and shared/place included", async () => {
  const lab = (name: string) => join(ROOT, "lab/basic", name);
  const ada = { name: "Ada", role: "admin", email: "ada@example.com", tags: ["a", "b"] };
  await equivalentFile(lab("user.schema.jsonc"), [ada, { name: "G", role: "member" }], [{ name: "", role: "admin" }, { name: "Ada" }, { ...ada, email: "nope" }, { ...ada, tags: ["a", "a"] }, { ...ada, extra: 1 }]);
  await equivalentFile(
    lab("team.schema.jsonc"),
    [{ lead: ada, members: [] }, { lead: ada, members: [ada], office: { city: "London", manager: ada } }],
    [{ lead: ada }, { lead: { name: "Ada" }, members: [] }, { lead: ada, members: [{}] }, { lead: ada, members: [], office: { city: "" } }, { lead: ada, members: [], office: { city: "Paris", manager: { name: "x" } } }, { lead: ada, members: [], extra: 1 }],
  );
  const team = schemaOf(fromFile(lab("team.schema.jsonc"))["draft-2020-12"]);
  assert.deepEqual(team.properties.office, { $ref: "#/$defs/place/$defs/place" });
  assert.deepEqual(team.$defs.place.$defs.place.properties.manager, { $ref: "#/$defs/user" });
  await equivalentFile(
    lab("event.schema.jsonc"),
    [{ at: "2026-10-20T10:00:00Z", kind: "click", x: 1, y: 2 }, { at: "2026-10-20T10:00:00Z", kind: "visit", url: "https://example.com" }],
    [{ at: "today", kind: "click", x: 1, y: 2 }, { at: "2026-10-20T10:00:00Z", kind: "click", x: 1 }, { at: "2026-10-20T10:00:00Z", kind: "visit", url: "not a uri" }, { at: "2026-10-20T10:00:00Z", kind: "other" }],
  );
  await equivalentFile(lab("point.schema.json5"), [{ x: 1, y: 2 }, { x: 1, y: 2, label: "sixteen chars.." }], [{ x: 1 }, { x: 1.5, y: 2 }, { x: 1, y: 2, label: "x".repeat(17) }, { x: 1, y: 2, z: 3 }]);
});
