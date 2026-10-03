// One parser per format, each turning a file's text into a `Value` or into problems placed in the
// text. The choice of each parser, and of each option below, is recorded in DESIGN.md.
import { parse as parseToml, TomlDate, TomlError } from "smol-toml";
import { parseAllDocuments } from "yaml";
import JSON5 from "json5";
import { parseTree, printParseErrorCode, type Node, type ParseError } from "jsonc-parser";
import { parse as parseDotenv } from "dotenv";
import { assertValue, UnsupportedValue, type Value } from "./serialize.ts";

export type Format = "toml" | "yaml" | "json5" | "jsonc" | "env" | "schema";

/** A problem in the source. `start` and `length` count UTF-16 code units, as JavaScript strings do; the mapper converts them to the UTF-8 bytes the protocol speaks. */
export type Problem = { message: string; start: number; length: number; code: number };

export type Parsed = { ok: true; value: Value } | { ok: false; problems: Problem[] };

// Diagnostic codes, shown as `motherload<code>` by the type check.
export const CODES = { syntax: 1, unsupported: 2, unknownFormat: 3, schema: 4 } as const;

/** Every path a loader claims, in the order the longest suffix is tested first. `.env` files are matched by name: `.env`, `.env.local`, `prod.env`. */
export const FILTER = /(\.schema\.json|\.toml|\.ya?ml|\.json5|\.jsonc|(?:^|[\\/])\.env(?:\.[^\\/]+)?|\.env)$/;

export function formatOf(path: string): Format | undefined {
  if (path.endsWith(".schema.json")) return "schema";
  if (path.endsWith(".toml")) return "toml";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".json5")) return "json5";
  if (path.endsWith(".jsonc")) return "jsonc";
  if (FILTER.test(path)) return "env";
  return undefined;
}

/** The UTF-16 offset of a 1-based line and column. */
function offsetOf(source: string, line: number, column: number): number {
  let offset = 0;
  for (let l = 1; l < line; l++) {
    const next = source.indexOf("\n", offset);
    if (next === -1) return source.length;
    offset = next + 1;
  }
  return Math.min(offset + Math.max(column - 1, 0), source.length);
}

const fail = (message: string, start: number, length: number, code: number = CODES.syntax): Parsed => ({ ok: false, problems: [{ message, start, length: Math.max(length, 1), code }] });

/** Wraps a parser's result in the module's value check, so a value no module can carry is a problem at the file's start. */
function carry(value: unknown): Parsed {
  try {
    assertValue(value);
    return { ok: true, value };
  } catch (error) {
    if (!(error instanceof UnsupportedValue)) throw error;
    const where = error.path.length ? ` at ${error.path.map(String).join(".")}` : "";
    return fail(`${error.message}${where}.`, 0, 1, CODES.unsupported);
  }
}

// ---- TOML ----------------------------------------------------------------------------------------

/** TOML's dates: an offset date-time is an instant and becomes a `Date`; a local date-time, date or time names no instant and stays its ISO text. */
function tomlDates(value: unknown): unknown {
  if (value instanceof TomlDate) return value.isLocal() ? value.toISOString() : new Date(value.getTime());
  if (Array.isArray(value)) return value.map(tomlDates);
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = Object.create(null);
    for (const key of Object.keys(value)) out[key] = tomlDates((value as Record<string, unknown>)[key]);
    return out;
  }
  return value;
}

export function parseTomlFile(source: string): Parsed {
  try {
    return carry(tomlDates(parseToml(source, { integersAsBigInt: "asNeeded" })));
  } catch (error) {
    if (error instanceof TomlError) return fail(error.message.split("\n")[0]!, offsetOf(source, error.line, error.column), 1);
    throw error;
  }
}

// ---- YAML ----------------------------------------------------------------------------------------

export function parseYamlFile(source: string): Parsed {
  const documents = parseAllDocuments(source, { merge: true });
  // `parseAllDocuments` returns an EmptyStream (an empty array with extra fields) for a file with no document.
  const list = Array.from(documents);
  const problems: Problem[] = list.flatMap((doc) =>
    doc.errors.map((e) => ({ message: e.message.split("\n")[0]!.replace(/:$/, ""), start: e.pos[0], length: Math.max(e.pos[1] - e.pos[0], 1), code: CODES.syntax })),
  );
  if (problems.length) return { ok: false, problems };
  if (list.length === 0) return { ok: true, value: null };
  const values = list.map((doc) => doc.toJS());
  // One document is its value; several are the list of their values, in order.
  return carry(values.length === 1 ? values[0] : values);
}

// ---- JSON5 ---------------------------------------------------------------------------------------

export function parseJson5File(source: string): Parsed {
  try {
    return carry(JSON5.parse(source));
  } catch (error) {
    const e = error as SyntaxError & { lineNumber?: number; columnNumber?: number };
    if (typeof e.lineNumber === "number") return fail(e.message.replace(/^JSON5: /, ""), offsetOf(source, e.lineNumber, e.columnNumber ?? 1), 1);
    throw error;
  }
}

// ---- JSONC and JSON (the schema loader) ---------------------------------------------------------

/** jsonc-parser's own `parse` assigns keys, which turns a `"__proto__"` key into a prototype; building from the tree defines them. */
function fromTree(node: Node): unknown {
  switch (node.type) {
    case "object": {
      const out: Record<string, unknown> = {};
      for (const property of node.children ?? []) {
        const [name, value] = property.children ?? [];
        if (!name || !value) continue;
        Object.defineProperty(out, name.value as string, { value: fromTree(value), enumerable: true, writable: true, configurable: true });
      }
      return out;
    }
    case "array":
      return (node.children ?? []).map(fromTree);
    default:
      return node.value;
  }
}

function parseJsonLike(source: string, options: { allowTrailingComma: boolean; disallowComments: boolean }): Parsed {
  const errors: ParseError[] = [];
  const tree = parseTree(source, errors, { ...options, allowEmptyContent: false });
  if (errors.length) return { ok: false, problems: errors.map((e) => ({ message: printParseErrorCode(e.error).replace(/([a-z])([A-Z])/g, "$1 $2"), start: e.offset, length: Math.max(e.length, 1), code: CODES.syntax })) };
  return carry(tree ? fromTree(tree) : null);
}

/** JSONC: JSON with comments, and trailing commas allowed. */
export const parseJsoncFile = (source: string) => parseJsonLike(source, { allowTrailingComma: true, disallowComments: false });

/** Strict JSON, with offsets for its errors. */
export const parseJsonFile = (source: string) => parseJsonLike(source, { allowTrailingComma: false, disallowComments: true });

// ---- .env ----------------------------------------------------------------------------------------

/** dotenv's grammar, without expansion: every value is a string, and a line that is not an assignment is ignored, as dotenv ignores it. */
export function parseEnvFile(source: string): Parsed {
  const parsed = parseDotenv(source);
  const out: Record<string, string> = {};
  for (const key of Object.keys(parsed)) out[key] = parsed[key]!;
  return { ok: true, value: out };
}

export function parseFile(format: Exclude<Format, "schema">, source: string): Parsed {
  switch (format) {
    case "toml":
      return parseTomlFile(source);
    case "yaml":
      return parseYamlFile(source);
    case "json5":
      return parseJson5File(source);
    case "jsonc":
      return parseJsoncFile(source);
    case "env":
      return parseEnvFile(source);
  }
}
