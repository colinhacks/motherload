// The preload: `node --import @motherload/env/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/env/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
