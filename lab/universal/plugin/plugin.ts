// ONE plugin definition: import a TOML file (a small subset: `key = value` with strings,
// numbers, booleans, JSON-style arrays, and `[table]` headers) as a typed object.
// Everything else in this package is an adapter over this object.
import type { LoaderPlugin, Diagnostic } from "./universal.ts";

type Value = string | number | boolean | Value[] | { [key: string]: Value };

class ParseError extends Error {
  start: number;
  length: number;
  constructor(message: string, start: number, length: number) {
    super(message);
    this.start = start;
    this.length = length;
  }
}

function parseValue(text: string, at: number): Value {
  if (/^"([^"\\]|\\.)*"$/.test(text)) return JSON.parse(text) as string;
  if (text === "true" || text === "false") return text === "true";
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  if (/^\[.*\]$/.test(text)) return JSON.parse(text) as Value[];
  throw new ParseError(`Unsupported TOML value: ${text}`, at, text.length);
}

export function parseTomlLite(source: string): { [key: string]: Value } {
  const root: { [key: string]: Value } = {};
  let table = root;
  let offset = 0;
  for (const raw of source.split("\n")) {
    const lineStart = offset;
    offset += raw.length + 1;
    const line = raw.replace(/\s+#.*$|^#.*$/, "").trim();
    if (!line) continue;
    const header = /^\[([A-Za-z0-9_.-]+)\]$/.exec(line);
    if (header) {
      table = root;
      for (const part of header[1]!.split(".")) table = (table[part] ??= {}) as { [key: string]: Value };
      continue;
    }
    const pair = /^([A-Za-z0-9_-]+)\s*=\s*(.+?)\s*$/.exec(line);
    if (!pair) throw new ParseError(`Cannot parse TOML line: ${raw.trim()}`, lineStart + raw.indexOf(raw.trim()), raw.trim().length);
    table[pair[1]!] = parseValue(pair[2]!, lineStart + raw.indexOf(pair[2]!));
  }
  return root;
}

const ident = (key: string) => (/^[A-Za-z_$][\w$]*$/.test(key) ? key : JSON.stringify(key));

/** Widened TypeScript type text for a parsed value: literals become string/number/boolean. */
export function typeText(value: Value): string {
  if (Array.isArray(value)) {
    const members = [...new Set(value.map(typeText))];
    return members.length === 0 ? "never[]" : members.length === 1 ? `${members[0]}[]` : `(${members.join(" | ")})[]`;
  }
  if (typeof value === "object") return `{ ${Object.entries(value).map(([k, v]) => `${ident(k)}: ${typeText(v)}`).join("; ")} }`;
  return typeof value;
}

export const plugin: LoaderPlugin = {
  name: "universal-toml",
  extensions: [".toml"],
  // Only files named config.toml or bunfig.toml: the "specific file name" case.
  test: /(^|[\\/])(config|bunfig)\.toml$/,
  load(source) {
    let data: { [key: string]: Value };
    try {
      data = parseTomlLite(source);
    } catch (error) {
      const e = error as ParseError;
      const diagnostics: Diagnostic[] = [{ messageText: e.message, start: e.start ?? 0, length: e.length ?? 1, code: 1 }];
      return { code: "export default undefined;\n", types: "declare const data: never;\nexport default data;\n", diagnostics };
    }
    return {
      code: [`export default ${JSON.stringify(data)};`, `export const loadedBy = "universal-toml";`, ""].join("\n"),
      types: [`declare const data: ${typeText(data)};`, `export default data;`, `export declare const loadedBy: "universal-toml";`, ""].join("\n"),
    };
  },
};
