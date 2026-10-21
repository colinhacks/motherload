// The module a `.schema.jsonc` or `.schema.json5` file becomes: the TypeScript type the schema
// describes, and a validator compiled from the schema when the module is built.
//
//   import user, { type Type as User } from "./user.schema.jsonc";
//   user.validate(input);       // { value } or { issues }, every issue; never throws
//   user.is(input);             // input is User, stopping at the first failure
//   user["~standard"];          // Standard Schema v1, for any library that accepts one
//
// The types come from Motherload's own emitter (schema-types.ts), the validator from ajv, a
// dependency of Motherload's, resolved from this module. The generated module imports nothing:
// ajv's standalone code is inlined with the few run-time helpers it requires. It holds two
// validators compiled from the same schema, one with `allErrors` for `validate` and one without
// for `is`, which share those helpers. A `$ref` to another
// schema file is followed (refs.ts): the types import that file's module, and the validator is
// compiled from every file the schema reaches.
import { readFileSync } from "node:fs";
import { createRequire, isBuiltin } from "node:module";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { CODES, literal, toJs, type Problem, type Value } from "@motherload/core";
import { collect, dynamicRefProblems, eachSchema, embeddedIdProblems, fileOf, forAjv, mapSchemas, parseSchemaFile, pointer, pointTo, withoutKeywords, type Files } from "./refs.ts";
import { LITERAL_NAME, schemaDeclarations, type Draft } from "./schema-types.ts";
import { jsonSchemas } from "./json-schema.ts";

const FAILED_TYPES = ["declare const schema: any;", "export default schema;", "export type Type = any;", ""].join("\n");

const problem = (message: string, place: { start: number; length: number } = { start: 0, length: 1 }): Problem => ({ message, ...place, code: CODES.schema });

/** The draft a schema declares, as the ajv entry point that compiles it (drafts 06 and 07 share one), or undefined when it declares none. */
function declaredDraft(schema: Value): string | undefined {
  const declared = typeof schema === "object" && schema !== null && !Array.isArray(schema) ? (schema as Record<string, Value>)["$schema"] : undefined;
  if (typeof declared !== "string") return undefined;
  const entry = ajvEntry(schema);
  return "error" in entry ? declared : entry.entry;
}

/** The draft a schema declares, as the ajv entry point that validates it. */
function ajvEntry(schema: Value): { entry: string } | { error: string } {
  const declared = typeof schema === "object" && schema !== null && !Array.isArray(schema) ? (schema as Record<string, Value>)["$schema"] : undefined;
  if (declared === undefined || typeof declared !== "string") return { entry: "ajv" };
  if (declared.includes("2020-12")) return { entry: "ajv/dist/2020" };
  if (declared.includes("2019-09")) return { entry: "ajv/dist/2019" };
  if (/draft-0[67]/.test(declared)) return { entry: "ajv" };
  return { error: `ajv validates JSON Schema drafts 06, 07, 2019-09 and 2020-12; this schema declares ${declared}.` };
}

/** The draft ajv compiles a schema in, by the entry point it is compiled with; draft-06 reads as draft-07. */
const DRAFTS: Record<string, Draft> = { ajv: "draft-07", "ajv/dist/2019": "2019-09", "ajv/dist/2020": "2020-12" };

export const draftOf = (schema: Value): Draft | undefined => {
  const entry = ajvEntry(schema);
  return "error" in entry ? undefined : DRAFTS[entry.entry];
};

/**
 * The keywords ajv acts on in each draft that the draft does not define (ajv 8.20.0's vocabulary
 * per class, read and measured on 2026-10-20). The spec ignores a keyword its draft does not
 * define, and so does Motherload: these are taken out of what ajv compiles and what the types read.
 * Left in, `$async: true` made the validator return a promise, which `is` read as a pass;
 * `nullable` without `type`, `id`, and 2020-12's `$recursiveAnchor: true` made ajv refuse the
 * schema; in 2019-09, 2020-12's `$dynamicRef` was enforced, and in both, draft-07's `dependencies`.
 * Every other keyword a draft does not define, a later draft's included, ajv ignores already, and
 * so does the emitter.
 */
const IGNORED: Record<Draft, readonly string[]> = {
  "draft-07": ["$async", "nullable", "id"],
  "2019-09": ["$async", "nullable", "id", "$dynamicRef", "$dynamicAnchor", "dependencies"],
  "2020-12": ["$async", "nullable", "id", "$recursiveRef", "$recursiveAnchor", "dependencies"],
};

