// The webpack loader, for webpack and Rspack, which take a loader for a file type:
//   module.rules: [{ test: /\.(toml|ya?ml|jsonc|json5|env|[ct]sv|txt|md)$/, use: "motherload/webpack" }]
// Next.js's Turbopack takes the same loader as motherload/turbopack.
import { toWebpackLoader } from "@motherload/core";
import { plugin } from "./plugin.ts";

export default toWebpackLoader(plugin);
