// The preload: `node --import @motherload/csv/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/csv/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