type Ajv = {
  compile(schema: unknown): unknown;
  addSchema(schema: unknown, key?: string): unknown;
  addMetaSchema(schema: unknown): unknown;
  addFormat(name: string, format: unknown): unknown;
  addKeyword(definition: object): unknown;
  opts: { code: { formats?: unknown } };
};

/** ajv's code generator (`ajv/dist/compile/codegen`): only code made by the same copy of ajv is code to it. */
type Codegen = { _: (strings: TemplateStringsArray, ...args: unknown[]) => unknown; str: (strings: TemplateStringsArray, ...args: unknown[]) => unknown; operators: Record<"GT" | "GTE" | "LT" | "LTE", unknown>; getProperty(key: string): unknown };

/** ajv compiles every validator with `new Function`, the one it writes out as standalone code too, which a process may disallow. */
const disallowedCodegen = (error: unknown) => error instanceof EvalError || /code generation from strings/i.test(String((error as Error)?.message));
const codegenProblem = (path: string) =>
  `Building ${basename(path)}'s validator runs ajv, which compiles it with new Function, and this process disallows code generation from strings (--disallow-code-generation-from-strings, on the command line or in NODE_OPTIONS). Build the module in a process without that flag: a program bundled with esbuild then validates where the flag is set, since the bundle's validator needs no new Function.`;

/**
 * ajv-formats' formatMaximum, formatMinimum, formatExclusiveMaximum and formatExclusiveMinimum
 * (its dist/limit.js, MIT), written with this module's ajv: ajv-formats' own requires its `ajv`,
 * which can be another copy (`loadAjv`). Without `$data`, which Motherload does not enable.
 */
function formatLimits({ _, str, operators, getProperty }: Codegen): object {
  const KEYWORDS: Record<string, [string, unknown]> = { formatMaximum: ["<=", operators.GT], formatMinimum: [">=", operators.LT], formatExclusiveMaximum: ["<", operators.GTE], formatExclusiveMinimum: [">", operators.LTE] };
  type Cxt = { gen: { scopeValue(prefix: string, value: object): unknown }; data: unknown; schemaCode: unknown; keyword: string; it: { schema: Record<string, unknown>; opts: { validateFormats?: boolean; code: { formats?: unknown } }; self: { formats: Record<string, unknown> } }; fail$data(condition: unknown): void };
  return {
    keyword: Object.keys(KEYWORDS),
    type: "string",
    schemaType: "string",
    dependencies: ["format"],
    error: {
      message: ({ keyword, schemaCode }: Cxt) => str`should be ${KEYWORDS[keyword]![0]} ${schemaCode}`,
      params: ({ keyword, schemaCode }: Cxt) => _`{comparison: ${KEYWORDS[keyword]![0]}, limit: ${schemaCode}}`,
    },
    code(cxt: Cxt) {
      const { gen, data, schemaCode, keyword, it } = cxt;
      if (it.opts.validateFormats === false) return;
      const format = it.schema["format"];
      const def = typeof format === "string" ? it.self.formats[format] : undefined;
      if (typeof format !== "string" || !def || def === true) return;
      if (typeof def !== "object" || def instanceof RegExp || typeof (def as { compare?: unknown }).compare !== "function") throw new Error(`"${keyword}": format "${format}" does not define "compare" function`);
      const fmt = gen.scopeValue("formats", { key: format, ref: def, code: it.opts.code.formats ? _`${it.opts.code.formats}${getProperty(format)}` : undefined });
      cxt.fail$data(_`${fmt}.compare(${data}, ${schemaCode}) ${KEYWORDS[keyword]![1]} 0`);
    },
  };
}

/**
 * ajv and ajv-formats, Motherload's own dependencies, looked up from this module: under pnpm a
 * package's dependencies resolve from the package only, not from the project's directory. One copy
 * of ajv compiles and writes every format's code: ajv-formats' plugin writes it with the copy its
 * own `require("ajv")` finds, which under npm beside ajv 6 (eslint's) is a second copy of ajv 8,
 * whose code this copy wrote out as JSON, so every format checked by a function threw (measured
 * 2026-10-20). So its format table is registered here, and its limit keywords are `formatLimits`.
 */
