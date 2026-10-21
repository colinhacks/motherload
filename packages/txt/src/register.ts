// The preload: `node --import @motherload/txt/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/txt/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
