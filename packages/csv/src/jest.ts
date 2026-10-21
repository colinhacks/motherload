// The Jest transformer: `transform: { "\\.[ct]sv$": "@motherload/csv/jest" }` in Jest's config.
import { standalone, toJestTransformer } from "@motherload/core";
import { loader } from "./loader.ts";

export default toJestTransformer(standalone(loader));