function loadAjv(path: string, schema: Value, standalone: boolean, allErrors = true, discriminator = false): { ajv: Ajv; require: NodeJS.Require } | { error: string } {
  const require = createRequire(import.meta.url);
  const entry = ajvEntry(schema);
  if ("error" in entry) return entry;
  let AjvClass: new (options: object) => Ajv;
  try {
    const mod = require(entry.entry);
    AjvClass = mod.default ?? mod;
  } catch {
    return { error: `Validating ${basename(path)} needs ajv, a dependency of Motherload, which did not load: reinstall Motherload.` };
  }
  // allErrors: `validate` lists every issue; `is` takes a validator without it, which returns at the
  // first failure. ajv sets allErrors per instance, so each is its own. strict: false and no logger:
  // a schema written for another validator (unknown keywords, formats) still compiles, as the spec
  // allows. No option that changes the value (useDefaults, coerceTypes, removeAdditional): the value
  // `validate` returns is the one it was given, as it was given. Two of ajv's defaults check more
  // than the schema says, and are changed so that the validator checks the schema as written:
  // ownProperties, so that a property is the value's own and not Object.prototype's (by default
  // `{}` failed `properties: { toString: { type: "string" } }` and passed `required: ["toString"]`);
  // and multipleOfPrecision, so that `multipleOf` is read in decimals (by default ajv refused 19.99
  // for 0.01 and 0.3 for 0.1, whose quotients a double misses by 1e-13): within 1e-7 of a step is
  // a multiple, which keeps every quotient below 1e8 exact and still refuses 0.015 for 0.01.
  const ajv = new AjvClass({ allErrors, strict: false, logger: false, ownProperties: true, multipleOfPrecision: 7, ...(discriminator ? { discriminator: true } : {}), ...(standalone ? { code: { source: true } } : {}) });
  // ajv's default class knows draft-07's meta-schema alone; draft-06's is added for a schema, or a
  // file it refers to, that declares it (ajv's documentation, "JSON Schema draft-06").
  try {
    if (entry.entry === "ajv") ajv.addMetaSchema(require("ajv/dist/refs/json-schema-draft-06.json"));
  } catch (error) {
    if (disallowedCodegen(error)) return { error: codegenProblem(path) };
    throw error;
  }
  let formats: { fullFormats: Record<string, unknown>; formatNames: string[] } | undefined;
  try {
    formats = require("ajv-formats/dist/formats");
  } catch {
    // Without ajv-formats, `format` is an annotation, which is what the spec makes it by default.
  }
  if (formats) {
    const codegen: Codegen = require("ajv/dist/compile/codegen");
    // What ajv-formats' plugin does, with this copy's codegen: the standalone code requires the table.
    ajv.opts.code.formats = codegen._`require("ajv-formats/dist/formats").fullFormats`;
    for (const name of formats.formatNames) ajv.addFormat(name, formats.fullFormats[name]);
    ajv.addKeyword(formatLimits(codegen));
  }
  return { ajv, require };
}

/**
 * The schema and every file it reaches, each without the keywords its draft ignores, with the
 * problems of their references; ajv's default, draft-07, is the draft of a root that declares none.
 */
export function filesOf(source: string, path: string, schema: Value): Files {
  const clean = (value: Value) => withoutKeywords(value, IGNORED[draftOf(schema) ?? "draft-07"]);
  const files = collect(path, clean(schema), source, { of: declaredDraft, none: "ajv" }, clean);
  // An `$id` below a file's root moves the base its `$ref`s resolve against, which the types do not follow (refs.ts).
  files.problems.push(...embeddedIdProblems(files, path, source));
  // ajv resolves some of 2020-12's `$dynamicRef`s otherwise than the spec (refs.ts).
  if (draftOf(schema) === "2020-12") files.problems.push(...dynamicRefProblems(files, path, source));
  return files;
}

/** The validator, compiled from the root with every other file added to ajv under its id; a problem when a file is not a valid schema. */
function compile(ajv: Ajv, files: Files, path: string): { validate: unknown } | { problem: Problem } {
  const { root, others } = forAjv(files, path);
  for (const other of others) {
    try {
      ajv.addSchema(other.schema, other.id);
    } catch (error) {
      return { problem: problem(disallowedCodegen(error) ? codegenProblem(path) : `${basename(other.path)} is not a valid schema: ${(error as Error).message}`, files.places.get(other.path)) };
    }
  }
  try {
    return { validate: ajv.compile(root) };
  } catch (error) {
    return { problem: problem(disallowedCodegen(error) ? codegenProblem(path) : `The schema is not valid: ${(error as Error).message}`) };
  }
}

