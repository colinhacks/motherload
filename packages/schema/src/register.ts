// The preload: `node --import @motherload/schema/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/schema/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
