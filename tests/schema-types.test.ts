// Motherload's JSON Schema to TypeScript emitter: each rule on a small schema, and every emitted
// declaration through tsc.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schemaCode } from "../packages/schema/src/schema.ts";
import { schemaDeclarations, type Draft } from "../packages/schema/src/schema-types.ts";
import { evaluate, run, TSC } from "./helpers.ts";

const emit = (schema: unknown) => schemaDeclarations(schema as never);

test("an object root is an interface: required keys, optional keys, and no index signature when closed", () => {
  assert.equal(
    emit({ title: "User", type: "object", properties: { name: { type: "string", minLength: 1 }, "e-mail": { type: "string", format: "email" } }, required: ["name", "id"], additionalProperties: false }),
    'export interface Type {\n  name: string;\n  "e-mail"?: string | undefined;\n  id: never;\n}',
  );
});

test("keys outside `properties` are an index signature that covers the named ones", () => {
  assert.equal(emit({ type: "object", properties: { a: { type: "number" } } }), "export interface Type {\n  a?: number | undefined;\n  [key: string]: unknown;\n}");
  assert.equal(emit({ type: "object", properties: { a: { type: "number" } }, additionalProperties: { type: "string" } }), "export interface Type {\n  a?: number | undefined;\n  [key: string]: string | number | undefined;\n}");
  assert.equal(emit({ type: "object", patternProperties: { "^x-": { type: "number" } }, additionalProperties: false }), "export interface Type {\n  [key: string]: number;\n}");
  assert.equal(emit({ type: "object", properties: { a: { type: "null" } }, unevaluatedProperties: false }), "export interface Type {\n  a?: null | undefined;\n}");
  assert.equal(emit({ type: "object", additionalProperties: false }), "export interface Type {\n  [key: string]: never;\n}");
});

test("arrays and tuples, in 2020-12's spelling and draft-07's", () => {
  assert.equal(emit({ type: "array", items: { type: ["string", "number"] } }), "export type Type = (string | number)[];");
  assert.equal(emit({ type: "array" }), "export type Type = unknown[];");
  assert.equal(emit({ type: "array", prefixItems: [{ type: "string" }, { type: "number" }], minItems: 1, items: false }), "export type Type = [string, number?];");
  assert.equal(emit({ type: "array", prefixItems: [{ type: "string" }], minItems: 1, items: { type: "boolean" } }), "export type Type = [string, ...boolean[]];");
  assert.equal(emit({ type: "array", items: [{ type: "string" }, { type: "integer" }], additionalItems: false, minItems: 2 }), "export type Type = [string, number];");
  assert.equal(emit({ type: "array", items: [{ type: "string" }] }), "export type Type = [string?, ...unknown[]];");
});

test("const, enum, combinators, and the keywords that only narrow", () => {
  assert.equal(emit({ enum: ["a", 1, true, null] }), 'export type Type = "a" | 1 | true | null;');
  assert.equal(emit({ const: { a: [1] } }), "export interface Type { readonly a: readonly [1] }");
  assert.equal(emit({ anyOf: [{ type: "string" }, { oneOf: [{ type: "number" }, { type: "null" }] }] }), "export type Type = string | number | null;");
  assert.equal(emit({ type: "object", required: ["a"], allOf: [{ properties: { a: { type: "string" } } }] }), "export type Type = {\n  a: unknown;\n  [key: string]: unknown;\n} & {\n  a?: string | undefined;\n  [key: string]: unknown;\n};");
  assert.equal(emit({ type: "string", not: { const: "" }, if: { minLength: 2 }, then: { pattern: "^a" } }), "export type Type = string;");
  assert.equal(emit({ anyOf: [{ type: "string" }, true] }), "export type Type = unknown;");
  assert.equal(emit({ type: "string", allOf: [false] }), "export type Type = never;");
  assert.equal(emit({}), "export type Type = unknown;");
  // Without `type`, the object keywords constrain an object alone, and every other JSON value passes them.
  assert.equal(emit({ properties: { a: { type: "string" } }, additionalProperties: false }), "export type Type = {\n  a?: string | undefined;\n} | unknown[] | string | number | boolean | null;");
  assert.equal(emit({ items: { type: "string" } }), "export type Type = string[] | {\n  [key: string]: unknown;\n} | string | number | boolean | null;");
  // A member of `allOf`, `anyOf` or `oneOf` is read within its schema's own types, and `$ref`, `const` and `enum` tell them too.
  assert.equal(emit({ type: "object", allOf: [{ properties: { a: { type: "string" } } }] }), "export type Type = {\n  [key: string]: unknown;\n} & {\n  a?: string | undefined;\n  [key: string]: unknown;\n};");
  assert.equal(emit({ $ref: "#/$defs/a", properties: { b: { type: "number" } }, $defs: { a: { type: "object" } } }).split("\n\n")[0], "export type Type = A & {\n  b?: number | undefined;\n  [key: string]: unknown;\n};");
  assert.equal(emit({ anyOf: [{ type: "string" }, { const: 1 }], properties: { a: {} } }), "export type Type = string | 1;");
  assert.equal(emit({ type: "string", allOf: [{ properties: { a: {} } }] }), "export type Type = string;");
  // OpenAPI 3.0's `nullable` is no JSON Schema keyword: not read, and taken out of what ajv compiles.
  assert.equal(emit({ type: "string", nullable: true }), "export type Type = string;");
});

