// Not a test file: `nub run typecheck` checks that each host's own config type takes the Vite
// plugin, as a project's vite.config.ts, rollup.config.ts or rolldown.config.ts writes it.
import { defineConfig } from "vite";
import type { RollupOptions } from "rollup";
import type { RolldownOptions } from "rolldown";
import motherload from "../src/vite.ts";

export const vite = defineConfig({ plugins: [motherload()] });
export const rollup: RollupOptions = { plugins: [motherload()] };
export const rolldown: RolldownOptions = { plugins: [motherload()] };
