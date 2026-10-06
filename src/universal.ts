// The loader contract and its projections onto each host, from the template in lab/universal
// (plugin/universal.ts). Two changes from the template: the checker's text comes from its own
// function, which may be asynchronous because only the content mapper calls it, and the mapper
// adapter converts positions to the UTF-8 bytes it declares in `initialize`.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Problem } from "./formats.ts";

export interface LoaderPlugin {
  /** Plugin name; also the content mapper's diagnostic source. */
  name: string;
  /** Every path the plugin loads. Bun and esbuild take only a RegExp, and esbuild's is RE2, so no lookaround. */
  filter: RegExp;
  /** JavaScript for runtimes and bundlers. Synchronous, because Node's `registerHooks` is. */
  load(source: string, path: string): { code: string; problems: Problem[] };
  /** TypeScript for the type checker. */
  types(source: string, path: string): Promise<{ types: string; problems: Problem[] }> | { types: string; problems: Problem[] };
}

function runtimeModule(plugin: LoaderPlugin, path: string): string {
  const result = plugin.load(readFileSync(path, "utf8"), path);
  if (result.problems.length) throw new Error(`${plugin.name}: ${path}: ${result.problems.map((p) => p.message).join("; ")}`);
  return result.code;
}

// ---- Node and nub: module.registerHooks ------------------------------------------------------

type NodeHooks = Parameters<typeof import("node:module").registerHooks>[0];

export function toNodeHooks(plugin: LoaderPlugin): NodeHooks {
  return {
    load(url, context, nextLoad) {
      if (!url.startsWith("file:")) return nextLoad(url, context);
      // A query or hash (`./app.toml?raw`) asks for something other than this module, which the
      // type check cannot see either (DESIGN.md, "How an import chooses"): leave it to the next hook.
      if (/[?#]/.test(url)) return nextLoad(url, context);
      const path = fileURLToPath(url);
      if (!plugin.filter.test(path)) return nextLoad(url, context);
      return { format: "module", source: runtimeModule(plugin, path), shortCircuit: true };
    },
  };
}

// ---- Bun runtime and Bun.build: Bun.plugin ---------------------------------------------------

type BunBuild = { onLoad(options: { filter: RegExp; namespace?: string }, callback: (args: { path: string }) => { loader: "js"; contents: string }): void };

export function toBunPlugin(plugin: LoaderPlugin): { name: string; setup(build: BunBuild): void } {
  return {
    name: plugin.name,
    setup(build) {
      // The filter must be exact: Bun's runtime throws when onLoad returns undefined (oven-sh/bun#5303).
      build.onLoad({ filter: plugin.filter }, (args) => ({ loader: "js", contents: runtimeModule(plugin, args.path) }));
    },
  };
}

// ---- esbuild ----------------------------------------------------------------------------------

type EsbuildBuild = { onLoad(options: { filter: RegExp; namespace?: string }, callback: (args: { path: string; suffix?: string }) => { contents: string; loader: "js" } | undefined): void };

export function toEsbuildPlugin(plugin: LoaderPlugin): { name: string; setup(build: EsbuildBuild): void } {
  return {
    name: plugin.name,
    setup(build) {
      // esbuild resolves `./app.toml?raw` to app.toml and keeps `?raw` in `suffix`; as in the Node hook, such an import is left to others.
      build.onLoad({ filter: plugin.filter, namespace: "file" }, (args) => (args.suffix ? undefined : { contents: runtimeModule(plugin, args.path), loader: "js" }));
    },
  };
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
      return { protocolVersion: protocolVersion ?? 1, positionEncoding: "utf-8", diagnosticSource: plugin.name };
    },
    openProject(params) {
      // motherload takes no options; a key in a tsconfig entry's `options` is a mistake worth showing.
      const { options } = (params ?? {}) as { options?: Record<string, unknown> | null };
      const optionDiagnostics = Object.keys(options ?? {}).map((key) => ({ path: [key], messageText: `Motherload takes no options; remove "${key}".`, code: 5 }));
      return { optionDiagnostics };
    },
    async transform(params) {
      const { fileName, content } = params as { fileName: string; content: string };
      const result = await plugin.types(content, fileName);
      return {
        extension: ".ts",
        text: result.types,
        diagnostics: result.problems.map((p) => ({ messageText: p.message, code: p.code, ...utf8Range(content, p.start, p.length) })),
      };
    },
    closeProject() {
      return {};
    },
  };
}
