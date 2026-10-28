// The module a data file becomes (DESIGN.md, "The module an import returns"), and the loaders
// built from the formats: each Motherload package is one or more formats behind one loader.
import { literal, toJs } from "./serialize.ts";
import { CODES, type Parsed, type Problem } from "./problems.ts";
import { ownerOf, type LoaderPlugin } from "./universal.ts";

export type ModuleText = { code: string; types: string; problems: Problem[] };

/** Types for a file that failed to parse: the problems are the error, and every use of the module stays quiet. */
export const FAILED_TYPES = "declare const data: any;\nexport default data;\n";

/** A module whose default export is one parsed value, typed as `as const` would type it. */
export function valueModule(parsed: Parsed): ModuleText {
  // The runtime never loads the failed module: every runtime adapter throws on problems first.
  if (!parsed.ok) return { code: "export default undefined;\n", types: FAILED_TYPES, problems: parsed.problems };
  return {
    code: `const data = ${toJs(parsed.value)};\nexport default data;\n`,
    types: `declare const data: ${literal(parsed.value)};\nexport default data;\n`,
    problems: [],
  };
}

/** A loader from a function that makes a file's whole module. */
export function moduleLoader(name: string, extensions: readonly string[], filter: RegExp, make: (source: string, path: string) => ModuleText): LoaderPlugin {
  return {
    name,
    extensions,
    filter,
    load(source, path) {
      const { code, problems } = make(source, path);
      return { code, problems };
    },
    types(source, path) {
      const { types, problems } = make(source, path);
      return { types, problems };
    },
  };
}

/** "a", "a and b", "a, b and c". */
const list = (items: readonly string[]) => (items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`);

/**
 * One loader for several formats, each path going to the format that claims the longest suffix of
 * it (`.env.toml` is TOML, not a `.env` file). TypeScript routes every extension of a
 * tsconfig entry to its mapper, including one the package does not read, which is a diagnostic
 * naming what it does read. `product` names the package in that message: "Motherload", or
 * "@motherload/toml".
 */
export function combine(name: string, product: string, plugins: readonly LoaderPlugin[]): LoaderPlugin {
  const extensions = plugins.flatMap((p) => p.extensions);
  const unknown = (path: string): Problem => ({
    message: `${product} reads ${list(extensions)} files; ${path} is none of them. Remove its extension from ${product}'s contentMappers entry.`,
    start: 0,
    length: 1,
    code: CODES.unknownFormat,
  });
  // A missing file may load only as the format that claims it allows, so `.env.toml` never does.
  const optional = plugins.some((p) => p.optional) ? { optional: (path: string) => ownerOf(plugins, path)?.optional?.(path) ?? false } : {};
  return {
    name,
    extensions,
    ...optional,
    filter: new RegExp(plugins.map((p) => `(?:${p.filter.source})`).join("|")),
    load(source, path) {
      const owner = ownerOf(plugins, path);
      return owner ? owner.load(source, path) : { code: "export default undefined;\n", problems: [unknown(path)] };
    },
    types(source, path) {
      const owner = ownerOf(plugins, path);
      return owner ? owner.types(source, path) : { types: FAILED_TYPES, problems: [unknown(path)] };
    },
  };
}

/** A format package's own loader: its format alone, with the message for an extension it does not read. */
export const standalone = (plugin: LoaderPlugin): LoaderPlugin => combine(plugin.name, plugin.name, [plugin]);
