// A webpack loader, for webpack, Rspack and Next.js, which take a loader for a file type:
//   webpack, Rspack:  module.rules: [{ test: /\.(toml|ya?ml|jsonc|json5|env|[ct]sv|txt|md)$/, use: "motherload/webpack-loader" }]
//   Turbopack:        turbopack: { rules: { "*.{toml,yaml,yml,jsonc,json5,csv,tsv,txt,md}": { loaders: ["motherload/webpack-loader"], as: "*.js" } } }
import { toWebpackLoader } from "@motherload/core";
import { plugin } from "./plugin.ts";

export default toWebpackLoader(plugin);
