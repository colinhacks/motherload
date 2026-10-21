// The preload: `node --import @motherload/json5/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/json5/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
