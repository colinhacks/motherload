// The schema module's two validators and the copy ajv compiles: `is` (without allErrors) and
// `validate` (with it) agree on every value, `contains` beside a tuple included, where ajv's
// first-failure code alone passed `[]`; and a oneOf whose variants a property tells apart reports
// the matching variant's issues alone, through ajv's discriminator, with the same verdicts as the
// oneOf compiled as written.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseSchemaFile } from "../packages/schema/src/refs.ts";
import { filesOf, schemaCode, withDiscriminators } from "../packages/schema/src/schema.ts";
import { evaluate, ROOT } from "./helpers.ts";

const PATH = join(ROOT, "tests/fixtures/verdicts.schema.jsonc");
const D07 = "http://json-schema.org/draft-07/schema#";
const D2020 = "https://json-schema.org/draft/2020-12/schema";

type Module = { is(value: unknown): boolean; validate(value: unknown): { value?: unknown; issues?: { message: string; path: (string | number)[]; keyword: string }[] }; schema: unknown };

/** How many oneOfs of a schema get ajv's discriminator in the copy the validator is compiled from. */
function discriminators(source: string, path = PATH): number {
  const parsed = parseSchemaFile(source, path);
  assert.ok(parsed.ok);
  return withDiscriminators(filesOf(source, path, parsed.value)).count;
}

async function build(source: string, path = PATH, discriminators = true): Promise<{ module: Module; code: string }> {
  const { code, problems } = schemaCode(source, path, { discriminators });
  assert.deepEqual(problems, [], source);
  return { module: (await evaluate(code)).default, code };
}

/** A directory of schema files, each written as JSON, with the root's path and text. */
function project(files: Record<string, unknown>, root: string) {
  const dir = mkdtempSync(join(tmpdir(), "motherload-verdicts-"));
  for (const [name, schema] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, name)), { recursive: true });
    writeFileSync(join(dir, name), JSON.stringify(schema, null, 2));
  }
  return { path: join(dir, root), source: readFileSync(join(dir, root), "utf8") };
}

/** A small seeded generator, so a failure names values that come back on the next run. */
function random(seed: number): () => number {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}

/**
 * Values to try against a schema: JSON's kinds, empty and nested-empty arrays and objects, every
 * literal the schema holds (`const`, `enum`, `default`, `examples`), and objects keyed by every
 * property name it mentions, with arrays of those, to a few levels.
 */
function samples(schema: unknown, count = 400): unknown[] {
  const literals: unknown[] = [];
  const names = new Set<string>();
  const walk = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(walk);
    if (typeof node !== "object" || node === null) return;
    for (const [key, value] of Object.entries(node)) {
      if (key === "const" || key === "default") literals.push(value);
      if ((key === "enum" || key === "examples") && Array.isArray(value)) literals.push(...value);
      if ((key === "properties" || key === "patternProperties" || key === "dependentRequired" || key === "dependentSchemas") && typeof value === "object" && value !== null) Object.keys(value).forEach((name) => names.add(name));
      if (key === "required" && Array.isArray(value)) value.forEach((name) => typeof name === "string" && names.add(name));
      walk(value);
    }
  };
  walk(schema);
  const base: unknown[] = [null, true, false, 0, 1, -1, 2, 1.5, 0.3, "", "a", "ab", "Ada", "2026-10-20T09:00:00Z", "yesterday", "https://example.com/a", "ada@example.com", [], [[]], [[], []], {}, { a: {} }, [{}], ...literals];
  const next = random(names.size * 31 + literals.length + 7);
  const pick = <T>(list: readonly T[]): T => list[Math.floor(next() * list.length)]!;
  const pool = [...base];
  const keys = [...names, "extra"];
  for (let level = 0; level < 3; level++) {
    const made: unknown[] = [];
    for (let i = 0; i < count / 4; i++) {
      const object: Record<string, unknown> = {};
      for (const key of keys) if (next() < 0.6) object[key] = pick(pool);
      made.push(object);
      made.push(Array.from({ length: Math.floor(next() * 4) }, () => pick(pool)));
    }
    pool.push(...made);
  }
  return [...base, ...pool.slice(base.length).filter(() => next() < count / pool.length)];
}

