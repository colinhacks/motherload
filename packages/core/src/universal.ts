// The loader contract and its projections onto each host, from the template in lab/universal
// (plugin/universal.ts). The changes from the template: the checker's text comes from its own
// function, which may be asynchronous because only the content mapper calls it; the mapper adapter
// converts positions to the UTF-8 bytes it declares in `initialize`; and a loader names the
// extensions it reads, so that of two Motherload packages in one host the one that claims the
// longer suffix of a file loads it, as TypeScript routes it, whatever order the host was given them
// in. The two global keys, `Symbol.for("motherload.registered")` and `Symbol.for("motherload.plugin")`,
// are the protocol: dotschema joins it through them to claim `.schema.jsonc` from `@motherload/jsonc`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Problem } from "./problems.ts";

export interface LoaderPlugin {
  /** The package's name, as `@motherload/toml`; also the esbuild plugin's name. */
  name: string;
  /** The extensions it reads, in the order its messages name them. */
  extensions: readonly string[];
  /** Every path the plugin loads. Bun and esbuild take only a RegExp, and esbuild's is RE2, so no lookaround. */
  filter: RegExp;
  /**
   * JavaScript for runtimes and bundlers. Synchronous, because Node's `registerHooks` is.
   * `watchFiles` are the other files the code was made from, if any, which a bundler
   * watches so that a change to one rebuilds the module.
   */
  load(source: string, path: string): { code: string; problems: Problem[]; watchFiles?: string[] };
  /** TypeScript for the type checker. */
  types(source: string, path: string): Promise<{ types: string; problems: Problem[] }> | { types: string; problems: Problem[] };
}

/** Every diagnostic is shown as `motherload<code>`, whichever Motherload package reports it. */
export const DIAGNOSTIC_SOURCE = "motherload";

/**
 * How strongly `plugin` claims `path`: the length of the longest of its extensions that ends the
 * path, 1 for a path its filter takes by name alone (`.env.local`), 0 for one it does not take.
 */
export function claim(plugin: LoaderPlugin, path: string): number {
  if (!plugin.filter.test(path)) return 0;
  return Math.max(1, ...plugin.extensions.filter((ext) => path.endsWith(ext)).map((ext) => ext.length));
}

/** The plugin that claims `path` the most strongly, the first of them on a tie. */
export function ownerOf(plugins: Iterable<LoaderPlugin>, path: string): LoaderPlugin | undefined {
  let owner: LoaderPlugin | undefined;
  let strength = 0;
  for (const plugin of plugins) {
    const c = claim(plugin, path);
    if (c > strength) [owner, strength] = [plugin, c];
  }
  return owner;
}

/** Whether another of `others` claims `path` more strongly than `plugin` does. */
const outranked = (plugin: LoaderPlugin, path: string, others: Iterable<LoaderPlugin>) => {
  const mine = claim(plugin, path);
  for (const other of others) if (other !== plugin && claim(other, path) > mine) return true;
  return false;
};

/** The Motherload plugins registered in this process: Node's and Bun's hooks are process-wide. */
const REGISTERED: Set<LoaderPlugin> = ((globalThis as Record<symbol, unknown>)[Symbol.for("motherload.registered")] ??= new Set()) as Set<LoaderPlugin>;

/** What a load error says: the plugin, the file and every problem. */
const loadError = (plugin: LoaderPlugin, path: string, problems: Problem[]) => `${plugin.name}: ${path}: ${problems.map((p) => p.message).join("; ")}`;

function runtimeModule(plugin: LoaderPlugin, path: string): string {
  const result = plugin.load(readFileSync(path, "utf8"), path);
  if (result.problems.length) throw new Error(loadError(plugin, path, result.problems));
  return result.code;
}

// ---- Node and nub: module.registerHooks ------------------------------------------------------

type NodeHooks = Parameters<typeof import("node:module").registerHooks>[0];

