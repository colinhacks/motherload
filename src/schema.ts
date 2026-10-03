// The module a `.schema.json` file becomes: the TypeScript type the schema describes, and a
// validator compiled from the schema when the module is built.
//
//   import user, { type Type as User } from "./user.schema.json";
//   user.parse(input);          // User, or a TypeError listing every issue
//   user.is(input);             // input is User
//   user["~standard"];          // Standard Schema v1, for any library that accepts one
//
// The types come from json-schema-to-typescript, the validator from ajv: both optional peer
// dependencies, resolved from the schema's own directory. The generated module imports nothing:
// ajv's standalone code is inlined with the few run-time helpers it requires.
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { basename, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { parseJsonFile, CODES, type Problem } from "./formats.ts";
import { literal, toJs, type Value } from "./serialize.ts";
import type { ModuleText } from "./data.ts";

const FAILED_TYPES = ["declare const schema: any;", "export default schema;", "export type Type = any;", "export declare const raw: string;", ""].join("\n");

const problem = (message: string, code: number = CODES.schema): Problem => ({ message, start: 0, length: 1, code });

/** The draft a schema declares, as the ajv entry point that validates it. */
function ajvEntry(schema: Value): { entry: string } | { error: string } {
  const declared = typeof schema === "object" && schema !== null && !Array.isArray(schema) ? (schema as Record<string, Value>)["$schema"] : undefined;
  if (declared === undefined || typeof declared !== "string") return { entry: "ajv" };
  if (declared.includes("2020-12")) return { entry: "ajv/dist/2020" };
  if (declared.includes("2019-09")) return { entry: "ajv/dist/2019" };
  if (/draft-0[67]/.test(declared)) return { entry: "ajv" };
  return { error: `ajv validates JSON Schema drafts 06, 07, 2019-09 and 2020-12; this schema declares ${declared}.` };
}

type Ajv = { compile(schema: unknown): unknown; errorsText?(errors: unknown): string };

/** ajv and ajv-formats as the project installed them, looked up from the schema's directory. */
function loadAjv(path: string, schema: Value, standalone: boolean): { ajv: Ajv; require: NodeJS.Require } | { error: string } {
  const require = createRequire(path);
  const entry = ajvEntry(schema);
  if ("error" in entry) return entry;
  let AjvClass: new (options: object) => Ajv;
  try {
    const mod = require(entry.entry);
    AjvClass = mod.default ?? mod;
  } catch {
    return { error: `Validating ${basename(path)} needs ajv, an optional peer dependency of motherload: install it in the project.` };
  }
  // allErrors: a Standard Schema result lists every issue. strict: false and no logger: a schema
  // written for another validator (unknown keywords, formats) still compiles, as the spec allows.
  const ajv = new AjvClass({ allErrors: true, strict: false, logger: false, ...(standalone ? { code: { source: true } } : {}) });
  try {
    const formats = require("ajv-formats");
    (formats.default ?? formats)(ajv);
  } catch {
    // Without ajv-formats, `format` is an annotation, which is what the spec makes it by default.
  }
  return { ajv, require };
}

// ---- types --------------------------------------------------------------------------------------

export async function schemaTypes(source: string, path: string): Promise<{ types: string; problems: Problem[] }> {
  const parsed = parseJsonFile(source);
  if (!parsed.ok) return { types: FAILED_TYPES, problems: parsed.problems };
  const schema = parsed.value;
  const problems: Problem[] = [];
  const loaded = loadAjv(path, schema, false);
  if ("ajv" in loaded) {
    try {
      loaded.ajv.compile(schema);
    } catch (error) {
      problems.push(problem(`The schema is not valid: ${(error as Error).message}`));
    }
  }
  // json-schema-to-typescript is an optional peer too: with prettier it is about 16 MB of the
  // 17 MB motherload would otherwise install (DESIGN.md), and only schema imports need it.
  let compile: typeof import("json-schema-to-typescript").compile;
  try {
    ({ compile } = await import(pathToFileURL(createRequire(path).resolve("json-schema-to-typescript")).href));
  } catch {
    return { types: FAILED_TYPES, problems: [...problems, problem(`Typing ${basename(path)} needs json-schema-to-typescript, an optional peer dependency of motherload: install it in the project.`)] };
  }
  // The root is always `Type`; a root `title` would otherwise name it.
  const root = structuredClone(schema) as Record<string, unknown>;
  if (root && typeof root === "object" && !Array.isArray(root)) delete root["title"];
  let declarations: string;
  try {
    declarations = await compile(root as never, "Type", {
      bannerComment: "",
      format: false,
      cwd: dirname(path),
      // A schema is one file: a $ref to another file or a URL is not followed (DESIGN.md).
      $refOptions: { resolve: { file: false, http: false } } as never,
    });
  } catch (error) {
    // ajv's message, when it has one, already says why; one problem per cause.
    return { types: FAILED_TYPES, problems: problems.length ? problems : [problem(`json-schema-to-typescript could not type the schema: ${(error as Error).message.split("\n")[0]}`)] };
  }
  return {
    types: [
      `import type { Schema as __MotherloadSchema } from "motherload";`,
      declarations.trim(),
      `declare const schema: __MotherloadSchema<Type, ${literal(schema)}>;`,
      "export default schema;",
      "export declare const raw: string;",
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

/** The module's JavaScript. Throws when the validator cannot be built: a bundler or the preload reports it as a load error. */
export function schemaCode(source: string, path: string): { code: string; problems: Problem[] } {
  const parsed = parseJsonFile(source);
  if (!parsed.ok) return { code: "export default undefined;\n", problems: parsed.problems };
  const loaded = loadAjv(path, parsed.value, true);
  if ("error" in loaded) return { code: "export default undefined;\n", problems: [problem(loaded.error)] };
  let standalone: string;
  try {
    const validate = loaded.ajv.compile(parsed.value);
    const standaloneModule = loaded.require("ajv/dist/standalone");
    standalone = (standaloneModule.default ?? standaloneModule)(loaded.ajv, validate);
  } catch (error) {
    return { code: "export default undefined;\n", problems: [problem(`The schema is not valid: ${(error as Error).message}`)] };
  }
  const entryFile = loaded.require.resolve("ajv");
  return {
    code: [inline(standalone, entryFile), `const __schema = ${toJs(parsed.value)};`, VALIDATOR, `export const raw = ${JSON.stringify(source)};`, ""].join("\n"),
    problems: [],
  };
}