test("with a draft, a keyword is read only in the drafts that have it, as ajv reads it", () => {
  const tuple = { type: "array", prefixItems: [{ type: "string" }], items: [{ type: "number" }], additionalItems: false };
  assert.equal(schemaDeclarations(tuple as never, undefined, "2020-12"), "export type Type = [string?, ...unknown[]];");
  assert.equal(schemaDeclarations(tuple as never, undefined, "2019-09"), "export type Type = [number?];");
  assert.equal(schemaDeclarations(tuple as never, undefined, "draft-07"), "export type Type = [number?];");
  const closed = { type: "object", properties: { a: { type: "string" } }, unevaluatedProperties: false };
  assert.equal(schemaDeclarations(closed as never, undefined, "2019-09"), "export interface Type {\n  a?: string | undefined;\n}");
  assert.equal(schemaDeclarations(closed as never, undefined, "draft-07"), "export interface Type {\n  a?: string | undefined;\n  [key: string]: unknown;\n}");
  // Without `type`, only a keyword the draft reads makes an array.
  assert.equal(schemaDeclarations({ type: "array", prefixItems: [{ type: "string" }] }, undefined, "2020-12"), "export type Type = [string?, ...unknown[]];");
  assert.equal(schemaDeclarations({ prefixItems: [{ type: "string" }] }, undefined, "2020-12"), "export type Type = [string?, ...unknown[]] | {\n  [key: string]: unknown;\n} | string | number | boolean | null;");
  assert.equal(schemaDeclarations({ prefixItems: [{ type: "string" }] }, undefined, "2019-09"), "export type Type = unknown;");
  assert.equal(schemaDeclarations({ additionalItems: { type: "string" } }, undefined, "2020-12"), "export type Type = unknown;");
});

test("a oneOf of objects told apart by a `const` is a union TypeScript narrows", () => {
  assert.equal(
    emit({ oneOf: [{ type: "object", properties: { kind: { const: "circle" }, r: { type: "number" } }, required: ["kind", "r"], additionalProperties: false }, { type: "object", properties: { kind: { const: "square" }, side: { type: "number" } }, required: ["kind", "side"], additionalProperties: false }] }),
    'export type Type = {\n  kind: "circle";\n  r: number;\n} | {\n  kind: "square";\n  side: number;\n};',
  );
});

