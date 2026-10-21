// A webpack loader, for webpack, Rspack and Next.js, which take a loader for a file type:
//   webpack, Rspack:  module.rules: [{ test: /\.json5$/, use: "@motherload/json5/webpack-loader" }]
//   Turbopack:        turbopack: { rules: { "*.json5": { loaders: ["@motherload/json5/webpack-loader"], as: "*.js" } } }
import { standalone, toWebpackLoader } from "@motherload/core";
import { loader } from "./loader.ts";

export default toWebpackLoader(standalone(loader));
