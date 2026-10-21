// The module a `.schema.jsonc` or `.schema.json5` file becomes: the TypeScript type the schema
// describes, and a validator compiled from the schema when the module is built.
//
//   import user, { type Type as User } from "./user.schema.jsonc";
//   user.parse(input);          // User, or a TypeError listing every issue
//   user.is(input);             // input is User
//   user["~standard"];          // Standard Schema v1, for any library that accepts one
//
// The types come from Motherload's own emitter (schema-types.ts), the validator from ajv, a
// dependency of Motherload's, resolved from this module. The generated module imports nothing:
// ajv's standalone code is inlined with the few run-time helpers it requires. A `$ref` to another
// schema file is followed (refs.ts): the types import that file's module, and the validator is
// compiled from every file the schema reaches.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";
import { CODES, literal, toJs, type Problem, type Value } from "@motherload/core";
import { collect, forAjv, parseSchemaFile, withoutKeywords, type Files } from "./refs.ts";
import { schemaDeclarations, type Draft } from "./schema-types.ts";

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

const draftOf = (schema: Value): Draft | undefined => {
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

type Ajv = { compile(schema: unknown): unknown; addSchema(schema: unknown, key?: string): unknown; addMetaSchema(schema: unknown): unknown };

/**
 * ajv and ajv-formats, Motherload's own dependencies, looked up from this module: under pnpm a
 * package's dependencies resolve from the package only, not from the project's directory.
 */
function loadAjv(path: string, schema: Value, standalone: boolean): { ajv: Ajv; require: NodeJS.Require } | { error: string } {
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
  // allErrors: a Standard Schema result lists every issue. strict: false and no logger: a schema
  // written for another validator (unknown keywords, formats) still compiles, as the spec allows.
  const ajv = new AjvClass({ allErrors: true, strict: false, logger: false, ...(standalone ? { code: { source: true } } : {}) });
  // ajv's default class knows draft-07's meta-schema alone; draft-06's is added for a schema, or a
  // file it refers to, that declares it (ajv's documentation, "JSON Schema draft-06").
  if (entry.entry === "ajv") ajv.addMetaSchema(require("ajv/dist/refs/json-schema-draft-06.json"));
  try {
    const formats = require("ajv-formats");
    (formats.default ?? formats)(ajv);
  } catch {
    // Without ajv-formats, `format` is an annotation, which is what the spec makes it by default.
  }
  return { ajv, require };
}

/**
 * The schema and every file it reaches, each without the keywords its draft ignores, with the
 * problems of their references; ajv's default, draft-07, is the draft of a root that declares none.
 */
function filesOf(source: string, path: string, schema: Value): Files {
  const clean = (value: Value) => withoutKeywords(value, IGNORED[draftOf(schema) ?? "draft-07"]);
  return collect(path, clean(schema), source, { of: declaredDraft, none: "ajv" }, clean);
}

/** The validator, compiled from the root with every other file added to ajv under its id; a problem when a file is not a valid schema. */
function compile(ajv: Ajv, files: Files, path: string): { validate: unknown } | { problem: Problem } {
  const { root, others } = forAjv(files, path);
  for (const other of others) {
    try {
      ajv.addSchema(other.schema, other.id);
    } catch (error) {
      return { problem: problem(`${basename(other.path)} is not a valid schema: ${(error as Error).message}`, files.places.get(other.path)) };
    }
  }
  try {
    return { validate: ajv.compile(root) };
  } catch (error) {
    return { problem: problem(`The schema is not valid: ${(error as Error).message}`) };
  }
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
      `declare const schema: __MotherloadSchema<Type, ${literal(schema)}>;`,
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
 * Inlines CommonJS modules: the standalone validator and every module it requires, transitively,
 * as functions in one ES module, so the generated module imports nothing at run time.
 */
function inline(entrySource: string, entryFile: string): string {
  const ids = new Map<string, number>();
  const bodies: string[] = [];
  const rewrite = (source: string, from: string) =>
    source.replace(REQUIRE, (call, _quote, specifier: string) => {
      let file: string;
      try {
        file = createRequire(from).resolve(specifier);
      } catch {
        return call;
      }
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
  const entry = rewrite(entrySource, entryFile);
  return [
    "const __modules = [",
    ...bodies.map((body) => `function (module, exports) {\n${body}\n},`),
    "];",
    "const __cache = [];",
    "function __require(id) {",
    "  if (!__cache[id]) { const module = { exports: {} }; __cache[id] = module; __modules[id](module, module.exports); }",
    "  return __cache[id].exports;",
    "}",
    "const validate = (() => {",
    "  const module = { exports: {} }, exports = module.exports;",
    entry,
    "  return module.exports.default ?? module.exports;",
    "})();",
  ].join("\n");
}

const VALIDATOR = `
const __path = (pointer) => pointer === "" ? [] : pointer.slice(1).split("/").map((s) => s.replace(/~1/g, "/").replace(/~0/g, "~"));
const __issues = () => (validate.errors ?? []).map((e) => ({ message: e.message ?? "is not valid", path: __path(e.instancePath ?? "") }));
const schema = {
  schema: __schema,
  "~standard": { version: 1, vendor: "motherload", validate: (value) => validate(value) ? { value } : { issues: __issues() } },
  is: (value) => validate(value),
  parse(value) {
    if (validate(value)) return value;
    const issues = __issues();
    const error = new TypeError(issues.map((i) => (i.path.length ? i.path.join(".") + ": " : "") + i.message).join("; "));
    error.issues = issues;
    throw error;
  },
};
export default schema;
`;

/**
 * The module's JavaScript, with problems in place of a validator that cannot be built, which a
 * bundler or the preload reports as a load error. `watchFiles` are the other schema files the
 * validator was compiled from, for a bundler to rebuild the module when one changes.
 */
export function schemaCode(source: string, path: string): { code: string; problems: Problem[]; watchFiles: string[] } {
  const failed = (problems: Problem[], watchFiles: string[] = []) => ({ code: "export default undefined;\n", problems, watchFiles });
  const parsed = parseSchemaFile(source, path);
  if (!parsed.ok) return failed(parsed.problems);
  const files = filesOf(source, path, parsed.value);
  if (files.problems.length) return failed(files.problems, files.watched);
  const loaded = loadAjv(path, parsed.value, true);
  if ("error" in loaded) return failed([problem(loaded.error)], files.watched);
  const compiled = compile(loaded.ajv, files, path);
  if ("problem" in compiled) return failed([compiled.problem], files.watched);
  let standalone: string;
  try {
    const standaloneModule = loaded.require("ajv/dist/standalone");
    standalone = (standaloneModule.default ?? standaloneModule)(loaded.ajv, compiled.validate);
  } catch (error) {
    return failed([problem(`The schema is not valid: ${(error as Error).message}`)], files.watched);
  }
  // The standalone code requires ajv's run-time helpers and ajv-formats' format functions
  // (`date-time`, `uri`), both dependencies of this package, so they resolve from this module:
  // from ajv's own directory ajv-formats does not resolve, and was left a bare `require`.
  return {
    code: [inline(standalone, fileURLToPath(import.meta.url)), `const __schema = ${toJs(parsed.value)};`, VALIDATOR, ""].join("\n"),
    problems: [],
    watchFiles: files.watched,
  };
}