/** Every schema file in the labs and the test fixtures but the broken ones, which have no module. */
function schemaFiles(): string[] {
  const found: string[] = [];
  const visit = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) {
        if (name !== "node_modules" && name !== "dist" && name !== "universal" && name !== "errors") visit(path);
      } else if (/\.schema\.json[c5]$/.test(name)) found.push(path);
    }
  };
  visit(join(ROOT, "lab"));
  visit(join(ROOT, "tests/fixtures"));
  return found;
}

/** Schemas written in this repository's tests, beside its files: the keywords whose verdicts depend on the validator's options or ajv's code paths. */
const INLINE: unknown[] = [
  { $schema: D2020, prefixItems: [{ type: "string" }], contains: { type: "number" } },
  { $schema: D07, items: [{ type: "string" }], contains: { type: "number" } },
  { $schema: D2020, type: "object", properties: { a: { prefixItems: [{ type: "string" }], contains: { type: "number" }, minContains: 2 } } },
  { $schema: D2020, type: "array", contains: { type: "number" }, unevaluatedItems: { type: "boolean" } },
  { $schema: D2020, type: "object", properties: { a: true }, unevaluatedProperties: false, oneOf: [{ required: ["a"] }, { required: ["b"] }] },
  { type: "object", properties: { name: { type: "string", minLength: 1 }, tags: { type: "array", uniqueItems: true } }, required: ["name"], additionalProperties: false },
  { type: "object", propertyNames: { pattern: "^a" }, minProperties: 1, maxProperties: 2 },
  { type: "object", dependencies: { a: ["b"], c: { required: ["d"] } } },
  { $schema: D2020, dependentRequired: { a: ["b"] }, dependentSchemas: { c: { required: ["d"] } } },
  { if: { properties: { a: { const: 1 } }, required: ["a"] }, then: { required: ["b"] }, else: { required: ["c"] } },
  { anyOf: [{ type: "string" }, { type: "array", items: { type: "number" } }], not: { const: "x" } },
  { multipleOf: 0.01 },
  { type: "object", properties: { toString: { type: "string" } }, required: ["a"] },
  { $defs: { node: { type: "object", properties: { kids: { type: "array", items: { $ref: "#/$defs/node" } } } } }, $ref: "#/$defs/node" },
];

test("is and validate give the same verdict on every value, for every schema in the labs, the fixtures and these tests", async () => {
  const sources = [...schemaFiles().map((path) => ({ path, source: readFileSync(path, "utf8") })), ...INLINE.map((schema) => ({ path: PATH, source: JSON.stringify(schema) }))];
  let checked = 0;
  for (const { path, source } of sources) {
    const { code, problems } = schemaCode(source, path);
    // A fixture that is not meant to compile (a reference to nothing, a draft refused) has no module.
    if (problems.length) continue;
    const { default: module } = await evaluate(code);
    for (const value of samples(module.schema)) {
      assert.equal(module.is(value), module.validate(value).issues === undefined, `${path} on ${JSON.stringify(value)}`);
      checked++;
    }
  }
  assert.ok(checked > 10000, String(checked));
});

