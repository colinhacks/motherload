// A webpack loader, for webpack, Rspack and Next.js, which take a loader for a file type:
//   webpack, Rspack:  module.rules: [{ test: /\.ya?ml$/, use: "@motherload/yaml/webpack-loader" }]
//   Turbopack:        turbopack: { rules: { "*.{yaml,yml}": { loaders: ["@motherload/yaml/webpack-loader"], as: "*.js" } } }
import { standalone, toWebpackLoader } from "@motherload/core";
import { loader } from "./loader.ts";

export default toWebpackLoader(standalone(loader));
