// The module a data file becomes (DESIGN.md, "The module an import returns"):
//
//   import config from "./app.toml";          // the data, typed as `as const` would type it
//   import text from "./app.toml?raw";        // the file's text, typed by client.d.ts
//   import "./.env";                          // the variables, loaded into process.env at run time
//   import users from "./users.csv";          // the rows, typed by the header's columns (also .tsv)
//   import notes from "./notes.txt";          // the text
//   import post, { frontmatter } from "./post.md"; // the body, and the YAML frontmatter
import { basename, relative } from "node:path";
import { literal, propertyName, toJs } from "./serialize.ts";
import { parseCsvFile, parseEnvFile, parseFile, parseMarkdownFile, parseTsvFile, type Format, type Problem } from "./formats.ts";

export type ModuleText = { code: string; types: string; problems: Problem[] };

/** Types for a file that failed to parse: the problems are the error, and every use of the module stays quiet. */
const FAILED_TYPES = "declare const data: any;\nexport default data;\n";

export function dataModule(format: Exclude<Format, "schema">, source: string, path: string): ModuleText {
  if (format === "env") return envModule(source, path);
  if (format === "csv" || format === "tsv") return tableModule(format, source);
  if (format === "txt") return { code: `const data = ${JSON.stringify(source)};\nexport default data;\n`, types: "declare const data: string;\nexport default data;\n", problems: [] };
  if (format === "md") return markdownModule(source);
  const parsed = parseFile(format, source);
  // The runtime never loads the failed module: every runtime adapter throws on problems first.
  if (!parsed.ok) return { code: "export default undefined;\n", types: FAILED_TYPES, problems: parsed.problems };
  return {
    code: `const data = ${toJs(parsed.value)};\nexport default data;\n`,
    types: `declare const data: ${literal(parsed.value)};\nexport default data;\n`,
    problems: [],
  };
}

/**
 * A `.env` file is imported for its effect: when the module runs, Node reads the file into
 * `process.env` (`process.loadEnvFile`, which leaves a variable the environment already sets), so
 * no value is in the module, and the types declare each variable on `NodeJS.ProcessEnv`. Under the
 * preload the module's own URL is the file; in a bundle the file is the same path from the working
 * directory as at build time, and a missing file loads nothing, as a deploy that sets its
 * variables another way has none.
 */
function envModule(source: string, path: string): ModuleText {
  const parsed = parseEnvFile(source);
  const keys = parsed.ok ? Object.keys(parsed.value as Record<string, string>) : [];
  const name = basename(path);
  const fromCwd = relative(process.cwd(), path) || name;
  return {
    code: [
      `const file = typeof import.meta.url === "string" && import.meta.url.endsWith(${JSON.stringify(`/${name}`)}) ? new URL(import.meta.url) : ${JSON.stringify(fromCwd)};`,
      `try { process.loadEnvFile(file); } catch (error) { if (error?.code !== "ENOENT") throw error; }`,
      "",
    ].join("\n"),
    types: ["declare global {", "  namespace NodeJS {", "    interface ProcessEnv {", ...keys.map((key) => `      ${propertyName(key)}: string;`), "    }", "  }", "}", "export {};", ""].join("\n"),
    problems: parsed.ok ? [] : parsed.problems,
  };
}

/**
 * A `.csv` or `.tsv` file is the array of its rows, each an object keyed by the header's columns.
 * Every value is a string, and the type is the column set, not each cell's literal: a file of
 * thousands of rows would otherwise be thousands of literal types. A file with no header is
 * `readonly never[]`, an array that holds no row.
 */
function tableModule(format: "csv" | "tsv", source: string): ModuleText {
  const parsed = format === "csv" ? parseCsvFile(source) : parseTsvFile(source);
  if (!parsed.ok) return { code: "export default undefined;\n", types: FAILED_TYPES, problems: parsed.problems };
  const row = parsed.columns.length === 0 ? "never" : `{ ${parsed.columns.map((name) => `readonly ${propertyName(name)}: string`).join("; ")} }`;
  return {
    code: `const data = ${toJs(parsed.rows)};\nexport default data;\n`,
    types: `declare const data: readonly ${row}[];\nexport default data;\n`,
    problems: [],
  };
}

/** A `.md` file is its body, without the frontmatter, and a named export `frontmatter`, typed as `as const` would type it (`{}` when the file has none). */
function markdownModule(source: string): ModuleText {
  const parsed = parseMarkdownFile(source);
  if (!parsed.ok) return { code: "export default undefined;\nexport const frontmatter = undefined;\n", types: `${FAILED_TYPES}export declare const frontmatter: any;\n`, problems: parsed.problems };
  return {
    code: `const data = ${JSON.stringify(parsed.body)};\nexport default data;\nexport const frontmatter = ${toJs(parsed.frontmatter)};\n`,
    types: `declare const data: string;\nexport default data;\nexport declare const frontmatter: ${literal(parsed.frontmatter)};\n`,
    problems: [],
  };
}
