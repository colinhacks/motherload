// The Jest transformer: `transform: { "\\.txt$": "@motherload/txt/jest" }` in Jest's config.
import { standalone, toJestTransformer } from "@motherload/core";
import { loader } from "./loader.ts";

export default toJestTransformer(standalone(loader));
