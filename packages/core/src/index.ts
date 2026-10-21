// @motherload/core: what every Motherload package shares. The loader contract and its adapters
// (Node's hooks, Bun, esbuild, a webpack loader, a Vite plugin, a Jest transformer, the content
// mapper), the content mapper's JSON-RPC server, the serializer, and the pieces of a parsed file
// and its module.
export { claim, DIAGNOSTIC_SOURCE, ownerOf, register, toBunPlugin, toEsbuildPlugin, toMapperHandlers, toJestTransformer, toNodeHooks, toVitePlugin, toWebpackLoader, utf8Range, type LoaderPlugin } from "./universal.ts";
export { serve } from "./rpc.ts";
export { assertValue, literal, propertyName, toJs, UnsupportedValue, type Value } from "./serialize.ts";
export { BOM, carry, CODES, fail, offsetOf, type Parsed, type Problem } from "./problems.ts";
export { combine, FAILED_TYPES, moduleLoader, standalone, valueModule, type ModuleText } from "./module.ts";