test("each definition is a named type, and a reference to it is its name", () => {
  const schema = {
    $ref: "#/$defs/node",
    $defs: { node: { type: "object", properties: { value: { type: "number" }, children: { type: "array", items: { $ref: "#/$defs/node" } }, tag: { $ref: "#/definitions/my-tag" }, slash: { $ref: "#/$defs/a~1b" } }, additionalProperties: false }, "a/b": { type: "string" }, Type: { type: "boolean" }, "1st": { type: "null" } },
    definitions: { "my-tag": { type: "string" } },
  };
  assert.equal(
    emit(schema),
    [
      "export type Type = Node;",
      "export interface Node {\n  value?: number | undefined;\n  children?: Node[] | undefined;\n  tag?: MyTag | undefined;\n  slash?: AB | undefined;\n}",
      "export type AB = string;",
      "export type Type2 = boolean;",
      "export type _1st = null;",
      "export type MyTag = string;",
    ].join("\n\n"),
  );
});

test("`#` is the root; another pointer is inlined, unless it leads back into itself; another file is unknown", () => {
  assert.equal(emit({ type: "object", properties: { next: { $ref: "#" } }, additionalProperties: false }), "export interface Type {\n  next?: Type | undefined;\n}");
  assert.equal(emit({ type: "object", properties: { a: { type: "string" }, b: { $ref: "#/properties/a" }, c: { $ref: "#/properties/c" }, d: { $ref: "./other.schema.jsonc" } }, additionalProperties: false }), "export interface Type {\n  a?: string | undefined;\n  b?: string | undefined;\n  c?: unknown;\n  d?: unknown;\n}");
});

test("a description is a doc comment", () => {
  assert.equal(emit({ type: "object", properties: { a: { type: "string", description: "One line." } }, additionalProperties: false }), "export interface Type {\n  /** One line. */\n  a?: string | undefined;\n}");
  assert.equal(emit({ type: "string", description: "Ends */ early.\nTwo lines." }), "/**\n * Ends *\\/ early.\n * Two lines.\n */\nexport type Type = string;");
});

test("every emitted declaration type-checks", () => {
  const schemas = [
    { type: "object", properties: { a: { type: "string" }, b: { type: "array", items: { $ref: "#/$defs/x" } } }, additionalProperties: { type: "number" }, $defs: { x: { anyOf: [{ type: "object", properties: { k: { const: "x" } }, required: ["k"] }, { enum: [1, 2] }] } } },
    // Parsed, so `__proto__` is a property, as it is in a schema file.
    JSON.parse('{"type": "object", "properties": {"0": {"type": "string"}, "a b": {"type": "number"}, "__proto__": {"type": "boolean"}}, "patternProperties": {"^x": {"type": "array", "prefixItems": [{"type": "string"}], "items": false}}}'),
    { type: ["object", "array", "null"], properties: { a: { type: "string" } }, items: { const: [1, 2] }, description: "*/ /*" },
    { $schema: "http://json-schema.org/draft-07/schema#", allOf: [{ $ref: "#/definitions/a" }, { properties: { b: { type: "integer" } } }], definitions: { a: { type: "object", properties: { a: { type: "string" } } } } },
  ];
  const dir = mkdtempSync(join(tmpdir(), "motherload-schema-types-"));
  schemas.forEach((schema, i) => writeFileSync(join(dir, `s${i}.ts`), `${emit(JSON.parse(JSON.stringify(schema)))}\n`));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: "esnext", module: "nodenext" }, include: ["*.ts"] }));
  const { status, out } = run(TSC, ["-p", join(dir, "tsconfig.json")]);
  assert.equal(out, "");
  assert.equal(status, 0);
});

/**
 * Each sample the validator accepts is assigned to the schema's type, and `use`, TypeScript run
 * against `Type`, must type-check: the type admits every value the validator accepts. A sample is
 * JSON, or JavaScript source text in `sources` for a value JSON cannot write (`undefined`).
 * `compilerOptions` are added to tsc's. Returns how many samples of each schema were accepted, so a
 * test can tell its samples are not all refused.
 */
