// The Jest transformer: `transform: { "\\.(toml|ya?ml|jsonc|json5|env|[ct]sv|txt|md)$": "motherload/jest" }`
// in Jest's config.
import { toJestTransformer } from "@motherload/core";
import { plugin } from "./plugin.ts";

export default toJestTransformer(plugin);