/** `registered` is every Motherload plugin in the process; a file one of them claims more strongly goes on to the next hook, which is that plugin's or reaches it. */
export function toNodeHooks(plugin: LoaderPlugin, registered: Iterable<LoaderPlugin> = REGISTERED): NodeHooks {
  return {
    load(url, context, nextLoad) {
      if (!url.startsWith("file:")) return nextLoad(url, context);
      const { search, hash } = new URL(url);
      const path = fileURLToPath(url.replace(/[?#].*$/, ""));
      if (!plugin.filter.test(path) || outranked(plugin, path, registered)) return nextLoad(url, context);
      // A query or hash asks for something this plugin does not make: leave it to the next hook.
      if (search || hash) return nextLoad(url, context);
      return { format: "module", source: runtimeModule(plugin, path), shortCircuit: true };
    },
  };
}

// ---- Bun runtime and Bun.build: Bun.plugin ---------------------------------------------------

type BunBuild = { onLoad(options: { filter: RegExp; namespace?: string }, callback: (args: { path: string }) => { loader: "js"; contents: string }): void };

export function toBunPlugin(plugin: LoaderPlugin, registered: Iterable<LoaderPlugin> = REGISTERED): { name: string; setup(build: BunBuild): void } {
  return {
    name: plugin.name,
    setup(build) {
      // The filter must be exact: Bun's runtime throws when onLoad returns undefined (oven-sh/bun#5303),
      // so a file another registered plugin claims more strongly is loaded with that plugin here.
      build.onLoad({ filter: plugin.filter }, (args) => ({ loader: "js", contents: runtimeModule(ownerOf([plugin, ...registered], args.path) ?? plugin, args.path) }));
    },
  };
}

/** The preload: the plugin's hooks for Node and nub, or its Bun plugin under Bun. */
export async function register(plugin: LoaderPlugin): Promise<void> {
  REGISTERED.add(plugin);
  const bun = (globalThis as { Bun?: { plugin(p: ReturnType<typeof toBunPlugin>): void } }).Bun;
  if (bun) {
    bun.plugin(toBunPlugin(plugin));
  } else {
    const { registerHooks } = await import("node:module");
    registerHooks(toNodeHooks(plugin));
  }
}

// ---- esbuild ----------------------------------------------------------------------------------

type EsbuildBuild = {
  initialOptions?: { plugins?: readonly unknown[] };
  onLoad(
    options: { filter: RegExp; namespace?: string },
    callback: (args: { path: string; suffix?: string }) => { contents: string; loader: "js"; watchFiles?: string[] } | { errors: { text: string }[]; watchFiles?: string[] } | undefined,
  ): void;
};

/** The Motherload plugin an esbuild plugin object was made from, so that plugins in one build can see each other. */
const PLUGIN = Symbol.for("motherload.plugin");

export function toEsbuildPlugin(plugin: LoaderPlugin): { name: string; setup(build: EsbuildBuild): void } {
  return {
    name: plugin.name,
    [PLUGIN]: plugin,
    setup(build) {
      const siblings = (build.initialOptions?.plugins ?? []).flatMap((p) => ((p as Record<symbol, unknown>)?.[PLUGIN] as LoaderPlugin | undefined) ?? []);
      // esbuild resolves `./app.toml?url` to app.toml and keeps `?url` in `suffix`; as in the Node
      // hook, a suffix is left to other plugins, as is a file another Motherload plugin in the
      // build claims more strongly.
      build.onLoad({ filter: plugin.filter, namespace: "file" }, (args) => {
        if (outranked(plugin, args.path, siblings)) return undefined;
        if (args.suffix) return undefined;
        // The files a module was made from are watched even when it fails, so fixing one rebuilds it.
        const result = plugin.load(readFileSync(args.path, "utf8"), args.path);
        const watchFiles = result.watchFiles ?? [];
        if (result.problems.length) return { errors: [{ text: loadError(plugin, args.path, result.problems) }], watchFiles };
        return { contents: result.code, loader: "js", watchFiles };
      });
    },
  } as { name: string; setup(build: EsbuildBuild): void };
}

// ---- TypeScript 7.1 content mapper ------------------------------------------------------------

/** A UTF-16 range of `source` as UTF-8 bytes. */
export function utf8Range(source: string, start: number, length: number): { start: number; length: number } {
  const before = Buffer.byteLength(source.slice(0, start), "utf8");
  const inside = Buffer.byteLength(source.slice(start, start + length), "utf8");
  return { start: before, length: Math.max(inside, 1) };
}

type MapperHandlers = Record<string, (params: unknown) => unknown>;

export function toMapperHandlers(plugin: LoaderPlugin): MapperHandlers {
  return {
    initialize(params) {
      // Builds from 2026-09-18 on send `protocolVersion: 1` and refuse a mapper that does not answer with it.
      const { protocolVersion } = (params ?? {}) as { protocolVersion?: number };
      return { protocolVersion: protocolVersion ?? 1, positionEncoding: "utf-8", diagnosticSource: DIAGNOSTIC_SOURCE };
    },
    openProject(params) {
      // Motherload takes no options; a key in a tsconfig entry's `options` is a mistake worth showing.
      const { options } = (params ?? {}) as { options?: Record<string, unknown> | null };
      const optionDiagnostics = Object.keys(options ?? {}).map((key) => ({ path: [key], messageText: `Motherload takes no options; remove "${key}".`, code: 5 }));
      return { optionDiagnostics };
    },
    async transform(params) {
      const { fileName, content } = params as { fileName: string; content: string };
      const result = await plugin.types(content, fileName);
      return {
        // An ES module whatever the nearest package.json says, as the preload and the plugins load it:
        // TypeScript takes a `.ts` module in a package with no "type" for CommonJS.
        extension: ".mts",
        text: result.types,
        diagnostics: result.problems.map((p) => ({ messageText: p.message, code: p.code, ...utf8Range(content, p.start, p.length) })),
      };
    },
    closeProject() {
      return {};
    },
  };
}
