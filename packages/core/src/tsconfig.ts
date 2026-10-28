// The `strict` option of a project's tsconfig entry, as a host reads it. TypeScript hands a mapper
// its entry's `options`, but the preload and the bundler plugins never see tsconfig, so when an
// import of a missing `.env` file fails they find the project's tsconfig themselves: the nearest
// `tsconfig.json` above the importer, the configs it extends, and the configs it references, since
// Vite's template keeps its real config in `tsconfig.app.json` behind `references`. Only a failed
// import reads it, so a project whose files are all there reads no tsconfig at all.
import { readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, join, resolve } from "node:path";

/** The packages whose tsconfig entry's `strict` reaches a `.env` file: the ones that read `.env`. */
const STRICT_PACKAGES = new Set(["motherload", "@motherload/env"]);

type Config = { extends?: unknown; references?: unknown; contentMappers?: unknown };

/** White space and comments up to the end of an object or array: what makes a comma before it a trailing one. */
const TRAILING = /(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*[}\]]/y;

/** JSONC as tsconfig is written: comments and trailing commas outside strings removed, then JSON. */
export function parseJsonc(text: string): unknown {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i++;
      out += text.slice(start, i + 1);
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      const end = text.indexOf("*/", i + 2);
      i = end === -1 ? text.length : end + 1;
      out += " ";
    } else if (c === ",") {
      TRAILING.lastIndex = i + 1;
      if (!TRAILING.test(text)) out += c;
    } else {
      out += c;
    }
  }
  return JSON.parse(out);
}

function readConfig(path: string): Config | undefined {
  try {
    const config = parseJsonc(readFileSync(path, "utf8").replace(/^﻿/, ""));
    return config && typeof config === "object" ? (config as Config) : undefined;
  } catch {
    return undefined;
  }
}

const isFile = (path: string) => statSync(path, { throwIfNoEntry: false })?.isFile() ?? false;

/**
 * The file an `extends` names, from the config at `from`: a path, with `.json` added when the path
 * as written is not a file, as TypeScript adds it; or a package's config, its `tsconfig.json` or a
 * file in it, which is all `require.resolve` finds without TypeScript's own resolver.
 */
function extended(name: string, from: string): string | undefined {
  if (name.startsWith(".") || isAbsolute(name)) {
    const path = resolve(dirname(from), name);
    return isFile(path) ? path : isFile(`${path}.json`) ? `${path}.json` : undefined;
  }
  const require = createRequire(from);
  for (const candidate of name.endsWith(".json") ? [name] : [`${name}/tsconfig.json`, `${name}.json`, name]) {
    try {
      return require.resolve(candidate);
    } catch {}
  }
  return undefined;
}

/** A config and every config it extends, each read once. */
function chain(path: string, seen = new Set<string>()): Config[] {
  if (seen.has(path)) return [];
  seen.add(path);
  const config = readConfig(path);
  if (!config) return [];
  const configs = [config];
  for (const name of [config.extends].flat()) {
    const file = typeof name === "string" ? extended(name, path) : undefined;
    if (file) configs.push(...chain(file, seen));
  }
  return configs;
}

/** The configs a config's `references` name, each a config file or a directory holding `tsconfig.json`. */
function referenced(config: Config, from: string): string[] {
  if (!Array.isArray(config.references)) return [];
  return config.references.flatMap((reference) => {
    const path = typeof reference?.path === "string" ? resolve(dirname(from), reference.path) : undefined;
    if (!path) return [];
    return isFile(path) ? [path] : isFile(join(path, "tsconfig.json")) ? [join(path, "tsconfig.json")] : [];
  });
}

/** The nearest `tsconfig.json` in `directory` or above it. */
function nearest(directory: string): string | undefined {
  for (let dir = resolve(directory); ; dir = dirname(dir)) {
    if (isFile(join(dir, "tsconfig.json"))) return join(dir, "tsconfig.json");
    if (dirname(dir) === dir) return undefined;
  }
}

/**
 * Whether a missing `.env` file imported from `directory` fails, as it does unless an entry of
 * `motherload` or `@motherload/env` in the project's tsconfig sets `"strict": false` in its
 * `options`: in the nearest `tsconfig.json`, a config it extends, or a config it references, one
 * level deep. No tsconfig, or no such entry, is strict.
 */
export function isStrict(directory: string): boolean {
  const root = nearest(directory);
  if (!root) return true;
  const configs = chain(root);
  for (const path of configs[0] ? referenced(configs[0], root) : []) configs.push(...chain(path));
  return !configs.some(
    (config) =>
      Array.isArray(config.contentMappers) &&
      config.contentMappers.some((entry) => STRICT_PACKAGES.has(entry?.package) && entry?.options?.strict === false),
  );
}
