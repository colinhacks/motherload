// The preload: `node --import @motherload/md/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/md/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
