// The universal plugin contract and its projections onto every host.
//
// One plugin object describes a file type once. Each `to*` function below turns it
// into what one host wants: a Node/nub `module.registerHooks` pair, a `Bun.plugin`,
// an esbuild plugin, an unplugin factory (Vite, Rollup, Rolldown, webpack, Rspack,
// Farm, Bun.build), and the JSON-RPC handlers of a TypeScript 7.1 content mapper.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export type Diagnostic = { messageText: string; start: number; length: number; code: number };

export type LoadResult = {
  /** JavaScript ES module source for the runtime and for bundlers. */
  code: string;
  /** TypeScript module source for the type checker. Optional: without it a wildcard `declare module "*.ext"` is the only type. */
  types?: string;
  /** Problems in the original file, positions in the original text. The checker shows them; runtimes throw. */
  diagnostics?: Diagnostic[];
};

export interface LoaderPlugin {
  /** Plugin name; also the content mapper's diagnostic source. */
  name: string;
  /** Extensions to claim, each starting with ".". This is the only unit TypeScript understands. */
  extensions: readonly string[];
  /** Optional narrower match on the absolute path (for example a fixed file name). Honoured by every runtime and bundler; not by TypeScript, which matches extensions only. */
  test?: RegExp;
  /** Turn file contents into a module. Synchronous, because Node's registerHooks and unloader are synchronous. */
  load(source: string, path: string): LoadResult;
}

export function matches(plugin: LoaderPlugin, path: string): boolean {
  if (!plugin.extensions.some((ext) => path.endsWith(ext))) return false;
  return plugin.test ? plugin.test.test(path) : true;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A RegExp for hosts whose only filter is a RegExp on the path (Bun, esbuild). Go's RE2 has no lookaround, so keep `test` simple. */
export function filterOf(plugin: LoaderPlugin): RegExp {
  return plugin.test ?? new RegExp(`(${plugin.extensions.map(escapeRegExp).join("|")})$`);
}

function runtimeModule(plugin: LoaderPlugin, path: string): string {
  const result = plugin.load(readFileSync(path, "utf8"), path);
  if (result.diagnostics?.length) {
    throw new Error(`${plugin.name}: ${path}: ${result.diagnostics.map((d) => d.messageText).join("; ")}`);
  }
  return result.code;
}

// ---- Node and nub: module.registerHooks ------------------------------------------------------

type NodeHooks = Parameters<typeof import("node:module").registerHooks>[0];

export function toNodeHooks(plugin: LoaderPlugin): NodeHooks {
  return {
    load(url, context, nextLoad) {
      if (!url.startsWith("file:")) return nextLoad(url, context);
      const path = fileURLToPath(url);
      if (!matches(plugin, path)) return nextLoad(url, context);
      return { format: "module", source: runtimeModule(plugin, path), shortCircuit: true };
    },
  };
}

// ---- Bun runtime and Bun.build: Bun.plugin ---------------------------------------------------

type BunBuild = { onLoad(options: { filter: RegExp; namespace?: string }, callback: (args: { path: string }) => { loader: string; contents: string }): void };

export function toBunPlugin(plugin: LoaderPlugin): { name: string; setup(build: BunBuild): void } {
  return {
    name: plugin.name,
    setup(build) {
      // The filter must be exact: Bun's runtime throws when onLoad returns undefined (oven-sh/bun#5303).
      build.onLoad({ filter: filterOf(plugin) }, (args) => ({ loader: "js", contents: runtimeModule(plugin, args.path) }));
    },
  };
}

// ---- esbuild ----------------------------------------------------------------------------------

type EsbuildBuild = { onLoad(options: { filter: RegExp; namespace?: string }, callback: (args: { path: string }) => { contents: string; loader: string }): void };

export function toEsbuildPlugin(plugin: LoaderPlugin): { name: string; setup(build: EsbuildBuild): void } {
  return {
    name: plugin.name,
    setup(build) {
      build.onLoad({ filter: filterOf(plugin), namespace: "file" }, (args) => ({ contents: runtimeModule(plugin, args.path), loader: "js" }));
    },
  };
}

// ---- unplugin: Vite, Rollup, Rolldown, webpack, Rspack, Rsbuild, Farm, Bun.build --------------

export function toUnpluginOptions(plugin: LoaderPlugin) {
  return {
    name: plugin.name,
    loadInclude: (id: string) => matches(plugin, id),
    load: (id: string) => runtimeModule(plugin, id),
  };
}

// ---- TypeScript 7.1 content mapper ------------------------------------------------------------

type MapperHandlers = Record<string, (params: unknown) => unknown>;

export function toMapperHandlers(plugin: LoaderPlugin): MapperHandlers {
  return {
    initialize(params) {
      const { protocolVersion } = (params ?? {}) as { protocolVersion?: number };
      return { protocolVersion: protocolVersion ?? 1, positionEncoding: "utf-8", diagnosticSource: plugin.name };
    },
    openProject() {
      return {};
    },
    transform(params) {
      const { fileName, content } = params as { fileName: string; content: string };
      // TypeScript routes every claimed extension here; the plugin's `test` cannot narrow that.
      // A file the plugin does not want becomes an empty module (no exports, no diagnostics).
      if (!matches(plugin, fileName)) return { extension: ".ts", text: "", diagnostics: [] };
      const result = plugin.load(content, fileName);
      return { extension: ".ts", text: result.types ?? "declare const data: unknown;\nexport default data;\n", diagnostics: result.diagnostics ?? [] };
    },
    closeProject() {
      return {};
    },
  };
}

// ---- webpack-style loader: Next.js Turbopack `turbopack.rules` and webpack `module.rules` ----

export function toWebpackLoader(plugin: LoaderPlugin): (this: { resourcePath: string }, source: string) => string {
  return function (source) {
    const result = plugin.load(source, this.resourcePath);
    if (result.diagnostics?.length) throw new Error(`${plugin.name}: ${this.resourcePath}: ${result.diagnostics.map((d) => d.messageText).join("; ")}`);
    return result.code;
  };
}