// ---- the copy ajv compiles ----------------------------------------------------------------------

const isObj = (value: Value | undefined): value is Record<string, Value> => typeof value === "object" && value !== null && !Array.isArray(value) && !(value instanceof Date);

/**
 * Whether some schema the validator is compiled from has `contains` beside a tuple (`prefixItems`,
 * or draft-07's list of `items`). ajv 8.20.0's validator without allErrors accepts `[]` there,
 * which the schema refuses: its `prefixItems` code sets the validity it gates `contains` on only
 * for an array that has items. The validator with allErrors is right, so `is` confirms a pass with it.
 */
export function needsConfirmation(files: Files): boolean {
  let found = false;
  for (const schema of files.schemas.values())
    eachSchema(schema, (sub) => {
      if (sub["contains"] !== undefined && (Array.isArray(sub["prefixItems"]) || Array.isArray(sub["items"]))) found = true;
    });
  return found;
}

/** The value a `$ref` in the file `from` points to, among the files the validator is compiled from; undefined for an anchor, a URL or nothing. */
function refTarget(files: Files, ref: string, from: string): Value | undefined {
  const other = fileOf(ref, from);
  const [file, fragment] = other ? [other.path, other.fragment] : ref.startsWith("#") ? [from, ref.slice(1)] : [undefined, ""];
  const schema = file === undefined ? undefined : files.schemas.get(file);
  const segments = pointer(fragment);
  return schema === undefined || !segments ? undefined : pointTo(schema, segments);
}

/**
 * The property that tells a `oneOf`'s variants apart, where ajv's `discriminator` (8.20.0,
 * dist/vocabularies/discriminator) can stand for the `oneOf` and give the same verdict on every
 * value: the schema is `type: "object"` (ajv skips the `oneOf` beside a discriminator, and the
 * discriminator checks objects alone, so without it a number passed); each variant, or the schema
 * a variant that is only a `$ref` points to, has the property in its own `properties` with a
 * `const` that is a non-empty string or an `enum` of one string, the values distinct; and the
 * property is required beside the `oneOf` or in every variant. Then a value whose tag is one
 * variant's fails every other variant, so the `oneOf` holds exactly when that variant does.
 */
function discriminatorOf(files: Files, schema: Record<string, Value>, from: string): string | undefined {
  const oneOf = schema["oneOf"];
  if (schema["type"] !== "object" || !Array.isArray(oneOf) || oneOf.length < 2) return undefined;
  const variants = oneOf.map((variant) => (isObj(variant) && Object.keys(variant).length === 1 && typeof variant["$ref"] === "string" ? refTarget(files, variant["$ref"], from) : variant));
  if (!variants.every(isObj)) return undefined;
  const tagOf = (variant: Record<string, Value>, name: string): string | undefined => {
    const properties = variant["properties"];
    const property = isObj(properties) && Object.hasOwn(properties, name) ? properties[name] : undefined;
    if (!isObj(property)) return undefined;
    if ("const" in property) return typeof property["const"] === "string" && property["const"] !== "" ? property["const"] : undefined;
    const values = property["enum"];
    return Array.isArray(values) && values.length === 1 && typeof values[0] === "string" ? values[0] : undefined;
  };
  const required = (owner: Record<string, Value>, name: string) => Array.isArray(owner["required"]) && owner["required"].includes(name);
  const first = variants[0]!["properties"];
  for (const name of isObj(first) ? Object.keys(first) : []) {
    const tags = variants.map((variant) => tagOf(variant as Record<string, Value>, name));
    if (tags.some((tag) => tag === undefined) || new Set(tags).size !== tags.length) continue;
    if (required(schema, name) || variants.every((variant) => required(variant as Record<string, Value>, name))) return name;
  }
  return undefined;
}

/**
 * The files as ajv compiles them for the module: a `discriminator` on each `oneOf` whose variants a
 * property tells apart (`discriminatorOf`), so that a failing value is reported against its own
 * variant alone, and none that the schema itself holds (OpenAPI's, which ajv ignores without its
 * `discriminator` option and would read with it). Never the module's `schema` or its Standard JSON
 * Schema, which stay as written. `count` is how many were added. None is added where any file uses
 * `unevaluatedProperties` or `unevaluatedItems`: ajv's discriminator does not pass on what its
 * variant evaluated, so `{ "kind": "y" }` failed `unevaluatedProperties: false` beside a oneOf
 * that the same schema passes without it (measured).
 */
