// The preload: `node --import @motherload/yaml/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/yaml/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
