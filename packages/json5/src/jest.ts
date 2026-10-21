// The Jest transformer: `transform: { "\\.json5$": "@motherload/json5/jest" }` in Jest's config.
import { standalone, toJestTransformer } from "@motherload/core";
import { loader } from "./loader.ts";

export default toJestTransformer(standalone(loader));
