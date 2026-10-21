// A webpack loader, for webpack, Rspack and Next.js, which take a loader for a file type:
//   webpack, Rspack:  module.rules: [{ test: /\.txt$/, use: "@motherload/txt/webpack-loader" }]
//   Turbopack:        turbopack: { rules: { "*.txt": { loaders: ["@motherload/txt/webpack-loader"], as: "*.js" } } }
import { standalone, toWebpackLoader } from "@motherload/core";
import { loader } from "./loader.ts";

export default toWebpackLoader(standalone(loader));