async function agrees(cases: { schema: Record<string, unknown>; samples: unknown[]; sources?: string[]; use?: string }[], compilerOptions: Record<string, unknown> = {}): Promise<number[]> {
  const dir = mkdtempSync(join(tmpdir(), "motherload-agrees-"));
  const drafts: Record<string, Draft> = { "https://json-schema.org/draft/2020-12/schema": "2020-12", "https://json-schema.org/draft/2019-09/schema": "2019-09" };
  const counts: number[] = [];
  for (const [i, { schema, samples, sources, use = "" }] of cases.entries()) {
    const { code, problems } = schemaCode(JSON.stringify(schema), join(dir, `s${i}.schema.jsonc`));
    assert.deepEqual(problems, []);
    const { default: validator } = await evaluate(code);
    const texts = [...samples.map((sample) => JSON.stringify(sample)), ...(sources ?? [])];
    const accepted = texts.filter((text) => validator.is(new Function(`return (${text});`)()));
    counts.push(accepted.length);
    const types = schemaDeclarations(schema as never, undefined, drafts[schema["$schema"] as string] ?? "draft-07");
    writeFileSync(join(dir, `s${i}.ts`), [types, ...accepted.map((text, j) => `export const accepted${j}: Type = ${text};`), use, ""].join("\n"));
  }
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ compilerOptions: { strict: true, noEmit: true, target: "esnext", module: "nodenext", types: [], ...compilerOptions }, include: ["*.ts"] }));
  const { status, out } = run(TSC, ["-p", join(dir, "tsconfig.json")]);
  assert.equal(out, "");
  assert.equal(status, 0);
  return counts;
}

test("if/then/else on a required property's listed values is a union TypeScript narrows", () => {
  const schema = {
    type: "object",
    properties: { kind: { enum: ["click", "visit"] }, at: { type: "string" } },
    required: ["kind", "at"],
    if: { properties: { kind: { const: "click" } } },
    then: { properties: { x: { type: "number" } }, required: ["x"] },
    else: { properties: { url: { type: "string" } }, required: ["url"] },
  };
  assert.equal(
    emit(schema),
    'export type Type = {\n  kind: "click" | "visit";\n  at: string;\n  [key: string]: unknown;\n} & (({ kind: "click" } & {\n  x: number;\n  [key: string]: unknown;\n}) | ({ kind: "visit" } & {\n  url: string;\n  [key: string]: unknown;\n}));',
  );
  // `allOf` members that hold a conditional each, an `enum` test, a `$ref` to the values, and a value no test names.
  const chain = {
    type: "object",
    properties: { kind: { $ref: "#/$defs/kind" } },
    required: ["kind"],
    allOf: [
      { if: { properties: { kind: { const: "click" } } }, then: { properties: { x: { type: "number" } }, required: ["x"] } },
      { if: { properties: { kind: { enum: ["visit", "leave"] } }, required: ["kind"] }, then: { properties: { url: { type: "string" } }, required: ["url"] } },
    ],
    $defs: { kind: { enum: ["click", "visit", "leave", "idle"] } },
  };
  assert.match(emit(chain), /\| \(\{ kind: "leave" \} & \{\n  url: string;\n  \[key: string\]: unknown;\n\}\) \| \{ kind: "idle" \}\);/);
  // A `then: false` leaves its value out; a test with `type` beside its values passes only those of that type.
  assert.equal(
    emit({ type: "object", properties: { n: { enum: [1, "1", 2] } }, required: ["n"], if: { properties: { n: { type: "string", enum: ["1", 2] } } }, then: false }),
    'export type Type = {\n  n: 1 | "1" | 2;\n  [key: string]: unknown;\n} & ({ n: 1 } | { n: 2 });',
  );
});

test("a conditional of another shape is not read: the type is as wide as without it", () => {
  const base = { type: "object", properties: { kind: { type: "string" } }, required: ["kind"] };
  const wide = emit(base);
  const then = { properties: { x: { type: "number" } }, required: ["x"] };
  // The property's values are not listed; it is not required; the `if` tests more than one value; another keyword sits in the test.
  assert.equal(emit({ ...base, if: { properties: { kind: { const: "click" } } }, then }), wide);
  assert.equal(emit({ type: "object", properties: { kind: { enum: ["a", "b"] } }, if: { properties: { kind: { const: "a" } } }, then }), emit({ type: "object", properties: { kind: { enum: ["a", "b"] } } }));
  const listed = { type: "object", properties: { kind: { enum: ["a", "b"] }, y: {} }, required: ["kind"] };
  assert.equal(emit({ ...listed, if: { properties: { kind: { const: "a" }, y: { const: 1 } } }, then }), emit(listed));
  assert.equal(emit({ ...listed, if: { properties: { kind: { const: "a", minLength: 1 } } }, then }), emit(listed));
  assert.equal(emit({ ...listed, if: { required: ["y"] }, then }), emit(listed));
});

