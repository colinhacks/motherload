// The preload: `node --import @motherload/jsonc/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/jsonc/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
