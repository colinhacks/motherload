// One preload for Node (`node --import universal-toml/register`), nub (`nub.jsonc` preload
// or `nub --import`) and Bun (`bun --preload universal-toml/register`).
import { plugin } from "./plugin.ts";
import { toBunPlugin, toNodeHooks } from "./universal.ts";

declare const Bun: undefined | { plugin(p: ReturnType<typeof toBunPlugin>): void };

if (typeof Bun !== "undefined") {
  Bun.plugin(toBunPlugin(plugin));
} else {
  const { registerHooks } = await import("node:module");
  registerHooks(toNodeHooks(plugin));
}