export function withDiscriminators(files: Files): { files: Files; count: number } {
  let unevaluated = false;
  for (const schema of files.schemas.values())
    eachSchema(schema, (sub) => {
      if (sub["unevaluatedProperties"] !== undefined || sub["unevaluatedItems"] !== undefined) unevaluated = true;
    });
  if (unevaluated) return { files, count: 0 };
  let count = 0;
  const schemas = new Map(
    [...files.schemas].map(([path, schema]) => [
      path,
      mapSchemas(withoutKeywords(schema, ["discriminator"]), (copy) => {
        const propertyName = discriminatorOf(files, copy, path);
        if (propertyName !== undefined) {
          copy["discriminator"] = { propertyName };
          count++;
        }
      }),
    ]),
  );
  return { files: { ...files, schemas }, count };
}

// ---- types --------------------------------------------------------------------------------------

/**
 * The module's types. They import the `Schema` type from `typesFrom`, the package the project
 * installed and the type check resolves from the schema's directory: `@motherload/schema`, or
 * `motherload`, which carries the same types. A `$ref` to another schema file is a type imported
 * from that file's module, which TypeScript sends through the mapper in turn.
 */
export function schemaTypes(source: string, path: string, typesFrom = "@motherload/schema"): { types: string; problems: Problem[] } {
  const parsed = parseSchemaFile(source, path);
  if (!parsed.ok) return { types: FAILED_TYPES, problems: parsed.problems };
  const schema = parsed.value;
  const draft = draftOf(schema);
  const files = filesOf(source, path, schema);
  const problems: Problem[] = [...files.problems];
  const loaded = loadAjv(path, schema, false);
  // A reference that cannot be followed is the problem; ajv would only add that it cannot resolve it.
  // A draft ajv does not validate is reported here too, where it was found only when the module was built.
  if ("error" in loaded) problems.push(problem(loaded.error));
  else if (!files.problems.length) {
    const compiled = compile(loaded.ajv, files, path);
    if ("problem" in compiled) problems.push(compiled.problem);
  }
  return {
    types: [
      `import type { Schema as __MotherloadSchema } from ${JSON.stringify(typesFrom)};`,
      schemaDeclarations(files.schemas.get(path)!, { path, read: (other) => files.schemas.get(other) }, draft),
      // The schema as written, under a name of its own, so an error or a hover prints `Schema<Type, Json>`.
      `/** The JSON Schema as written in ${basename(path).replace(/\*\//g, "*\\/")}. */`,
      `type ${LITERAL_NAME} = ${literal(schema)};`,
      `declare const schema: __MotherloadSchema<Type, ${LITERAL_NAME}>;`,
      "export default schema;",
      "",
    ].join("\n"),
    problems,
  };
}

// ---- code ---------------------------------------------------------------------------------------

