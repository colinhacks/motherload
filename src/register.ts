// One preload: `node --import motherload/register`, nub's `preload` in nub.jsonc, and
// `bun --preload motherload/register` (the Bun branch is the template's, run by examples/bun).
import { register } from "@motherload/core";
import { plugin } from "./plugin.ts";

await register(plugin);