test("is confirms a pass with validate's validator where ajv's first-failure code passes [] for contains beside a tuple", async () => {
  for (const schema of INLINE.slice(0, 3)) {
    const { module, code } = await build(JSON.stringify(schema));
    assert.match(code, /^const __confirm = true;$/m);
    const empty = schema === INLINE[2] ? { a: [] } : [];
    assert.equal(module.is(empty), false, JSON.stringify(schema));
    assert.deepEqual(module.validate(empty).issues?.map((issue) => issue.keyword), ["contains"]);
    assert.equal(module.is(schema === INLINE[2] ? { a: ["x", 1, 2] } : ["x", 1]), true);
  }
  // Only there: `contains` alone, and a tuple alone, are not confirmed.
  assert.match((await build(JSON.stringify({ contains: { type: "number" } }))).code, /^const __confirm = false;$/m);
  assert.match((await build(JSON.stringify({ type: "array", items: { type: "string" } }))).code, /^const __confirm = false;$/m);
  // In a file the schema refers to.
  const { path, source } = project({ "list.schema.jsonc": { type: "object", properties: { tags: { $ref: "./tags.schema.jsonc" } } }, "tags.schema.jsonc": { items: [{ type: "string" }], contains: { const: 1 } } }, "list.schema.jsonc");
  const { module, code } = await build(source, path);
  assert.match(code, /^const __confirm = true;$/m);
  assert.equal(module.is({ tags: [] }), false);
});

const EVENT = join(ROOT, "lab/basic/event.schema.jsonc");

test("a oneOf whose variants a property tells apart reports the matching variant's issues alone", async () => {
  const { module } = await build(readFileSync(EVENT, "utf8"), EVENT);
  assert.equal(discriminators(readFileSync(EVENT, "utf8"), EVENT), 1);
  const at = "2026-10-20T09:00:00Z";
  const issues = (value: unknown) => module.validate(value).issues?.map(({ path, keyword, message }) => [path, keyword, message]);
  // Without the discriminator, ajv also reported `required 'url'`, the click's own `const` and the oneOf.
  assert.deepEqual(issues({ kind: "click", x: 1 }), [
    [["at"], "required", "must have required property 'at'"],
    [["y"], "required", "must have required property 'y'"],
  ]);
  assert.deepEqual(issues({ at, kind: "visit", url: "not a uri" }), [[["url"], "format", 'must match format "uri"']]);
  // An unknown tag, and one that is not a string: the property's own rule, then the oneOf at the tag.
  assert.deepEqual(issues({ at, kind: "nope" }), [
    [["kind"], "enum", "must be equal to one of the allowed values"],
    [["kind"], "oneOf", 'value of tag "kind" must be in oneOf'],
  ]);
  assert.deepEqual(issues({ at, kind: 5 }), [
    [["kind"], "enum", "must be equal to one of the allowed values"],
    [["kind"], "oneOf", 'tag "kind" must be string'],
  ]);
  assert.deepEqual(issues(5), [[[], "type", "must be object"]]);
  // The module's schema and its Standard JSON Schema are the file as written.
  assert.doesNotMatch(JSON.stringify(module.schema), /discriminator/);
  assert.doesNotMatch(JSON.stringify((module as any)["~standard"].jsonSchema.input({ target: "draft-2020-12" })), /discriminator/);
});

/** A oneOf of a cat and a dog, told apart by `kind`, inside a property. */
const pets = (variants: unknown[], extra: object = {}) => ({ $schema: D2020, type: "object", properties: { pet: { type: "object", required: ["kind"], oneOf: variants, ...extra } } });
const CAT = { properties: { kind: { const: "cat" }, lives: { type: "integer" } }, required: ["lives"] };
const DOG = { properties: { kind: { enum: ["dog"] }, bark: { type: "string" } }, required: ["bark"] };