test("the type admits every value the validator accepts, and narrows: conditionals, unevaluatedProperties, and schemas without type", async () => {
  const counts = await agrees([
    {
      schema: { type: "object", properties: { kind: { enum: ["click", "visit"] }, at: { type: "string" } }, required: ["kind", "at"], if: { properties: { kind: { const: "click" } } }, then: { properties: { x: { type: "number" } }, required: ["x"] }, else: { properties: { url: { type: "string" } }, required: ["url"] } },
      samples: [{ kind: "click", at: "t", x: 1 }, { kind: "visit", at: "t", url: "u" }, { kind: "click", at: "t", x: 1, url: "u" }, { kind: "visit", at: "t", url: "u", x: "any" }, { kind: "click", at: "t" }, { kind: "visit", at: "t", x: 1 }],
      use: [
        "declare const v: Type;",
        "if (v.kind === \"click\") v.x.toFixed(); else v.url.toUpperCase();",
        "// @ts-expect-error: `x` is a number only on a click",
        "v.x.toFixed();",
      ].join("\n"),
    },
    {
      schema: {
        $schema: "https://json-schema.org/draft/2020-12/schema",
        type: "object",
        properties: { kind: { $ref: "#/$defs/kind" } },
        required: ["kind"],
        unevaluatedProperties: false,
        allOf: [
          { if: { properties: { kind: { const: "click" } } }, then: { properties: { x: { type: "number" } }, required: ["x"] } },
          { if: { properties: { kind: { enum: ["visit", "leave"] } }, required: ["kind"] }, then: { properties: { url: { type: "string" } }, required: ["url"] } },
        ],
        $defs: { kind: { enum: ["click", "visit", "leave", "idle"] } },
      },
      samples: [{ kind: "idle" }, { kind: "idle", x: 1 }, { kind: "click", x: 1 }, { kind: "leave", url: "u" }, { kind: "click", x: 1, url: "u" }, { kind: "visit" }],
      use: [
        "export function describe(v: Type): string {",
        "  switch (v.kind) {",
        "    case \"click\": return v.x.toFixed();",
        "    case \"visit\": case \"leave\": return v.url;",
        "    case \"idle\": return \"idle\";",
        "    default: { const none: never = v; return none; }",
        "  }",
        "}",
      ].join("\n"),
    },
    // `unevaluatedProperties: false` refuses no key that `allOf` allows, so the type has no `[key: string]: never`.
    { schema: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", allOf: [{ properties: { a: { type: "string" } } }], unevaluatedProperties: false }, samples: [{ a: "x" }, {}, { b: 1 }] },
    { schema: { $schema: "https://json-schema.org/draft/2020-12/schema", type: "object", $ref: "#/$defs/a", unevaluatedProperties: false, $defs: { a: { properties: { a: { type: "string" } } } } }, samples: [{ a: "x" }, { b: 1 }] },
    // Without `type`, every value of another type than the keywords constrain passes them.
    { schema: { properties: { a: { type: "string" } }, required: ["a"] }, samples: [5, "x", null, [], { a: "s" }, {}, { a: 1 }] },
    { schema: { type: "object", properties: { address: { properties: { city: { type: "string" } } } } }, samples: [{ address: 5 }, { address: { city: "c" } }, { address: { city: 1 } }] },
    { schema: { type: ["object", "string"], allOf: [{ properties: { a: { type: "number" } } }] }, samples: ["s", { a: 1 }, { a: "x" }, 5] },
    {
      schema: { properties: { kind: { enum: ["a", "b"] } }, required: ["kind"], if: { properties: { kind: { const: "a" } } }, then: { properties: { x: { type: "number" } }, required: ["x"] } },
      samples: [5, { kind: "a", x: 1 }, { kind: "b" }, { kind: "a" }],
      use: ["declare const v: Type;", "if (typeof v === \"object\" && v !== null && !Array.isArray(v) && v.kind === \"a\") v.x.toFixed();"].join("\n"),
    },
    { schema: { items: { type: "string" } }, samples: [["a"], [1], 5, {}] },
  ]);
  assert.deepEqual(counts, [4, 3, 2, 1, 5, 2, 2, 3, 3]);
});

test("a required key that `properties` does not list takes the type of the patterns that match it, or of additionalProperties", async () => {
  // A key matching a pattern is not an additional property; one matching several takes each pattern's type.
  assert.equal(
    emit({ type: "object", required: ["total", "x-max", "xy"], patternProperties: { "^x-": { type: "integer" }, "^x": { type: "string" } }, additionalProperties: { type: "boolean" } }),
    "export interface Type {\n  total: boolean;\n  \"x-max\": number | string;\n  xy: string;\n  [key: string]: number | string | boolean;\n}",
  );
  // Closed, the key is allowed only by a pattern; with none, nothing passes, and the key is never.
  assert.equal(emit({ type: "object", required: ["a", "x1"], patternProperties: { "^x": { type: "number" } }, additionalProperties: false }), "export interface Type {\n  a: never;\n  x1: number;\n  [key: string]: number;\n}");
  assert.equal(emit({ type: "object", required: ["a"], unevaluatedProperties: false }), "export interface Type {\n  a: never;\n}");
  // Without additionalProperties, any value.
  assert.equal(emit({ type: "object", required: ["a"] }), "export interface Type {\n  a: unknown;\n  [key: string]: unknown;\n}");
  // A pattern this runtime cannot read may or may not match: both types.
  assert.equal(emit({ type: "object", required: ["a"], patternProperties: { "(?<": { type: "number" } }, additionalProperties: { type: "string" } }), "export interface Type {\n  a: number | string;\n  [key: string]: number | string;\n}");
  const counts = await agrees([
    { schema: { type: "object", required: ["a"], additionalProperties: { type: "number" } }, samples: [{ a: 1 }, { a: 1, b: 2 }, { a: "x" }, {}] },
    { schema: { type: "object", required: ["xa"], patternProperties: { "^x": { type: "number" } }, additionalProperties: false }, samples: [{ xa: 1 }, { xa: 1, xb: 2 }, { xa: "s" }, { xa: 1, b: 1 }] },
    {
      schema: { type: "object", properties: { name: { type: "string" } }, required: ["name", "total", "x-max"], patternProperties: { "^x-": { type: "integer" } }, additionalProperties: { type: "number" } },
      samples: [{ name: "n", total: 1.5, "x-max": 2 }, { name: "n", total: 1, "x-max": 2.5 }, { name: "n", total: 1, "x-max": 2, other: 3 }],
      use: ["declare const v: Type;", 'export const sum: number = v.total + v["x-max"];'].join("\n"),
    },
  ]);
  assert.deepEqual(counts, [2, 2, 2]);
});

test("an optional property may hold undefined, which the validator passes as absent, under exactOptionalPropertyTypes too", async () => {
  assert.equal(emit({ type: "object", properties: { a: { type: "string" }, b: {}, c: false }, additionalProperties: false }), "export interface Type {\n  a?: string | undefined;\n  b?: unknown;\n  c?: undefined;\n}");
  const counts = await agrees(
    [
      { schema: { type: "object", properties: { a: { type: "string" } } }, samples: [{ a: "x" }, {}], sources: ["{ a: undefined }"] },
      { schema: { type: "object", properties: { a: { type: "string" }, c: false }, additionalProperties: false }, samples: [], sources: ["{ a: undefined }", "{ c: undefined }"] },
      { schema: { type: "object", properties: { a: { type: "string" } }, required: ["a"] }, samples: [{ a: "x" }], sources: ["{ a: undefined }"] },
    ],
    { exactOptionalPropertyTypes: true },
  );
  // A required property that holds undefined is missing, for ajv as for the type.
  assert.deepEqual(counts, [3, 2, 1]);
});
