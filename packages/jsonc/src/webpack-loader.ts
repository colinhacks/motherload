// A webpack loader, for webpack, Rspack and Next.js, which take a loader for a file type:
//   webpack, Rspack:  module.rules: [{ test: /\.jsonc$/, use: "@motherload/jsonc/webpack-loader" }]
//   Turbopack:        turbopack: { rules: { "*.jsonc": { loaders: ["@motherload/jsonc/webpack-loader"], as: "*.js" } } }
import { standalone, toWebpackLoader } from "@motherload/core";
import { loader } from "./loader.ts";

export default toWebpackLoader(standalone(loader));
