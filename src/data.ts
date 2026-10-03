// The module a data file becomes. Three exports, chosen per import by name, because TypeScript
// gives a content mapper only the file (DESIGN.md, "How an import chooses"):
//
//   import config from "./app.toml";          // the data, typed as resolveJsonModule types JSON
//   import { literal } from "./app.toml";     // the same object, typed as `as const` would type it
//   import { raw } from "./app.toml";         // the file's text
import { literal, toJs, widened } from "./serialize.ts";
import { parseFile, type Format, type Problem } from "./formats.ts";

export type ModuleText = { code: string; types: string; problems: Problem[] };

/** Types for a file that failed to parse: the problems are the error, and every use of the module stays quiet. */
const FAILED_TYPES = ["declare const data: any;", "export default data;", "export declare const literal: any;", "export declare const raw: string;", ""].join("\n");

export function dataModule(format: Exclude<Format, "schema">, source: string): ModuleText {
  const parsed = parseFile(format, source);
  const raw = `export const raw = ${JSON.stringify(source)};`;
  if (!parsed.ok) {
    // The runtime never loads this: every runtime adapter throws on problems first.
    return { code: ["export default undefined;", "export const literal = undefined;", raw, ""].join("\n"), types: FAILED_TYPES, problems: parsed.problems };
  }
  const value = parsed.value;
  // A `.env` module has no `literal`: its literal type would put each value, often a secret, into
  // the type text, which hovers show and `--declaration` writes to disk.
  const withLiteral = format !== "env";
  return {
    code: [`const data = ${toJs(value)};`, "export default data;", ...(withLiteral ? ["export const literal = data;"] : []), raw, ""].join("\n"),
    types: [`declare const data: ${widened(value)};`, "export default data;", ...(withLiteral ? [`export declare const literal: ${literal(value)};`] : []), "export declare const raw: string;", ""].join("\n"),
    problems: [],
  };
}