test("the discriminator is added through a $ref, in another file, and in a nested union, and only where ajv's rules hold", async () => {
  const tagged = async (schema: unknown, path = PATH, source = JSON.stringify(schema)) => {
    await build(source, path);
    return discriminators(source, path) === 1;
  };
  // A nested union; a variant that is only a $ref, in the file and in another file.
  const { module } = await build(JSON.stringify(pets([CAT, DOG])));
  assert.deepEqual(module.validate({ pet: { kind: "dog" } }).issues?.map(({ path, keyword }) => [path, keyword]), [[["pet", "bark"], "required"]]);
  assert.equal(await tagged({ ...pets([{ $ref: "#/$defs/cat" }, DOG]), $defs: { cat: CAT } }), true);
  const other = project({ "pet.schema.jsonc": pets([{ $ref: "./cat.schema.jsonc" }, DOG]), "cat.schema.jsonc": CAT }, "pet.schema.jsonc");
  assert.equal(await tagged(undefined, other.path, other.source), true);
  // Where ajv's discriminator would not give the oneOf's verdict, or would refuse the schema: the flat list.
  for (const [schema, why] of [
    [{ ...pets([CAT, DOG]), properties: { pet: { required: ["kind"], oneOf: [CAT, DOG] } } }, "no type: object, so a number would pass"],
    [pets([CAT, { ...DOG, properties: { kind: { enum: ["dog", "wolf"] } } }]), "an enum of two"],
    [pets([CAT, { ...DOG, properties: { kind: { const: "cat" } } }]), "the same tag twice"],
    [pets([CAT, { ...DOG, properties: { kind: { const: 1 } } }]), "a tag that is not a string"],
    [pets([CAT, { ...DOG, properties: { kind: { const: "" } } }]), "an empty tag, which ajv reads as no const"],
    [pets([CAT, { ...DOG, properties: { bark: { type: "string" } } }]), "a variant without the tag"],
    [{ $schema: D2020, type: "object", oneOf: [CAT, DOG] }, "the tag not required"],
    [{ ...pets([{ $ref: "#/$defs/cat", title: "Cat" }, DOG]), $defs: { cat: CAT } }, "a $ref beside another keyword, which ajv does not follow"],
    [pets([{ allOf: [CAT] }, DOG]), "the tag under allOf"],
    [{ ...pets([CAT, DOG]), unevaluatedProperties: false }, "unevaluatedProperties, which ajv's discriminator does not pass what its variant evaluated to"],
  ] as const) {
    assert.equal(await tagged(schema), false, why);
  }
  // A discriminator the schema holds itself (OpenAPI's, with a mapping ajv refuses) is ignored, as before.
  const own = { ...pets([CAT, DOG]), discriminator: { propertyName: "kind", mapping: { cat: "#/x" } } };
  const { module: ownModule } = await build(JSON.stringify(own));
  assert.equal(ownModule.is({ pet: { kind: "cat", lives: 9 } }), true);
});

test("with the discriminator, every value gets the verdict the oneOf as written gives", async () => {
  const cases = [
    { path: EVENT, source: readFileSync(EVENT, "utf8") },
    { path: PATH, source: JSON.stringify(pets([CAT, DOG])) },
    { path: PATH, source: JSON.stringify({ ...pets([{ $ref: "#/$defs/cat" }, DOG]), $defs: { cat: CAT } }) },
  ];
  for (const { path, source } of cases) {
    const tagged = await build(source, path);
    const flat = await build(source, path, false);
    assert.equal(discriminators(source, path), 1);
    assert.notEqual(tagged.code, flat.code);
    const values = samples(tagged.module.schema, 2000);
    values.push({ pet: { kind: "cat", lives: 9 } }, { pet: { kind: "dog", bark: "woof" } }, { pet: { kind: "cat", bark: "woof" } });
    values.push({ at: "2026-10-20T09:00:00Z", kind: "click", x: 1, y: 2 }, { at: "2026-10-20T09:00:00Z", kind: "visit", url: "https://example.com/a" }, { at: "2026-10-20T09:00:00Z", kind: "click", x: 1, y: 2, url: "https://example.com/a" });
    for (const value of values) {
      const verdict = flat.module.is(value);
      assert.equal(tagged.module.is(value), verdict, `${source} on ${JSON.stringify(value)}`);
      assert.equal(tagged.module.validate(value).issues === undefined, verdict, `${source} on ${JSON.stringify(value)}`);
    }
    assert.ok(values.some((value) => flat.module.is(value)), `some sample passes ${source}`);
  }
});
