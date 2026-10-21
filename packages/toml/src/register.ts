// The preload: `node --import @motherload/toml/register`, nub's `preload` in nub.jsonc, or
// `bun --preload @motherload/toml/register`.
import { register, standalone } from "@motherload/core";
import { loader } from "./loader.ts";

await register(standalone(loader));
