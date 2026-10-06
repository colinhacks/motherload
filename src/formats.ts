// One parser per format, each turning a file's text into a `Value` or into problems placed in the
// text. The choice of each parser, and of each option below, is recorded in DESIGN.md.
import { parse as parseToml, TomlDate, TomlError } from "smol-toml";
import { parseAllDocuments } from "yaml";
import JSON5 from "json5";
import { parseTree, printParseErrorCode, type Node, type ParseError } from "jsonc-parser";
import { parseEnv } from "node:util";
import { parse as parseCsv, CsvError } from "csv-parse/sync";
import { assertValue, UnsupportedValue, type Value } from "./serialize.ts";

export type Format = "toml" | "yaml" | "json5" | "jsonc" | "env" | "csv" | "tsv" | "txt" | "md" | "schema";

/** The formats whose module is one value, the default export typed by `literal`. */
export type ValueFormat = "toml" | "yaml" | "json5" | "jsonc";

/** A problem in the source. `start` and `length` count UTF-16 code units, as JavaScript strings do; the mapper converts them to the UTF-8 bytes the protocol speaks. */
export type Problem = { message: string; start: number; length: number; code: number };

export type Parsed = { ok: true; value: Value } | { ok: false; problems: Problem[] };

// Diagnostic codes, shown as `motherload<code>` by the type check.
export const CODES = { syntax: 1, unsupported: 2, unknownFormat: 3, schema: 4 } as const;

/** Every path a loader claims, in the order the longest suffix is tested first. `.env` files are matched by name: `.env`, `.env.local`, `prod.env`. */
export const FILTER = /(\.schema\.json|\.toml|\.ya?ml|\.json5|\.jsonc|\.csv|\.tsv|\.txt|\.md|(?:^|[\\/])\.env(?:\.[^\\/]+)?|\.env)$/;

