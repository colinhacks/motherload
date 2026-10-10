// Motherload's JSON Schema to TypeScript emitter: each rule on a small schema, and every emitted
// declaration through tsc.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { schemaDeclarations } from "../src/schema-types.ts";
import { run, TSC } from "./helpers.ts";

const emit = (schema: unknown) => schemaDeclarations(schema as never);

test("an object root is an interface: required keys, optional keys, and no index signature when closed", () => {
  assert.equal(
    emit({ title: "User", type: "object", properties: { name: { type: "string", minLength: 1 }, "e-mail": { type: "string", format: "email" } }, required: ["name", "id"], additionalProperties: false }),
    'export interface Type {\n  name: string;\n  "e-mail"?: string;\n  id: unknown;\n}',
  );
});

test("keys outside `properties` are an index signature that covers the named ones", () => {
  assert.equal(emit({ type: "object", properties: { a: { type: "number" } } }), "export interface Type {\n  a?: number;\n  [key: string]: unknown;\n}");
  assert.equal(emit({ type: "object", properties: { a: { type: "number" } }, additionalProperties: { type: "string" } }), "export interface Type {\n  a?: number;\n  [key: string]: string | number | undefined;\n}");
  assert.equal(emit({ type: "object", patternProperties: { "^x-": { type: "number" } }, additionalProperties: false }), "export interface Type {\n  [key: string]: number;\n}");
  assert.equal(emit({ type: "object", properties: { a: { type: "null" } }, unevaluatedProperties: false }), "export interface Type {\n  a?: null;\n}");
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
  assert.equal(emit({ type: "object", required: ["a"], allOf: [{ properties: { a: { type: "string" } } }] }), "export type Type = {\n  a: unknown;\n  [key: string]: unknown;\n} & {\n  a?: string;\n  [key: string]: unknown;\n};");
  assert.equal(emit({ type: "string", not: { const: "" }, if: { minLength: 2 }, then: { pattern: "^a" } }), "export type Type = string;");
  assert.equal(emit({ anyOf: [{ type: "string" }, true] }), "export type Type = unknown;");
  assert.equal(emit({ type: "string", allOf: [false] }), "export type Type = never;");
  assert.equal(emit({}), "export type Type = unknown;");
  assert.equal(emit({ properties: { a: { type: "string" } }, additionalProperties: false }), "export interface Type {\n  a?: string;\n}");
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
      "export interface Node {\n  value?: number;\n  children?: Node[];\n  tag?: MyTag;\n  slash?: AB;\n}",
      "export type AB = string;",
      "export type Type2 = boolean;",
      "export type _1st = null;",
      "export type MyTag = string;",
    ].join("\n\n"),
  );
});

test("`#` is the root; another pointer is inlined, unless it leads back into itself; another file is unknown", () => {
  assert.equal(emit({ type: "object", properties: { next: { $ref: "#" } }, additionalProperties: false }), "export interface Type {\n  next?: Type;\n}");
  assert.equal(emit({ type: "object", properties: { a: { type: "string" }, b: { $ref: "#/properties/a" }, c: { $ref: "#/properties/c" }, d: { $ref: "./other.schema.json" } }, additionalProperties: false }), "export interface Type {\n  a?: string;\n  b?: string;\n  c?: unknown;\n  d?: unknown;\n}");
});

test("a description is a doc comment", () => {
  assert.equal(emit({ type: "object", properties: { a: { type: "string", description: "One line." } }, additionalProperties: false }), "export interface Type {\n  /** One line. */\n  a?: string;\n}");
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