/** `require("x")` calls in CommonJS source, not inside a string (ajv keeps `'require("…")'` strings for its own code generation). */
const REQUIRE = /(?<!['"\w.$])require\(\s*(["'])([^"']+)\1\s*\)/g;

/**
 * The requires in ajv's standalone code, which ajv writes with double quotes (each helper's `.code`,
 * `require("ajv/dist/runtime/equal").default`). That code holds the schema's own strings, written
 * with JSON.stringify, which escapes `"` and not `'`: REQUIRE took `"load require('ajv') now"` in a
 * `const` for a call, rewrote the string the validator compares, and inlined ajv (measured
 * 2026-10-20). A `"` in such a string is always `\"`, so a double-quoted require is code.
 */
const STANDALONE_REQUIRE = /(?<![\w.$\\])require\((")([^"\\]+)"\)/g;

/**
 * Inlines CommonJS modules: each standalone validator and every module they require, transitively,
 * as functions in one ES module, so the generated module imports nothing at run time. The
 * validators share one table of modules, so a helper both require (ucs2length, fast-deep-equal,
 * ajv-formats' formats) is there once; each validator is the constant of its name.
 */
function inline(entries: ReadonlyArray<{ name: string; source: string }>, entryFile: string): string {
  const ids = new Map<string, number>();
  const bodies: string[] = [];
  // In a helper's own source (fast-uri writes `require('./lib/utils')`), a require that does not
  // resolve is left as written, for a guarded optional one; in the standalone code it is a problem,
  // thrown to `schemaCode`, never a bare `require` the module would fail on when it runs.
  const rewrite = (source: string, from: string, standalone = false) =>
    source.replace(standalone ? STANDALONE_REQUIRE : REQUIRE, (call, _quote, specifier: string) => {
      let file: string | undefined;
      try {
        file = createRequire(from).resolve(specifier);
      } catch {
        if (!standalone) return call;
      }
      if (!file || isBuiltin(file)) throw new Error(`${standalone ? "ajv's standalone code" : basename(from)} requires ${specifier}, which ${file ? "is a Node.js built-in" : `does not resolve from ${basename(from)}`}, so it cannot be inlined.`);
      return `__require(${add(file)})`;
    });
  const add = (file: string): number => {
    const known = ids.get(file);
    if (known !== undefined) return known;
    const id = bodies.length;
    ids.set(file, id);
    bodies.push("");
    const text = readFileSync(file, "utf8");
    bodies[id] = file.endsWith(".json") ? `module.exports = ${text};` : rewrite(text, file);
    return id;
  };
  const validators = entries.map(({ name, source }) => [
    `const ${name} = (() => {`,
    "  const module = { exports: {} }, exports = module.exports;",
    rewrite(source, entryFile, true),
    "  return module.exports.default ?? module.exports;",
    "})();",
  ]);
  return [
    "const __modules = [",
    ...bodies.map((body) => `function (module, exports) {\n${body}\n},`),
    "];",
    "const __cache = [];",
    "function __require(id) {",
    "  if (!__cache[id]) { const module = { exports: {} }; __cache[id] = module; __modules[id](module, module.exports); }",
    "  return __cache[id].exports;",
    "}",
    ...validators.flat(),
  ].join("\n");
}

const VALIDATOR = `
// Standard Schema's path for an ajv error. ajv's instancePath is a JSON Pointer, which writes an
// array index as it writes an object key, so each segment is read against the value it names: in
// an array, a number. The key of a property that is missing, unexpected or misnamed, which ajv
// gives in the error's params (for the discriminator, the tag's), ends the path; so does the key whose name an error inside
// propertyNames is about, which ajv gives on the error itself.
const __KEYS = { required: "missingProperty", dependentRequired: "missingProperty", dependencies: "missingProperty", additionalProperties: "additionalProperty", unevaluatedProperties: "unevaluatedProperty", propertyNames: "propertyName", discriminator: "tag" };
const __path = (value, error) => {
  const path = [];
  const segments = error.instancePath ? error.instancePath.slice(1).split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~")) : [];
  let at = value;
  for (const segment of segments) {
    let index = false;
    // Reading the value again runs its getters again; one that throws now leaves the rest as keys.
    try {
      index = Array.isArray(at);
      at = typeof at === "object" && at !== null ? at[segment] : undefined;
    } catch {
      at = undefined;
    }
    path.push(index ? Number(segment) : segment);
  }
  const key = Object.hasOwn(__KEYS, error.keyword) ? error.params?.[__KEYS[error.keyword]] : undefined;
  if (typeof key === "string") path.push(key);
  else if (typeof error.propertyName === "string") path.push(error.propertyName);
  return path;
};
// The discriminator Motherload adds for a oneOf whose variants a property tells apart (withDiscriminators
// in schema.ts) is not in the schema as written, so its failure is reported as the oneOf's.
const __issue = (value, error) => ({ message: error.message ?? "is not valid", path: __path(value, error), keyword: error.keyword === "discriminator" ? "oneOf" : error.keyword });
// What ajv threw, as text, for a value it could not check: a value nested deeper than the stack, one
// that refers to itself where the schema recurses, a getter or proxy that throws.
const __thrown = (error) => {
  try {
    return typeof error?.message === "string" ? error.message : String(error);
  } catch {
    return "a value that cannot be read";
  }
};
// Every issue, from the validator compiled with allErrors; the value itself on success. Nothing
// throws: what ajv throws is one issue at the root, with its message.
const __validate = (value) => {
  try {
    if (__validateAll(value)) return { value };
  } catch (error) {
    return { issues: [{ message: "could not be checked: " + __thrown(error), path: [], keyword: "error" }] };
  }
  return { issues: __validateAll.errors.map((error) => __issue(value, error)) };
};
// The validator compiled without allErrors, which returns at the first failure; a value it
// cannot check is not known to be valid. Where ajv's first-failure code can pass a value the schema
// refuses (\`contains\` beside a tuple, needsConfirmation in schema.ts), a pass is confirmed.
const __is = (value) => {
  try {
    return __validateFirst(value) && (!__confirm || __validateAll(value));
  } catch {
    return false;
  }
};
// Standard JSON Schema v1: the schema in the target's draft, self-contained, computed when the module
// was built (json-schema.ts); a fresh copy each call, so a caller may change it.
const __jsonSchema = (options) => {
  const target = options?.target;
  const entry = Object.hasOwn(__jsonSchemas, target) ? __jsonSchemas[target] : undefined;
  if (!entry) throw new TypeError(\`Motherload converts a schema to the "draft-07" and "draft-2020-12" targets, not \${JSON.stringify(target)}.\`);
  if (entry.error) throw new TypeError(entry.error);
  return structuredClone(entry.schema);
};
const schema = {
  validate: __validate,
  is: __is,
  schema: __schema,
  "~standard": { version: 1, vendor: "motherload", validate: __validate, jsonSchema: { input: __jsonSchema, output: __jsonSchema } },
};
export default schema;
`;

/**
 * The module's JavaScript, with problems in place of a validator that cannot be built, which a
 * bundler or the preload reports as a load error. `watchFiles` are the other schema files the
 * validator was compiled from, for a bundler to rebuild the module when one changes.
 * `discriminators: false` compiles each oneOf as written, for the test that compares the two.
 */
export function schemaCode(source: string, path: string, { discriminators = true } = {}): { code: string; problems: Problem[]; watchFiles: string[] } {
  const failed = (problems: Problem[], watchFiles: string[] = []) => ({ code: "export default undefined;\n", problems, watchFiles });
  const parsed = parseSchemaFile(source, path);
  if (!parsed.ok) return failed(parsed.problems);
  const files = filesOf(source, path, parsed.value);
  if (files.problems.length) return failed(files.problems, files.watched);
  // Two validators from the same files, formats and meta-schemas: every error for `validate`, the first for `is`.
  const standalones: { name: string; source: string }[] = [];
  // Each oneOf a property tells apart gets ajv's discriminator, so that its issues are the matching
  // variant's; were ajv to refuse one, the validator is compiled as the schema is written.
  const tagged = discriminators ? withDiscriminators(files) : { files, count: 0 };
  for (const [name, allErrors] of [["__validateAll", true], ["__validateFirst", false]] as const) {
    let loaded = loadAjv(path, parsed.value, true, allErrors, tagged.count > 0);
    if ("error" in loaded) return failed([problem(loaded.error)], files.watched);
    let compiled = tagged.count > 0 ? compile(loaded.ajv, tagged.files, path) : compile(loaded.ajv, files, path);
    if ("problem" in compiled && tagged.count > 0) {
      loaded = loadAjv(path, parsed.value, true, allErrors);
      if ("error" in loaded) return failed([problem(loaded.error)], files.watched);
      compiled = compile(loaded.ajv, files, path);
    }
    if ("problem" in compiled) return failed([compiled.problem], files.watched);
    try {
      const standaloneModule = loaded.require("ajv/dist/standalone");
      standalones.push({ name, source: (standaloneModule.default ?? standaloneModule)(loaded.ajv, compiled.validate) });
    } catch (error) {
      return failed([problem(`The schema is not valid: ${(error as Error).message}`)], files.watched);
    }
  }
  // The standalone code requires ajv's run-time helpers and ajv-formats' format functions
  // (`date-time`, `uri`), both dependencies of this package, so they resolve from this module:
  // from ajv's own directory ajv-formats does not resolve, and was left a bare `require`.
  let inlined: string;
  try {
    inlined = inline(standalones, fileURLToPath(import.meta.url));
  } catch (error) {
    return failed([problem((error as Error).message)], files.watched);
  }
  return {
    code: [inlined, `const __schema = ${toJs(parsed.value)};`, `const __jsonSchemas = ${toJs(jsonSchemas(files, path, draftOf(parsed.value) ?? "draft-07"))};`, `const __confirm = ${needsConfirmation(files)};`, VALIDATOR, ""].join("\n"),
    problems: [],
    watchFiles: files.watched,
  };
}
