import { createUnplugin } from "unplugin";
import { plugin } from "./plugin.ts";
import { toUnpluginOptions } from "./universal.ts";

export const universalToml = createUnplugin(() => toUnpluginOptions(plugin));
export const vite = universalToml.vite;
export const rollup = universalToml.rollup;
export const webpack = universalToml.webpack;
export const rspack = universalToml.rspack;
export const esbuild = universalToml.esbuild;
export const bun = universalToml.bun;
