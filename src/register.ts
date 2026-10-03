// One preload: `node --import motherload/register`, nub's `preload` in nub.jsonc, and
// `bun --preload motherload/register` (the Bun branch is the template's, not run in this repository).
import { plugin } from "./plugin.ts";
import { toBunPlugin, toNodeHooks } from "./universal.ts";

declare const Bun: undefined | { plugin(p: ReturnType<typeof toBunPlugin>): void };

if (typeof Bun !== "undefined") {
  Bun.plugin(toBunPlugin(plugin));
} else {
  const { registerHooks } = await import("node:module");
  registerHooks(toNodeHooks(plugin));
}