export function formatOf(path: string): Format | undefined {
  if (path.endsWith(".schema.json")) return "schema";
  if (path.endsWith(".toml")) return "toml";
  if (path.endsWith(".yaml") || path.endsWith(".yml")) return "yaml";
  if (path.endsWith(".json5")) return "json5";
  if (path.endsWith(".jsonc")) return "jsonc";
  if (path.endsWith(".csv")) return "csv";
  if (path.endsWith(".tsv")) return "tsv";
  if (path.endsWith(".txt")) return "txt";
  if (path.endsWith(".md")) return "md";
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

/** Node's grammar (`util.parseEnv`), the one `process.loadEnvFile` reads the file with at run time: every value is a string, `${NAME}` is not expanded, and a line that is not an assignment is ignored. */
export function parseEnvFile(source: string): Parsed {
  const parsed = parseEnv(source);
  const out: Record<string, string> = {};
  for (const key of Object.keys(parsed)) out[key] = parsed[key]!;
  return { ok: true, value: out };
}

// ---- CSV and TSV ---------------------------------------------------------------------------------

/** A table: its header's column names, in order, and one object per later row, keyed by them. Every value is a string. */
export type ParsedTable = { ok: true; columns: string[]; rows: Record<string, string>[] } | { ok: false; problems: Problem[] };

const BOM = "﻿";

/**
 * CSV (RFC 4180: quoted fields, doubled quotes, line breaks inside quotes) or TSV (IANA
 * text/tab-separated-values: a tab between fields and no quoting, so `"` is an ordinary character),
 * read with csv-parse. Rows end in CRLF or LF, mixed in one file. A blank line is not a row,
 * wherever it is. The first row is the header; a row whose field count differs from the header's,
 * and an empty or repeated column name, are problems placed at that row.
 */
function parseTable(text: string, delimiter: "," | "\t"): ParsedTable {
  const skip = text.startsWith(BOM) ? 1 : 0;
  const source = text.slice(skip);
  // csv-parse counts UTF-8 bytes; every place it reports is a row's end, so a running count converts them.
  const bytes = Buffer.from(source, "utf8");
  let atByte = 0;
  let atChar = 0;
  const charOf = (byte: number) => {
    atChar += bytes.toString("utf8", atByte, byte).length;
    atByte = byte;
    return atChar;
  };
  const records: { fields: string[]; start: number; end: number }[] = [];
  let lastEnd = 0;
  try {
    parseCsv(source, {
      delimiter,
      quote: delimiter === "," ? '"' : false,
      record_delimiter: ["\r\n", "\n"],
      relax_column_count: true,
      on_record: (fields: string[], context) => {
        const start = lastEnd;
        lastEnd = charOf(context.bytes);
        records.push({ fields, start, end: lastEnd });
        return null;
      },
    });
  } catch (error) {
    if (!(error instanceof CsvError)) throw error;
    // Placed at the row that failed: where the previous row ended.
    const line = source.slice(lastEnd).split(/\r?\n/, 1)[0]!;
    return { ok: false, problems: [{ message: error.message.replace(/ at line \d+/, ""), start: skip + lastEnd, length: Math.max(line.length, 1), code: CODES.syntax }] };
  }
  const rowText = (r: { start: number; end: number }) => source.slice(r.start, r.end).replace(/\r?\n$/, "");
  const rows = records.filter((r) => !(r.fields.length === 1 && rowText(r) === ""));
  const [header, ...body] = rows;
  if (!header) return { ok: true, columns: [], rows: [] };
  const problems: Problem[] = [];
  const at = (r: (typeof rows)[number], message: string) => problems.push({ message, start: skip + r.start, length: Math.max(rowText(r).length, 1), code: CODES.syntax });
  const columns = header.fields;
  const seen = new Set<string>();
  columns.forEach((name, i) => {
    if (name === "") at(header, `Column ${i + 1} of the header has no name.`);
    else if (seen.has(name)) at(header, `The header names the column "${name}" twice.`);
    seen.add(name);
  });
  for (const row of body) if (row.fields.length !== columns.length) at(row, `This row has ${row.fields.length} field${row.fields.length === 1 ? "" : "s"}; the header has ${columns.length}.`);
  if (problems.length) return { ok: false, problems };
  return { ok: true, columns, rows: body.map((row) => Object.fromEntries(columns.map((name, i) => [name, row.fields[i]!]))) };
}

export const parseCsvFile = (source: string) => parseTable(source, ",");
export const parseTsvFile = (source: string) => parseTable(source, "\t");

// ---- Markdown ------------------------------------------------------------------------------------

export type ParsedMarkdown = { ok: true; frontmatter: Value; body: string } | { ok: false; problems: Problem[] };

/**
 * A Markdown file's YAML frontmatter and its body. The frontmatter is a `---` line at the very
 * start of the file, closed by the next `---` line, read as a `.yaml` file is; the body is the text
 * after the closing line. With no frontmatter, or an empty one, the frontmatter is `{}`.
 */
export function parseMarkdownFile(text: string): ParsedMarkdown {
  const skip = text.startsWith(BOM) ? 1 : 0;
  const open = /^---[ \t]*\r?\n/.exec(text.slice(skip));
  if (!open) return { ok: true, frontmatter: {}, body: text };
  const from = skip + open[0].length;
  const close = /^---[ \t]*(?:\r?\n|$)/gm;
  close.lastIndex = from;
  const closed = close.exec(text);
  if (!closed) return { ok: false, problems: [{ message: "The frontmatter that starts here has no closing --- line.", start: skip, length: 3, code: CODES.syntax }] };
  const yaml = text.slice(from, closed.index);
  const parsed = parseYamlFile(yaml);
  // yaml's messages name a line and column inside the frontmatter, which the diagnostic's own place replaces.
  if (!parsed.ok) return { ok: false, problems: parsed.problems.map((p) => ({ ...p, message: p.message.replace(/ at line \d+, column \d+$/, ""), start: from + p.start })) };
  const value = parsed.value ?? {};
  if (typeof value !== "object" || Array.isArray(value) || value instanceof Date) {
    return { ok: false, problems: [{ message: "The frontmatter must be a YAML mapping of keys to values.", start: from, length: Math.max(yaml.replace(/\s+$/, "").length, 1), code: CODES.syntax }] };
  }
  return { ok: true, frontmatter: value, body: text.slice(closed.index + closed[0].length) };
}

export function parseFile(format: ValueFormat | "env", source: string): Parsed {
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
