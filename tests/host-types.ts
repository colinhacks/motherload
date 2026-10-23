// Not a test file: `nub run typecheck` checks that each host's own config type takes the Vite
// plugin, as a project's vite.config.ts, rollup.config.ts or rolldown.config.ts writes it.
import { defineConfig } from "vite";
import type { RollupOptions } from "rollup";
import type { RolldownOptions } from "rolldown";
import motherload from "../src/vite.ts";
import { withMotherload } from "../src/next.ts";

export const vite = defineConfig({ plugins: [motherload()] });
export const rollup: RollupOptions = { plugins: [motherload()] };
export const rolldown: RolldownOptions = { plugins: [motherload()] };

// And that withMotherload takes a Next.js config as next.config.ts writes it, with fields the
// wrapper does not name, at the top and inside the ones it does (src/next.ts, NextConfig). Next's
// own `NextConfig` type passing through it is checked by lab/nextjs's next.config.ts.
export const next = withMotherload({ reactStrictMode: true });
export const nextNested = withMotherload({ turbopack: { root: "/app" }, typescript: { tsconfigPath: "tsconfig.json" }, compiler: { removeConsole: true } });
// @ts-expect-error a field the wrapper reads still has its type checked
withMotherload({ typescript: { ignoreBuildErrors: "yes" } });
